import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PrismaClient();
const snapshotFile = '.local-backups/before-data-model-v2.json';
try {
  if (process.argv[2] === 'capture') {
    const snapshot = {};
    const tables = await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    for (const { tablename } of tables) {
      const name = tablename.replaceAll('"','""');
      snapshot[tablename] = await db.$queryRawUnsafe(`SELECT row_to_json(t) AS record FROM "${name}" t`);
    }
    await mkdir('.local-backups', { recursive:true });
    await writeFile(snapshotFile, JSON.stringify(snapshot,null,2), { flag:'wx' });
    console.log('Snapshot preservado:', Object.fromEntries(Object.entries(snapshot).map(([k,v]) => [k,v.length])));
  } else {
    const snapshot = JSON.parse(await readFile(snapshotFile,'utf8'));
    for (const [table, records] of Object.entries(snapshot)) {
      const current = await db.$queryRawUnsafe(`SELECT row_to_json(t) AS record FROM "${table.replaceAll('"','""')}" t`);
      const byId = new Map(current.map(({record}) => [record.id ?? record.key,record]));
      for (const {record} of records) {
        const after = byId.get(record.id ?? record.key);
        assert.ok(after, `Registro removido em ${table}`);
        for (const [key,value] of Object.entries(record)) assert.deepEqual(after[key],value, `${table}.${key} alterado no registro ${record.id ?? record.key}`);
      }
    }
    console.log('PASS: todos os registros e valores anteriores foram preservados.');
  }
} finally { await db.$disconnect(); }
