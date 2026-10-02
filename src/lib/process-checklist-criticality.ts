import type {Prisma,Vehicle,Checklist,ChecklistAnswer} from '@prisma/client';
import type {InspectionItem} from './driver-inspection';
import {CRITICALITY_ENGINE_VERSION,evaluateNegativeAnswer} from './criticality-engine';
import {parseRestrictionPolicy,restrictionPolicyKey} from './restrictions';

/** Called inside the submission transaction: responses, decisions, incidents, alerts and block commit together. */
export async function processChecklistCriticality(tx:Prisma.TransactionClient,checklist:Checklist & {answers:ChecklistAnswer[]},vehicle:Vehicle,rules:InspectionItem[]){
 const processed=new Set((await tx.checklistEvaluation.findMany({where:{answerId:{in:checklist.answers.map(a=>a.id)}},select:{answerId:true}})).map(e=>e.answerId));
 const decisions=checklist.answers.flatMap(answer=>{
  if(processed.has(answer.id))return [];
  const rule=rules.find(r=>r.id===answer.item);if(!rule)throw new Error('RULE_MISMATCH');
  const decision=evaluateNegativeAnswer({...answer,problemType:answer.problemType??undefined},rule);
  return decision?[{answer,rule,decision}]:[];
 });
 const evaluatedAt=new Date();const blocked=decisions.some(d=>d.decision.blocksVehicle);
 const restrictionPolicy=blocked?parseRestrictionPolicy((await tx.setting.findUnique({where:{key:restrictionPolicyKey}}))?.value):null;
 const statusAfter=blocked?'STOPPED':vehicle.status;const availabilityAfter=blocked?'UNAVAILABLE':vehicle.availability;
 for(const {answer,rule,decision} of decisions){
  const title=`${rule.label}: ${answer.problemType}`;
  const description=[`Checklist ${checklist.id}`,`Resposta original ${answer.id}`,`Problema: ${answer.problemType}`,answer.notes?`Observação: ${answer.notes}`:''].filter(Boolean).join('\n');
  const incident=decision.createsIncident?await tx.incident.create({data:{vehicleId:vehicle.id,driverId:checklist.driverId,checklistId:checklist.id,origin:'CHECKLIST',category:rule.category,title,description,priority:decision.priority,vehicleBlocked:decision.blocksVehicle,openedAt:evaluatedAt}}):null;
  const evaluation=await tx.checklistEvaluation.create({data:{answerId:answer.id,incidentId:incident?.id,priority:decision.priority,createsIncident:decision.createsIncident,blocksVehicle:decision.blocksVehicle,ruleSnapshot:decision.ruleSnapshot,configVersion:checklist.configVersion!,engineVersion:CRITICALITY_ENGINE_VERSION,evaluatedAt,vehicleStatusBefore:vehicle.status,vehicleStatusAfter:statusAfter,availabilityBefore:vehicle.availability,availabilityAfter}});
  if(incident)await tx.checklistAnswer.update({where:{id:answer.id},data:{incidentId:incident.id}});
  if(decision.blocksVehicle&&restrictionPolicy)await tx.vehicleRestriction.create({data:{vehicleId:vehicle.id,incidentId:incident?.id,evaluationId:evaluation.id,reason:title,state:restrictionPolicy.initialState,releaseEvidenceRequired:restrictionPolicy.releaseEvidenceRequired,detectedAt:evaluatedAt}});
  await tx.alert.create({data:{vehicleId:vehicle.id,evaluationId:evaluation.id,title,description:decision.blocksVehicle?'Regra de bloqueio acionada. Consulte a resposta e o processamento.':incident?'Ocorrência criada automaticamente a partir da resposta do motorista.':'Resposta negativa registrada. A regra não gera ocorrência automaticamente.',priority:decision.priority,module:incident?'ocorrencias':'checklists',createdAt:evaluatedAt}});
 }
 if(blocked)await tx.vehicle.update({where:{id:vehicle.id},data:{status:statusAfter,availability:availabilityAfter}});
}
