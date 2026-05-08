import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runSqlFile(relativePathFromRepoRoot) {
  const repoRoot = path.resolve(__dirname, '../../..');
  const absolutePath = path.join(repoRoot, relativePathFromRepoRoot);
  const sql = await fs.readFile(absolutePath, 'utf8');
  await pool.query(sql);
  return absolutePath;
}
