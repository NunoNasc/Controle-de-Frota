import {Prisma,type Maintenance} from '@prisma/client';
import {prisma} from './prisma';
import {maintenanceAlertState} from './maintenance';
import {reconcileAlert} from './alert-reconciliation';
export async function syncMaintenanceAlert(tx:Prisma.TransactionClient,m:Maintenance,now=new Date()){
 const state=maintenanceAlertState(m,now);const existing=await tx.alert.findUnique({where:{maintenanceId:m.id}});
 if(!state){await reconcileAlert(tx,existing,{title:m.title,description:'',priority:'LOW',module:'manutencoes'},false,'Manutenção encerrada ou sem atraso/indisponibilidade acima dos limites configurados.');return;}
 const title=`Manutenção requer atenção: ${m.title}`;const description=state.reasons.join(' · ');
 await reconcileAlert(tx,existing,{maintenanceId:m.id,vehicleId:m.vehicleId,module:'manutencoes',title,description,priority:state.priority,responsibleId:m.responsibleId,actionRequired:'Cobrar andamento, revisar previsão e registrar o atendimento da manutenção.'},true,'Limites de atraso e indisponibilidade definidos na manutenção.');
}
/** Local clock reconciliation: invoked on module/dashboard reads, and after writes. No external scheduler. */
export async function syncMaintenanceAlerts(){
 for(let attempt=0;attempt<3;attempt++){
  try{await prisma.$transaction(async tx=>{const now=new Date();const rows=await tx.maintenance.findMany({where:{OR:[{stage:{notIn:['DONE','CANCELED']}},{alert:{sourceActive:true}}]}});for(const m of rows)await syncMaintenanceAlert(tx,m,now);},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});return;}
  catch(e){if(attempt<2&&e instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(e.code))continue;throw e;}
 }
}
