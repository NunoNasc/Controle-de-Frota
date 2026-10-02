import { PrismaClient } from '@prisma/client';
import { fleet } from './fleet-data';
import { seedChecklistConfig } from './seed-checklist-config';
const db = new PrismaClient();
async function main() {
  await seedChecklistConfig(db);
  // Real inventory only. Existing operational information and QR tokens are preserved.
  await db.$transaction(async tx => {
    for (const vehicle of fleet) await tx.vehicle.upsert({
      where: { plate: vehicle.plate }, update: {},
      create: { ...vehicle, status: 'UNKNOWN', availability: 'UNKNOWN', mileage: null, code: null, unit: null },
    });
  });
  console.log(`${fleet.length} veículos da relação real conferidos. Nenhum dado operacional fictício criado.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
