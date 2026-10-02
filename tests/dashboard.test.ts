import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboard,defaultFilters,parseDashboardFilters,parsePolicy,openAge,type DashboardInput,type FleetVehicle,type ChecklistRecord,type IncidentRecord } from '../src/lib/dashboard-domain';
const now = new Date('2026-09-28T15:00:00Z');
const v = (id:string,extra:Partial<FleetVehicle>={}):FleetVehicle => ({ id,plate:id,code:id,model:'Modelo',active:true,status:'AVAILABLE',availability:'AVAILABLE',mileage:1000,costCenterId:null,costCenterName:null,...extra });
const input = (extra:Partial<DashboardInput>={}):DashboardInput => ({ vehicles:[v('a')],incidents:[],alerts:[],checklists:[],preventives:[],maintenance:[],documents:[],...extra });
const check = (id:string,extra:Partial<ChecklistRecord>={}):ChecklistRecord => ({ id,vehicleId:'a',driverName:'Condutor',type:'PRE_TRIP',status:'SUBMITTED',result:'OK',hasProblem:false,submittedAt:new Date('2026-09-28T12:00:00Z'),conformityPercentage:100,answers:[],...extra });
const incident = (id:string,extra:Partial<IncidentRecord>={}):IncidentRecord => ({ id,number:1,vehicleId:'a',title:id,priority:'HIGH',status:'OPEN',openedAt:new Date('2026-09-27T12:00:00Z'),responsibleName:null,checklistId:null,...extra });

test('cadastro sem situação ou hodômetro não inventa disponibilidade nem pendência',() => {
  const data = buildDashboard(input({vehicles:[v('a',{status:'UNKNOWN',availability:'UNKNOWN',mileage:null,code:null})]}),defaultFilters,now);
  assert.equal(data.counts.frota,1);
  assert.equal(data.counts.disponiveis,0);
  assert.equal(data.counts.pendentes,0);
  assert.equal(data.actions.length,0);
  assert.equal(data.statuses.find(s=>s.status === 'UNKNOWN')?.count,1);
});

test('hodômetro ausente não antecipa vencimento por KM, mas mantém prazo por data',() => {
  const data = buildDashboard(input({vehicles:[v('a',{mileage:null})],preventives:[
    {id:'future',vehicleId:'a',title:'Futura',dueAt:new Date('2027-01-01'),dueMileage:100,completedAt:null},
    {id:'expired',vehicleId:'a',title:'Vencida',dueAt:new Date('2026-01-01'),dueMileage:100,completedAt:null},
  ]}),defaultFilters,now);
  assert.equal(data.counts.vencidas,1);
  assert.equal(data.counts.proximas,0);
});
test('cards distinguem veículos disponíveis, em uso e indisponíveis; pendência só para aptos',() => {
  const data = buildDashboard(input({ vehicles:[v('a'),v('b',{ status:'IN_USE' }),v('c',{ status:'MAINTENANCE',availability:'UNAVAILABLE' }),v('d',{ status:'STOPPED',availability:'UNAVAILABLE' }),v('e',{ status:'INACTIVE',active:false,availability:'UNAVAILABLE' })] }),defaultFilters,now);
  assert.equal(data.counts.frota,5); assert.equal(data.counts.disponiveis,1); assert.equal(data.counts.manutencao,1); assert.equal(data.counts.parados,1); assert.equal(data.counts.pendentes,2);
  assert.ok(data.actions.some(r => r.id === 'stopped:d'));
});
test('checklist diário respeita meia-noite da Bahia, tipo, cancelamento e avaliação',() => {
  for (const c of [check('old',{ submittedAt:new Date('2026-09-28T02:59:59Z') }),check('post',{ type:'POST_TRIP' }),check('draft',{ status:'DRAFT' }),check('cancel',{ status:'CANCELED' }),check('na',{ result:'NOT_EVALUATED' })]) assert.equal(buildDashboard(input({ checklists:[c] }),defaultFilters,now).counts.pendentes,1);
  for (const c of [check('valid',{ submittedAt:new Date('2026-09-28T03:00:00Z') }),check('legacy',{ type:'UNSPECIFIED',status:'REVIEWED' })]) assert.equal(buildDashboard(input({ checklists:[c] }),defaultFilters,now).counts.pendentes,0);
});
test('preventivas usam data ou km, limite inclusivo e não misturam vencidas com próximas',() => {
  const preventive = (id:string,days:number,km:number,completedAt:Date|null=null) => ({ id,vehicleId:'a',title:id,dueAt:new Date(now.getTime()+days*86400000),dueMileage:1000+km,completedAt });
  const data = buildDashboard(input({ preventives:[preventive('date',-1,2000),preventive('km',20,0),preventive('today',0,3000),preventive('seven',7,2000),preventive('thousand',8,1000),preventive('far',8,1001),preventive('done',-2,-10,now)] }),defaultFilters,now);
  assert.equal(data.counts.vencidas,2); assert.equal(data.counts.proximas,3);
  assert.equal(data.views.vencidas.find(r => r.id === 'preventive:km')?.detectedAt,null);
});
test('somente pendências; ordem crítico, urgente, atenção, normal e antiguidade',() => {
  const data = buildDashboard(input({ checklists:[check('valid')],incidents:[incident('normal',{ priority:'LOW' }),incident('attention',{ priority:'MEDIUM' }),incident('urgent-new'),incident('critical',{ priority:'CRITICAL' }),incident('urgent-old',{ openedAt:new Date('2026-01-01T12:00:00Z') }),incident('done',{ status:'COMPLETED' }),incident('canceled',{ status:'CANCELED' })] }),defaultFilters,now);
  assert.deepEqual(data.actions.map(r => r.id),['incident:critical','incident:urgent-old','incident:urgent-new','incident:attention','incident:normal']);
});
test('deduplica espelhos sem esconder alerta de gravidade superior',() => {
  const source = input({ checklists:[check('c',{ hasProblem:true,result:'ISSUE',answers:[{ answer:'ISSUE',priority:'HIGH' }] })],incidents:[incident('i',{ title:'Falha',checklistId:'c' })],alerts:[{ id:'mirror',vehicleId:'a',title:'Falha',priority:'HIGH',status:'OPEN',createdAt:now },{ id:'critical',vehicleId:'a',title:'Falha',priority:'CRITICAL',status:'OPEN',createdAt:now }] });
  const data = buildDashboard(source,defaultFilters,now);
  assert.equal(data.actions.length,2); assert.ok(data.actions.some(r => r.id === 'alert:critical')); assert.equal(data.counts.inconformes,1); assert.equal(data.counts.criticos,1);
});
test('período não apaga frota atual; sem data permanece visível; filtro de centro é independente de unidade',() => {
  const source = input({ vehicles:[v('a',{ costCenterId:'cc1' }),v('b',{ costCenterId:'cc2' })],incidents:[incident('old',{ openedAt:new Date('2025-01-01') }),incident('recent',{ vehicleId:'b',priority:'CRITICAL',openedAt:now })],preventives:[{ id:'km',vehicleId:'a',title:'KM',dueAt:new Date('2027-01-01'),dueMileage:900,completedAt:null }] });
  const data = buildDashboard(source,{ ...defaultFilters,period:'today' },now);
  assert.equal(data.counts.frota,2); assert.equal(data.counts.ocorrencias,1); assert.equal(data.counts.vencidas,1);
  const combined = buildDashboard(source,{ ...defaultFilters,costCenter:'cc2',vehicle:'b',status:'AVAILABLE',priority:'CRITICAL',period:'today' },now);
  assert.equal(combined.counts.frota,1); assert.equal(combined.counts.ocorrencias,1); assert.ok(combined.actions.every(r => r.vehicleId === 'b' && r.priority === 'CRITICAL'));
  assert.equal(buildDashboard(source,{ ...defaultFilters,vehicle:'missing' },now).counts.frota,0);
});
test('manutenção regular não exige intervenção; atrasos sim; concluídos ficam fora',() => {
  const maintenance = (id:string,status:'OPEN'|'IN_PROGRESS'|'COMPLETED',expectedAt:Date|null) => ({ id,vehicleId:'a',title:id,status,scheduledAt:new Date('2026-09-27'),enteredAt:null,expectedAt,responsibleName:null,supplierName:null });
  const data = buildDashboard(input({ checklists:[check('valid')],maintenance:[maintenance('regular','IN_PROGRESS',new Date('2026-09-30')),maintenance('late','IN_PROGRESS',new Date('2026-09-26')),maintenance('done','COMPLETED',new Date('2026-09-26'))] }),defaultFilters,now);
  assert.equal(data.counts.servicos,2); assert.deepEqual(data.actions.map(r => r.id),['service-action:late']);
});
test('parâmetros inválidos são neutralizados e regras configuráveis têm limites',() => {
  assert.deepEqual(parseDashboardFilters({ priority:'toString',status:'bad',period:'-5' }),defaultFilters);
  assert.deepEqual(parsePolicy({ upcomingDays:0,upcomingKm:-1 }),{ upcomingDays:7,upcomingKm:1000 });
  assert.deepEqual(parsePolicy({ upcomingDays:14,upcomingKm:500 }),{ upcomingDays:14,upcomingKm:500 });
  assert.equal(openAge(null,now),'Não registrado'); assert.equal(openAge(new Date(now.getTime()+1000),now),'0 min');
});
