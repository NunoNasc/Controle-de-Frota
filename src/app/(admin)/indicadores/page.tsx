import Link from 'next/link';
import {prisma} from '@/lib/prisma';
import {getIndicators} from '@/lib/indicators';
import {indicatorFilters,percent,durationHours,type IndicatorParams} from '@/lib/indicator-filters';
import {incidentCategories} from '@/lib/incidents';
import {maintenanceKinds} from '@/lib/maintenance';
import {currency,integer} from '@/lib/utils';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {IndicatorTable,type IndicatorRow} from '@/components/indicator-table';
export const dynamic='force-dynamic';
export const metadata={title:'Indicadores'};
function Metric({label,value,note}:{label:string;value:string;note:string}){return <Card className="p-5 min-w-0"><h3 className="text-sm text-slate-600">{label}</h3><p className="text-3xl font-semibold mt-3 text-emerald-900" data-metric={label}>{value}</p><p className="text-xs text-slate-500 mt-3 leading-5">{note}</p></Card>;}
function Section({title,note,headers,rows}:{title:string;note:string;headers:string[];rows:IndicatorRow[]}){return <Card className="min-w-0 overflow-hidden"><div className="p-5 border-b border-slate-100"><h2 className="font-semibold">{title}</h2><p className="text-sm text-slate-500 mt-1">{note}</p></div><IndicatorTable label={title} headers={headers} rows={rows}/></Card>;}
export default async function IndicatorsPage({searchParams}:{searchParams:Promise<IndicatorParams>}){
 const f=indicatorFilters(await searchParams);
 const [vehicles,centers,report]=await Promise.all([
  prisma.vehicle.findMany({select:{id:true,plate:true,model:true,profile:true,category:true},orderBy:{plate:'asc'}}),
  prisma.costCenter.findMany({select:{id:true,code:true,name:true},orderBy:{code:'asc'}}),
  f.valid?getIndicators(f):Promise.resolve(null),
 ]);
 const types=[...new Set(vehicles.map(v=>v.profile||v.category))].sort();
 const input='block w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2.5 mt-2 text-sm';
 const cat=(c:string)=>incidentCategories[c as keyof typeof incidentCategories]??c;
 return <div className="page space-y-6"><div className="page-heading"><div><div className="eyebrow">GESTÃO · DADOS DA OPERAÇÃO</div><h1>Indicadores</h1><p>Disponibilidade, confiabilidade e custos da frota.</p></div><Button asChild variant="outline"><Link href="/relatorios">Relatórios</Link></Button></div>
 <form action="/indicadores" className="rounded-xl border border-slate-200 bg-white p-5" aria-label="Filtros de indicadores"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
 <label className="text-sm min-w-0">Período inicial<input className={input} type="date" name="from" defaultValue={f.from} required/></label><label className="text-sm min-w-0">Período final<input className={input} type="date" name="to" defaultValue={f.to} required/></label>
 <label className="text-sm min-w-0"><span id="indicator-vehicle-label">Veículo</span><select aria-labelledby="indicator-vehicle-label" className={input} name="vehicle" defaultValue={f.vehicle}><option value="">Todos os veículos</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} · {v.model}</option>)}</select></label>
 <label className="text-sm min-w-0"><span id="indicator-type-label">Tipo de veículo</span><select aria-labelledby="indicator-type-label" className={input} name="type" defaultValue={f.type}><option value="">Todos os tipos</option>{types.map(t=><option key={t}>{t}</option>)}</select></label>
 <label className="text-sm min-w-0"><span id="indicator-costCenter-label">Centro de custo</span><select aria-labelledby="indicator-costCenter-label" className={input} name="costCenter" defaultValue={f.costCenter}><option value="">Todos os centros</option><option value="unassigned">Não informado</option>{centers.map(c=><option value={c.id} key={c.id}>{c.code} · {c.name}</option>)}</select></label></div><div className="flex flex-wrap items-center gap-4 mt-4"><Button type="submit">Aplicar filtros</Button><Link href="/indicadores" className="text-sm text-emerald-700">Limpar filtros</Link><span className="text-xs text-slate-500">Datas em America/Bahia · início e fim inclusivos · padrão: últimos 30 dias</span></div></form>
 {!report?<p role="alert" className="p-5 rounded-xl bg-red-50 text-red-800">Informe datas válidas, com início anterior ou igual ao fim, sem datas futuras.</p>:<>
 <section aria-label="Situação atual"><h2 className="font-semibold mb-2">Situação atual da frota</h2><p className="text-sm text-slate-500 mb-4">Posição de {f.now.toLocaleString('pt-BR',{timeZone:'America/Bahia'})}. Aplica veículo, tipo e centro de custo; não reconstrói posições passadas.</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <Metric label="Disponibilidade da frota" value={percent(report.fleet.availability)} note={`${report.fleet.available} aptos / ${report.fleet.total} ativos. Inclui veículos em uso aptos; ${report.fleet.unknown} sem situação completa.`}/>
 <Metric label="Veículos parados" value={integer(report.fleet.stopped)} note="Indisponíveis, em manutenção ou com restrição operacional, sem duplicar veículos."/>
 <Metric label="Preventivas vencidas" value={integer(report.fleet.overdue)} note="Veículos com ao menos uma preventiva vencida por data ou KM; respeita tolerância dos planos."/>
 <Metric label="Veículos sem plano" value={integer(report.fleet.noPlan)} note="Ativos sem plano configurado. Ausência de plano não significa preventiva em dia."/>
 </div></section>
 <section aria-label="Resultados do período"><h2 className="font-semibold mb-4">Resultados do período</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <Metric label="Tempo médio parado" value={durationHours(report.downtime.hours)} note={`${report.downtime.episodes} períodos de parada em ${report.downtime.vehicles} veículos. Intervalos unidos e limitados ao período selecionado.`}/>
 <Metric label="Ocorrências críticas" value={integer(report.incidents.critical)} note={`Das ${report.incidents.total} ocorrências abertas no período, pela criticidade atual. Exclui canceladas e não procedentes.`}/>
 <Metric label="Reincidência de problemas" value={integer(report.incidents.repeated)} note="Repetições após a primeira ocorrência de mesmo problema, categoria e veículo dentro do período."/>
 <Metric label="Tempo médio para solução" value={durationHours(report.incidents.solutionHours)} note={`${report.incidents.solved} ocorrências liberadas/concluídas no período, da abertura à solução.`}/>
 <Metric label="Preventivas realizadas no prazo" value={percent(report.preventive.rate)} note={`${report.preventive.onTime} no prazo / ${report.preventive.onTime+report.preventive.late} avaliáveis. ${report.preventive.unknown} sem dados suficientes.`}/>
 <Metric label="Checklists realizados" value={integer(report.checks.total)} note="Enviados ou revisados no período. Exclui rascunhos e cancelados."/>
 <Metric label="Conformidade dos checklists" value={percent(report.checks.conformity)} note={`${report.checks.ok} respostas OK / ${report.checks.applicable} aplicáveis. Itens “não se aplica” são excluídos.`}/>
 <Metric label="Custo de manutenção" value={report.costs.total===null?'Não informado':currency(report.costs.total)} note={`${report.costs.known} serviços concluídos com custo. ${report.costs.unknown} sem valor informado, excluídos da soma.`}/>
 </div></section>
 <Section title="Ocorrências, problemas e custo por veículo" note="Ordenado pelos veículos com maior número de problemas. Respostas negativas vinculadas a ocorrências não são contadas novamente." headers={['Placa','Veículo','Ocorrências','Críticas','Problemas','Custo de manutenção','Sem custo informado']} rows={report.vehicles.map(v=>({key:v.id,href:`/frota/${v.id}`,cells:[v.plate,v.model,integer(v.incidents),integer(v.critical),integer(v.problems),v.cost===null?'Não informado':currency(v.cost),integer(v.unknownCosts)]}))}/>
 <div className="grid gap-5 xl:grid-cols-2"><Section title="Ocorrências por categoria" note="Ocorrências abertas dentro do período." headers={['Categoria','Ocorrências','Críticas']} rows={report.categories.map(c=>({key:c.category,cells:[cat(c.category),integer(c.total),integer(c.critical)]}))}/>
 <Section title="Custo preventivo x corretivo" note="Custos registrados de serviços concluídos no período. Preditivas e tipos não informados permanecem separados." headers={['Tipo','Custo','Com valor','Sem valor']} rows={report.costKinds.map(c=>({key:c.kind,cells:[maintenanceKinds[c.kind as keyof typeof maintenanceKinds]??'Não informado',c.cost===null?'Não informado':currency(c.cost),integer(c.known),integer(c.unknown)]}))}/></div>
 <Section title="Problemas reincidentes" note="Mesmo título normalizado (maiúsculas e espaços), categoria e veículo. Não pressupõe diagnóstico técnico idêntico." headers={['Placa','Problema','Categoria','Ocorrências','Repetições']} rows={report.recurrence.map((r,index)=>({key:String(index),href:`/frota/${r.vehicleId}`,cells:[r.plate,r.problem,cat(r.category),integer(r.total),integer(r.repeats)]}))}/>
 <details className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-slate-800">Como os indicadores são calculados</summary><div className="space-y-3 mt-4 leading-6"><p>Todos os totais são calculados no PostgreSQL, sem dados fictícios. O período filtra abertura das ocorrências, envio dos checklists, conclusão das manutenções e data registrada da última preventiva. Centro de custo e tipo usam o cadastro atual do veículo; históricos de veículos inativos continuam consultáveis.</p><p>Tempo parado une intervalos registrados de manutenção e restrição operacional para cada veículo, recorta pelo período e calcula a média dos intervalos resultantes. Veículo marcado como parado sem início registrado não permite calcular duração. Disponibilidade é a proporção de ativos aptos na posição atual, não uma disponibilidade histórica por horas.</p><p>Preventivas no prazo usam mudanças de ciclo no histórico do plano, comparando data e KM realizados com os limites do ciclo anterior, sem tolerância. O cadastro inicial não comprova um ciclo concluído. Registros antigos sem KM realizado só comprovam atraso por data; caso contrário ficam sem avaliação. Uma manutenção preventiva concluída sem registro do ciclo no plano não comprova cumprimento de prazo.</p><p>Custos incluem somente valores conhecidos de manutenções concluídas; orçamento, valor aprovado e pedidos não são somados. Sem base de cálculo, exibimos “Sem base” ou “Não informado”, nunca uma porcentagem inventada.</p></div></details>
 </>}
 </div>;
}
