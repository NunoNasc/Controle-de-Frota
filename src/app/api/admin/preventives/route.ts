import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import {adminUnavailable,invalidAdminOrigin} from '@/lib/admin-boundary';
import {readLimitedBody} from '@/lib/checklist-upload';
import {preventiveSchema,nextPreventiveMileage} from '@/lib/preventive';
import {recordMileage} from '@/lib/mileage';
import {syncPreventiveAlert} from '@/lib/preventive-alerts';
export async function POST(request:Request){
 if(adminUnavailable()||invalidAdminOrigin(request))return Response.json({error:'Acesso não autorizado.'},{status:403});
 let raw;try{raw=JSON.parse(await readLimitedBody(request,16000));}catch{return Response.json({error:'Dados inválidos.'},{status:400});}
 const parsed=preventiveSchema.safeParse(raw);if(!parsed.success)return Response.json({error:'Confira os campos obrigatórios, datas e valores inteiros.'},{status:400});
 const input=parsed.data;
 try{await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id=${input.vehicleId} FOR UPDATE`;
  const v=await tx.vehicle.findUnique({where:{id:input.vehicleId}});if(!v)throw new Error('Veículo não encontrado.');
  const old=await tx.preventivePlan.findUnique({where:{vehicleId:v.id}});if((old?.revision??null)!==input.revision)throw new Error('STALE');
  if(v.mileage!==null&&input.mileage!==null&&input.mileage<v.mileage)throw new Error('O KM atual não pode ser reduzido. Atualize a tela para conferir novas leituras.');
  const current=input.mileage??v.mileage,nextMileage=nextPreventiveMileage(input.lastMileage,input.intervalKm,input.nextMileage);
  if(nextMileage===null&&!input.dueAt)throw new Error('Informe o KM da última preventiva, o próximo KM ou uma data prevista.');
  if(nextMileage!==null&&nextMileage>9999999)throw new Error('O próximo KM excede o limite permitido.');
  if(input.lastMileage!==null&&current!==null&&input.lastMileage>current)throw new Error('O KM da última preventiva não pode superar o KM atual.');
  const date=(d:string|null)=>d?new Date(`${d}T00:00:00-03:00`):null;
  if(input.lastAt&&date(input.lastAt)!>new Date())throw new Error('A última preventiva não pode estar no futuro.');
  if(input.lastAt&&input.dueAt&&input.dueAt<input.lastAt)throw new Error('A data prevista não pode ser anterior à última preventiva.');
  const actor=`${input.operatorName} · ${input.operatorId} (identificação autodeclarada)`;
  if(input.mileage!==null&&input.mileage!==v.mileage)await recordMileage(tx,{vehicleId:v.id,mileage:input.mileage,source:'ADMIN',actor});
  const data={intervalKm:input.intervalKm,lastMileage:input.lastMileage,nextMileage,lastAt:date(input.lastAt),dueAt:date(input.dueAt),toleranceKm:input.toleranceKm,toleranceDays:input.toleranceDays,upcomingKm:input.upcomingKm,upcomingDays:input.upcomingDays};
  const plan=old?await tx.preventivePlan.update({where:{id:old.id},data:{...data,revision:{increment:1}}}):await tx.preventivePlan.create({data:{...data,vehicleId:v.id}});
  await tx.preventivePlanEvent.create({data:{planId:plan.id,actor,note:input.note,before:old?JSON.parse(JSON.stringify(old)):Prisma.DbNull,after:JSON.parse(JSON.stringify(plan))}});
  await tx.vehicle.update({where:{id:v.id},data:{lastPreventiveAt:plan.lastAt,nextPreventiveAt:plan.dueAt,nextPreventiveMileage:plan.nextMileage}});
  await syncPreventiveAlert(tx,plan,current,v.active);
 },{isolationLevel:'Serializable',timeout:20000});return Response.json({ok:true});
 }catch(e){if(e instanceof Error&&e.message==='STALE'||e instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002','P2010'].includes(e.code))return Response.json({error:'Registro alterado por outro atendimento. Atualize e confira antes de salvar.'},{status:409});
 if(e instanceof Error&&e.constructor===Error)return Response.json({error:e.message},{status:400});return Response.json({error:'Não foi possível salvar. Nenhuma alteração confirmada.'},{status:503});}
}
