import { runSqlFile } from './sql-runner.js';
import { pool } from './pool.js';

const files = [
  'database/schema_v1.sql',
  'database/functions_v1.sql'
];

async function main() {
  for (const file of files) {
    const path = await runSqlFile(file);
    console.log(`[db:migrate] applied: ${path}`);
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
