'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { parseDashboardFilters, priorityLabels, vehicleStates } from '@/lib/dashboard-domain';
import { labels } from '@/components/status-badge';
type Props = { costCenters:{ id:string;name:string }[]; vehicles:{ id:string;plate:string;model:string;costCenterId:string|null }[]; updatedAt:string };
export function DashboardFilters({ costCenters,vehicles,updatedAt }:Props) {
  const router = useRouter(); const search = useSearchParams(); const path = usePathname(); const [pending,startTransition] = useTransition();
  const filters = parseDashboardFilters(Object.fromEntries(search));
  useEffect(() => { const id = setInterval(() => { if (document.visibilityState === 'visible') startTransition(() => router.refresh()); },30000); return () => clearInterval(id); },[router]);
  const change = (key:string,value:string) => { const params = new URLSearchParams(search); if (value && value !== 'all') params.set(key,value); else params.delete(key); if (key === 'costCenter') params.delete('vehicle'); startTransition(() => router.replace(`${path}?${params}`,{ scroll:false })); };
  const options = vehicles.filter(v => !filters.costCenter || (filters.costCenter === 'unassigned' ? !v.costCenterId : v.costCenterId === filters.costCenter));
  const active = !!(filters.costCenter || filters.vehicle || filters.status || filters.priority || filters.period !== 'all');
  return <section className="op-filters" aria-label="Filtros do dashboard" aria-busy={pending}>
    <div className="op-filter-fields"><span className="op-filter-icon"><SlidersHorizontal size={17}/></span>
      <label>Centro de custo<select aria-label="Centro de custo" disabled={pending} value={filters.costCenter} onChange={e => change('costCenter',e.target.value)}><option value="">Todos os centros</option><option value="unassigned">Não informado</option>{costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Veículo<select aria-label="Veículo" disabled={pending} value={filters.vehicle} onChange={e => change('vehicle',e.target.value)}><option value="">Todos os veículos</option>{options.map(v => <option key={v.id} value={v.id}>{v.plate} · {v.model}</option>)}</select></label>
      <label>Status do veículo<select aria-label="Status do veículo" disabled={pending} value={filters.status} onChange={e => change('status',e.target.value)}><option value="">Todos os status</option>{vehicleStates.map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></label>
      <label>Criticidade<select aria-label="Criticidade" disabled={pending} value={filters.priority} onChange={e => change('priority',e.target.value)}><option value="">Todas as prioridades</option>{Object.entries(priorityLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Período de detecção<select aria-label="Período de detecção" disabled={pending} value={filters.period} onChange={e => change('period',e.target.value)}><option value="all">Todas as datas</option><option value="today">Hoje</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select></label>
    </div><div className="op-filter-footer"><p>Frota: situação atual. Período: detecção das pendências e entrada em manutenção. Próximas preventivas: horizonte futuro.</p><div className="flex items-center gap-3">{active && <Button size="sm" variant="ghost" onClick={() => startTransition(() => router.replace(path,{ scroll:false }))}><X/>Limpar filtros</Button>}<span className="op-updated" aria-live="polite">{pending ? 'Atualizando…' : `Atualizado ${new Date(updatedAt).toLocaleTimeString('pt-BR',{ timeZone:'America/Bahia',hour:'2-digit',minute:'2-digit' })}`}</span><Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(() => router.refresh())} aria-label="Atualizar dashboard"><RefreshCw size={14} className={pending ? 'animate-spin' : ''}/><span>Atualizar</span></Button></div></div>
  </section>;
}
