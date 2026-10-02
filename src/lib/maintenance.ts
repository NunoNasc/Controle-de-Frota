import {z} from 'zod';
export const maintenanceKinds={PREVENTIVE:'Preventiva',CORRECTIVE:'Corretiva',PREDICTIVE:'Preditiva',UNSPECIFIED:'Não informado'} as const;
export const maintenanceStages={REQUESTED:'Solicitada',ANALYSIS:'Em análise',AWAITING_QUOTE:'Aguardando orçamento',AWAITING_APPROVAL:'Aguardando aprovação',AWAITING_PART:'Aguardando peça',SCHEDULED:'Programada',IN_SERVICE:'Em manutenção',TESTING:'Teste',DONE:'Concluída',CANCELED:'Cancelada'} as const;
export type MaintenanceStageKey=keyof typeof maintenanceStages;
export const closedMaintenance=(stage:string)=>stage==='DONE'||stage==='CANCELED';
const instant=z.iso.datetime({offset:true}).nullable();const reference=z.string().max(100).nullable();
const money=z.number().min(0).max(9999999999.99).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001,'Use no máximo duas casas decimais.').nullable();
export const maintenanceSchema=z.object({
 id:z.string().max(100).optional(),revision:z.number().int().nonnegative().optional(),submissionKey:z.uuid(),
 operatorName:z.string().trim().min(3,'Informe seu nome.').max(100),operatorId:z.string().trim().min(1,'Informe sua identificação.').max(60),
 vehicleId:z.string().min(1,'Selecione o veículo.').max(100),kind:z.enum(['PREVENTIVE','CORRECTIVE','PREDICTIVE']),
 stage:z.enum(['REQUESTED','ANALYSIS','AWAITING_QUOTE','AWAITING_APPROVAL','AWAITING_PART','SCHEDULED','IN_SERVICE','TESTING','DONE','CANCELED']),
 title:z.string().trim().min(5,'Informe o problema ou serviço (mínimo 5 caracteres).').max(200),description:z.string().trim().max(5000).default(''),
 serviceOrder:z.string().trim().max(80).nullable(),incidentId:reference,requisitionId:reference,purchaseOrderId:reference,supplierId:reference,responsibleId:reference,
 newResponsible:z.object({name:z.string().trim().min(3).max(100),employeeId:z.string().trim().min(1).max(60)}).optional(),
 budget:money,approvedAmount:money,cost:money,mileage:z.number().int().min(0).max(9999999).nullable(),
 enteredAt:instant,scheduledAt:instant,expectedAt:instant,unavailableFrom:instant,completedAt:instant,
 solution:z.string().trim().max(5000).default(''),note:z.string().trim().max(5000).default(''),
 alertAfterHours:z.number().int().min(1).max(8760),criticalAfterHours:z.number().int().min(1).max(17520),
}).strict();
export function validateMaintenance(input:z.infer<typeof maintenanceSchema>,now=new Date()){
 if(input.criticalAfterHours<input.alertAfterHours)throw new Error('O limite crítico deve ser igual ou maior que o limite de atenção.');
 if(input.stage==='SCHEDULED'&&!input.scheduledAt)throw new Error('Informe a data da programação.');
 if(['IN_SERVICE','TESTING','DONE'].includes(input.stage)&&!input.enteredAt)throw new Error('Informe a data de entrada.');
 if(['IN_SERVICE','TESTING','DONE'].includes(input.stage)&&!input.responsibleId&&!input.newResponsible)throw new Error('Defina o responsável pelo serviço.');
 if(closedMaintenance(input.stage)&&input.solution.length<5)throw new Error('Informe a solução ou motivo do encerramento.');
 if(!closedMaintenance(input.stage)&&input.completedAt)throw new Error('A data de conclusão exige um serviço concluído.');
 for(const date of [input.enteredAt,input.unavailableFrom,input.completedAt])if(date&&new Date(date)>now)throw new Error('Entrada, indisponibilidade e conclusão não podem estar no futuro.');
 if(input.enteredAt&&input.expectedAt&&new Date(input.expectedAt)<new Date(input.enteredAt))throw new Error('A previsão não pode ser anterior à entrada.');
 if(input.unavailableFrom&&!input.enteredAt)throw new Error('Registre a entrada antes de informar a indisponibilidade.');
 if(input.unavailableFrom&&input.enteredAt&&new Date(input.unavailableFrom)<new Date(input.enteredAt))throw new Error('A indisponibilidade desta manutenção não pode começar antes da entrada.');
 if(input.completedAt&&[input.enteredAt,input.unavailableFrom].some(d=>d&&new Date(d)>new Date(input.completedAt!)))throw new Error('A conclusão não pode ser anterior à entrada ou à indisponibilidade.');
}
export function elapsedLabel(start:Date|string|null,end:Date|string|null,now=new Date()){
 if(!start)return 'Não registrada';const minutes=Math.max(0,Math.floor(((end?new Date(end):now).getTime()-new Date(start).getTime())/60000));
 return minutes>=1440?`${Math.floor(minutes/1440)} d ${Math.floor(minutes%1440/60)} h`:minutes>=60?`${Math.floor(minutes/60)} h ${minutes%60} min`:`${minutes} min`;
}
export type MaintenanceClock={stage:string;stageChangedAt:Date;scheduledAt:Date|null;expectedAt:Date|null;unavailableFrom:Date|null;unavailableUntil:Date|null;alertAfterHours:number;criticalAfterHours:number};
export function maintenanceAlertState(m:MaintenanceClock,now=new Date()){
 if(closedMaintenance(m.stage))return null;
 const anchor=m.stage==='SCHEDULED'&&m.scheduledAt&&m.scheduledAt>m.stageChangedAt?m.scheduledAt:m.stageChangedAt;
 const stalled=Math.max(0,(now.getTime()-anchor.getTime())/3600000);
 const down=m.unavailableFrom&&!m.unavailableUntil?Math.max(0,(now.getTime()-m.unavailableFrom.getTime())/3600000):0;
 const overdue=m.expectedAt?Math.max(0,(now.getTime()-m.expectedAt.getTime())/3600000):0;
 const reasons:string[]=[];
 if(stalled>=m.alertAfterHours)reasons.push(`Sem mudança de etapa há ${elapsedLabel(anchor,null,now)}`);
 if(down>=m.alertAfterHours)reasons.push(`Veículo indisponível há ${elapsedLabel(m.unavailableFrom,null,now)}`);
 if(overdue>0)reasons.push(`Previsão excedida em ${elapsedLabel(m.expectedAt,null,now)}`);
 if(!reasons.length)return null;
 const priority: 'CRITICAL'|'HIGH'|'MEDIUM'=Math.max(stalled,down,overdue)>=m.criticalAfterHours?'CRITICAL':overdue>0?'HIGH':'MEDIUM';
 return {priority,reasons};
}
