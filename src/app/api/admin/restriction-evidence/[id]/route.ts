import {prisma} from '@/lib/prisma';
import {adminUnavailable} from '@/lib/admin-boundary';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 if(adminUnavailable())return new Response('Acesso indisponível',{status:403});
 const file=await prisma.restrictionEvidence.findUnique({where:{id:(await params).id}});if(!file)return new Response('Evidência não encontrada',{status:404});
 return new Response(new Uint8Array(file.content),{headers:{'Content-Type':file.mimeType,'Content-Disposition':`attachment; filename="evidencia"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
}
