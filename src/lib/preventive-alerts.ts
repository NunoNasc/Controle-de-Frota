import {Prisma,type PreventivePlan} from '@prisma/client';
import {prisma} from './prisma';
import {preventiveLabels,preventiveState} from './preventive';
import {reconcileAlert} from './alert-reconciliation';
export async function syncPreventiveAlert(tx:Prisma.TransactionClient,plan:PreventivePlan,mileage:number|null,active=true){
 const state=preventiveState(plan,mileage);const existing=await tx.alert.findUnique({where:{preventivePlanId:plan.id}});
 if(!active||['CURRENT','UNKNOWN'].includes(state.status)){await reconcileAlert(tx,existing,{title:'Preventiva',description:'',priority:'LOW',module:'preventivas'},false,!active?'Veículo inativo: monitoramento preventivo suspenso.':state.status==='CURRENT'?'Plano preventivo voltou à condição em dia.':'Plano sem critério de vencimento avaliável; conferir configuração.');return;}
 const data={title:`Preventiva ${preventiveLabels[state.status].toLowerCase()}`,description:[state.remainingKm===null?'KM não avaliado':`${state.remainingKm.toLocaleString('pt-BR')} km até o limite`,state.remainingDays===null?'Sem prazo por data':`${state.remainingDays} dia(s) até a data prevista`].join(' · '),priority:state.status==='OVERDUE'?'HIGH' as const:state.status==='ATTENTION'?'MEDIUM' as const:'LOW' as const,status:'OPEN' as const};
 await reconcileAlert(tx,existing,{...data,vehicleId:plan.vehicleId,preventivePlanId:plan.id,module:'preventivas',actionRequired:'Revisar o plano e programar a manutenção preventiva.'},true,'Faixas de KM, data e tolerância configuradas no plano preventivo.');
}
export async function syncPreventiveAlerts(){for(let attempt=0;attempt<3;attempt++)try{await prisma.$transaction(async tx=>{for(const p of await tx.preventivePlan.findMany({include:{vehicle:true}}))await syncPreventiveAlert(tx,p,p.vehicle.mileage,p.vehicle.active);},{isolationLevel:'Serializable',timeout:20000});return;}catch(e){if(attempt<2&&e instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(e.code))continue;throw e;}}
