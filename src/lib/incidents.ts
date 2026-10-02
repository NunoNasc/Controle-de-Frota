import {z} from 'zod';

export const incidentStages = {
 NEW:'Novo', ANALYSIS:'Em análise', AWAITING_APPROVAL:'Aguardando aprovação', AWAITING_PART:'Aguardando peça',
 AWAITING_SUPPLIER:'Aguardando fornecedor', SCHEDULED:'Programado', UNDER_MAINTENANCE:'Em manutenção',
 AWAITING_TEST:'Aguardando teste', RELEASED:'Liberado', DONE:'Concluído', REJECTED:'Não procede', VOID:'Cancelado', CONTINGENCY:'Contingência',
} as const;
export const priorities = {LOW:'Normal',MEDIUM:'Atenção',HIGH:'Urgente',CRITICAL:'Crítico'} as const;
export const incidentCategories = {TIRES:'Pneus',LIGHTING:'Iluminação',BRAKES:'Freios',FLUIDS:'Fluidos',SAFETY:'Segurança',BODY:'Carroceria',OTHER:'Outros'};
export const incidentOrigins = {UNSPECIFIED:'Não informada',MANUAL:'Manual',CHECKLIST:'Checklist',MAINTENANCE:'Manutenção'};
export const closedStages: string[] = ['RELEASED','DONE','REJECTED','VOID'];
export const incidentDate = (value:Date|string) => new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Bahia'}).format(new Date(value));
export function openTime(openedAt:Date|string,resolvedAt:Date|string|null,now=Date.now()){
 const minutes=Math.max(0,Math.floor(((resolvedAt?new Date(resolvedAt).getTime():now)-new Date(openedAt).getTime())/60000));
 return minutes<60?`${minutes} min`:minutes<1440?`${Math.floor(minutes/60)} h ${minutes%60} min`:`${Math.floor(minutes/1440)} d ${Math.floor(minutes%1440/60)} h`;
}
const reference=z.string().max(100).nullable();
export const incidentUpdateSchema=z.object({
 revision:z.number().int().nonnegative(),
 operatorName:z.string().trim().min(3,'Informe seu nome.').max(100),
 operatorId:z.string().trim().min(1,'Informe sua matrícula ou identificação.').max(60),
 stage:z.enum(Object.keys(incidentStages) as [keyof typeof incidentStages,...(keyof typeof incidentStages)[]]),
 priority:z.enum(['LOW','MEDIUM','HIGH','CRITICAL']),
 justification:z.string().trim().max(2000).default(''),
 responsibleId:reference,
 newResponsible:z.object({name:z.string().trim().min(3).max(100),employeeId:z.string().trim().min(1).max(60)}).optional(),
 dueAt:z.iso.datetime({offset:true}).nullable(),
 supplierId:reference,requisitionId:reference,purchaseOrderId:reference,
 maintenanceIds:z.array(z.string().max(100)).max(100).refine(ids=>new Set(ids).size===ids.length),
 solution:z.string().trim().max(5000).default(''),
 comment:z.string().trim().max(5000).default(''),
 attachment:z.object({fileName:z.string().trim().min(1).max(180),mimeType:z.enum(['image/jpeg','image/png','application/pdf']),base64:z.string().max(7_000_000)}).optional(),
}).strict();

export function validateIncidentTransition(previous:{priority:string;stage:string;openedAt:Date},next:z.infer<typeof incidentUpdateSchema>){
 if(previous.priority!==next.priority&&next.justification.length<5)throw new Error('Explique a alteração de criticidade (mínimo de 5 caracteres).');
 if(closedStages.includes(next.stage)&&next.solution.length<5)throw new Error('Informe a solução ou o motivo do encerramento (mínimo de 5 caracteres).');
 if(closedStages.includes(previous.stage)&&!closedStages.includes(next.stage)&&next.justification.length<5)throw new Error('Informe uma justificativa para reabrir a ocorrência.');
 if(next.dueAt&&new Date(next.dueAt)<previous.openedAt)throw new Error('O prazo não pode ser anterior à abertura.');
}

export function decodeIncidentAttachment(file:{base64:string;mimeType:string}){
 const bytes=Buffer.from(file.base64,'base64');
 const valid=file.mimeType==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':file.mimeType==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):file.mimeType==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217;
 if(!valid||bytes.length>5*1024*1024||bytes.toString('base64')!==file.base64)throw new Error('Anexo inválido. Use JPEG, PNG ou PDF de até 5 MB.');
 return new Uint8Array(bytes);
}
