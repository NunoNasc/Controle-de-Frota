import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, cpSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const databaseDir = path.resolve('.local-db');
const pg = new EmbeddedPostgres({ databaseDir, user: 'frota', password: 'frota_local_dev', port: 54329, persistent: true, authMethod: 'scram-sha-256', initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'] });
let server;
if (process.platform === 'win32') {
  // Native Windows executables cannot start from pnpm paths exceeding MAX_PATH.
  const require = createRequire(import.meta.url);
  const embeddedRequire = createRequire(require.resolve('embedded-postgres'));
  const native = path.resolve(path.dirname(embeddedRequire.resolve('@embedded-postgres/windows-x64')), '../native');
  const runtime = path.resolve('.pg-runtime');
  if (!existsSync(path.join(runtime, 'bin/initdb.exe'))) cpSync(native, runtime, { recursive: true });
  if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
    const passwordFile = path.resolve('.pg-password'); writeFileSync(passwordFile, 'frota_local_dev\n');
    try { await new Promise((resolve, reject) => { const child = spawn(path.join(runtime,'bin/initdb.exe'), ['-D', databaseDir, '-U', 'frota', '--auth=scram-sha-256', `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C'], { stdio: 'inherit', windowsHide: true }); child.on('error',reject); child.on('exit',code => code === 0 ? resolve() : reject(new Error(`initdb: ${code}`))); }); } finally { unlinkSync(passwordFile); }
  }
  server = spawn(path.join(runtime,'bin/postgres.exe'), ['-D', databaseDir, '-p', '54329', '-h', '127.0.0.1'], { stdio: ['ignore','pipe','pipe'], windowsHide: true });
  await new Promise((resolve,reject) => { const timer = setTimeout(() => reject(new Error('PostgreSQL startup timeout')),30000); server.on('error',reject); server.on('exit',code => reject(new Error(`postgres: ${code}`))); server.stderr.on('data', chunk => { const message = chunk.toString(); process.stdout.write(message); if (message.includes('ready to accept connections')) { clearTimeout(timer); resolve(); } }); });
} else {
  if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
}
const client = pg.getPgClient();
await client.connect();
const result = await client.query("SELECT 1 FROM pg_database WHERE datname = 'frota'");
if (!result.rows.length) await client.query('CREATE DATABASE frota');
await client.end();
console.log('PostgreSQL local pronto em 127.0.0.1:54329. Ctrl+C encerra o banco preservando os dados.');
const timer = setInterval(() => {}, 60000);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { clearInterval(timer); if (server) server.kill(); else await pg.stop(); process.exit(0); });
