import {z} from 'zod';
export const restrictionLabels={AWAITING_ASSESSMENT:'Aguardando avaliação',BLOCKED:'Bloqueado',RELEASED:'Liberado'} as const;
export const restrictionPolicyKey='operational-restrictions';
export const restrictionPolicySchema=z.object({initialState:z.enum(['AWAITING_ASSESSMENT','BLOCKED']),releaseEvidenceRequired:z.boolean()}).strict();
export const defaultRestrictionPolicy={initialState:'AWAITING_ASSESSMENT',releaseEvidenceRequired:true} as const;
export function parseRestrictionPolicy(value:unknown){const parsed=restrictionPolicySchema.safeParse(value);return parsed.success?parsed.data:defaultRestrictionPolicy;}
export const restrictionActorSchema=z.object({operatorName:z.string().trim().min(3,'Informe o nome do responsável.').max(100),operatorId:z.string().trim().min(1,'Informe a matrícula ou identificação.').max(60)});
export const restrictionDecisionSchema=restrictionActorSchema.extend({
 revision:z.number().int().nonnegative(),decision:z.enum(['AWAITING_ASSESSMENT','BLOCKED','RELEASED']),
 solution:z.string().trim().max(5000).default(''),notes:z.string().trim().min(3,'Informe a observação da avaliação.').max(5000),
 postReleaseStatus:z.enum(['AVAILABLE','MAINTENANCE','STOPPED','UNKNOWN']).default('UNKNOWN'),
 attachment:z.object({fileName:z.string().trim().min(1).max(180),mimeType:z.enum(['image/jpeg','image/png','application/pdf']),base64:z.string().max(7_000_000)}).optional(),
}).strict();
export function validateRestrictionDecision(restriction:{state:string;revision:number;releaseEvidenceRequired:boolean},input:z.infer<typeof restrictionDecisionSchema>){
 if(restriction.revision!==input.revision)throw new Error('STALE');
 if(restriction.state==='RELEASED')throw new Error('Esta restrição já foi liberada. O histórico não pode ser alterado.');
 if(input.decision==='RELEASED'&&input.solution.length<5)throw new Error('Informe a solução aplicada (mínimo de 5 caracteres).');
 if(input.decision==='RELEASED'&&restriction.releaseEvidenceRequired&&!input.attachment)throw new Error('Esta restrição exige uma evidência da liberação.');
}
export const safetyNotice='Este sistema registra e controla decisões. Não substitui a avaliação técnica nem os procedimentos de segurança da empresa.';
