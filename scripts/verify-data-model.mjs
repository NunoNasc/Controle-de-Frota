import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const db = new PrismaClient();
const rollback = new Error('INTENTIONAL_TEST_ROLLBACK');
async function mustReject(name, operation, pattern) {
  try { await db.$transaction(async tx => { await operation(tx); throw rollback; }); }
  catch (error) { if (error === rollback) throw new Error(`Constraint missing: ${name}`); assert.match(String(error),pattern,name); console.log(`PASS: ${name}`); return; }
  throw new Error(`Unexpected commit: ${name}`);
}
async function snapshot() {
  const result = {};
  const tables = await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename`;
  for (const {tablename} of tables) result[tablename] = await db.$queryRawUnsafe(`SELECT row_to_json(t) AS record FROM "${tablename.replaceAll('"','""')}" t ORDER BY COALESCE(row_to_json(t)->>'id', row_to_json(t)->>'key')`);
  return result;
}
try {
  const before = await snapshot();
  execFileSync(process.execPath,['node_modules/tsx/dist/cli.mjs','prisma/seed.ts'],{ stdio:'pipe',windowsHide:true });
  assert.deepEqual(await snapshot(),before,'seed must preserve all values, counts and timestamps on repeat');
  console.log('PASS: seed idempotente, inclusive novos relacionamentos e timestamps.');
  const example = await db.incident.findUniqueOrThrow({ where:{ id:'demo-v2-incident' },include:{ vehicle:{ include:{ costCenter:true } },driver:true,checklist:{ include:{ answers:{ include:{ photos:true } } } },responsible:true,evidence:true,maintenance:{ include:{ purchaseOrder:true,requisition:true,supplier:true } } } });
  assert.ok(example.vehicle.costCenter); assert.ok(example.driver); assert.ok(example.responsible); assert.equal(example.checklist.answers.length,6); assert.equal(example.checklist.answers.find(a => a.item === 'lights').photos.length,1); assert.equal(example.evidence.length,1);
  assert.equal(example.maintenance[0].purchaseOrder.requisitionId,example.maintenance[0].requisition.id); assert.equal(Number(example.maintenance[0].approvedAmount),320);
  console.log('PASS: veículo → checklist → ocorrência → manutenção → SC/pedido/fornecedor e evidências.');
  const vehicleId = example.vehicleId;
  const checklistData = () => ({ vehicleId,driverName:'Teste isolado',mileage:50000,result:'OK',submissionKey:randomUUID() });
  await mustReject('percentual fora da faixa',tx => tx.checklist.create({ data:{ ...checklistData(),conformityPercentage:101 } }),/Checklist_conformity_range/);
  await mustReject('coordenadas inválidas',tx => tx.checklist.create({ data:{ ...checklistData(),latitude:91,longitude:0 } }),/Checklist_location_valid/);
  await mustReject('coordenadas incompletas',tx => tx.checklist.create({ data:{ ...checklistData(),latitude:0 } }),/Checklist_location_valid/);
  await mustReject('veículo inexistente',tx => tx.checklist.create({ data:{ ...checklistData(),vehicleId:'missing' } }),/Foreign key constraint/);
  await mustReject('quilometragem negativa',tx => tx.checklist.create({ data:{ ...checklistData(),mileage:-1 } }),/Checklist_nonnegative_mileage/);
  await mustReject('orçamento negativo',tx => tx.maintenance.create({ data:{ vehicleId,title:'Teste',type:'Corretiva',scheduledAt:new Date(),budget:-1 } }),/Maintenance_nonnegative_values/);
  await mustReject('anexo sem proprietário',tx => tx.evidence.create({ data:{ fileName:'a.jpg',storageKey:'test/a.jpg',mimeType:'image/jpeg' } }),/Evidence_exactly_one_parent/);
  await mustReject('anexo com dois proprietários',tx => tx.evidence.create({ data:{ fileName:'a.jpg',storageKey:'test/a.jpg',mimeType:'image/jpeg',incidentId:example.id,checklistAnswerId:example.checklist.answers[0].id } }),/Evidence_exactly_one_parent/);
  const equipment = await db.equipment.findUniqueOrThrow({ where:{ code:'DEMO-EQ-001' } });
  await mustReject('pedido com dois ativos',tx => tx.purchaseOrder.create({ data:{ number:randomUUID(),description:'Teste',amount:1,vehicleId,equipmentId:equipment.id } }),/PurchaseOrder_single_asset/);
  await mustReject('pedido negativo',tx => tx.purchaseOrder.create({ data:{ number:randomUUID(),description:'Teste',amount:-1 } }),/PurchaseOrder_nonnegative_amount/);
  await mustReject('OS duplicada',tx => tx.maintenance.create({ data:{ vehicleId,title:'Teste',type:'Corretiva',scheduledAt:new Date(),serviceOrder:'DEMO-OS-001' } }),/Unique constraint/);
  await mustReject('exclusão de checklist com ocorrência',tx => tx.checklist.delete({ where:{ id:example.checklistId } }),/foreign key constraint/i);
  await mustReject('disponibilidade incompatível',tx => tx.vehicle.update({ where:{ id:vehicleId },data:{ status:'STOPPED',availability:'AVAILABLE' } }),/Vehicle_available_requires_operational/);
  await mustReject('conclusão anterior à entrada',tx => tx.maintenance.create({ data:{ vehicleId,title:'Teste',type:'Corretiva',scheduledAt:new Date(),enteredAt:new Date(),completedAt:new Date('2000-01-01') } }),/Maintenance_valid_dates/);
  try {
    await db.$transaction(async tx => {
      const created = await tx.costCenter.create({ data:{ code:randomUUID(),name:'Timestamp QA' } });
      const updated = await tx.costCenter.update({ where:{ id:created.id },data:{ name:'Alterado' } });
      assert.ok(updated.updatedAt >= created.updatedAt); assert.equal(updated.createdAt.getTime(),created.createdAt.getTime());
      const first = await tx.incident.create({ data:{ vehicleId,title:'Sequência A',description:'QA' } });
      const second = await tx.incident.create({ data:{ vehicleId,title:'Sequência B',description:'QA' } });
      assert.ok(second.number > first.number); throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  assert.deepEqual(await snapshot(),before,'database tests must leave application records unchanged');
  console.log('PASS: numeração automática, timestamps e rollback de todos os registros de teste.');
} finally { await db.$disconnect(); }
