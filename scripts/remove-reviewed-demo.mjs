// One-time cleanup of the reviewed snapshot. Abort if ANY original data has changed.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PrismaClient();
const backup = JSON.parse(readFileSync('.local-backups/before-real-fleet-1790619760906.json','utf8'));
const order = ['Evidence','Maintenance','ChecklistAnswer','Incident','Checklist','Alert','Preventive','Document','Tire','PurchaseOrder','Vehicle','Driver','Supplier','Equipment','PurchaseRequisition','StaffMember','CostCenter'];
const expected = {Evidence:2,Maintenance:8,ChecklistAnswer:174,Incident:4,Checklist:29,Alert:3,Preventive:7,Document:7,Tire:7,PurchaseOrder:5,Vehicle:13,Driver:5,Supplier:2,Equipment:1,PurchaseRequisition:1,StaffMember:1,CostCenter:1};
try {
 assert.equal(process.argv[2],'--apply','Explicit --apply required');
 await db.$transaction(async tx => {
  await tx.$executeRawUnsafe(`LOCK TABLE ${order.map(t=>`"${t}"`).join(',')} IN EXCLUSIVE MODE`);
  for (const table of order) {
   assert.equal(backup[table].length,expected[table],`Unexpected snapshot: ${table}`);
   const current = (await tx.$queryRawUnsafe(`SELECT row_to_json(t) AS record FROM "${table}" t`)).map(r=>r.record);
   assert.equal(current.length,backup[table].length,`New records in ${table}; manual review needed, nothing deleted`);
   const byId = new Map(current.map(r=>[r.id,r]));
   for (const before of backup[table]) {
    const after = byId.get(before.id); assert.ok(after);
    for (const [key,value] of Object.entries(before)) assert.deepEqual(after[key],value,`${table}.${key} changed; cleanup aborted`);
   }
  }
  for (const table of order) {
   const count = await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE id = ANY($1::text[])`,backup[table].map(r=>r.id));
   assert.equal(count,expected[table]);
   console.log(`${table}: ${count} registros fictícios removidos`);
  }
 }, {timeout:30000});
} finally { await db.$disconnect(); }
