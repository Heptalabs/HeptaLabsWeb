#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

const databaseUrl = process.argv[2];
const outputFile = process.argv[3];

if (!databaseUrl || !outputFile) {
  console.error('usage: node ./scripts/db-backup-fallback.mjs <database-url> <output-file>');
  process.exit(1);
}

const quoteIdent = (value) => `"${String(value).replace(/"/g, '""')}"`;

const client = new Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();

  const tablesResult = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
  );

  const tables = [];

  for (const row of tablesResult.rows) {
    const tableName = String(row.table_name);
    const columnsResult = await client.query(
      `
        SELECT
          column_name,
          data_type,
          udt_name,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
      `,
      [tableName]
    );

    const columns = columnsResult.rows.map((column) => ({
      name: String(column.column_name),
      dataType: String(column.data_type || ''),
      udtName: String(column.udt_name || ''),
      isNullable: String(column.is_nullable || '').toUpperCase() === 'YES'
    }));

    const rowsResult = await client.query(`SELECT * FROM ${quoteIdent(tableName)}`);
    tables.push({
      name: tableName,
      rowCount: rowsResult.rowCount,
      columns,
      rows: rowsResult.rows
    });
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceDatabase: new URL(databaseUrl).pathname.replace(/^\//, ''),
    tableCount: tables.length,
    totalRowCount: tables.reduce((sum, table) => sum + Number(table.rowCount || 0), 0),
    tables
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(payload), 'utf8');

  console.log(
    `[db-backup-fallback] wrote ${outputFile} (tables=${payload.tableCount}, rows=${payload.totalRowCount})`
  );
}

main()
  .catch((error) => {
    console.error('[db-backup-fallback] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
