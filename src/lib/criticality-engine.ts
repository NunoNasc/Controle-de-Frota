import type {InspectionAnswer,InspectionItem} from './driver-inspection';
export const CRITICALITY_ENGINE_VERSION='1.0';
/** Rules, not keyword matching, determine severity. No decision comes from the driver's payload. */
export function evaluateNegativeAnswer(answer:Pick<InspectionAnswer,'item'|'answer'|'problemType'>,rule:InspectionItem){
 if(answer.item!==rule.id)throw new Error('RULE_MISMATCH');
 if(answer.answer!=='ISSUE')return null;
 if(!answer.problemType||!rule.problems.includes(answer.problemType))throw new Error('INVALID_PROBLEM');
 return {priority:rule.priority,createsIncident:rule.generatesIncident,blocksVehicle:rule.blocksVehicle,createsAlert:true as const,ruleSnapshot:{itemId:rule.id,itemLabel:rule.label,category:rule.category,categoryLabel:rule.group,problemType:answer.problemType,priority:rule.priority,requiresPhoto:rule.requiresPhoto,generatesIncident:rule.generatesIncident,blocksVehicle:rule.blocksVehicle,allowsNotApplicable:rule.allowsNotApplicable,problemOptions:rule.problems}};
}
