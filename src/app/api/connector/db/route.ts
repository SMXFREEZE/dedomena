// @ts-nocheck
// Server-side only — dynamically imports untyped DB drivers at runtime.
import { NextRequest, NextResponse } from 'next/server';

function fmt(rows: any[]): string {
  return rows.map((r, i) =>
    `--- Row ${i + 1} ---\n${Object.entries(r).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}`
  ).join('\n\n');
}

// Allows SELECT and WITH (CTEs) but blocks mutations
function onlySelect(query: string) {
  const q = query.trim().replace(/\s+/g, ' ');
  if (!/^(SELECT|WITH)\b/i.test(q))
    throw new Error('Only SELECT queries are allowed for safety.');
  if (/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|CALL|MERGE)\b/i.test(q))
    throw new Error('Mutation queries are not allowed.');
}

function safeParseJSON(raw: string, field: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in "${field}" field. Please paste the full JSON object.`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { connectorId, credentials: creds } = await req.json();

    switch (connectorId) {

      // ── PostgreSQL-compatible ─────────────────────────────────────────────────
      case 'postgresql':
      case 'cockroachdb':
      case 'neon':
      case 'mariadb':
      case 'tidb':
      case 'planetscale': {
        const { Client } = await import('pg');
        const query = creds.query?.trim() || 'SELECT NOW()';
        onlySelect(query);
        const client = new Client({
          host: creds.host, port: Number(creds.port) || 5432,
          database: creds.database, user: creds.username, password: creds.password,
          ssl: creds.ssl === 'disable' ? false : { rejectUnauthorized: creds.ssl === 'require' },
          connectionTimeoutMillis: 10000,
        });
        try {
          await client.connect();
          const res = await client.query(query);
          return NextResponse.json({ content: fmt(res.rows), recordCount: res.rowCount ?? res.rows.length });
        } finally {
          await client.end().catch(() => {});
        }
      }

      // ── MySQL ─────────────────────────────────────────────────────────────────
      case 'mysql': {
        const mysql = await import('mysql2/promise');
        const query = creds.query?.trim() || 'SELECT NOW()';
        onlySelect(query);
        const conn = await mysql.createConnection({
          host: creds.host, port: Number(creds.port) || 3306,
          database: creds.database, user: creds.username, password: creds.password,
          connectTimeout: 10000,
        });
        try {
          const [rows] = await conn.query(query);
          return NextResponse.json({ content: fmt(rows as any[]), recordCount: (rows as any[]).length });
        } finally {
          await conn.end().catch(() => {});
        }
      }

      // ── SQL Server ────────────────────────────────────────────────────────────
      case 'mssql': {
        const sql = await import('mssql');
        const query = creds.query?.trim() || 'SELECT TOP 10 * FROM sys.tables';
        onlySelect(query);
        const pool = await sql.connect({
          server: creds.server, database: creds.database,
          authentication: { type: 'default', options: { userName: creds.username, password: creds.password } },
          options: { encrypt: true, trustServerCertificate: true },
          connectionTimeout: 10000,
        });
        try {
          const result = await pool.request().query(query);
          return NextResponse.json({ content: fmt(result.recordset), recordCount: result.recordset.length });
        } finally {
          await pool.close().catch(() => {});
        }
      }

      // ── MongoDB ───────────────────────────────────────────────────────────────
      case 'mongodb': {
        const { MongoClient } = await import('mongodb');
        const client = new MongoClient(creds.uri, { serverSelectionTimeoutMS: 10000 });
        try {
          await client.connect();
          const limit = Math.min(Number(creds.limit) || 1000, 5000);
          const docs = await client.db(creds.database).collection(creds.collection).find({}).limit(limit).toArray();
          return NextResponse.json({
            content: docs.map((d: any, i: number) => `--- Document ${i + 1} ---\n${JSON.stringify(d, null, 2)}`).join('\n\n'),
            recordCount: docs.length,
          });
        } finally {
          await client.close().catch(() => {});
        }
      }

      // ── Redis ─────────────────────────────────────────────────────────────────
      case 'redis': {
        const { createClient } = await import('redis');
        if (!creds.url) throw new Error('Redis URL is required.');
        const client = createClient({ url: creds.url, password: creds.password || undefined });
        client.on('error', () => {});
        try {
          await client.connect();
          const keys = await client.keys('*');
          const sample = keys.slice(0, 500);
          const values = await Promise.all(sample.map(async k => {
            try {
              const type = await client.type(k);
              let val = '';
              if (type === 'string') val = (await client.get(k)) ?? '';
              else if (type === 'hash') val = JSON.stringify(await client.hGetAll(k));
              else if (type === 'list') val = JSON.stringify(await client.lRange(k, 0, 99));
              else if (type === 'set') val = JSON.stringify(await client.sMembers(k));
              return `${k} (${type}): ${val.slice(0, 500)}`;
            } catch { return `${k}: (error reading value)`; }
          }));
          return NextResponse.json({ content: values.join('\n'), recordCount: keys.length });
        } finally {
          await client.disconnect().catch(() => {});
        }
      }

      // ── Apache Cassandra ──────────────────────────────────────────────────────
      case 'cassandra': {
        const cassandra = await import('cassandra-driver');
        const client = new cassandra.Client({
          contactPoints: [creds.host],
          localDataCenter: 'datacenter1',
          keyspace: creds.keyspace,
          credentials: creds.username ? { username: creds.username, password: creds.password } : undefined,
        });
        try {
          await client.connect();
          const query = creds.query?.trim() || `SELECT * FROM ${creds.keyspace}.table LIMIT 1000`;
          onlySelect(query);
          const result = await client.execute(query);
          return NextResponse.json({ content: fmt(result.rows as any[]), recordCount: result.rows.length });
        } finally {
          await client.shutdown().catch(() => {});
        }
      }

      // ── Google BigQuery ───────────────────────────────────────────────────────
      case 'bigquery': {
        const { BigQuery } = await import('@google-cloud/bigquery');
        const sa = safeParseJSON(creds.serviceAccount, 'Service Account JSON');
        const bq = new BigQuery({ projectId: creds.projectId, credentials: sa });
        const query = creds.query?.trim() || `SELECT * FROM \`${creds.projectId}.dataset.table\` LIMIT 1000`;
        onlySelect(query);
        const [rows] = await bq.query({ query });
        return NextResponse.json({ content: fmt(rows), recordCount: rows.length });
      }

      // ── Snowflake ─────────────────────────────────────────────────────────────
      case 'snowflake': {
        const snowflake = await import('snowflake-sdk');
        const query = creds.query?.trim() || 'SELECT CURRENT_TIMESTAMP()';
        onlySelect(query);
        const conn = await new Promise<any>((resolve, reject) => {
          const c = snowflake.createConnection({
            account: creds.account, username: creds.username, password: creds.password,
            warehouse: creds.warehouse, database: creds.database, schema: creds.schema,
          });
          c.connect((err: any, cn: any) => err ? reject(err) : resolve(cn));
        });
        const rows = await new Promise<any[]>((resolve, reject) =>
          conn.execute({ sqlText: query, complete: (err: any, _: any, rows: any[]) => err ? reject(err) : resolve(rows ?? []) })
        );
        return NextResponse.json({ content: fmt(rows), recordCount: rows.length });
      }

      // ── Google Cloud Storage ──────────────────────────────────────────────────
      case 'gcs': {
        const { Storage } = await import('@google-cloud/storage');
        const sa = creds.serviceAccount ? safeParseJSON(creds.serviceAccount, 'Service Account JSON') : undefined;
        const storage = new Storage({ credentials: sa });
        const [file] = await storage.bucket(creds.bucket).file(creds.object).download();
        return NextResponse.json({ content: file.toString(), recordCount: 1 });
      }

      // ── Web Scrape ────────────────────────────────────────────────────────────
      case 'web-scrape': {
        if (!creds.url) throw new Error('URL is required.');
        const res = await fetch(creds.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Dedomena/1.0)' },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
        const html = await res.text();
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ').trim().slice(0, 100_000);
        return NextResponse.json({ content: text, recordCount: 1 });
      }

      // ── Turso / libSQL ────────────────────────────────────────────────────────
      case 'turso': {
        const { createClient } = await import('@libsql/client');
        const query = creds.query?.trim() || 'SELECT 1';
        onlySelect(query);
        const client = createClient({ url: creds.url, authToken: creds.token });
        const result = await client.execute(query);
        return NextResponse.json({ content: fmt(result.rows as any[]), recordCount: result.rows.length });
      }

      // ── Plaid ─────────────────────────────────────────────────────────────────
      case 'plaid': {
        const { PlaidApi, PlaidEnvironments, Configuration } = await import('plaid');
        const envKey = (creds.env ?? 'sandbox') as keyof typeof PlaidEnvironments;
        const config = new Configuration({
          basePath: PlaidEnvironments[envKey] ?? PlaidEnvironments.sandbox,
          baseOptions: { headers: { 'PLAID-CLIENT-ID': creds.clientId, 'PLAID-SECRET': creds.secret } },
        });
        const client = new PlaidApi(config);
        const res = await client.transactionsGet({
          access_token: creds.accessToken,
          start_date: new Date(Date.now() - 90 * 86_400_000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
        });
        const txns = res.data.transactions;
        return NextResponse.json({
          content: fmt(txns.map(t => ({ date: t.date, amount: t.amount, name: t.name, category: t.category?.join(', ') }))),
          recordCount: txns.length,
        });
      }

      // ── Amazon Redshift (PostgreSQL-compatible) ───────────────────────────────
      case 'redshift': {
        const { Client } = await import('pg');
        const query = creds.query?.trim() || 'SELECT 1';
        onlySelect(query);
        const client = new Client({
          host: creds.host, port: Number(creds.port) || 5439,
          database: creds.database, user: creds.username, password: creds.password,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 10000,
        });
        try {
          await client.connect();
          const res = await client.query(query);
          return NextResponse.json({ content: fmt(res.rows), recordCount: res.rows.length });
        } finally {
          await client.end().catch(() => {});
        }
      }

      // ── Azure Synapse (MSSQL-compatible) ─────────────────────────────────────
      case 'synapse': {
        const sql = await import('mssql');
        const query = creds.query?.trim() || 'SELECT TOP 10 * FROM INFORMATION_SCHEMA.TABLES';
        onlySelect(query);
        const pool = await sql.connect({
          server: creds.server, database: creds.database,
          authentication: { type: 'default', options: { userName: creds.username, password: creds.password } },
          options: { encrypt: true, trustServerCertificate: true },
        });
        try {
          const result = await pool.request().query(query);
          return NextResponse.json({ content: fmt(result.recordset), recordCount: result.recordset.length });
        } finally {
          await pool.close().catch(() => {});
        }
      }

      default:
        return NextResponse.json({ error: `No server connector for: ${connectorId}` }, { status: 400 });
    }

  } catch (error: any) {
    console.error(`DB Connector Error [${new Date().toISOString()}]:`, error);
    return NextResponse.json({
      error: error.message || 'Connection failed',
      hint: getHint(error.message),
    }, { status: 500 });
  }
}

// ── Friendly hints for common errors ──────────────────────────────────────────
function getHint(msg: string = ''): string | undefined {
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg))
    return 'Could not reach the server. Check host, port, and firewall rules.';
  if (/password|authentication|auth/i.test(msg))
    return 'Authentication failed. Double-check username and password.';
  if (/ssl|certificate/i.test(msg))
    return 'SSL error. Try changing the SSL mode to "disable" or "prefer".';
  if (/database.*not exist|unknown database/i.test(msg))
    return 'Database not found. Check the database name.';
  if (/permission|denied|privilege/i.test(msg))
    return 'Permission denied. Ensure the user has SELECT privileges.';
  return undefined;
}
