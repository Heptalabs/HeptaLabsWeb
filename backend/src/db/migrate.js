import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { runSqlFile } from './sql-runner.js';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const MIGRATION_LOCK_KEY = 131052026;

const migrations = [
  { id: '20260508_0001_schema_v1', filePath: 'database/schema_v1.sql' },
  { id: '20260508_0002_functions_v1', filePath: 'database/functions_v1.sql' }
];

async function getMigrationChecksum(filePath) {
  const absolutePath = path.join(repoRoot, filePath);
  const sql = await fs.readFile(absolutePath, 'utf8');
  return createHash('sha256').update(sql).digest('hex');
}

async function shouldAdoptLegacyBaseline() {
  const tablePresence = await pool.query(`
    SELECT
      to_regclass('public.users') IS NOT NULL AS has_users,
      to_regclass('public.asset_policies') IS NOT NULL AS has_asset_policies,
      to_regclass('public.ledger_entries') IS NOT NULL AS has_ledger_entries,
      to_regclass('public.withdrawals') IS NOT NULL AS has_withdrawals
  `);

  const hasRequiredTables = Boolean(
    tablePresence.rows?.[0]?.has_users &&
      tablePresence.rows?.[0]?.has_asset_policies &&
      tablePresence.rows?.[0]?.has_ledger_entries &&
      tablePresence.rows?.[0]?.has_withdrawals
  );

  if (!hasRequiredTables) {
    return false;
  }

  const requiredFunctions = await pool.query(`
    SELECT proname
    FROM pg_proc
    WHERE proname IN ('fn_apply_ledger_delta', 'fn_get_product_policy_for_date', 'fn_run_daily_batch')
  `);

  return requiredFunctions.rowCount === 3;
}

async function adoptLegacyBaselineIfNeeded() {
  const migrationCount = await pool.query('SELECT COUNT(*)::INT AS count FROM schema_migrations');
  const existingCount = Number(migrationCount.rows?.[0]?.count || 0);
  if (existingCount > 0) {
    return false;
  }

  const legacyDetected = await shouldAdoptLegacyBaseline();
  if (!legacyDetected) {
    return false;
  }

  for (const migration of migrations) {
    const checksum = await getMigrationChecksum(migration.filePath);
    await pool.query(
      `INSERT INTO schema_migrations (id, file_path, checksum_sha256)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [migration.id, migration.filePath, checksum]
    );
    console.log(`[db:migrate] adopted legacy baseline: ${migration.id}`);
  }

  return true;
}

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
  try {
    await adoptLegacyBaselineIfNeeded();

    for (const migration of migrations) {
      const checksum = await getMigrationChecksum(migration.filePath);

      const existing = await pool.query(
        'SELECT checksum_sha256 FROM schema_migrations WHERE id = $1 LIMIT 1',
        [migration.id]
      );

      if (existing.rowCount) {
        const appliedChecksum = String(existing.rows[0].checksum_sha256 || '').trim().toLowerCase();
        if (appliedChecksum && appliedChecksum !== checksum) {
          throw new Error(
            `[db:migrate] checksum mismatch for ${migration.id}. ` +
              `applied=${appliedChecksum} current=${checksum}. ` +
              `Create a new migration instead of modifying an applied file.`
          );
        }
        console.log(`[db:migrate] skipped (already applied): ${migration.id}`);
        continue;
      }

      const appliedPath = await runSqlFile(migration.filePath);
      await pool.query(
        `INSERT INTO schema_migrations (id, file_path, checksum_sha256)
         VALUES ($1, $2, $3)`,
        [migration.id, migration.filePath, checksum]
      );
      console.log(`[db:migrate] applied: ${migration.id} (${appliedPath})`);
    }
  } finally {
    await pool.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
  }
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[db:migrate] failed:', err);
    await pool.end();
    process.exit(1);
  });
