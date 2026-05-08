import { pool } from '../db/pool.js';

const tickSeconds = Number(process.env.WORKER_TICK_SECONDS || 30);

async function tick() {
  const startedAt = new Date().toISOString();

  try {
    const result = await pool.query('SELECT NOW() AS now');
    const dbNow = result.rows[0]?.now;
    console.log(`[worker] tick at=${startedAt} dbNow=${dbNow}`);
  } catch (error) {
    console.error('[worker] tick error:', error.message);
  }
}

console.log(`[worker] started (interval=${tickSeconds}s)`);
void tick();

setInterval(() => {
  void tick();
}, tickSeconds * 1000);

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
