import {z} from 'zod';
export const alertCategories={CHECKLIST:'Checklist',MAINTENANCE:'Manutenção',PREVENTIVE:'Preventiva',DOCUMENT:'Documentação',PURCHASE:'Pedido',TIRE:'Pneu',INCIDENT:'Ocorrência'} as const;
export const alertStages={NEW:'Novo',IN_PROGRESS:'Em atendimento',RESOLVED:'Resolvido',HANDLED:'Tratado',NOT_APPLICABLE:'Não procedente',RULE_CLOSED:'Encerrado por regra'} as const;
export const alertPriorities={CRITICAL:'Crítica',HIGH:'Alta',MEDIUM:'Média',LOW:'Baixa'} as const;
export type AlertStageKey=keyof typeof alertStages;
export const activeAlertStages=['NEW','IN_PROGRESS'] as const;
export const isAlertOpen=(stage:string)=>activeAlertStages.some(s=>s===stage);
export function alertSourceTransition(previous:{sourceActive:boolean;stage:string;priority:string},active:boolean,priority:string){
 if(!active)return isAlertOpen(previous.stage)?'RULE_CLOSED':undefined;
 const rank=['LOW','MEDIUM','HIGH','CRITICAL'];
 if(!previous.sourceActive||!isAlertOpen(previous.stage)&&rank.indexOf(priority)>rank.indexOf(previous.priority))return 'NEW';
 return undefined;
}
export const alertUpdateSchema=z.object({revision:z.number().int().nonnegative(),stage:z.enum(['NEW','IN_PROGRESS','RESOLVED','HANDLED','NOT_APPLICABLE','RULE_CLOSED']),responsibleId:z.string().min(1).max(100).nullable(),newResponsible:z.object({name:z.string().trim().min(3).max(100),employeeId:z.string().trim().min(1).max(60)}).optional(),actionRequired:z.string().trim().min(3).max(1000),note:z.string().trim().min(5,'Descreva o atendimento ou motivo (mínimo 5 caracteres).').max(3000),operatorName:z.string().trim().min(3).max(100),operatorId:z.string().trim().min(1).max(60)}).strict();
export function validateAlertUpdate(previous:{stage:string},input:z.infer<typeof alertUpdateSchema>){
 if(input.stage==='RULE_CLOSED'&&previous.stage!=='RULE_CLOSED')throw new Error('O encerramento por regra é exclusivo do processamento automático.');
 if(input.stage!=='NEW'&&input.stage!=='RULE_CLOSED'&&!input.responsibleId&&!input.newResponsible)throw new Error('Defina um responsável pelo atendimento.');
}
export function alertSourceLink(a:{sourceHref:string|null;vehicleId:string|null;preventivePlanId:string|null;mileageReadingId:string|null;maintenanceId:string|null;evaluationId:string|null}){
 if(a.sourceHref?.startsWith('/')&&!a.sourceHref.startsWith('//'))return a.sourceHref;
 if(a.maintenanceId)return `/manutencoes/${a.maintenanceId}`;
 if((a.preventivePlanId||a.mileageReadingId)&&a.vehicleId)return `/preventivas/${a.vehicleId}`;
 return null;
}
