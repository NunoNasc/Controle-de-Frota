import {z} from 'zod';
export const purchaseStages={PENDING:'Pendente',APPROVAL:'Em aprovação',APPROVED:'Aprovado',REJECTED:'Recusado',CONTINGENCY:'Contingência',ORDERED:'Pedido gerado',WAITING_SUPPLIER:'Aguardando fornecedor',DELIVERED:'Entregue',FINISHED:'Finalizado',CANCELED:'Cancelado (cadastro anterior)'} as const;
export type PurchaseStageKey=keyof typeof purchaseStages;
export const purchaseIndicators=['PENDING','APPROVAL','APPROVED','REJECTED','CONTINGENCY','WAITING_SUPPLIER'] as const;
export function purchaseAge(stageChangedAt:Date,now=new Date()){return Math.max(0,Math.floor((now.getTime()-stageChangedAt.getTime())/86400000));}
export function purchaseStalled(p:{stage:string;stageChangedAt:Date;staleAfterDays:number},now=new Date()){return !['FINISHED','REJECTED','CANCELED'].includes(p.stage)&&purchaseAge(p.stageChangedAt,now)>=p.staleAfterDays;}
const ref=z.string().min(1).max(100).nullable();const staff=z.object({name:z.string().trim().min(3).max(100),employeeId:z.string().trim().min(1).max(60)});
export const purchaseSchema=z.object({
 id:z.string().max(100).optional(),revision:z.number().int().nonnegative().optional(),submissionKey:z.uuid(),
 orderNumber:z.string().trim().max(80).nullable(),scNumber:z.string().trim().max(80).nullable(),description:z.string().trim().min(5).max(5000),
 stage:z.enum(['PENDING','APPROVAL','APPROVED','REJECTED','CONTINGENCY','ORDERED','WAITING_SUPPLIER','DELIVERED','FINISHED','CANCELED']),
 vehicleId:ref,equipmentId:ref,supplierId:ref,requesterId:ref,responsibleId:ref,
 newRequester:staff.optional(),newResponsible:staff.optional(),
 newSupplier:z.object({name:z.string().trim().min(3).max(150),taxId:z.string().trim().regex(/^\d{14}$/,'Informe os 14 dígitos do CNPJ.'),phone:z.string().trim().max(30),specialty:z.string().trim().max(100)}).optional(),
 newEquipment:z.object({code:z.string().trim().min(1).max(50),name:z.string().trim().min(3).max(100)}).optional(),
 amount:z.number().min(0).max(9999999999.99).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001).nullable(),
 requestedAt:z.iso.datetime({offset:true}),staleAfterDays:z.number().int().min(1).max(365),notes:z.string().trim().max(5000),
 incidentIds:z.array(z.string().min(1).max(100)).max(100),maintenanceIds:z.array(z.string().min(1).max(100)).max(100),
 operatorName:z.string().trim().min(3).max(100),operatorId:z.string().trim().min(1).max(60),note:z.string().trim().min(3,'Informe o motivo da alteração.').max(2000),
}).strict();
export function validatePurchase(input:z.infer<typeof purchaseSchema>,now=new Date()){
 if(new Date(input.requestedAt)>now)throw new Error('A solicitação não pode ter data futura.');
 if(!input.requesterId&&!input.newRequester)throw new Error('Informe o solicitante.');
 if(input.vehicleId&&(input.equipmentId||input.newEquipment))throw new Error('Selecione veículo ou equipamento, não ambos.');
 if(input.incidentIds.length||input.maintenanceIds.length){if(!input.vehicleId)throw new Error('Selecione o veículo dos vínculos.');}
 if(new Set(input.incidentIds).size!==input.incidentIds.length||new Set(input.maintenanceIds).size!==input.maintenanceIds.length)throw new Error('Vínculos duplicados.');
 if(['ORDERED','WAITING_SUPPLIER','DELIVERED','FINISHED'].includes(input.stage)&&(!input.orderNumber||(!input.supplierId&&!input.newSupplier)||input.amount===null))throw new Error('Pedido gerado ou posterior exige número do pedido, fornecedor e valor.');
}
