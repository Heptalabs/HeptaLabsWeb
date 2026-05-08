import { runSqlFile } from './sql-runner.js';
import { pool } from './pool.js';

const files = ['database/seed_v1.sql'];

async function main() {
  for (const file of files) {
    const path = await runSqlFile(file);
    console.log(`[db:seed] applied: ${path}`);
  }
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[db:seed] failed:', err);
    await pool.end();
    process.exit(1);
  });
