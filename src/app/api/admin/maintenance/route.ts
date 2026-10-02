import {Prisma} from '@prisma/client';
import {adminUnavailable,invalidAdminOrigin} from '@/lib/admin-boundary';
import {readLimitedBody} from '@/lib/checklist-upload';
import {maintenanceSchema} from '@/lib/maintenance';
import {saveMaintenance} from '@/lib/maintenance-service';
export async function POST(request:Request){
 if(adminUnavailable()||invalidAdminOrigin(request))return Response.json({error:'Acesso não autorizado.'},{status:403});
 let raw;try{raw=JSON.parse(await readLimitedBody(request,30000));}catch{return Response.json({error:'Dados inválidos.'},{status:400});}
 const parsed=maintenanceSchema.safeParse(raw);if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message??'Confira os campos.'},{status:400});
 try{return Response.json(await saveMaintenance(parsed.data),{status:parsed.data.id?200:201});}catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&(error.code==='P2034'||error.code==='P2010'&&['40001','40P01'].includes(String(error.meta?.code)))||error instanceof Error&&error.message==='STALE')return Response.json({error:'Registro alterado em outro atendimento. Atualize antes de salvar.'},{status:409});
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return Response.json({error:'OS ou envio já registrado. Confira antes de tentar novamente.'},{status:409});
  if(error instanceof Error&&error.message==='NOT_FOUND')return Response.json({error:'Manutenção não encontrada.'},{status:404});
  if(error instanceof Error&&error.constructor===Error&&error.message.length<300)return Response.json({error:error.message},{status:400});
  return Response.json({error:'Não foi possível salvar. Nenhuma alteração foi confirmada.'},{status:503});
 }
}
