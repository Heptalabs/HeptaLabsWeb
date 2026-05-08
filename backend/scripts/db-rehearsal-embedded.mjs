#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const { Client } = pg;

const envFile = process.argv[2] || '.env.production';
const envKeysFileArg = process.argv[3] || process.env.ENV_KEYS_FILE || '';
const backupDirArg = process.argv[4] || 'ops/backups';

const cwd = process.cwd();
const envPath = path.resolve(cwd, envFile);
const envKeysPath = envKeysFileArg ? path.resolve(cwd, envKeysFileArg) : '';
const backupDir = path.resolve(cwd, backupDirArg);
const embeddedDataDir = path.resolve(cwd, 'ops/.embedded-postgres');

dotenv.config({ path: envPath });
if (envKeysPath) {
  dotenv.config({ path: envKeysPath, override: true });
}

const databaseUrlRaw = process.env.DATABASE_URL || '';
if (!databaseUrlRaw) {
  console.error('[db-rehearsal-embedded] fail: DATABASE_URL is missing');
  process.exit(1);
}

const databaseUrl = new URL(databaseUrlRaw);
const host = databaseUrl.hostname || '127.0.0.1';
if (!['127.0.0.1', 'localhost'].includes(host)) {
  console.error(`[db-rehearsal-embedded] fail: host must be localhost/127.0.0.1 (got: ${host})`);
  process.exit(1);
}

const port = Number(databaseUrl.port || 5432);
const user = decodeURIComponent(databaseUrl.username || 'postgres');
const password = decodeURIComponent(databaseUrl.password || 'postgres');
const dbName = databaseUrl.pathname.replace(/^\//, '') || 'heptalabs';
const sourceDbName = `${dbName}_src_${Date.now()}`;
const sourceDbUrl = new URL(databaseUrl.toString());
sourceDbUrl.pathname = `/${sourceDbName}`;
const redactedDbUrl = new URL(databaseUrl.toString());
if (redactedDbUrl.password) redactedDbUrl.password = '***';

const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const backupFile = path.join(backupDir, `imwallet-db-${ts}.json`);
const runSeed = String(process.env.RUN_SEED || '0') === '1';

const run = (cmd, args, extraEnv = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} failed (code=${code})`));
    });
  });

const ensureDatabaseExists = async (targetDbName) => {
  const adminUrl = new URL(databaseUrl.toString());
  adminUrl.pathname = '/postgres';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname=$1 LIMIT 1', [targetDbName]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${targetDbName.replace(/"/g, '""')}"`);
      console.log(`[db-rehearsal-embedded] created database: ${targetDbName}`);
    } else {
      console.log(`[db-rehearsal-embedded] database exists: ${targetDbName}`);
    }
  } finally {
    await client.end();
  }
};

const dropDatabaseIfExists = async (targetDbName) => {
  const adminUrl = new URL(databaseUrl.toString());
  adminUrl.pathname = '/postgres';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    await client.query(
      `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
      `,
      [targetDbName]
    );
    await client.query(`DROP DATABASE IF EXISTS "${targetDbName.replace(/"/g, '""')}"`);
    console.log(`[db-rehearsal-embedded] dropped database: ${targetDbName}`);
  } finally {
    await client.end();
  }
};

const pgServer = new EmbeddedPostgres({
  databaseDir: embeddedDataDir,
  user,
  password,
  port,
  persistent: true,
  initdbFlags: ['--locale=C', '--encoding=UTF8']
});

const main = async () => {
  console.log(`[db-rehearsal-embedded] env: ${envPath}`);
  if (envKeysPath) {
    console.log(`[db-rehearsal-embedded] env keys: ${envKeysPath}`);
  }
  console.log(`[db-rehearsal-embedded] data dir: ${embeddedDataDir}`);
  console.log(`[db-rehearsal-embedded] database url: ${redactedDbUrl.toString()}`);

  await fs.mkdir(backupDir, { recursive: true });
  await fs.mkdir(embeddedDataDir, { recursive: true });
  const pgVersionFile = path.join(embeddedDataDir, 'PG_VERSION');
  const isInitialized = await fs
    .access(pgVersionFile)
    .then(() => true)
    .catch(() => false);
  if (!isInitialized) {
    await pgServer.initialise();
    console.log('[db-rehearsal-embedded] cluster initialized');
  } else {
    console.log('[db-rehearsal-embedded] reuse existing cluster');
  }
  await pgServer.start();
  console.log('[db-rehearsal-embedded] embedded postgres started');

  try {
    await ensureDatabaseExists(dbName);
    await dropDatabaseIfExists(sourceDbName);
    await ensureDatabaseExists(sourceDbName);
    await run('npm', ['run', 'db:migrate'], { DATABASE_URL: sourceDbUrl.toString() });
    if (runSeed) {
      await run('npm', ['run', 'db:seed'], { DATABASE_URL: sourceDbUrl.toString() });
    } else {
      console.log('[db-rehearsal-embedded] skip db:seed (set RUN_SEED=1 to include seed step)');
    }

    await run('node', ['./scripts/db-backup-fallback.mjs', sourceDbUrl.toString(), backupFile], {
      DATABASE_URL: sourceDbUrl.toString()
    });

    await run('node', ['./scripts/db-restore-rehearsal-json.mjs', sourceDbUrl.toString(), backupFile, '0'], {
      DATABASE_URL: sourceDbUrl.toString()
    });

    await dropDatabaseIfExists(sourceDbName);
    console.log('[db-rehearsal-embedded] done');
  } finally {
    await pgServer.stop().catch((error) => {
      console.error('[db-rehearsal-embedded] stop warning:', error);
    });
    console.log('[db-rehearsal-embedded] embedded postgres stopped');
  }
};

main().catch((error) => {
  console.error('[db-rehearsal-embedded] failed:', error);
  process.exit(1);
});
