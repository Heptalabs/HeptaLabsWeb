#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const databaseUrl = process.argv[2];
const backupFile = process.argv[3];
const keepRehearsalDb = String(process.argv[4] || '0') === '1';

if (!databaseUrl || !backupFile) {
  console.error(
    'usage: node ./scripts/db-restore-rehearsal-json.mjs <database-url> <backup-json-file> [keep-rehearsal-db:0|1]'
  );
  process.exit(1);
}

const quoteIdent = (value) => `"${String(value).replace(/"/g, '""')}"`;
const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const normalizeInsertValue = (value, columnMeta) => {
  if (value === null || value === undefined) return null;
  const udtName = String(columnMeta?.udtName || '').toLowerCase();
  if (udtName === 'json' || udtName === 'jsonb') {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return value;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaFiles = [
  path.join(repoRoot, '..', 'database', 'schema_v1.sql'),
  path.join(repoRoot, '..', 'database', 'functions_v1.sql')
];

const baseUrl = new URL(databaseUrl);
const baseDbName = baseUrl.pathname.replace(/^\//, '') || 'postgres';
const rehearsalDbName = `${baseDbName}_reh_${Date.now()}`;
const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';
const rehearsalUrl = new URL(databaseUrl);
rehearsalUrl.pathname = `/${rehearsalDbName}`;

async function runSchemaMigrations() {
  const client = new Client({ connectionString: rehearsalUrl.toString() });
  await client.connect();
  try {
    for (const file of schemaFiles) {
      const sql = await fs.readFile(file, 'utf8');
      await client.query(sql);
      console.log(`[db-restore-rehearsal-json] schema applied: ${file}`);
    }
  } finally {
    await client.end();
  }
}

async function restoreDataFromJson() {
  const raw = await fs.readFile(backupFile, 'utf8');
  const backup = JSON.parse(raw);
  const tables = Array.isArray(backup?.tables) ? backup.tables : [];

  const client = new Client({ connectionString: rehearsalUrl.toString() });
  await client.connect();

  try {
    const existingTablesResult = await client.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema='public'
          AND table_type='BASE TABLE'
      `
    );
    const existingTables = new Set(existingTablesResult.rows.map((row) => String(row.table_name)));

    const restoreTables = tables.filter((table) => existingTables.has(String(table?.name || '')));
    const skippedTables = tables.filter((table) => !existingTables.has(String(table?.name || '')));
    for (const skipped of skippedTables) {
      console.warn(`[db-restore-rehearsal-json] skip missing table: ${String(skipped?.name || '')}`);
    }

    await client.query('BEGIN');
    await client.query("SET session_replication_role = 'replica'");

    if (restoreTables.length > 0) {
      const truncateSql = `TRUNCATE TABLE ${restoreTables.map((table) => quoteIdent(table.name)).join(', ')} RESTART IDENTITY CASCADE`;
      await client.query(truncateSql);
    }

    for (const table of restoreTables) {
      const tableName = String(table.name);
      const rows = Array.isArray(table.rows) ? table.rows : [];
      const columns = Array.isArray(table.columns) ? table.columns : [];
      const columnNames = columns.map((column) => String(column.name));

      if (rows.length === 0 || columnNames.length === 0) continue;

      for (const rowChunk of chunk(rows, 200)) {
        const values = [];
        const valuePlaceholders = [];
        let paramIndex = 1;

        for (const row of rowChunk) {
          const rowPlaceholders = [];
          for (const column of columns) {
            values.push(normalizeInsertValue(row?.[column.name], column));
            rowPlaceholders.push(`$${paramIndex}`);
            paramIndex += 1;
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        const insertSql = `
          INSERT INTO ${quoteIdent(tableName)} (${columnNames.map(quoteIdent).join(', ')})
          VALUES ${valuePlaceholders.join(', ')}
        `;
        await client.query(insertSql, values);
      }
    }

    await client.query("SET session_replication_role = 'origin'");
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function runSmokeQueries() {
  const client = new Client({ connectionString: rehearsalUrl.toString() });
  await client.connect();
  try {
    const result = await client.query(
      `
        SELECT
          to_regclass('public.users') IS NOT NULL AS has_users,
          to_regclass('public.sessions') IS NOT NULL AS has_sessions,
          to_regclass('public.discover_content_items') IS NOT NULL AS has_discover
      `
    );
    const flags = result.rows[0] || {};
    if (flags.has_users) {
      const users = await client.query('SELECT COUNT(*)::INT AS count FROM users');
      console.log(`[ok] users=${users.rows[0].count}`);
    }
    if (flags.has_sessions) {
      const sessions = await client.query('SELECT COUNT(*)::INT AS count FROM sessions');
      console.log(`[ok] sessions=${sessions.rows[0].count}`);
    }
    if (flags.has_discover) {
      const discover = await client.query('SELECT COUNT(*)::INT AS count FROM discover_content_items');
      console.log(`[ok] discover_items=${discover.rows[0].count}`);
    }
  } finally {
    await client.end();
  }
}

async function dropRehearsalDb() {
  const adminClient = new Client({ connectionString: adminUrl.toString() });
  await adminClient.connect();
  try {
    await adminClient.query(
      `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
      `,
      [rehearsalDbName]
    );
    await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdent(rehearsalDbName)}`);
    console.log(`[db-restore-rehearsal-json] dropped rehearsal db: ${rehearsalDbName}`);
  } finally {
    await adminClient.end();
  }
}

async function createRehearsalDb() {
  const adminClient = new Client({ connectionString: adminUrl.toString() });
  await adminClient.connect();
  try {
    await adminClient.query(`CREATE DATABASE ${quoteIdent(rehearsalDbName)}`);
    console.log(`[db-restore-rehearsal-json] created rehearsal db: ${rehearsalDbName}`);
  } finally {
    await adminClient.end();
  }
}

async function main() {
  await createRehearsalDb();
  let shouldDrop = !keepRehearsalDb;
  try {
    await runSchemaMigrations();
    await restoreDataFromJson();
    await runSmokeQueries();
    console.log('[db-restore-rehearsal-json] done');
  } catch (error) {
    console.error('[db-restore-rehearsal-json] failed:', error);
    process.exitCode = 1;
  } finally {
    if (shouldDrop) {
      await dropRehearsalDb().catch((error) => {
        console.error('[db-restore-rehearsal-json] drop failed:', error);
      });
    } else {
      console.log(`[db-restore-rehearsal-json] KEEP_REHEARSAL_DB=1 -> keep ${rehearsalDbName}`);
    }
  }
}

main();
