import {Prisma} from '@prisma/client';
import {prisma} from './prisma';
import {closedStages,decodeIncidentAttachment,incidentUpdateSchema,validateIncidentTransition} from './incidents';
import type {z} from 'zod';
import {reconcileAlert} from './alert-reconciliation';

export async function updateIncident(id:string,input:z.infer<typeof incidentUpdateSchema>){
 const content=input.attachment?decodeIncidentAttachment(input.attachment):null;
 return prisma.$transaction(async tx=>{
  const previous=await tx.incident.findUnique({where:{id},include:{maintenance:{select:{id:true,title:true,serviceOrder:true}}}});
  if(!previous)throw new Error('NOT_FOUND');
  if(previous.revision!==input.revision)throw new Error('STALE');
  validateIncidentTransition(previous,input);
  const actor=`${input.operatorName} · ${input.operatorId} (identificação autodeclarada)`;
  await tx.$queryRaw`SELECT set_config('fleet.actor',${actor},true),set_config('fleet.reason',${input.justification},true)`;
  let responsibleId=input.responsibleId;
  if(input.newResponsible){
   const staff=await tx.staffMember.findUnique({where:{employeeId:input.newResponsible.employeeId}});
   if(staff&&(!staff.active||staff.name!==input.newResponsible.name))throw new Error('Matrícula de responsável já cadastrada com outro nome ou inativa.');
   responsibleId=(staff??await tx.staffMember.create({data:input.newResponsible})).id;
  }
  const [responsible,supplier,requisition,order,maintenance]=await Promise.all([
   responsibleId?tx.staffMember.findUnique({where:{id:responsibleId}}):null,
   input.supplierId?tx.supplier.findUnique({where:{id:input.supplierId}}):null,
   input.requisitionId?tx.purchaseRequisition.findUnique({where:{id:input.requisitionId}}):null,
   input.purchaseOrderId?tx.purchaseOrder.findUnique({where:{id:input.purchaseOrderId}}):null,
   tx.maintenance.findMany({where:{id:{in:input.maintenanceIds}}}),
  ]);
  if(responsibleId&&(!responsible||responsibleId!==previous.responsibleId&&!responsible.active))throw new Error('Responsável inválido ou inativo.');
  if(input.supplierId&&(!supplier||(input.supplierId!==previous.supplierId&&(!supplier.active||supplier.status!=='ACTIVE'))))throw new Error('Fornecedor inválido ou inativo.');
  if(input.requisitionId&&!requisition||input.purchaseOrderId&&!order)throw new Error('SC ou pedido não encontrado.');
  if(order?.vehicleId&&order.vehicleId!==previous.vehicleId)throw new Error('O pedido pertence a outro veículo.');
  if(order?.requisitionId&&input.requisitionId&&order.requisitionId!==input.requisitionId)throw new Error('A SC informada difere da SC do pedido.');
  if(order?.supplierId&&input.supplierId&&order.supplierId!==input.supplierId)throw new Error('O fornecedor difere do fornecedor do pedido.');
  if(maintenance.length!==input.maintenanceIds.length||maintenance.some(m=>m.vehicleId!==previous.vehicleId||(m.incidentId&&m.incidentId!==id)))throw new Error('Manutenção inválida, de outro veículo ou vinculada a outra ocorrência.');
  const data={stage:input.stage,priority:input.priority,responsibleId,dueAt:input.dueAt?new Date(input.dueAt):null,supplierId:input.supplierId,requisitionId:input.requisitionId,purchaseOrderId:input.purchaseOrderId,solution:input.solution||null,resolvedAt:closedStages.includes(input.stage)?previous.resolvedAt??new Date():null};
  const changed=Object.entries(data).some(([key,value])=>{
   const old=previous[key as keyof typeof data];
   return (old instanceof Date?old.toISOString():old)!==(value instanceof Date?value.toISOString():value);
  });
  const beforeIds=previous.maintenance.map(m=>m.id).sort();
  const maintenanceChanged=JSON.stringify(beforeIds)!==JSON.stringify([...input.maintenanceIds].sort());
  if(!changed&&!maintenanceChanged&&!input.comment&&!content)throw new Error('Nenhuma alteração para registrar.');
  // Revision and all edits commit atomically. DB trigger appends snapshots and mirrors the dashboard status.
  const result=await tx.incident.updateMany({where:{id,revision:input.revision},data});
  if(result.count!==1)throw new Error('STALE');
  const references={responsible:responsible?.name??null,supplier:supplier?.name??null,requisition:requisition?.number??null,purchaseOrder:order?.orderNumber??null};
  if(changed)await tx.incidentEvent.create({data:{incidentId:id,actor,kind:'REFERENCES',note:'Identificação dos vínculos neste atendimento',after:references}});
  if(maintenanceChanged){
   await tx.maintenance.updateMany({where:{incidentId:id,id:{notIn:input.maintenanceIds}},data:{incidentId:null}});
   await tx.maintenance.updateMany({where:{id:{in:input.maintenanceIds}},data:{incidentId:id}});
   await tx.incidentEvent.create({data:{incidentId:id,actor,kind:'MAINTENANCE',note:'Vínculos de manutenção atualizados',before:previous.maintenance,after:maintenance.map(m=>({id:m.id,title:m.title,serviceOrder:m.serviceOrder}))}});
  }
  if(input.comment)await tx.incidentEvent.create({data:{incidentId:id,actor,kind:'COMMENT',note:input.comment}});
  if(content&&input.attachment){
   const file=await tx.incidentAttachment.create({data:{incidentId:id,actor,content,sizeBytes:content.length,mimeType:input.attachment.mimeType,fileName:input.attachment.fileName.replace(/[\x00-\x1f\\/]/g,'_')}});
   await tx.incidentEvent.create({data:{incidentId:id,actor,kind:'ATTACHMENT',note:`Anexo adicionado: ${file.fileName}`,after:{attachmentId:file.id,fileName:file.fileName,mimeType:file.mimeType,sizeBytes:file.sizeBytes}}});
  }
  for(const alert of await tx.alert.findMany({where:{evaluation:{incidentId:id}}}))await reconcileAlert(tx,alert,{title:alert.title,description:alert.description,module:alert.module,priority:input.priority},!closedStages.includes(input.stage),`Ocorrência ${previous.publicNumber}: ${input.stage}. ${input.solution||input.justification||'Atendimento registrado.'}`);
  return tx.incident.findUniqueOrThrow({where:{id},select:{revision:true,publicNumber:true}});
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});
}
