import {Prisma} from '@prisma/client';
import type {z} from 'zod';
import {prisma} from './prisma';
import {maintenanceSchema,validateMaintenance,closedMaintenance,maintenanceKinds} from './maintenance';
import {syncMaintenanceAlert} from './maintenance-alerts';
export async function saveMaintenance(input:z.infer<typeof maintenanceSchema>){
 validateMaintenance(input);
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id=${input.vehicleId} FOR UPDATE`;
  const vehicle=await tx.vehicle.findUnique({where:{id:input.vehicleId}});if(!vehicle)throw new Error('Veículo não encontrado.');
  if(!input.id){const replay=await tx.maintenance.findUnique({where:{submissionKey:input.submissionKey}});if(replay){if(replay.vehicleId!==input.vehicleId)throw new Error('Identificador de envio já utilizado.');return {id:replay.id,revision:replay.revision};}}
  const previous=input.id?await tx.maintenance.findUnique({where:{id:input.id}}):null;
  if(input.id&&!previous)throw new Error('NOT_FOUND');
  if(previous&&(previous.revision!==input.revision||previous.vehicleId!==input.vehicleId))throw new Error('STALE');
  if(previous&&closedMaintenance(previous.stage))throw new Error('Manutenção encerrada. Crie um novo serviço para preservar o histórico.');
  if(!previous&&(!vehicle.active||vehicle.status==='INACTIVE'))throw new Error('Não é possível solicitar serviço para veículo inativo.');
  if(previous?.unavailableFrom&&input.unavailableFrom!==previous.unavailableFrom.toISOString())throw new Error('O início da indisponibilidade já foi registrado e não pode ser substituído.');
  const actor=`${input.operatorName} · ${input.operatorId} (identificação autodeclarada)`;
  await tx.$queryRaw`SELECT set_config('fleet.actor',${actor},true),set_config('fleet.reason',${input.note||'Atendimento de manutenção registrado'},true)`;
  let responsibleId=input.responsibleId;
  if(input.newResponsible){const staff=await tx.staffMember.findUnique({where:{employeeId:input.newResponsible.employeeId}});if(staff&&(!staff.active||staff.name!==input.newResponsible.name))throw new Error('Matrícula de responsável já cadastrada com outro nome ou inativa.');responsibleId=(staff??await tx.staffMember.create({data:input.newResponsible})).id;}
  const [responsible,supplier,incident,sc,order]=await Promise.all([
   responsibleId?tx.staffMember.findUnique({where:{id:responsibleId}}):null,input.supplierId?tx.supplier.findUnique({where:{id:input.supplierId}}):null,
   input.incidentId?tx.incident.findUnique({where:{id:input.incidentId}}):null,input.requisitionId?tx.purchaseRequisition.findUnique({where:{id:input.requisitionId}}):null,input.purchaseOrderId?tx.purchaseOrder.findUnique({where:{id:input.purchaseOrderId}}):null,
  ]);
  if(responsibleId&&(!responsible||!responsible.active&&previous?.responsibleId!==responsibleId))throw new Error('Responsável inválido ou inativo.');
  if(input.supplierId&&(!supplier||(!supplier.active||supplier.status!=='ACTIVE')&&previous?.supplierId!==input.supplierId))throw new Error('Fornecedor inválido ou inativo.');
  if(input.incidentId&&(!incident||incident.vehicleId!==input.vehicleId))throw new Error('Ocorrência inválida ou de outro veículo.');
  if(input.requisitionId&&!sc||input.purchaseOrderId&&!order)throw new Error('SC ou pedido não encontrado.');
  if(order?.vehicleId&&order.vehicleId!==input.vehicleId)throw new Error('O pedido pertence a outro veículo.');
  if(order?.requisitionId&&input.requisitionId&&order.requisitionId!==input.requisitionId)throw new Error('A SC não corresponde ao pedido.');
  if(order?.supplierId&&input.supplierId&&order.supplierId!==input.supplierId)throw new Error('O fornecedor não corresponde ao pedido.');
  const date=(v:string|null)=>v?new Date(v):null;
  const data={vehicleId:input.vehicleId,kind:input.kind,type:maintenanceKinds[input.kind],stage:input.stage,title:input.title,description:input.description,serviceOrder:input.serviceOrder||null,incidentId:input.incidentId,requisitionId:input.requisitionId,purchaseOrderId:input.purchaseOrderId,supplierId:input.supplierId,responsibleId,budget:input.budget,approvedAmount:input.approvedAmount,cost:input.cost??0,costKnown:input.cost!==null,mileage:input.mileage,enteredAt:date(input.enteredAt),scheduledAt:date(input.scheduledAt),expectedAt:date(input.expectedAt),unavailableFrom:date(input.unavailableFrom),completedAt:closedMaintenance(input.stage)?date(input.completedAt)??new Date():null,solution:input.solution,alertAfterHours:input.alertAfterHours,criticalAfterHours:input.criticalAfterHours};
  let id=previous?.id;
  if(id){if((await tx.maintenance.updateMany({where:{id,revision:input.revision},data})).count!==1)throw new Error('STALE');}
  else id=(await tx.maintenance.create({data:{...data,submissionKey:input.submissionKey}})).id;
  const record=await tx.maintenance.findUniqueOrThrow({where:{id}});
  await syncMaintenanceAlert(tx,record);
  for(const incidentId of new Set([previous?.incidentId,input.incidentId].filter((v):v is string=>!!v)))await tx.incidentEvent.create({data:{incidentId,actor,kind:'MAINTENANCE_SERVICE',note:incidentId===input.incidentId?`Manutenção ${record.serviceOrder??record.title}: ${input.note||'Atendimento registrado'}`:'Manutenção desvinculada desta ocorrência.',after:{maintenanceId:id,stage:record.stage,title:record.title,serviceOrder:record.serviceOrder}}});
  return {id,revision:record.revision};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});
}
