import {z} from 'zod';
export const preventiveLabels={CURRENT:'Em dia',UPCOMING:'Próxima',ATTENTION:'Atenção',OVERDUE:'Vencida',UNKNOWN:'Não avaliada'} as const;
export type PreventiveState=keyof typeof preventiveLabels;
export type PlanClock={nextMileage:number|null;dueAt:Date|string|null;toleranceKm:number;toleranceDays:number;upcomingKm:number;upcomingDays:number};
const day=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export function preventiveState(plan:PlanClock,mileage:number|null,now=new Date()){
 const remainingKm=plan.nextMileage===null||mileage===null?null:plan.nextMileage-mileage;
 const remainingDays=plan.dueAt===null?null:Math.round((Date.parse(day(new Date(plan.dueAt)))-Date.parse(day(now)))/86400000);
 const rank=(remaining:number|null,tolerance:number,near:number,date=false)=>remaining===null?-1:(remaining<0&&-remaining>=tolerance)||(!date&&remaining===0&&tolerance===0)?3:remaining<=0?2:remaining<=near?1:0;
 const level=Math.max(rank(remainingKm,plan.toleranceKm,plan.upcomingKm),rank(remainingDays,plan.toleranceDays,plan.upcomingDays,true));
 const status:PreventiveState=level===3?'OVERDUE':level===2?'ATTENTION':level===1?'UPCOMING':level===0?'CURRENT':'UNKNOWN';
 return {status,remainingKm,remainingDays,mileageUnknown:plan.nextMileage!==null&&mileage===null};
}
const km=z.number().int().min(0).max(9999999).nullable();
export const preventiveSchema=z.object({vehicleId:z.string().min(1).max(100),revision:z.number().int().min(0).nullable(),mileage:km,intervalKm:z.number().int().min(1).max(9999999),lastMileage:km,nextMileage:km,lastAt:z.iso.date().nullable(),dueAt:z.iso.date().nullable(),toleranceKm:z.number().int().min(0).max(100000),toleranceDays:z.number().int().min(0).max(365),upcomingKm:z.number().int().min(0).max(100000),upcomingDays:z.number().int().min(0).max(365),operatorName:z.string().trim().min(3).max(100),operatorId:z.string().trim().min(1).max(60),note:z.string().trim().min(3).max(2000)}).strict();
export function nextPreventiveMileage(last:number|null,interval:number,manual:number|null){return last===null?manual:last+interval;}
