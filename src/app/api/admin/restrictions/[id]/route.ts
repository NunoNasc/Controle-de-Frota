import {Prisma} from '@prisma/client';
import {adminUnavailable,invalidAdminOrigin} from '@/lib/admin-boundary';
import {readLimitedBody} from '@/lib/checklist-upload';
import {restrictionDecisionSchema} from '@/lib/restrictions';
import {decideRestriction} from '@/lib/restriction-service';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(adminUnavailable()||invalidAdminOrigin(request))return Response.json({error:'Acesso não autorizado.'},{status:403});
 let raw;try{raw=JSON.parse(await readLimitedBody(request,7_100_000));}catch{return Response.json({error:'Dados inválidos ou muito grandes.'},{status:400});}
 const parsed=restrictionDecisionSchema.safeParse(raw);if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message??'Confira os campos.'},{status:400});
 try{return Response.json(await decideRestriction((await params).id,parsed.data));}catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&(error.code==='P2034'||error.code==='P2010'&&['40001','40P01'].includes(String(error.meta?.code)))||error instanceof Error&&error.message==='STALE')return Response.json({error:'O veículo ou a restrição foi alterado. Atualize a página antes de decidir.'},{status:409});
  if(error instanceof Error&&error.message==='NOT_FOUND')return Response.json({error:'Restrição não encontrada.'},{status:404});
  if(error instanceof Error&&error.constructor===Error&&error.message.length<300)return Response.json({error:error.message},{status:400});
  return Response.json({error:'Não foi possível registrar a decisão. Nenhuma alteração foi confirmada.'},{status:503});
 }
}
