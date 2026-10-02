import {NextRequest,NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {readLimitedBody} from '@/lib/checklist-upload';
import {incidentUpdateSchema} from '@/lib/incidents';
import {updateIncident} from '@/lib/incident-service';
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 if(process.env.NODE_ENV==='production'||process.env.ALLOW_DEV_ADMIN!=='true')return NextResponse.json({error:'Acesso administrativo indisponível.'},{status:403});
 const origins=new Set([new URL(process.env.APP_URL??'http://localhost:3000').origin,'http://127.0.0.1:3000','http://localhost:3000']);
 if(!origins.has(request.headers.get('origin')??''))return NextResponse.json({error:'Origem não autorizada.'},{status:403});
 let raw;try{raw=JSON.parse(await readLimitedBody(request,7_100_000));}catch{return NextResponse.json({error:'Dados inválidos ou anexo muito grande.'},{status:400});}
 const parsed=incidentUpdateSchema.safeParse(raw);
 if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??'Confira os campos.'},{status:400});
 try{return NextResponse.json(await updateIncident((await params).id,parsed.data));}
 catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2034'||error instanceof Error&&error.message==='STALE')return NextResponse.json({error:'A ocorrência foi alterada em outro atendimento. Atualize a página e confira antes de salvar.'},{status:409});
  if(error instanceof Error&&error.message==='NOT_FOUND')return NextResponse.json({error:'Ocorrência não encontrada.'},{status:404});
  if(error instanceof Error&&!(error instanceof Prisma.PrismaClientKnownRequestError)&&!(error instanceof Prisma.PrismaClientUnknownRequestError)&&error.message.length<250)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({error:'Não foi possível registrar o atendimento. Tente novamente.'},{status:503});
 }
}
