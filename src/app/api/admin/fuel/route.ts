import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import {adminUnavailable,invalidAdminOrigin} from '@/lib/admin-boundary';
import {readLimitedBody} from '@/lib/checklist-upload';
import {fuelSchema} from '@/lib/vehicle-record';
export async function POST(request:Request){
 if(adminUnavailable()||invalidAdminOrigin(request))return Response.json({error:'Acesso não autorizado.'},{status:403});
 let raw;try{raw=JSON.parse(await readLimitedBody(request,16000));}catch{return Response.json({error:'Dados inválidos.'},{status:400});}
 const p=fuelSchema.safeParse(raw);if(!p.success)return Response.json({error:'Confira os campos obrigatórios e valores (litros: até 3 casas; valor: até 2 casas).'}, {status:400});
 if(new Date(p.data.fueledAt)>new Date())return Response.json({error:'A data de abastecimento não pode estar no futuro.'},{status:400});
 const {operatorName,operatorId,...input}=p.data;
 try{const result=await prisma.$transaction(async tx=>{
  const existing=await tx.fuelRecord.findUnique({where:{submissionKey:input.submissionKey}});if(existing){if(existing.vehicleId!==input.vehicleId)throw new Error('Identificador de envio já utilizado.');return existing;}
  const vehicle=await tx.vehicle.findUnique({where:{id:input.vehicleId}});if(!vehicle)throw new Error('Veículo não encontrado.');
  return tx.fuelRecord.create({data:{...input,fueledAt:new Date(input.fueledAt),actor:`${operatorName} · ${operatorId} (identificação autodeclarada)`}});
 },{isolationLevel:'Serializable'});return Response.json({id:result.id},{status:201});
 }catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(e.code))return Response.json({error:'Há outro envio em processamento. Tente novamente.'},{status:409});if(e instanceof Error&&e.constructor===Error)return Response.json({error:e.message},{status:400});return Response.json({error:'Não foi possível registrar o abastecimento.'},{status:503});}
}
