import {Prisma} from '@prisma/client';
import {adminUnavailable,invalidAdminOrigin} from '@/lib/admin-boundary';
import {readLimitedBody} from '@/lib/checklist-upload';
import {purchaseSchema} from '@/lib/purchases';
import {savePurchase} from '@/lib/purchase-service';
export async function POST(request:Request){
 if(adminUnavailable()||invalidAdminOrigin(request))return Response.json({error:'Acesso não autorizado.'},{status:403});
 let raw;try{raw=JSON.parse(await readLimitedBody(request,60000));}catch{return Response.json({error:'Dados inválidos.'},{status:400});}
 const parsed=purchaseSchema.safeParse(raw);if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message??'Confira os campos.'},{status:400});
 try{return Response.json(await savePurchase(parsed.data),{status:parsed.data.id?200:201});}catch(e){
  if(e instanceof Error&&e.message==='STALE'||e instanceof Prisma.PrismaClientKnownRequestError&&(e.code==='P2034'||e.code==='P2010'&&['40001','40P01'].includes(String(e.meta?.code))))return Response.json({error:'Registro alterado por outro atendimento. Atualize e confira antes de salvar.'},{status:409});
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return Response.json({error:'Pedido, SC ou cadastro já registrado. Atualize e confira os dados.'},{status:409});
  if(e instanceof Error&&e.message==='NOT_FOUND')return Response.json({error:'Compra não encontrada.'},{status:404});
  if(e instanceof Error&&e.constructor===Error&&e.message.length<500)return Response.json({error:e.message},{status:400});return Response.json({error:'Não foi possível salvar a compra.'},{status:503});
 }
}
