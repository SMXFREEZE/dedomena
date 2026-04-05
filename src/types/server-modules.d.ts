// Type stubs for server-side DB drivers that lack or have incomplete @types packages.
// These modules are only imported dynamically inside /api/connector/db/route.ts
// and are never bundled into client code.

declare module 'mysql2/promise' { const m: any; export = m; }
declare module 'mssql' { const m: any; export = m; }
declare module 'cassandra-driver' { const m: any; export = m; }
declare module 'snowflake-sdk' { const m: any; export = m; }
declare module '@google-cloud/bigquery' { const m: any; export = m; }
declare module '@google-cloud/storage' { const m: any; export = m; }
declare module 'plaid' { const m: any; export = m; }
declare module '@libsql/client' { const m: any; export = m; }
declare module 'redis' { const m: any; export = m; }
declare module 'mongodb' { const m: any; export = m; }
