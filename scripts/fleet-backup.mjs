import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
const db = new PrismaClient();
try {
 const snapshot = await db.$transaction(async tx => {
  const result = {};
  const tables = await tx.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  for (const {tablename} of tables) result[tablename] = (await tx.$queryRawUnsafe(`SELECT row_to_json(t) AS record FROM "${tablename.replaceAll('"','""')}" t`)).map(r=>r.record);
  return result;
 }, {isolationLevel:'RepeatableRead'});
 mkdirSync('.local-backups',{recursive:true});
 const path = `.local-backups/before-real-fleet-${Date.now()}.json`;
 writeFileSync(path,JSON.stringify(snapshot,null,2),{flag:'wx'});
 console.log(path, Object.fromEntries(Object.entries(snapshot).map(([k,v])=>[k,v.length])));
 console.log('Vehicles',snapshot.Vehicle.map(v=>({id:v.id,plate:v.plate})));
 console.log('Checklists',snapshot.Checklist.map(v=>({id:v.id,key:v.submissionKey})));
} finally {await db.$disconnect();}
