import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';
import { fleet } from '../prisma/fleet-data';
const db = new PrismaClient();
async function main() {
  const vehicles = await db.vehicle.findMany();
  assert.equal(fleet.length,24);
  for (const expected of fleet) {
    const actual = vehicles.find(v=>v.plate === expected.plate);
    assert.ok(actual,expected.plate);
    for (const key of ['model','year','profile','brand','category'] as const) assert.equal(actual[key],expected[key],`${expected.plate}.${key}`);
    assert.equal(actual.cargoVolumeM3 === null ? null : Number(actual.cargoVolumeM3),expected.cargoVolumeM3);
    assert.ok(actual.qrToken);
  }
  assert.equal(vehicles.filter(v=>v.plate === 'QTO6109').length,1);
  assert.equal(vehicles.filter(v=>v.id.startsWith('FT-') || v.plate === 'DEM0A13').length,0);
  assert.equal(await db.checklist.count({where:{OR:[{submissionKey:{startsWith:'seed-'}},{submissionKey:'demo-v2-checklist'}]}}),0);
  console.log('PASS: 24 veículos reais, campos conferidos, placas únicas, QR Codes e ausência de fixtures antigos.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
