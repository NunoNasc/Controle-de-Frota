import {Prisma} from '@prisma/client';
import type {z} from 'zod';
import {prisma} from './prisma';
import {purchaseSchema,validatePurchase} from './purchases';
export async function savePurchase(input:z.infer<typeof purchaseSchema>){
 validatePurchase(input);
 return prisma.$transaction(async tx=>{
  if(input.id)await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${input.id} FOR UPDATE`;
  if(!input.id){const replay=await tx.purchaseOrder.findUnique({where:{submissionKey:input.submissionKey}});if(replay)return {id:replay.id,revision:replay.revision};}
  const old=input.id?await tx.purchaseOrder.findUnique({where:{id:input.id},include:{incidents:true,maintenance:true}}):null;
  if(input.id&&!old)throw new Error('NOT_FOUND');if(old&&old.revision!==input.revision)throw new Error('STALE');
  const actor=`${input.operatorName} · ${input.operatorId} (identificação autodeclarada)`;
  await tx.$queryRaw`SELECT set_config('fleet.actor',${actor},true),set_config('fleet.reason',${input.note},true)`;
  async function contact(id:string|null,newStaff:{name:string;employeeId:string}|undefined,previous:string|null|undefined){
   if(newStaff){const s=await tx.staffMember.findUnique({where:{employeeId:newStaff.employeeId}});if(s&&(!s.active||s.name!==newStaff.name))throw new Error('Matrícula já cadastrada com outro nome ou inativa.');return s??tx.staffMember.create({data:newStaff});}
   if(!id)return null;const s=await tx.staffMember.findUnique({where:{id}});if(!s||(!s.active&&previous!==id))throw new Error('Contato inválido ou inativo.');return s;
  }
  const requester=await contact(input.requesterId,input.newRequester,old?.requesterId),responsible=await contact(input.responsibleId,input.newResponsible,old?.responsibleId);
  let supplier=input.supplierId?await tx.supplier.findUnique({where:{id:input.supplierId}}):null;
  if(input.newSupplier){const s=await tx.supplier.findUnique({where:{taxId:input.newSupplier.taxId}});if(s&&s.name!==input.newSupplier.name)throw new Error('CNPJ já cadastrado com outra razão social.');supplier=s??await tx.supplier.create({data:input.newSupplier});}
  if((input.supplierId||input.newSupplier)&&(!supplier||(!supplier.active||supplier.status!=='ACTIVE')&&supplier.id!==old?.supplierId))throw new Error('Fornecedor inválido ou inativo.');
  let equipment=input.equipmentId?await tx.equipment.findUnique({where:{id:input.equipmentId}}):null;
  if(input.newEquipment){const e=await tx.equipment.findUnique({where:{code:input.newEquipment.code}});if(e&&e.name!==input.newEquipment.name)throw new Error('Código de equipamento já utilizado.');equipment=e??await tx.equipment.create({data:input.newEquipment});}
  if((input.equipmentId||input.newEquipment)&&(!equipment||!equipment.active&&equipment.id!==old?.equipmentId))throw new Error('Equipamento inválido ou inativo.');
  const vehicle=input.vehicleId?await tx.vehicle.findUnique({where:{id:input.vehicleId}}):null;
  if(input.vehicleId&&(!vehicle||(!vehicle.active||vehicle.status==='INACTIVE')&&vehicle.id!==old?.vehicleId))throw new Error('Veículo inválido ou inativo.');
  let sc=input.scNumber?await tx.purchaseRequisition.findUnique({where:{number:input.scNumber}}):null;
  if(input.scNumber&&!sc)sc=await tx.purchaseRequisition.create({data:{number:input.scNumber,description:input.description,requesterId:requester?.id}});
  const incidents=await tx.incident.findMany({where:{id:{in:input.incidentIds}}}),maintenance=await tx.maintenance.findMany({where:{id:{in:input.maintenanceIds}}});
  if(incidents.length!==input.incidentIds.length||maintenance.length!==input.maintenanceIds.length)throw new Error('Ocorrência ou manutenção não encontrada.');
  for(const item of [...incidents,...maintenance]){
   if(item.vehicleId!==input.vehicleId)throw new Error('O vínculo pertence a outro veículo.');
   if(item.purchaseOrderId&&item.purchaseOrderId!==old?.id)throw new Error('O registro já está relacionado a outra compra. Desvincule na origem antes de continuar.');
   if(item.requisitionId&&sc&&item.requisitionId!==sc.id)throw new Error('A SC difere da informada na ocorrência ou manutenção.');
   if(item.supplierId&&supplier&&item.supplierId!==supplier.id)throw new Error('O fornecedor difere do informado na ocorrência ou manutenção.');
  }
  const data={orderNumber:input.orderNumber||null,requisitionId:sc?.id??null,description:input.description,stage:input.stage,vehicleId:input.vehicleId,equipmentId:equipment?.id??null,supplierId:supplier?.id??null,requesterId:requester?.id??null,responsibleId:responsible?.id??null,amount:input.amount??0,amountKnown:input.amount!==null,requestedAt:new Date(input.requestedAt),staleAfterDays:input.staleAfterDays,notes:input.notes};
  let id=old?.id;if(id){if((await tx.purchaseOrder.updateMany({where:{id,revision:input.revision},data})).count!==1)throw new Error('STALE');}else id=(await tx.purchaseOrder.create({data:{...data,number:`SOL-${crypto.randomUUID().toUpperCase()}`,submissionKey:input.submissionKey}})).id;
  await tx.incident.updateMany({where:{purchaseOrderId:id,id:{notIn:input.incidentIds}},data:{purchaseOrderId:null}});
  await tx.maintenance.updateMany({where:{purchaseOrderId:id,id:{notIn:input.maintenanceIds}},data:{purchaseOrderId:null}});
  for(const i of incidents)if(i.purchaseOrderId!==id)await tx.incident.update({where:{id:i.id},data:{purchaseOrderId:id}});
  for(const m of maintenance)if(m.purchaseOrderId!==id)await tx.maintenance.update({where:{id:m.id},data:{purchaseOrderId:id}});
  const related=new Set([...(old?.incidents??[]).map(i=>i.id),...input.incidentIds]);
  for(const incidentId of related)await tx.incidentEvent.create({data:{incidentId,actor,kind:'PURCHASE',note:input.incidentIds.includes(incidentId)?`Compra: ${input.orderNumber||'Pedido ainda não gerado'} · ${input.note}`:'Compra desvinculada desta ocorrência.',after:{purchaseId:id,stage:input.stage}}});
  const snapshot={requester:requester?.name??null,responsible:responsible?.name??null,supplier:supplier?.name??null,vehicle:vehicle?.plate??null,equipment:equipment?.name??null,sc:sc?.number??null,incidents:incidents.map(i=>({id:i.id,number:i.publicNumber})),maintenance:maintenance.map(m=>({id:m.id,title:m.title,os:m.serviceOrder}))};
  await tx.purchaseEvent.create({data:{purchaseId:id,actor,note:'Vínculos e identificações deste atendimento',before:old?{incidents:old.incidents.map(i=>({id:i.id,number:i.publicNumber})),maintenance:old.maintenance.map(m=>({id:m.id,title:m.title}))}:Prisma.DbNull,after:snapshot}});
  return tx.purchaseOrder.findUniqueOrThrow({where:{id},select:{id:true,revision:true}});
 },{isolationLevel:'Serializable',timeout:20000});
}
