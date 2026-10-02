import type {Prisma} from '@prisma/client';
export async function recordMileage(tx:Prisma.TransactionClient,input:{vehicleId:string;mileage:number;actor:string;source:'CHECKLIST'|'ADMIN';checklistId?:string}){
 await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id=${input.vehicleId} FOR UPDATE`;
 if(input.checklistId){const existing=await tx.mileageReading.findUnique({where:{checklistId:input.checklistId}});if(existing)return existing;}
 const vehicle=await tx.vehicle.findUniqueOrThrow({where:{id:input.vehicleId}});const accepted=vehicle.mileage===null||input.mileage>=vehicle.mileage;
 const reading=await tx.mileageReading.create({data:{...input,previousMileage:vehicle.mileage,accepted}});
 if(accepted&&(vehicle.mileage===null||input.mileage>vehicle.mileage))await tx.vehicle.update({where:{id:vehicle.id},data:{mileage:input.mileage}});
 if(!accepted)await tx.alert.create({data:{vehicleId:vehicle.id,mileageReadingId:reading.id,module:'preventivas',priority:'MEDIUM',title:`Possível erro de quilometragem: ${vehicle.plate}`,description:`Leitura de ${input.mileage.toLocaleString('pt-BR')} km inferior aos ${vehicle.mileage!.toLocaleString('pt-BR')} km cadastrados. Hodômetro mantido. Conferir leitura e checklist com ${input.actor}.`}});
 return reading;
}
