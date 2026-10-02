import {Prisma} from '@prisma/client';
import {prisma} from './prisma';
import {syncMaintenanceAlerts} from './maintenance-alerts';
import {syncPreventiveAlerts} from './preventive-alerts';
import {reconcileAlert} from './alert-reconciliation';
import {purchaseStalled} from './purchases';
import {closedStages} from './incidents';
import {dayKey} from './dashboard-domain';
export async function syncAlertSources(){
 await syncMaintenanceAlerts();await syncPreventiveAlerts();
 for(let attempt=0;attempt<3;attempt++)try{
  await prisma.$transaction(async tx=>{
   const now=new Date(),today=dayKey(now);
   const sync=async(key:string,data:Prisma.AlertUncheckedCreateInput,active:boolean,rule:string)=>reconcileAlert(tx,await tx.alert.findUnique({where:{sourceKey:key}}),{...data,sourceKey:key},active,rule);
   for(const d of await tx.document.findMany())await sync(`DOCUMENT:${d.id}`,{module:'documentos',category:'DOCUMENT',vehicleId:d.vehicleId,title:`Documento vencido: ${d.title}`,description:`Validade registrada: ${dayKey(d.expiresAt)}.`,priority:'HIGH',sourceHref:`/frota/${d.vehicleId}?tab=documentos`,actionRequired:'Conferir validade e regularizar o documento.'},dayKey(d.expiresAt)<today,'Documento com validade anterior ao dia atual; encerra após regularização da validade.');
   for(const p of await tx.purchaseOrder.findMany())await sync(`PURCHASE:${p.id}`,{module:'compras',category:'PURCHASE',vehicleId:p.vehicleId,title:`Pedido sem avanço: ${p.orderNumber??p.number}`,description:`Sem mudança de status desde ${p.stageChangedAt.toISOString()}. Limite: ${p.staleAfterDays} dias.`,priority:p.stage==='CONTINGENCY'?'HIGH':'MEDIUM',responsibleId:p.responsibleId,sourceHref:`/compras/${p.id}`,actionRequired:'Cobrar aprovação, peça ou fornecedor e registrar o andamento do pedido.'},purchaseStalled(p,now),'Prazo sem mudança de status configurado no pedido; encerra quando não há atraso ou o pedido é encerrado.');
   for(const t of await tx.tire.findMany()){
    const status=t.status.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
    const critical=['CRITICO','CRITICA','CRITICAL','SEM CONDICAO DE RODAGEM'].includes(status),attention=['ATENCAO','MEDIUM','URGENTE','HIGH'].includes(status);
    await sync(`TIRE:${t.id}`,{module:'pneus',category:'TIRE',vehicleId:t.vehicleId,title:`Pneu requer avaliação: ${t.serial}`,description:`Condição cadastrada: ${t.status}. Posição: ${t.position}.`,priority:critical?'CRITICAL':['URGENTE','HIGH'].includes(status)?'HIGH':'MEDIUM',sourceHref:t.vehicleId?`/frota/${t.vehicleId}?tab=pneus`:'/pneus',actionRequired:'Solicitar avaliação técnica do pneu e registrar a providência.'},critical||attention,'Condição de atenção, urgente ou crítica explicitamente cadastrada no pneu; não infere limite técnico de sulco.');
   }
   for(const i of await tx.incident.findMany({include:{evaluation:{select:{id:true}}}})){
    if(i.evaluation)continue; // Checklist already owns the alert; avoid a duplicate queue entry.
    await sync(`INCIDENT:${i.id}`,{module:'ocorrencias',category:'INCIDENT',vehicleId:i.vehicleId,title:`${i.publicNumber}: ${i.title}`,description:i.description,priority:i.priority,responsibleId:i.responsibleId,sourceHref:`/ocorrencias/${i.id}`,actionRequired:'Analisar a ocorrência e registrar solução ou encaminhamento.'},!closedStages.includes(i.stage),'Ocorrência aberta; encerramento segue o status final registrado na ocorrência.');
   }
  },{isolationLevel:'Serializable',timeout:30000});return;
 }catch(e){if(attempt<2&&e instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(e.code))continue;throw e;}
}
