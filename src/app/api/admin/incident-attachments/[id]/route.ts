import {prisma} from '@/lib/prisma';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 if(process.env.NODE_ENV==='production'||process.env.ALLOW_DEV_ADMIN!=='true')return new Response('Acesso indisponível',{status:403});
 const file=await prisma.incidentAttachment.findUnique({where:{id:(await params).id}});
 if(!file)return new Response('Anexo não encontrado',{status:404});
 return new Response(new Uint8Array(file.content),{headers:{'Content-Type':file.mimeType,'Content-Disposition':`attachment; filename="anexo"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"sandbox; default-src 'none'"}});
}
