import {prisma} from './prisma';
import {syncAlertSources} from './alert-sources';
import {preventiveState} from './preventive';
export async function getOperationalPanel(){
 await syncAlertSources();
 const [vehicles,criticalCount,critical,maintenance,checklists,unassignedCount,unassigned,legacy]=await prisma.$transaction([
  prisma.vehicle.findMany({where:{active:true,status:{not:'INACTIVE'}},select:{id:true,status:true,availability:true,operationalStatus:true,mileage:true,preventivePlan:true}}),
  prisma.alert.count({where:{priority:'CRITICAL',stage:{in:['NEW','IN_PROGRESS']}}}),
  prisma.alert.findMany({where:{priority:'CRITICAL',stage:{in:['NEW','IN_PROGRESS']}},select:{id:true,title:true,openedAt:true,vehicle:{select:{plate:true}},responsible:{select:{name:true}}},orderBy:[{openedAt:'asc'},{id:'asc'}],take:4}),
  prisma.maintenance.count({where:{stage:{in:['IN_SERVICE','TESTING']}}}),
  prisma.checklist.count({where:{status:'SUBMITTED',OR:[{hasProblem:true},{result:'ISSUE'}]}}),
  prisma.incident.count({where:{responsibleId:null,stage:{notIn:['RELEASED','DONE','REJECTED','VOID']},status:{in:['OPEN','IN_PROGRESS']}}}),
  prisma.incident.findMany({where:{responsibleId:null,stage:{notIn:['RELEASED','DONE','REJECTED','VOID']},status:{in:['OPEN','IN_PROGRESS']}},select:{id:true,publicNumber:true,title:true,priority:true,openedAt:true,vehicle:{select:{plate:true}}},orderBy:[{priority:'desc'},{openedAt:'asc'},{id:'asc'}],take:4}),
  prisma.preventive.findMany({where:{completedAt:null,vehicle:{active:true,status:{not:'INACTIVE'}}},select:{vehicleId:true,dueAt:true,dueMileage:true,vehicle:{select:{mileage:true}}}}),
 ],{isolationLevel:'RepeatableRead'});
 const now=new Date();
 const available=vehicles.filter(v=>v.availability==='AVAILABLE'&&['AVAILABLE','IN_USE'].includes(v.status)&&v.operationalStatus==='CLEAR').length;
 const unknown=vehicles.filter(v=>v.status==='UNKNOWN'||v.availability==='UNKNOWN').length;
 const stopped=vehicles.filter(v=>['STOPPED','MAINTENANCE'].includes(v.status)||v.availability==='UNAVAILABLE'||v.operationalStatus!=='CLEAR').length;
 const overdue=new Set(vehicles.filter(v=>v.preventivePlan&&preventiveState(v.preventivePlan,v.mileage,now).status==='OVERDUE').map(v=>v.id));
 const day=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 for(const p of legacy)if(day(p.dueAt)<day(now)||(p.vehicle.mileage!==null&&p.dueMileage<=p.vehicle.mileage))overdue.add(p.vehicleId);
 return {updatedAt:now.toISOString(),fleet:{total:vehicles.length,available,unknown,availability:vehicles.length&&!unknown?available/vehicles.length*100:null},stopped,criticalCount,maintenance,checklists,overdue:overdue.size,unassignedCount,
 critical:critical.map(a=>({id:a.id,title:a.title,plate:a.vehicle?.plate??'Operação geral',responsible:a.responsible?.name??'Sem responsável',openedAt:a.openedAt.toISOString()})),
 unassigned:unassigned.map(i=>({id:i.id,number:i.publicNumber,title:i.title,plate:i.vehicle.plate,priority:i.priority,openedAt:i.openedAt.toISOString()}))};
}
export type OperationalPanelData=Awaited<ReturnType<typeof getOperationalPanel>>;
