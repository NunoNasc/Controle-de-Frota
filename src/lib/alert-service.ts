import {prisma} from './prisma';
import {alertUpdateSchema,validateAlertUpdate,isAlertOpen} from './alerts';
import type {z} from 'zod';
export async function updateAlert(id:string,input:z.infer<typeof alertUpdateSchema>){
 return prisma.$transaction(async tx=>{
  const previous=await tx.alert.findUnique({where:{id}});if(!previous)throw new Error('NOT_FOUND');if(previous.revision!==input.revision)throw new Error('STALE');validateAlertUpdate(previous,input);
  let responsibleId=input.responsibleId;
  if(input.newResponsible){const found=await tx.staffMember.findUnique({where:{employeeId:input.newResponsible.employeeId}});if(found&&(!found.active||found.name!==input.newResponsible.name))throw new Error('Matrícula já cadastrada com outro nome ou inativa.');responsibleId=(found??await tx.staffMember.create({data:input.newResponsible})).id;}
  if(responsibleId){const staff=await tx.staffMember.findUnique({where:{id:responsibleId}});if(!staff||!staff.active&&responsibleId!==previous.responsibleId)throw new Error('Responsável inválido ou inativo.');}
  const actor=`${input.operatorName} · ${input.operatorId} (identificação autodeclarada)`;
  await tx.$queryRaw`SELECT set_config('fleet.actor',${actor},true),set_config('fleet.alert_reason',${input.note},true)`;
  const changed=await tx.alert.updateMany({where:{id,revision:input.revision},data:{stage:input.stage,responsibleId,actionRequired:input.actionRequired,closingReason:!isAlertOpen(input.stage)&&input.stage!==previous.stage?input.note:previous.closingReason}});if(changed.count!==1)throw new Error('STALE');
  return tx.alert.findUniqueOrThrow({where:{id},select:{revision:true}});
 },{isolationLevel:'Serializable',timeout:20000});
}
