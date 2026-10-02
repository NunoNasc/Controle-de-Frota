import {syncAlertSources} from './alert-sources';
import { prisma } from '@/lib/prisma';
import { buildDashboard, dayKey, parsePolicy, type DashboardFilters } from '@/lib/dashboard-domain';
export async function getDashboard(filters: DashboardFilters) {
  await syncAlertSources();
  const now = new Date();
  const today = new Date(`${dayKey(now)}T00:00:00-03:00`);
  const [vehicles,incidents,alerts,checklists,preventives,maintenance,documents,setting,costCenters,plans] = await prisma.$transaction([
    prisma.vehicle.findMany({ include:{ costCenter:{ select:{ name:true } } },orderBy:{ plate:'asc' } }),
    prisma.incident.findMany({ where:{ status:{ in:['OPEN','IN_PROGRESS'] } },include:{ responsible:{ select:{ name:true } } } }),
    prisma.alert.findMany({ where:{ status:{ in:['OPEN','IN_PROGRESS'] } } }),
    prisma.checklist.findMany({ where:{ status:{ in:['SUBMITTED','REVIEWED'] },OR:[{ submittedAt:{ gte:today } },{ status:'SUBMITTED',OR:[{ hasProblem:true },{ result:'ISSUE' }] }] },include:{ answers:{ select:{ answer:true,priority:true } } },orderBy:{ submittedAt:'desc' } }),
    prisma.preventive.findMany({ where:{ completedAt:null },orderBy:{ dueAt:'asc' } }),
    prisma.maintenance.findMany({ where:{ status:{ in:['OPEN','IN_PROGRESS'] } },include:{ responsible:{ select:{ name:true } },supplier:{ select:{ name:true } } },orderBy:{ expectedAt:'asc' } }),
    prisma.document.findMany({ orderBy:{ expiresAt:'asc' } }),
    prisma.setting.findUnique({ where:{ key:'dashboardPolicy' } }),
    prisma.costCenter.findMany({ orderBy:{ name:'asc' },select:{ id:true,name:true } }),
    prisma.preventivePlan.findMany(),
  ], { isolationLevel:'RepeatableRead' });
  const dashboard = buildDashboard({
    vehicles:vehicles.map(v => ({ ...v,costCenterName:v.costCenter?.name ?? null })),
    incidents:incidents.map(i => ({ ...i,responsibleName:i.responsible?.name ?? null })),alerts,
    checklists:checklists.map(c => ({ ...c,conformityPercentage:c.conformityPercentage === null ? null : Number(c.conformityPercentage) })),
    plans,preventives,maintenance:maintenance.map(m => ({ ...m,responsibleName:m.responsible?.name ?? null,supplierName:m.supplier?.name ?? null })),documents,
  },filters,now,parsePolicy(setting?.value));
  return { ...dashboard,costCenters,vehicleOptions:vehicles.map(v => ({ id:v.id,plate:v.plate,model:v.model,costCenterId:v.costCenterId })) };
}
