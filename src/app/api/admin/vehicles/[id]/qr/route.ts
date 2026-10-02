import {randomBytes} from 'node:crypto';
import {Prisma} from '@prisma/client';
import QRCode from 'qrcode';
import {prisma} from '@/lib/prisma';
import {adminUnavailable,invalidAdminOrigin} from '@/lib/admin-boundary';
import {readLimitedBody} from '@/lib/checklist-upload';
import {checklistQrUrl,qrLocalOnly,qrRotationSchema,rotateVehicleQr} from '@/lib/vehicle-qr';
import {vehicleQrPdf,vehicleQrPrintHtml} from '@/lib/vehicle-qr-label';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store, max-age=0','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Cross-Origin-Resource-Policy':'same-origin'};
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 if(adminUnavailable()||request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Acesso não autorizado.'},{status:403,headers});
 const v=await prisma.vehicle.findUnique({where:{id:(await params).id}});if(!v)return Response.json({error:'Veículo não encontrado.'},{status:404,headers});
 const query=new URL(request.url).searchParams;
 if(query.has('revision')&&query.get('revision')!==String(v.qrRevision))return Response.json({error:'QR Code atualizado. Recarregue a ficha antes de imprimir.'},{status:409,headers});
 try{const url=checklistQrUrl(v.qrToken),format=query.get('format');
  if(format==='pdf'){const bytes=await vehicleQrPdf(v,url,query.get('size')==='a4'?'a4':'label');return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="checklist-${v.plate}-${query.get('size')==='a4'?'a4':'etiqueta'}.pdf"`}});}
  if(format==='print'){const nonce=randomBytes(16).toString('hex');return new Response(await vehicleQrPrintHtml(v,url,nonce),{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; img-src data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`}});}
  return Response.json({url,image:await QRCode.toDataURL(url,{width:640,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}}),revision:v.qrRevision,localOnly:qrLocalOnly(url)}, {headers});
 }catch{return Response.json({error:'Não foi possível gerar a etiqueta. Confira o endereço de acesso configurado para os motoristas.'},{status:503,headers});}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(adminUnavailable()||invalidAdminOrigin(request))return Response.json({error:'Acesso não autorizado.'},{status:403,headers});
 let raw;try{raw=JSON.parse(await readLimitedBody(request,8000));}catch{return Response.json({error:'Dados inválidos.'},{status:400,headers});}
 const parsed=qrRotationSchema.safeParse(raw);if(!parsed.success)return Response.json({error:'Informe responsável, motivo e confirme a invalidação das etiquetas antigas.'},{status:400,headers});
 try{return Response.json(await rotateVehicleQr((await params).id,parsed.data),{headers});}catch(e){if(e instanceof Error&&e.message==='NOT_FOUND')return Response.json({error:'Veículo não encontrado.'},{status:404,headers});if(e instanceof Error&&e.message==='STALE'||e instanceof Prisma.PrismaClientKnownRequestError&&(['P2034','P2002'].includes(e.code)||e.code==='P2010'&&['40001','40P01'].includes(String(e.meta?.code))))return Response.json({error:'O QR Code foi alterado por outro atendimento. Atualize a ficha.'},{status:409,headers});return Response.json({error:'Não foi possível regenerar o QR Code.'},{status:503,headers});}
}
