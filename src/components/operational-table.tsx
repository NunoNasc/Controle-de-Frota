'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { priorityLabels, type OperationalRow } from '@/lib/dashboard-domain';
export function PriorityBadge({ priority }:{ priority:keyof typeof priorityLabels }) { return <span className={`badge ${ { CRITICAL:'badge-red',HIGH:'badge-orange',MEDIUM:'badge-yellow',LOW:'badge-green' }[priority] }`}>{priorityLabels[priority]}</span>; }
export function OperationalTable({ rows, compact=false, emptyMessage='Nenhuma situação exige intervenção com estes filtros.', pageSize=8 }:{ rows:OperationalRow[];compact?:boolean;emptyMessage?:string;pageSize?:number }) {
  const [page,setPage] = useState(0); const pages = Math.max(1,Math.ceil(rows.length/pageSize)); const current = Math.min(page,pages-1);
  if (!rows.length) return <div className="op-empty"><CheckCircle2 size={25}/><p>{emptyMessage}</p></div>;
  return <><div className="op-table-scroll" tabIndex={0} aria-label="Tabela operacional; role horizontalmente quando necessário"><table className={`op-table ${compact ? 'op-table-compact' : ''}`}><thead><tr><th>Prioridade</th><th>Placa</th>{!compact && <th>Veículo</th>}<th>{compact ? 'Situação / serviço' : 'Problema'}</th>{!compact && <><th>Origem</th><th>Detectado em</th><th>Tempo em aberto</th></>}<th>Responsável</th><th>Status</th><th>Ação</th></tr></thead><tbody>{rows.slice(current*pageSize,current*pageSize+pageSize).map(r => <tr key={r.id} data-priority={r.priority}>
    <td><PriorityBadge priority={r.priority}/></td><td><Link className="plate" href={r.vehicleId ? `/frota/${r.vehicleId}` : r.href}>{r.plate}</Link></td>{!compact && <td className="op-model" title={r.vehicle}>{r.vehicle}</td>}
    <td className="op-problem"><span>{r.problem}</span>{r.detail && <small>{r.detail}</small>}</td>{!compact && <><td className="op-origin">{r.origin}</td><td className="op-detected">{r.detectedAt ? <><span>{new Date(r.detectedAt).toLocaleDateString('pt-BR',{ timeZone:'America/Bahia' })}</span><small>{new Date(r.detectedAt).toLocaleTimeString('pt-BR',{ timeZone:'America/Bahia',hour:'2-digit',minute:'2-digit' })}</small></> : <span title="O histórico não informa quando o limite foi ultrapassado.">Não registrado</span>}</td><td className="op-age">{r.age}</td></>}
    <td className={r.responsible === 'Não atribuído' ? 'op-unassigned' : ''}>{r.responsible}</td><td><StatusBadge status={r.status}/></td><td><Link className="op-row-action" href={r.href}>{r.action}<ArrowUpRight size={12}/></Link></td>
  </tr>)}</tbody></table></div><div className="op-pagination"><span>{current*pageSize+1}–{Math.min((current+1)*pageSize,rows.length)} de {rows.length} registros</span><div className="flex items-center gap-2"><span>Página {current+1} de {pages}</span><Button variant="ghost" size="icon" disabled={current === 0} onClick={() => setPage(current-1)} aria-label="Pendências anteriores"><ChevronLeft/></Button><Button variant="ghost" size="icon" disabled={current === pages-1} onClick={() => setPage(current+1)} aria-label="Próximas pendências"><ChevronRight/></Button></div></div></>;
}
