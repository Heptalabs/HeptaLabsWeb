import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`[server] shutting down (${signal})`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
