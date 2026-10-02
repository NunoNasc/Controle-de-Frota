import {Prisma} from '@prisma/client';
import {adminUnavailable,invalidAdminOrigin} from '@/lib/admin-boundary';
import {readLimitedBody} from '@/lib/checklist-upload';
import {alertUpdateSchema} from '@/lib/alerts';
import {updateAlert} from '@/lib/alert-service';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(adminUnavailable()||invalidAdminOrigin(request))return Response.json({error:'Acesso não autorizado.'},{status:403});
 let raw;try{raw=JSON.parse(await readLimitedBody(request,16000));}catch{return Response.json({error:'Dados inválidos.'},{status:400});}
 const parsed=alertUpdateSchema.safeParse(raw);if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message??'Confira os campos.'},{status:400});
 try{return Response.json(await updateAlert((await params).id,parsed.data));}catch(e){
  if(e instanceof Error&&e.message==='STALE'||e instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(e.code))return Response.json({error:'Alerta alterado por outro atendimento. Atualize antes de salvar.'},{status:409});
  if(e instanceof Error&&e.message==='NOT_FOUND')return Response.json({error:'Alerta não encontrado.'},{status:404});
  if(e instanceof Error&&e.constructor===Error)return Response.json({error:e.message},{status:400});return Response.json({error:'Não foi possível registrar o atendimento.'},{status:503});
 }
}
