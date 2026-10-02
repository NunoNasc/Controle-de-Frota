import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getDashboard } from '@/lib/dashboard-data';
import { parseDashboardFilters,filterQuery,viewLabels,type DashboardView,type FleetRow,type OperationalRow } from '@/lib/dashboard-domain';
import { DashboardFilters } from '@/components/dashboard-filters';
import { OperationalTable } from '@/components/operational-table';
import { DataTable } from '@/components/data-table';
import { Card } from '@/components/ui/card';
export async function generateMetadata({ params }:{ params:Promise<{ view:string }> }) { const { view } = await params; return { title:viewLabels[view as DashboardView] ?? 'Dashboard' }; }
export default async function DashboardRecords({ params,searchParams }:{ params:Promise<{ view:string }>;searchParams:Promise<Record<string,string|string[]|undefined>> }) {
  const { view } = await params; if (!Object.hasOwn(viewLabels,view)) notFound();
  const filters = parseDashboardFilters(await searchParams); const data = await getDashboard(filters); const rows = data.views[view as DashboardView];
  const isFleet = ['frota','disponiveis','manutencao','parados'].includes(view); const query = filterQuery(filters);
  return <div className="page operational-page"><Link className="subtle-link mb-5" href={`/${query ? `?${query}` : ''}`}><ArrowLeft size={15}/>Voltar ao dashboard</Link><div className="page-heading"><div><div className="eyebrow">REGISTROS RELACIONADOS</div><h1>{viewLabels[view as DashboardView]}</h1><p>{rows.length} registros · mesmos critérios e filtros do dashboard</p></div></div><DashboardFilters costCenters={data.costCenters} vehicles={data.vehicleOptions} updatedAt={data.updatedAt}/>{isFleet ? <DataTable key={JSON.stringify(filters)} title={viewLabels[view as DashboardView]} columns={['Placa','Prefixo','Veículo','Centro de custo','Quilometragem']} rows={(rows as FleetRow[]).map(r => ({ id:r.id,cells:[r.plate,r.code ?? 'Não informado',r.model,r.costCenter,r.mileage === null ? 'Não informado' : `${r.mileage.toLocaleString('pt-BR')} km`],status:r.status,href:r.href }))}/> : <Card><OperationalTable key={JSON.stringify(filters)} rows={rows as OperationalRow[]} pageSize={15} emptyMessage="Nenhum registro corresponde a estes critérios."/></Card>}</div>;
}
