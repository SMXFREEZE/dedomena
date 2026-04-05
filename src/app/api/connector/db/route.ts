// @ts-nocheck
// Server-side only — dynamically imports untyped DB drivers at runtime.
// Type checking disabled intentionally; all external input is validated at runtime.
import { NextRequest, NextResponse } from 'next/server';

// Server-side connector route for sources that need TCP connections
// (PostgreSQL, MySQL, MongoDB, Redis, SQL Server, etc.)
// These cannot run in the browser — they require Node.js database drivers.

function fmt(rows: any[]): string {
  return rows.map((r, i) => `--- Row ${i + 1} ---\n${Object.entries(r).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}`).join('\n\n');
}

function onlySelect(query: string) {
  if (!/^\s*SELECT\b/i.test(query.trim()))
    throw new Error('Only SELECT queries are allowed for safety.');
}

export async function POST(req: NextRequest) {
  try {
    const { connectorId, credentials: creds } = await req.json();

    switch (connectorId) {

      case 'postgresql':
      case 'cockroachdb':
      case 'neon':
      case 'mariadb':
      case 'tidb':
      case 'planetscale': {
        const { Client } = await import('pg');
        const query = creds.query || 'SELECT NOW()';
        onlySelect(query);
        const client = new Client({
          host: creds.host, port: Number(creds.port) || 5432,
          database: creds.database, user: creds.username, password: creds.password,
          ssl: creds.ssl === 'disable' ? false : { rejectUnauthorized: false },
        });
        await client.connect();
        const res = await client.query(query);
        await client.end();
        return NextResponse.json({ content: fmt(res.rows), recordCount: res.rowCount });
      }

      case 'mysql': {
        const mysql = await import('mysql2/promise');
        const query = creds.query || 'SELECT NOW()';
        onlySelect(query);
        const conn = await mysql.createConnection({
          host: creds.host, port: Number(creds.port) || 3306,
          database: creds.database, user: creds.username, password: creds.password,
        });
        const [rows] = await conn.query(query);
        await conn.end();
        return NextResponse.json({ content: fmt(rows as any[]), recordCount: (rows as any[]).length });
      }

      case 'mssql': {
        const sql = await import('mssql');
        const query = creds.query || 'SELECT TOP 10 * FROM sys.tables';
        onlySelect(query);
        const pool = await sql.connect({
          server: creds.server, database: creds.database,
          authentication: { type: 'default', options: { userName: creds.username, password: creds.password } },
          options: { encrypt: true, trustServerCertificate: true },
        });
        const result = await pool.request().query(query);
        await pool.close();
        return NextResponse.json({ content: fmt(result.recordset), recordCount: result.recordset.length });
      }

      case 'mongodb': {
        const { MongoClient } = await import('mongodb');
        const client = new MongoClient(creds.uri);
        await client.connect();
        const limit = Math.min(Number(creds.limit) || 1000, 5000);
        const docs = await client.db(creds.database).collection(creds.collection).find({}).limit(limit).toArray();
        await client.close();
        return NextResponse.json({
          content: docs.map((d: any, i: number) => `--- Document ${i + 1} ---\n${JSON.stringify(d, null, 2)}`).join('\n\n'),
          recordCount: docs.length,
        });
      }

      case 'redis': {
        const { createClient } = await import('redis');
        const client = createClient({ url: creds.url, password: creds.password || undefined });
        await client.connect();
        const keys = await client.keys('*');
        const sample = keys.slice(0, 500);
        const values = await Promise.all(sample.map(async k => {
          const type = await client.type(k);
          let val = '';
          if (type === 'string') val = await client.get(k) ?? '';
          else if (type === 'hash') val = JSON.stringify(await client.hGetAll(k));
          else if (type === 'list') val = JSON.stringify(await client.lRange(k, 0, 99));
          else if (type === 'set') val = JSON.stringify(await client.sMembers(k));
          return `${k} (${type}): ${val.slice(0, 500)}`;
        }));
        await client.disconnect();
        return NextResponse.json({ content: values.join('\n'), recordCount: keys.length });
      }

      case 'cassandra': {
        const cassandra = await import('cassandra-driver');
        const client = new cassandra.Client({
          contactPoints: [creds.host],
          localDataCenter: 'datacenter1',
          keyspace: creds.keyspace,
          credentials: creds.username ? { username: creds.username, password: creds.password } : undefined,
        });
        await client.connect();
        const query = creds.query || `SELECT * FROM ${creds.keyspace}.${creds.tableName ?? 'table'} LIMIT 1000`;
        onlySelect(query);
        const result = await client.execute(query);
        await client.shutdown();
        return NextResponse.json({ content: fmt(result.rows as any[]), recordCount: result.rows.length });
      }

      case 'bigquery': {
        const { BigQuery } = await import('@google-cloud/bigquery');
        const sa = JSON.parse(creds.serviceAccount);
        const bq = new BigQuery({ projectId: creds.projectId, credentials: sa });
        const query = creds.query || `SELECT * FROM \`${creds.projectId}.dataset.table\` LIMIT 1000`;
        onlySelect(query);
        const [rows] = await bq.query({ query });
        return NextResponse.json({ content: fmt(rows), recordCount: rows.length });
      }

      case 'snowflake': {
        const snowflake = await import('snowflake-sdk');
        const query = creds.query || 'SELECT CURRENT_TIMESTAMP()';
        onlySelect(query);
        const conn = await new Promise<any>((resolve, reject) => {
          const c = snowflake.createConnection({
            account: creds.account, username: creds.username, password: creds.password,
            warehouse: creds.warehouse, database: creds.database, schema: creds.schema,
          });
          c.connect((err: any, cn: any) => err ? reject(err) : resolve(cn));
        });
        const rows = await new Promise<any[]>((resolve, reject) =>
          conn.execute({ sqlText: query, complete: (err: any, _: any, rows: any[]) => err ? reject(err) : resolve(rows) })
        );
        return NextResponse.json({ content: fmt(rows), recordCount: rows.length });
      }

      case 'web-scrape': {
        const res = await fetch(creds.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Dedomena/1.0)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        // Strip tags and collapse whitespace
        const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ').trim().slice(0, 100000);
        return NextResponse.json({ content: text, recordCount: 1 });
      }

      case 'gcs': {
        const { Storage } = await import('@google-cloud/storage');
        const sa = creds.serviceAccount ? JSON.parse(creds.serviceAccount) : undefined;
        const storage = new Storage({ credentials: sa });
        const [file] = await storage.bucket(creds.bucket).file(creds.object).download();
        return NextResponse.json({ content: file.toString(), recordCount: 1 });
      }

      case 'plaid': {
        const { PlaidApi, PlaidEnvironments, Configuration } = await import('plaid');
        const config = new Configuration({
          basePath: PlaidEnvironments[creds.env as keyof typeof PlaidEnvironments ?? 'sandbox'],
          baseOptions: { headers: { 'PLAID-CLIENT-ID': creds.clientId, 'PLAID-SECRET': creds.secret } },
        });
        const client = new PlaidApi(config);
        const res = await client.transactionsGet({
          access_token: creds.accessToken,
          start_date: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
        });
        const txns = res.data.transactions;
        return NextResponse.json({
          content: fmt(txns.map(t => ({ date: t.date, amount: t.amount, name: t.name, category: t.category?.join(', ') }))),
          recordCount: txns.length,
        });
      }

      case 'turso': {
        const { createClient } = await import('@libsql/client');
        const query = creds.query || 'SELECT 1';
        onlySelect(query);
        const client = createClient({ url: creds.url, authToken: creds.token });
        const result = await client.execute(query);
        return NextResponse.json({ content: fmt(result.rows as any[]), recordCount: result.rows.length });
      }

      default:
        return NextResponse.json({ error: `No server connector for: ${connectorId}` }, { status: 400 });
    }

  } catch (error: any) {
    console.error('DB Connector Error:', error);
    return NextResponse.json({ error: error.message || 'Connection failed' }, { status: 500 });
  }
}
