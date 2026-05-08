import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = String(process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const requiredLimit = Number.parseInt(process.env.DAPP_CATEGORY_LIMIT || '10', 10);
const safeLimit = Number.isFinite(requiredLimit) && requiredLimit > 0 ? requiredLimit : 10;
const categories = ['all', 'defi', 'exchanges', 'collectibles', 'social', 'games'];

const fetchByCategorySnapshot = async () => {
  const url = `${baseUrl}/api/v1/market/popular-dapps/by-category?limit=${safeLimit}`;
  const response = await fetch(url);
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`request failed status=${response.status} body=${raw.slice(0, 200)}`);
  }
  return response.json();
};

const extractSeedCount = (source, category) => {
  if (category === 'all') return 0;
  const mapAnchor = 'const discoverDappTopupSeedMap';
  const mapStart = source.indexOf(mapAnchor);
  const sourceForMap = mapStart >= 0 ? source.slice(mapStart) : source;
  const anchor = `${category}: [`;
  const anchorIndex = sourceForMap.indexOf(anchor);
  if (anchorIndex < 0) return 0;

  const openIndex = sourceForMap.indexOf('[', anchorIndex);
  if (openIndex < 0) return 0;

  let depth = 0;
  let closeIndex = -1;
  for (let idx = openIndex; idx < sourceForMap.length; idx += 1) {
    const ch = sourceForMap[idx];
    if (ch === '[') depth += 1;
    if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        closeIndex = idx;
        break;
      }
    }
  }
  if (closeIndex < 0) return 0;
  const body = sourceForMap.slice(openIndex + 1, closeIndex);
  return (body.match(/\bid:\s*'[^']+'/g) || []).length;
};

const loadTopupSeedCounts = async () => {
  const appTsxPath = path.resolve(process.cwd(), '..', 'imwallet-app', 'App.tsx');
  const source = await fs.readFile(appTsxPath, 'utf8');
  const seedCounts = {};
  for (const category of categories) {
    seedCounts[category] = extractSeedCount(source, category);
  }
  return { appTsxPath, seedCounts };
};

const run = async () => {
  const [snapshot, seedMeta] = await Promise.all([fetchByCategorySnapshot(), loadTopupSeedCounts()]);
  const buckets = snapshot?.dappsByCategory && typeof snapshot.dappsByCategory === 'object' ? snapshot.dappsByCategory : {};
  const failed = [];

  console.log(`\n[verify] endpoint=${baseUrl}/api/v1/market/popular-dapps/by-category?limit=${safeLimit}`);
  console.log(`[verify] source=${snapshot?.source || 'unknown'} providersUsed=${(snapshot?.providersUsed || []).join(',') || '-'}`);
  console.log(`[verify] failedProviders=${JSON.stringify(snapshot?.failedProviders || [])}`);
  console.log(`[verify] topupSeedSource=${seedMeta.appTsxPath}\n`);
  console.log('category | apiCount | seedCount | effectiveCount | required | status');
  console.log('---------|----------|-----------|----------------|----------|-------');

  for (const category of categories) {
    const apiCount = Array.isArray(buckets[category]) ? buckets[category].length : 0;
    const seedCount = seedMeta.seedCounts[category] || 0;
    const effectiveCount = category === 'all' ? apiCount : Math.max(apiCount, seedCount);
    const ok = effectiveCount >= safeLimit;
    if (!ok) {
      failed.push({ category, apiCount, seedCount, effectiveCount });
    }
    console.log(
      `${category.padEnd(8)}| ${String(apiCount).padEnd(8)}| ${String(seedCount).padEnd(9)}| ${String(effectiveCount).padEnd(14)}| ${String(
        safeLimit
      ).padEnd(8)}| ${ok ? 'PASS' : 'FAIL'}`
    );
  }

  if (failed.length) {
    console.error(`\n[verify] FAILED categories=${failed.map((entry) => entry.category).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log('\n[verify] PASS all categories meet required count with live+fallback policy.');
};

run().catch((error) => {
  console.error(`[verify] ERROR ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
