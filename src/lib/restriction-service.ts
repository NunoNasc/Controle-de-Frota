import {Prisma} from '@prisma/client';
import type {z} from 'zod';
import {prisma} from './prisma';
import {decodeIncidentAttachment} from './incidents';
import {restrictionDecisionSchema,restrictionLabels,validateRestrictionDecision} from './restrictions';
export async function decideRestriction(id:string,input:z.infer<typeof restrictionDecisionSchema>){
 const content=input.attachment?decodeIncidentAttachment(input.attachment):null;
 return prisma.$transaction(async tx=>{
  const record=await tx.vehicleRestriction.findUnique({where:{id}});if(!record)throw new Error('NOT_FOUND');
  // All restriction decisions serialize on their vehicle, including simultaneous restrictions.
  await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id=${record.vehicleId} FOR UPDATE`;
  validateRestrictionDecision(record,input);
  const vehicle=await tx.vehicle.findUniqueOrThrow({where:{id:record.vehicleId}});
  const remaining=await tx.vehicleRestriction.count({where:{vehicleId:record.vehicleId,id:{not:id},state:{not:'RELEASED'}}});
  if(input.decision==='RELEASED'&&!remaining&&input.postReleaseStatus==='AVAILABLE'){
   if(!vehicle.active||vehicle.status==='INACTIVE')throw new Error('Veículo inativo não pode ser disponibilizado.');
   if(await tx.maintenance.count({where:{vehicleId:vehicle.id,status:{in:['OPEN','IN_PROGRESS']}}}))throw new Error('Há manutenção aberta para este veículo. Registre a liberação mantendo-o em manutenção ou conclua a manutenção antes de disponibilizá-lo.');
  }
  const actor=`${input.operatorName} · ${input.operatorId} (identificação autodeclarada)`;
  await tx.$queryRaw`SELECT set_config('fleet.actor',${actor},true),set_config('fleet.solution',${input.solution},true),set_config('fleet.notes',${input.notes},true),set_config('fleet.reason',${input.notes},true),set_config('fleet.post_release_status',${input.postReleaseStatus},true)`;
  const updated=await tx.vehicleRestriction.updateMany({where:{id,revision:input.revision,state:{not:'RELEASED'}},data:{state:input.decision}});
  if(updated.count!==1)throw new Error('STALE');
  const event=await tx.restrictionEvent.findFirstOrThrow({where:{restrictionId:id,after:{path:['revision'],equals:input.revision+1}}});
  if(content&&input.attachment)await tx.restrictionEvidence.create({data:{eventId:event.id,content,fileName:input.attachment.fileName.replace(/[\x00-\x1f\\/]/g,'_'),mimeType:input.attachment.mimeType,sizeBytes:content.length}});
  const current=await tx.vehicle.findUniqueOrThrow({where:{id:vehicle.id}});
  if(record.incidentId){
   const incidentStillRestricted=await tx.vehicleRestriction.count({where:{incidentId:record.incidentId,state:{not:'RELEASED'}}});
   await tx.incident.update({where:{id:record.incidentId},data:{vehicleBlocked:incidentStillRestricted>0}});
   await tx.incidentEvent.create({data:{incidentId:record.incidentId,actor,kind:'RESTRICTION',note:`${restrictionLabels[input.decision]}: ${input.notes}`,after:{restrictionId:id,eventId:event.id,decision:input.decision,solution:input.solution,remainingRestrictions:remaining,vehicleStatus:current.status,operationalStatus:current.operationalStatus}}});
  }
  return {revision:input.revision+1,operationalStatus:current.operationalStatus,remainingRestrictions:input.decision==='RELEASED'?remaining:remaining+1};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});
}
