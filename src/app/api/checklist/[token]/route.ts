import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { processChecklistCriticality } from '@/lib/process-checklist-criticality';
import { summarizeAnswers } from '@/lib/checklist';
import { driverPayloadSchema, createDriverInspectionSchema } from '@/lib/driver-inspection';
import { getVehicleInspection } from '@/lib/checklist-config';
import { checklistSubmissionWhere } from '@/lib/vehicle-checklist-link';
import { decodeChecklistPhoto, readLimitedBody } from '@/lib/checklist-upload';
import {recordMileage} from '@/lib/mileage';
import {syncPreventiveAlert} from '@/lib/preventive-alerts';
import {mileageConcern} from '@/lib/mileage-validation';
class MileageConfirmationRequired extends Error {
  constructor(public previousMileage:number) { super('MILEAGE_CONFIRMATION'); }
}
export const runtime = 'nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{token:string}>}) {
  const origin = request.headers.get('origin');
  const allowedOrigins = new Set([new URL(process.env.APP_URL ?? 'http://localhost:3000').origin]);
  if (process.env.NODE_ENV !== 'production') {allowedOrigins.add('http://127.0.0.1:3000');allowedOrigins.add('http://localhost:3000');}
  if (!origin || !allowedOrigins.has(origin)) return NextResponse.json({error:'Origem não autorizada.'},{status:403});
  const {token} = await params; const where=checklistSubmissionWhere(token);
  if (!where) return NextResponse.json({error:'Veículo não encontrado.'},{status:404});
  let raw:string;
  try {raw=await readLimitedBody(request,30_000_000);} catch {return NextResponse.json({error:'Fotos excedem o limite de envio. Reduza as imagens e tente novamente.'},{status:413});}
  let input; try {input=driverPayloadSchema.safeParse(JSON.parse(raw));} catch {return NextResponse.json({error:'Formulário inválido.'},{status:400});}
  if (!input.success) return NextResponse.json({error:'Confira sua identificação, quilometragem e respostas.'},{status:400});
  const payload=input.data;
  try {
    const photos = new Map(payload.answers.filter(a=>a.photo).map(a=>[a.item,decodeChecklistPhoto(a.photo!)]));
    const result=await prisma.$transaction(async tx=>{
      // Serialize rotation with submissions: an old credential cannot write after revocation commits.
      await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE "qrToken"=${token} FOR UPDATE`;
      const vehicle=await tx.vehicle.findUnique({where});
      if (!vehicle || !vehicle.active || vehicle.status==='INACTIVE') throw new Error('NOT_FOUND');
      const existing=await tx.checklist.findUnique({where:{submissionKey:payload.submissionKey}});
      if(existing){if(existing.vehicleId!==vehicle.id)throw new Error('INVALID_KEY');const reading=await tx.mileageReading.findUnique({where:{checklistId:existing.id}});return {...existing,mileageWarning:reading?.accepted===false,operationalStatus:vehicle.operationalStatus};}
      if(mileageConcern(payload.mileage,vehicle.mileage) && payload.mileageConfirmedAgainst!==vehicle.mileage)throw new MileageConfirmationRequired(vehicle.mileage!);
      const config=await getVehicleInspection(tx,vehicle);
      if(config.version!==payload.configVersion)throw new Error('CONFIG_CHANGED');
      if(!createDriverInspectionSchema(config.items).safeParse(payload).success)throw new Error('ANSWERS');
      const inspectionItems=config.items;
      const driver=await tx.driver.findUnique({where:{employeeId:payload.driverIdentification}});
      if(driver && (!driver.active || driver.status!=='ACTIVE'))throw new Error('DRIVER');
      const checklist=await tx.checklist.create({data:{
        vehicleId:vehicle.id,driverId:driver?.id,driverName:driver?.name ?? payload.driverIdentification,driverIdentification:payload.driverIdentification,
        mileage:payload.mileage,submissionKey:payload.submissionKey,configVersion:config.version,type:'PRE_TRIP',status:'SUBMITTED',...summarizeAnswers(payload.answers),
        answers:{create:payload.answers.map(a=>{
          const definition=inspectionItems.find(i=>i.id===a.item)!;const content=photos.get(a.item);
          return {item:a.item,configItemId:definition.id,itemLabel:definition.label,categoryLabel:definition.group,requiresPhoto:definition.requiresPhoto,incidentRule:definition.generatesIncident,blocksVehicle:definition.blocksVehicle,allowsNotApplicable:definition.allowsNotApplicable,answer:a.answer,problemType:a.problemType,notes:a.notes,category:definition.category,priority:definition.priority,generatesIncident:a.answer==='ISSUE'&&definition.generatesIncident,
            ...(content ? {photos:{create:{fileName:`${a.item}.jpg`,storageKey:`postgres:${crypto.randomUUID()}`,mimeType:'image/jpeg',sizeBytes:content.byteLength,content,description:`${definition.label}: ${a.problemType}`}}} : {})};
        })},
      },include:{answers:true}});
      const reading=await recordMileage(tx,{vehicleId:vehicle.id,mileage:payload.mileage,checklistId:checklist.id,source:'CHECKLIST',actor:payload.driverIdentification});
      const plan=await tx.preventivePlan.findUnique({where:{vehicleId:vehicle.id}});
      if(plan)await syncPreventiveAlert(tx,plan,reading.accepted?reading.mileage:reading.previousMileage,vehicle.active);
      await processChecklistCriticality(tx,checklist,vehicle,inspectionItems);
      return {...checklist,mileageWarning:!reading.accepted,operationalStatus:(await tx.vehicle.findUniqueOrThrow({where:{id:vehicle.id},select:{operationalStatus:true}})).operationalStatus};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});
    return NextResponse.json({id:result.id,submittedAt:result.submittedAt,mileageWarning:result.mileageWarning,operationalStatus:result.operationalStatus},{status:201});
  } catch(e){
    if(e instanceof MileageConfirmationRequired)return NextResponse.json({code:'MILEAGE_CONFIRMATION',previousMileage:e.previousMileage,error:'Confira o hodômetro e confirme a leitura diferente do último registro.'},{status:400});
    const message=e instanceof Error ? e.message : '';
    if(message==='CONFIG_CHANGED')return NextResponse.json({code:'CONFIG_CHANGED',error:'A configuração deste checklist foi atualizada. Recarregue para conferir os itens atuais.'},{status:409});
    if(message==='ANSWERS')return NextResponse.json({error:'Confira todos os itens, os tipos de problema e as fotos exigidas.'},{status:400});
    if(message==='NOT_FOUND')return NextResponse.json({error:'Veículo não encontrado ou inativo.'},{status:404});
    if(message==='DRIVER')return NextResponse.json({error:'Matrícula indisponível. Entre em contato com a Frota.'},{status:400});
    if(message==='PHOTO')return NextResponse.json({error:'Foto inválida. Tire uma nova foto do problema.'},{status:400});
    if(message==='INVALID_KEY')return NextResponse.json({error:'Identificador de envio inválido.'},{status:400});
    if(e instanceof Prisma.PrismaClientKnownRequestError && (['P2034','P2002'].includes(e.code)||e.code==='P2010'&&['40001','40P01'].includes(String(e.meta?.code))))return NextResponse.json({error:'Há outro envio em processamento. Aguarde e tente novamente.'},{status:409});
    console.error('Falha ao persistir checklist',e instanceof Error ? e.name : 'unknown');
    return NextResponse.json({error:'Não foi possível confirmar o envio. Tente novamente; não haverá duplicação.'},{status:503});
  }
}
