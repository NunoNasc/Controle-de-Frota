import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {prisma} from './prisma';
export const qrRotationSchema=z.object({revision:z.number().int().nonnegative(),operatorName:z.string().trim().min(3).max(100),operatorId:z.string().trim().min(1).max(60),reason:z.string().trim().min(5).max(1000),acknowledged:z.literal(true)}).strict();
export const qrFingerprint=(token:string)=>createHash('sha256').update(token).digest('hex');
export function checklistQrUrl(token:string,base=process.env.APP_URL??'http://localhost:3000'){
 const url=new URL(base);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('APP_URL deve conter somente a origem HTTP/HTTPS da aplicação.');
 return new URL(`/checklist/${token}`,url).href;
}
export function qrLocalOnly(url:string){const host=new URL(url).hostname;return ['localhost','127.0.0.1','[::1]'].includes(host);}
export async function rotateVehicleQr(id:string,input:z.infer<typeof qrRotationSchema>){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id=${id} FOR UPDATE`;
  const v=await tx.vehicle.findUnique({where:{id}});if(!v)throw new Error('NOT_FOUND');if(v.qrRevision!==input.revision)throw new Error('STALE');
  const token=randomBytes(32).toString('hex'),now=new Date();
  await tx.vehicle.update({where:{id},data:{qrToken:token,qrRevision:{increment:1},qrRotatedAt:now}});
  await tx.vehicleQrEvent.create({data:{vehicleId:id,actor:`${input.operatorName} · ${input.operatorId} (identificação autodeclarada)`,reason:input.reason,previousFingerprint:qrFingerprint(v.qrToken),nextFingerprint:qrFingerprint(token),createdAt:now}});
  return {revision:v.qrRevision+1};
 },{isolationLevel:'Serializable',timeout:20000});
}
