import type { Priority, VehicleStatus } from '@prisma/client';
import {preventiveState,type PlanClock} from './preventive';


export type DashboardFilters = { costCenter: string; vehicle: string; status: string; priority: string; period: string };
export const defaultFilters: DashboardFilters = { costCenter: '', vehicle: '', status: '', priority: '', period: 'all' };
export const priorityLabels = { CRITICAL: 'Crítico', HIGH: 'Urgente', MEDIUM: 'Atenção', LOW: 'Normal' };
export const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
export const vehicleStates = ['AVAILABLE','IN_USE','MAINTENANCE','STOPPED','INACTIVE','UNKNOWN'] as const;
export function parseDashboardFilters(params: Record<string, string | string[] | undefined>): DashboardFilters {
  const value = (key: string) => typeof params[key] === 'string' ? params[key] as string : '';
  return { costCenter: value('costCenter'), vehicle: value('vehicle'), status: vehicleStates.includes(value('status') as VehicleStatus) ? value('status') : '', priority: Object.hasOwn(priorityLabels,value('priority')) ? value('priority') : '', period: ['all','today','7','30'].includes(value('period')) ? value('period') : 'all' };
}
export function filterQuery(filters: DashboardFilters) {
  const query = new URLSearchParams();
  for (const [key,value] of Object.entries(filters)) if (value && !(key === 'period' && value === 'all')) query.set(key,value);
  return query.toString();
}
export function dashboardHref(view: string, filters: DashboardFilters) { const query = filterQuery(filters); return `/painel/${view}${query ? `?${query}` : ''}`; }
export function dayKey(value: Date) { return new Intl.DateTimeFormat('en-CA', { timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit' }).format(value); }
export function dayDistance(from: Date, to: Date) { return Math.round((Date.parse(dayKey(to)) - Date.parse(dayKey(from)))/86400000); }
export function openAge(detectedAt: Date | null, now: Date) {
  if (!detectedAt) return 'Não registrado';
  const minutes = Math.max(0,Math.floor((now.getTime()-detectedAt.getTime())/60000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes/60)} h`;
  return `${Math.floor(minutes/1440)} d ${Math.floor(minutes%1440/60)} h`;
}
export interface FleetVehicle { id:string; plate:string; code:string|null; model:string; active:boolean; status:VehicleStatus; availability:string; operationalStatus?:string; mileage:number|null; costCenterId:string|null; costCenterName:string|null }
type Work = 'OPEN'|'IN_PROGRESS'|'COMPLETED'|'CANCELED';
export interface IncidentRecord { id:string; number:number; publicNumber?:string; vehicleId:string; title:string; priority:Priority; status:Work; openedAt:Date; responsibleName:string|null; checklistId:string|null }
export interface AlertRecord { id:string; vehicleId:string|null; title:string; priority:Priority; status:Work; createdAt:Date; preventivePlanId?:string|null }
export interface ChecklistRecord { id:string; vehicleId:string; driverName:string; type:string; status:string; result:string; hasProblem:boolean; submittedAt:Date; conformityPercentage:number|null; answers:{ answer:string; priority:Priority }[] }
export interface PreventiveRecord { id:string; vehicleId:string; title:string; dueAt:Date; dueMileage:number; completedAt:Date|null }
export interface MaintenanceRecord { id:string; vehicleId:string; title:string; status:Work; scheduledAt:Date|null; enteredAt:Date|null; expectedAt:Date|null; responsibleName:string|null; supplierName:string|null; unavailableFrom?:Date|null; unavailableUntil?:Date|null }
export interface DocumentRecord { id:string; vehicleId:string; title:string; expiresAt:Date }
export interface DashboardInput { vehicles:FleetVehicle[]; incidents:IncidentRecord[]; alerts:AlertRecord[]; checklists:ChecklistRecord[]; preventives:PreventiveRecord[]; maintenance:MaintenanceRecord[]; documents:DocumentRecord[]; plans?:(PlanClock&{id:string;vehicleId:string})[] }
export interface DashboardPolicy { upcomingDays:number; upcomingKm:number }
export const defaultPolicy: DashboardPolicy = { upcomingDays:7, upcomingKm:1000 };
export function parsePolicy(value: unknown): DashboardPolicy {
  const candidate = value && typeof value === 'object' ? value as Record<string,unknown> : {};
  return {
    upcomingDays: typeof candidate.upcomingDays === 'number' && Number.isInteger(candidate.upcomingDays) && candidate.upcomingDays >= 1 && candidate.upcomingDays <= 90 ? candidate.upcomingDays : defaultPolicy.upcomingDays,
    upcomingKm: typeof candidate.upcomingKm === 'number' && Number.isInteger(candidate.upcomingKm) && candidate.upcomingKm >= 1 && candidate.upcomingKm <= 10000 ? candidate.upcomingKm : defaultPolicy.upcomingKm,
  };
}
export interface OperationalRow { id:string; vehicleId:string|null; priority:Priority; plate:string; vehicle:string; problem:string; origin:string; detectedAt:string|null; age:string; responsible:string; status:string; href:string; action:string; detail:string }
export interface FleetRow { id:string; plate:string; model:string; code:string|null; costCenter:string; mileage:number|null; status:string; href:string }
export const viewLabels = { frota:'Frota Total', disponiveis:'Disponíveis', manutencao:'Em Manutenção', parados:'Parados', criticos:'Alertas Críticos', pendentes:'Checklists Pendentes', vencidas:'Preventivas Vencidas', ocorrencias:'Ocorrências Abertas', acoes:'Requer ação', servicos:'Manutenções em andamento', proximas:'Preventivas próximas do vencimento', inconformes:'Checklists com não conformidade' };
export type DashboardView = keyof typeof viewLabels;
export function buildDashboard(input: DashboardInput, filters: DashboardFilters, now = new Date(), policy = defaultPolicy) {
  const startToday = new Date(`${dayKey(now)}T00:00:00-03:00`);
  const start = filters.period === 'all' ? null : new Date(startToday.getTime() - (filters.period === 'today' ? 0 : Number(filters.period)-1)*86400000);
  // Unknown detection dates stay visible rather than silently hiding mileage-based backlog.
  const inPeriod = (value: Date|null) => !value || ((!start || value >= start) && value <= now);
  const isOpen = (status: string) => status === 'OPEN' || status === 'IN_PROGRESS';
  const effectiveStatus = (v:FleetVehicle) => v.active ? v.status : 'INACTIVE';
  const vehicles = input.vehicles.filter(v => (!filters.costCenter || (filters.costCenter === 'unassigned' ? !v.costCenterId : v.costCenterId === filters.costCenter)) && (!filters.vehicle || v.id === filters.vehicle) && (!filters.status || effectiveStatus(v) === filters.status));
  const byId = new Map(vehicles.map(v => [v.id,v]));
  const isSelected = (id:string) => byId.has(id);
  const priorityMatches = (p:string) => !filters.priority || p === filters.priority;
  const row = (id:string,vehicleId:string|null,problem:string,origin:string,priority:Priority,status:string,detectedAt:Date|null,responsible:string|null,href:string,action:string,detail=''): OperationalRow => ({ id, vehicleId, priority, plate:vehicleId ? byId.get(vehicleId)?.plate ?? '—' : '—', vehicle:vehicleId ? byId.get(vehicleId)?.model ?? '—' : 'Operação geral', problem, origin, detectedAt:detectedAt?.toISOString() ?? null, age:openAge(detectedAt,now), responsible:responsible ?? 'Não atribuído', status, href, action, detail });
  const recordHref = (module:string,id:string) => `/${module}?record=${encodeURIComponent(id)}`;
  const incidentRows = input.incidents.filter(i => isSelected(i.vehicleId) && isOpen(i.status) && inPeriod(i.openedAt)).map(i => row(`incident:${i.id}`,i.vehicleId,i.title,'Ocorrência',i.priority,i.status,i.openedAt,i.responsibleName,recordHref('ocorrencias',i.id),'Ver ocorrência',i.publicNumber ?? `OC-${String(i.number).padStart(6,'0')}`));
  const hasFleetFilter = !!(filters.costCenter || filters.vehicle || filters.status);
  const alertRows = input.alerts.filter(a => (a.vehicleId ? isSelected(a.vehicleId) : !hasFleetFilter) && isOpen(a.status) && inPeriod(a.createdAt)).map(a => row(`alert:${a.id}`,a.vehicleId,a.title,'Alerta',a.priority,a.status,a.createdAt,null,recordHref('alertas',a.id),'Ver alerta'));
  const accepted = input.checklists.filter(c => ['SUBMITTED','REVIEWED'].includes(c.status) && c.submittedAt >= startToday && c.submittedAt <= now && ['PRE_TRIP','UNSPECIFIED'].includes(c.type) && c.result !== 'NOT_EVALUATED');
  const checkedToday = new Set(accepted.map(c => c.vehicleId));
  const pendingRows = vehicles.filter(v => v.active && v.availability === 'AVAILABLE' && ['AVAILABLE','IN_USE'].includes(v.status) && !checkedToday.has(v.id)).map(v => row(`pending:${v.id}`,v.id,'Checklist de saída não realizado hoje','Checklist diário','MEDIUM','OPEN',startToday,null,`/frota/${v.id}`,'Ver veículo','Ativo operacional sem inspeção de saída hoje.'));
  const overdueRows:OperationalRow[] = []; const upcomingRows:OperationalRow[] = [];
  for (const p of input.preventives) {
    const v = byId.get(p.vehicleId); if (!v || !v.active || v.status === 'INACTIVE' || p.completedAt) continue;
    const remainingDays = dayDistance(now,p.dueAt); const remainingKm = v.mileage === null ? Infinity : p.dueMileage-v.mileage;
    const expiredByDate = remainingDays < 0; const expiredByKm = remainingKm <= 0;
    if (expiredByDate || expiredByKm) {
      const detected = expiredByDate ? new Date(`${dayKey(p.dueAt)}T00:00:00-03:00`).getTime()+86400000 : null;
      const detectedAt = detected === null ? null : new Date(detected);
      if (inPeriod(detectedAt)) overdueRows.push(row(`preventive:${p.id}`,v.id,p.title,'Preventiva','HIGH','OVERDUE',detectedAt,null,recordHref('preventivas',p.id),'Ver preventiva',expiredByDate ? `${Math.abs(remainingDays)} dia(s) após o prazo` : `${Math.abs(remainingKm).toLocaleString('pt-BR')} km no limite ou acima`));
    } else if (remainingDays <= policy.upcomingDays || remainingKm <= policy.upcomingKm) {
      upcomingRows.push(row(`upcoming:${p.id}`,v.id,p.title,'Preventiva','MEDIUM','MEDIUM',null,null,recordHref('preventivas',p.id),'Planejar',`${remainingDays} dia(s) · ${Number.isFinite(remainingKm) ? remainingKm.toLocaleString('pt-BR') + ' km restantes' : 'quilometragem não informada'}`));
    }
  }
  const preventiveAttention:OperationalRow[]=[];
  const planIndicators={CURRENT:0,UPCOMING:0,ATTENTION:0,OVERDUE:0,UNKNOWN:0};
  for(const v of vehicles.filter(v=>v.active)){
    const plan=input.plans?.find(p=>p.vehicleId===v.id);const state=plan?preventiveState(plan,v.mileage,now):null;
    const status=state?.status??'UNKNOWN';const priority:Priority=status==='OVERDUE'?'HIGH':status==='ATTENTION'?'MEDIUM':'LOW';
    if(priorityMatches(priority))planIndicators[status]++;
    if(!plan||!state||status==='CURRENT'||status==='UNKNOWN')continue;
    const detail=`Atual: ${v.mileage===null?'não informado':v.mileage.toLocaleString('pt-BR')+' km'} · Preventiva: ${plan.nextMileage===null?'por data':plan.nextMileage.toLocaleString('pt-BR')+' km'} · ${state.remainingKm===null?'KM não avaliado':state.remainingKm<0?Math.abs(state.remainingKm).toLocaleString('pt-BR')+' km acima':'Faltam: '+state.remainingKm.toLocaleString('pt-BR')+' km'}${state.remainingDays===null?'':' · '+state.remainingDays+' dia(s) até a data'}`;
    const entry=row(`plan:${plan.id}`,v.id,'Preventiva do veículo','Preventiva',priority,status==='OVERDUE'?'OVERDUE':status==='ATTENTION'?'MEDIUM':'LOW',null,null,`/preventivas/${v.id}`,'Ver plano',detail);
    if(status==='OVERDUE')overdueRows.push(entry);else if(status==='ATTENTION')preventiveAttention.push(entry);else upcomingRows.push(entry);
  }
  const activeMaintenance = input.maintenance.filter(m => isSelected(m.vehicleId) && m.status === 'IN_PROGRESS' && inPeriod(m.enteredAt ?? m.scheduledAt));
  const maintenanceRows = activeMaintenance.map(m => { const late = m.expectedAt && dayDistance(now,m.expectedAt) < 0; return row(`maintenance:${m.id}`,m.vehicleId,m.title,'Manutenção',late ? 'HIGH' : 'LOW',m.status,m.enteredAt ?? m.scheduledAt,m.responsibleName,recordHref('manutencoes',m.id),'Ver manutenção',`${m.supplierName ?? 'Fornecedor não definido'} · ${m.expectedAt ? `previsão ${dayKey(m.expectedAt).split('-').reverse().join('/')}${late ? ' • atrasada' : ''}` : 'sem previsão'}`); });
  const maintenanceActions = input.maintenance.filter(m => isSelected(m.vehicleId) && isOpen(m.status) && (m.status === 'OPEN' ? !!m.scheduledAt && dayDistance(now,m.scheduledAt) <= 0 : !!m.expectedAt && dayDistance(now,m.expectedAt) < 0)).map(m => {
    const detected = m.status === 'OPEN' ? m.scheduledAt : new Date(`${dayKey(m.expectedAt!)}T00:00:00-03:00`).getTime()+86400000;
    return row(`service-action:${m.id}`,m.vehicleId,m.status === 'OPEN' ? `Serviço aguardando início: ${m.title}` : `Prazo de manutenção excedido: ${m.title}`,'Manutenção',m.status === 'OPEN' ? 'MEDIUM' : 'HIGH',m.status,new Date(detected!),m.responsibleName,recordHref('manutencoes',m.id),'Ver manutenção');
  }).filter(r => inPeriod(r.detectedAt ? new Date(r.detectedAt) : null));
  const checklistRows = input.checklists.filter(c => isSelected(c.vehicleId) && c.status === 'SUBMITTED' && (c.hasProblem || c.result === 'ISSUE') && inPeriod(c.submittedAt)).map(c => {
    const priorities = c.answers.filter(a => a.answer === 'ISSUE').map(a => a.priority).sort((a,b) => priorityOrder[a]-priorityOrder[b]);
    const linked = input.incidents.find(i => i.checklistId === c.id && isOpen(i.status));
    return row(`checklist:${c.id}`,c.vehicleId,'Checklist com não conformidade','Checklist',priorities[0] ?? 'MEDIUM','SUBMITTED',c.submittedAt,linked?.responsibleName ?? null,recordHref('checklists',c.id),'Ver checklist',`${c.driverName} · ${c.conformityPercentage === null ? 'não avaliado' : `${c.conformityPercentage.toLocaleString('pt-BR')}% conforme`}`);
  });
  const documentRows = input.documents.filter(d => isSelected(d.vehicleId) && dayDistance(now,d.expiresAt) < 0 && byId.get(d.vehicleId)?.active).map(d => row(`document:${d.id}`,d.vehicleId,`${d.title} vencido`,'Documento','HIGH','OVERDUE',new Date(new Date(`${dayKey(d.expiresAt)}T00:00:00-03:00`).getTime()+86400000),null,recordHref('documentos',d.id),'Ver documento')).filter(r => inPeriod(new Date(r.detectedAt!)));
  // Mirrors share vehicle and exact problem text. Keep the incident as the actionable source.
  const uniqueAlerts = alertRows.filter(a => !input.alerts.some(raw=>`alert:${raw.id}`===a.id&&raw.preventivePlanId)&&!incidentRows.some(i => i.vehicleId === a.vehicleId && i.problem === a.problem && priorityOrder[i.priority] <= priorityOrder[a.priority]));
  const uniqueChecklists = checklistRows.filter(c => !input.incidents.some(i => isOpen(i.status) && c.id === `checklist:${i.checklistId}` && incidentRows.some(r => r.id === `incident:${i.id}`)));
  const stoppedWithoutRecord = vehicles.filter(v => v.active && v.status === 'STOPPED' && !input.incidents.some(i => i.vehicleId === v.id && isOpen(i.status))).map(v => row(`stopped:${v.id}`,v.id,v.operationalStatus && v.operationalStatus !== 'CLEAR' ? 'VEÍCULO COM RESTRIÇÃO OPERACIONAL' : 'Veículo parado sem ocorrência aberta','Frota','CRITICAL',v.operationalStatus && v.operationalStatus !== 'CLEAR' ? v.operationalStatus : 'STOPPED',null,null,`/frota/${v.id}`,'Ver veículo'));
  const actions = [...incidentRows,...uniqueAlerts,...pendingRows,...overdueRows,...preventiveAttention,...maintenanceActions,...uniqueChecklists,...documentRows,...stoppedWithoutRecord].filter(r => priorityMatches(r.priority)).sort((a,b) => priorityOrder[a.priority]-priorityOrder[b.priority] || (a.detectedAt ? Date.parse(a.detectedAt) : Infinity)-(b.detectedAt ? Date.parse(b.detectedAt) : Infinity) || a.id.localeCompare(b.id));
  const priorityVehicles = new Set([...actions,...maintenanceRows,...upcomingRows,...checklistRows,...alertRows].filter(r => priorityMatches(r.priority)).map(a => a.vehicleId));
  const fleet = vehicles.filter(v => !filters.priority || priorityVehicles.has(v.id));
  const fleetRows = (source:FleetVehicle[]):FleetRow[] => source.map(v => ({ id:v.id,plate:v.plate,model:v.model,code:v.code,costCenter:v.costCenterName ?? 'Não informado',mileage:v.mileage,status:v.operationalStatus && v.operationalStatus !== 'CLEAR' ? v.operationalStatus : effectiveStatus(v),href:`/frota/${v.id}` }));
  const filtered = (rows:OperationalRow[]) => rows.filter(r => priorityMatches(r.priority));
  const views = {
    frota:fleetRows(fleet), disponiveis:fleetRows(fleet.filter(v => v.active && v.status === 'AVAILABLE' && v.availability === 'AVAILABLE')),
    manutencao:fleetRows(fleet.filter(v => effectiveStatus(v) === 'MAINTENANCE')), parados:fleetRows(fleet.filter(v => effectiveStatus(v) === 'STOPPED')),
    criticos:filtered(alertRows.filter(r => r.priority === 'CRITICAL')), pendentes:filtered(pendingRows), vencidas:filtered(overdueRows), ocorrencias:filtered(incidentRows),
    acoes:actions, servicos:filtered(maintenanceRows), proximas:filtered(upcomingRows), inconformes:filtered(checklistRows),
  };
  const statuses = vehicleStates.filter(status => !filters.status || filters.status === status).map(status => ({ status,count:fleet.filter(v => effectiveStatus(v) === status).length }));
  return { filters,policy,views,actions,statuses,planIndicators,updatedAt:now.toISOString(),counts:Object.fromEntries(Object.entries(views).map(([key,rows]) => [key,rows.length])) as Record<DashboardView,number> };
}
