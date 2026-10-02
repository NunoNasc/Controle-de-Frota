import {z} from 'zod';
export type IndicatorParams=Record<string,string|string[]|undefined>;
export function indicatorFilters(params:IndicatorParams,now=new Date()){
 const value=(key:string)=>typeof params[key]==='string'?params[key] as string:'';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const fallback=new Date(Date.parse(`${today}T03:00:00Z`)-29*86400000).toISOString().slice(0,10);
 const from=value('from')||fallback,to=value('to')||today;
 const valid=z.iso.date().safeParse(from).success&&z.iso.date().safeParse(to).success&&from<=to&&to<=today;
 return {from,to,vehicle:value('vehicle').slice(0,100),type:value('type').slice(0,100),costCenter:value('costCenter').slice(0,100),valid,
 start:valid?new Date(`${from}T00:00:00-03:00`):new Date(`${fallback}T00:00:00-03:00`),
 end:valid?new Date(Math.min(Date.parse(`${to}T00:00:00-03:00`)+86400000,now.getTime())):now,now};
}
export type IndicatorFilters=ReturnType<typeof indicatorFilters>;
export const percent=(n:number|null)=>n===null?'Sem base':`${n.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
export function durationHours(hours:number|null){
 if(hours===null)return 'Sem base';
 const minutes=Math.round(hours*60);
 return minutes<60?`${minutes} min`:minutes<1440?`${Math.floor(minutes/60)} h ${minutes%60} min`:`${Math.floor(minutes/1440)} d ${Math.floor(minutes%1440/60)} h`;
}
