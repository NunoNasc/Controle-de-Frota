import {Prisma,type Alert,type Priority} from '@prisma/client';
import {alertSourceTransition} from './alerts';
/** Manual treatment remains final for the same condition. Recurrence/escalation opens a new audited cycle. */
export async function reconcileAlert(tx:Prisma.TransactionClient,existing:Alert|null,data:Prisma.AlertUncheckedCreateInput,active:boolean,rule:string){
 if(!existing){if(active)await tx.alert.create({data});return;}
 const stage=alertSourceTransition(existing,active,(data.priority??existing.priority) as Priority);
 const patch:Prisma.AlertUncheckedUpdateInput={};
 if(existing.sourceActive!==active)patch.sourceActive=active;
 if(active){for(const key of ['title','priority','vehicleId','sourceHref'] as const){if(data[key]!==undefined&&data[key]!==existing[key])Object.assign(patch,{[key]:data[key]});}}
 if(stage){patch.stage=stage;patch.closingReason=stage==='RULE_CLOSED'?rule:'';if(stage==='NEW')patch.description=data.description;}
 // Clock text is a detection snapshot; do not append history on every refresh merely for elapsed minutes.
 if(Object.keys(patch).length){await tx.$queryRaw`SELECT set_config('fleet.alert_reason',${stage==='NEW'?'Nova condição ou agravamento detectado. '+rule:rule},true)`;await tx.alert.update({where:{id:existing.id},data:patch});await tx.$queryRaw`SELECT set_config('fleet.alert_reason','',true)`;}
}
