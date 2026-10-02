import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {adminUnavailable,invalidAdminOrigin} from '@/lib/admin-boundary';
import {readLimitedBody} from '@/lib/checklist-upload';
import {restrictionActorSchema,restrictionPolicySchema,restrictionPolicyKey,parseRestrictionPolicy} from '@/lib/restrictions';
const schema=restrictionActorSchema.extend({updatedAt:z.iso.datetime(),policy:restrictionPolicySchema}).strict();
export async function PUT(request:Request){
 if(adminUnavailable()||invalidAdminOrigin(request))return Response.json({error:'Acesso não autorizado.'},{status:403});
 let raw;try{raw=JSON.parse(await readLimitedBody(request,10000));}catch{return Response.json({error:'Dados inválidos.'},{status:400});}
 const parsed=schema.safeParse(raw);if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message??'Confira os campos.'},{status:400});
 try{await prisma.$transaction(async tx=>{
  const current=await tx.setting.findUniqueOrThrow({where:{key:restrictionPolicyKey}});
  if(current.updatedAt.toISOString()!==parsed.data.updatedAt)throw new Error('STALE');
  await tx.setting.update({where:{key:restrictionPolicyKey},data:{value:parsed.data.policy}});
  await tx.restrictionPolicyEvent.create({data:{actor:`${parsed.data.operatorName} · ${parsed.data.operatorId} (identificação autodeclarada)`,before:parseRestrictionPolicy(current.value),after:parsed.data.policy}});
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});return Response.json({saved:true});}
 catch(error){if(error instanceof Error&&error.message==='STALE'||error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2034')return Response.json({error:'Configuração alterada. Atualize a página.'},{status:409});return Response.json({error:'Não foi possível salvar.'},{status:503});}
}
