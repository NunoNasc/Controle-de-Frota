import Link from 'next/link';
import type {Prisma} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import {restrictionLabels,safetyNotice} from '@/lib/restrictions';
import {incidentDate} from '@/lib/incidents';
import {RestrictionBanner} from './restriction-banner';
import {RestrictionDecisionForm} from './restriction-decision-form';
import {StatusBadge} from './status-badge';
function RecordedVehicleState({snapshot}:{snapshot:Prisma.JsonValue}){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||!snapshot.vehicleStatusAfter)return null;
 const operational=String(snapshot.operationalStatusAfter);
 return <p className="mt-2 text-xs text-slate-500">Situação registrada após esta decisão: {operational==='CLEAR'?'sem restrições ativas':restrictionLabels[operational as keyof typeof restrictionLabels]} · <StatusBadge status={String(snapshot.vehicleStatusAfter)}/></p>;
}
export async function VehicleRestrictions({vehicleId,incidentId,showBanner=true}:{vehicleId:string;incidentId?:string;showBanner?:boolean}){
 const [vehicle,restrictions,activeCount]=await Promise.all([
  prisma.vehicle.findUniqueOrThrow({where:{id:vehicleId},select:{operationalStatus:true}}),
  prisma.vehicleRestriction.findMany({where:{vehicleId,...(incidentId?{incidentId}:{})},include:{incident:{select:{id:true,publicNumber:true}},evaluation:{select:{answer:{select:{checklistId:true}}}},events:{include:{evidence:{select:{id:true,fileName:true,sizeBytes:true}}},orderBy:{createdAt:'asc'}}},orderBy:[{state:'asc'},{createdAt:'desc'}]}),
  prisma.vehicleRestriction.count({where:{vehicleId,state:{not:'RELEASED'}}}),
 ]);
 return <section id="restricoes" className="mt-6 min-w-0"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Controle de restrições operacionais</h2><Link className="subtle-link" href="/configuracoes/restricoes">Configurar regras</Link></div>{showBanner&&<RestrictionBanner status={vehicle.operationalStatus}/>}{incidentId&&activeCount>restrictions.filter(r=>r.state!=='RELEASED').length&&<Link className="subtle-link my-3" href={`/frota/${vehicleId}#restricoes`}>Consultar todas as restrições deste veículo →</Link>}
 {!restrictions.length?<p className="mt-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Nenhuma restrição registrada{incidentId?' para esta ocorrência':''}. {safetyNotice}</p>:<div className="mt-4 grid min-w-0 gap-5">{restrictions.map(r=><article key={r.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{r.reason}</h3><p className="mt-1 text-xs text-slate-500">Detectado em {incidentDate(r.detectedAt)} · Registrado em {incidentDate(r.createdAt)}</p></div><StatusBadge status={r.state}/></div><div className="my-3 flex flex-wrap gap-4 text-sm">{r.incident?<Link className="subtle-link" href={`/ocorrencias/${r.incident.id}`}>{r.incident.publicNumber}</Link>:<span className="text-xs text-slate-500">Regra sem ocorrência vinculada</span>}{r.evaluation&&<Link className="subtle-link" href={`/checklists/${r.evaluation.answer.checklistId}`}>Checklist e evidências originais</Link>}</div><p className="text-xs text-slate-500">Evidência de liberação: {r.releaseEvidenceRequired?'obrigatória':'opcional'} (regra preservada na abertura).</p>
 <details className="mt-4" open={r.state!=='RELEASED'}><summary className="cursor-pointer text-sm font-semibold">Histórico de bloqueios e liberações · {r.events.length} registro(s)</summary><ol className="mt-4 space-y-4 border-l-2 border-slate-200 pl-4">{r.events.map(e=><li key={e.id} className="min-w-0"><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{e.before?'Decisão:':'Registro inicial:'} {restrictionLabels[e.decision]}</strong><time className="text-xs text-slate-500" dateTime={e.createdAt.toISOString()}>{incidentDate(e.createdAt)}</time></div><p className="mt-1 break-words text-xs text-slate-500">{e.actor}</p>{e.solution&&<p className="mt-2 whitespace-pre-wrap break-words text-sm"><strong>Solução aplicada:</strong> {e.solution}</p>}<p className="mt-2 whitespace-pre-wrap break-words text-sm">{e.notes}</p><RecordedVehicleState snapshot={e.after}/>{e.evidence.map(file=><a className="mt-2 block break-all text-sm font-medium text-emerald-700" key={file.id} href={`/api/admin/restriction-evidence/${file.id}`}>Baixar evidência: {file.fileName}</a>)}</li>)}</ol></details>
 {r.state!=='RELEASED'&&<RestrictionDecisionForm key={r.revision} id={r.id} revision={r.revision} state={r.state} requiresEvidence={r.releaseEvidenceRequired} otherActive={activeCount-1}/>}</article>)}</div>}</section>;
}
