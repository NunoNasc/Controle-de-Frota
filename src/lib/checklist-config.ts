import {createHash} from 'node:crypto';
import type {Prisma} from '@prisma/client';
import type {InspectionItem} from './driver-inspection';
export const vehicleChecklistType=(vehicle:{profile:string|null;category:string})=>vehicle.profile||vehicle.category;
export async function getVehicleInspection(db:Pick<Prisma.TransactionClient,'checklistItemConfig'>,vehicle:{profile:string|null;category:string}){
 const type=vehicleChecklistType(vehicle);
 const records=await db.checklistItemConfig.findMany({where:{active:true,OR:[{vehicleTypes:{isEmpty:true}},{vehicleTypes:{has:type}}]},include:{category:true},orderBy:[{category:{sortOrder:'asc'}},{sortOrder:'asc'},{id:'asc'}]});
 const items:InspectionItem[]=records.map(r=>({id:r.id,label:r.label,help:r.help,group:r.category.name,category:r.category.inspectionCategory,priority:r.priority,problems:r.problems,requiresPhoto:r.requiresPhoto,generatesIncident:r.generatesIncident,blocksVehicle:r.blocksVehicle,allowsNotApplicable:r.allowsNotApplicable}));
 const version=createHash('sha256').update(JSON.stringify({type,items,revisions:records.map(r=>r.updatedAt.toISOString())})).digest('hex');
 return {items,version};
}
