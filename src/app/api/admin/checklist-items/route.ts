import {NextRequest,NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import {configItemSchema} from '@/lib/checklist-config-validation';
import {vehicleChecklistType} from '@/lib/checklist-config';
import {readLimitedBody} from '@/lib/checklist-upload';
export async function POST(request:NextRequest){
 // Match the existing administrative boundary even if this handler is invoked without the proxy.
 if(process.env.NODE_ENV==='production'||process.env.ALLOW_DEV_ADMIN!=='true')return NextResponse.json({error:'Acesso administrativo indisponível.'},{status:403});
 const origins=new Set([new URL(process.env.APP_URL??'http://localhost:3000').origin,'http://127.0.0.1:3000','http://localhost:3000']);
 if(!origins.has(request.headers.get('origin')??''))return NextResponse.json({error:'Origem não autorizada.'},{status:403});
 let raw;try{raw=JSON.parse(await readLimitedBody(request,16000));}catch{return NextResponse.json({error:'Dados inválidos ou muito grandes.'},{status:400});}
 const parsed=configItemSchema.safeParse(raw);if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??'Confira os campos.'},{status:400});
 const {id,updatedAt,...data}=parsed.data;
 try{
  const item=await prisma.$transaction(async tx=>{
   const [category,vehicles,existing]=await Promise.all([tx.checklistCategory.findUnique({where:{id:data.categoryId}}),tx.vehicle.findMany({select:{profile:true,category:true}}),id?tx.checklistItemConfig.findUnique({where:{id}}):null]);
   if(!category)throw new Error('CATEGORY');
   const known=new Set([...vehicles.map(vehicleChecklistType),...(existing?.vehicleTypes??[])]);
   if(data.vehicleTypes.some(t=>!known.has(t)))throw new Error('TYPE');
   if(id){if(!existing)throw new Error('NOT_FOUND');if(existing.updatedAt.toISOString()!==updatedAt)throw new Error('STALE');return tx.checklistItemConfig.update({where:{id},data});}
   if(await tx.checklistItemConfig.count()>=100)throw new Error('LIMIT');
   return tx.checklistItemConfig.create({data});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  return NextResponse.json({id:item.id});
 }catch(e){
  const code=e instanceof Error?e.message:'';
  if(code==='STALE'||e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2034')return NextResponse.json({error:'Este cadastro foi alterado. Atualize a página antes de salvar.'},{status:409});
  if(['CATEGORY','TYPE','NOT_FOUND','LIMIT'].includes(code))return NextResponse.json({error:code==='LIMIT'?'Limite de 100 itens atingido.':'Categoria, tipo de veículo ou item inválido.'},{status:400});
  return NextResponse.json({error:'Não foi possível salvar. Tente novamente.'},{status:503});
 }
}
