import { Connector, ConnectorField, Category, CategoryId, OAuthConfig } from './types';

// ── Field shorthand helpers ────────────────────────────────────────────────────
const t = (key: string, label: string, ph = '', req = false): ConnectorField =>
  ({ key, label, type: 'text', placeholder: ph, required: req });
const p = (key: string, label: string, ph = ''): ConnectorField =>
  ({ key, label, type: 'password', placeholder: ph, required: true });
const u = (key: string, label: string, ph = '', req = false): ConnectorField =>
  ({ key, label, type: 'url', placeholder: ph, required: req });
const n = (key: string, label: string, ph = '', req = false): ConnectorField =>
  ({ key, label, type: 'number', placeholder: ph, required: req });
const sel = (key: string, label: string, opts: [string, string][]): ConnectorField =>
  ({ key, label, type: 'select', options: opts.map(([value, optLabel]) => ({ value, label: optLabel })) });
const ta = (key: string, label: string, ph = ''): ConnectorField =>
  ({ key, label, type: 'textarea', placeholder: ph });
const oauth = (): ConnectorField =>
  ({ key: '_oauth', label: 'Authenticate', type: 'oauth_button' });

// ── OAuth config shortcuts ─────────────────────────────────────────────────────
const google = (scopes: string[]): OAuthConfig => ({
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  scopes,
  clientIdField: 'clientId',
  additionalParams: { prompt: 'consent', access_type: 'offline' },
});
const microsoft = (scopes: string[]): OAuthConfig => ({
  authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  scopes: [...scopes, 'offline_access'],
  clientIdField: 'clientId',
});

// ── Categories ────────────────────────────────────────────────────────────────
export const CATEGORIES: Category[] = [
  { id: 'databases',     label: 'Databases',        emoji: '🗄️' },
  { id: 'warehouses',    label: 'Data Warehouses',   emoji: '🏭' },
  { id: 'storage',       label: 'File Storage',      emoji: '📁' },
  { id: 'crm',           label: 'CRM & Sales',       emoji: '💼' },
  { id: 'marketing',     label: 'Marketing',         emoji: '📣' },
  { id: 'productivity',  label: 'Productivity',      emoji: '✅' },
  { id: 'communication', label: 'Communication',     emoji: '💬' },
  { id: 'analytics',     label: 'Analytics',         emoji: '📊' },
  { id: 'devtools',      label: 'Developer Tools',   emoji: '⚙️' },
  { id: 'finance',       label: 'Finance',           emoji: '💳' },
  { id: 'ecommerce',     label: 'E-commerce',        emoji: '🛍️' },
  { id: 'custom',        label: 'Custom',            emoji: '🔌' },
];

// ── Connector registry — 110+ sources ─────────────────────────────────────────
export const CONNECTORS: Connector[] = [

  // ── DATABASES (server-side — require TCP drivers) ──────────────────────────
  {
    id: 'postgresql', name: 'PostgreSQL', emoji: '🐘', color: '#336791',
    category: 'databases', executionMode: 'server', popular: true,
    description: 'Query any PostgreSQL-compatible database (Supabase, Neon, CockroachDB…)',
    tags: ['sql', 'relational', 'postgres', 'supabase', 'neon', 'cockroachdb'],
    fields: [t('host','Host','db.example.com',true), n('port','Port','5432'), t('database','Database Name','',true), t('username','Username','',true), p('password','Password'), sel('ssl','SSL',[ ['require','Require'],['prefer','Prefer'],['disable','Disable'] ]), ta('query','SQL Query','SELECT * FROM users LIMIT 1000')],
  },
  {
    id: 'mysql', name: 'MySQL', emoji: '🐬', color: '#4479a1',
    category: 'databases', executionMode: 'server', popular: true,
    description: 'Connect to MySQL or MariaDB databases.',
    tags: ['sql', 'relational', 'mysql', 'mariadb'],
    fields: [t('host','Host','localhost',true), n('port','Port','3306'), t('database','Database Name','',true), t('username','User','',true), p('password','Password'), ta('query','SQL Query','SELECT * FROM users LIMIT 1000')],
  },
  {
    id: 'mongodb', name: 'MongoDB', emoji: '🍃', color: '#47a248',
    category: 'databases', executionMode: 'server', popular: true,
    description: 'Query documents from any MongoDB collection.',
    tags: ['nosql', 'document', 'mongodb', 'atlas'],
    fields: [t('uri','Connection URI','mongodb+srv://user:pass@cluster.mongodb.net',true), t('database','Database Name','',true), t('collection','Collection Name','users',true), n('limit','Limit','1000')],
  },
  {
    id: 'redis', name: 'Redis', emoji: '🔴', color: '#dc382d',
    category: 'databases', executionMode: 'server',
    description: 'Read keys and hashes from a Redis instance.',
    tags: ['cache', 'keyvalue', 'redis', 'upstash'],
    fields: [u('url','Redis URL','redis://localhost:6379'), p('password','Password (optional)')],
  },
  {
    id: 'mssql', name: 'SQL Server', emoji: '🪟', color: '#cc2927',
    category: 'databases', executionMode: 'server',
    description: 'Microsoft SQL Server and Azure SQL Database.',
    tags: ['sql', 'relational', 'mssql', 'azure'],
    fields: [t('server','Server','host.database.windows.net',true), t('database','Database','',true), t('username','Username','',true), p('password','Password'), ta('query','SQL Query','SELECT TOP 1000 * FROM dbo.Users')],
  },
  {
    id: 'cockroachdb', name: 'CockroachDB', emoji: '🪳', color: '#6933ff',
    category: 'databases', executionMode: 'server',
    description: 'Distributed SQL, PostgreSQL-compatible.',
    tags: ['sql', 'distributed', 'cockroachdb'],
    fields: [t('host','Host','free-tier.gcp-us-central1.cockroachlabs.cloud',true), n('port','Port','26257'), t('database','Database','',true), t('username','Username','',true), p('password','Password'), ta('query','SQL Query','SELECT * FROM users LIMIT 1000')],
  },
  {
    id: 'cassandra', name: 'Apache Cassandra', emoji: '💫', color: '#1287b1',
    category: 'databases', executionMode: 'server',
    description: 'Wide-column distributed database.',
    tags: ['nosql', 'cassandra', 'wide-column'],
    fields: [t('host','Host','localhost',true), n('port','Port','9042'), t('keyspace','Keyspace','',true), t('username','Username'), p('password','Password'), ta('query','CQL Query','SELECT * FROM users LIMIT 1000')],
  },
  {
    id: 'mariadb', name: 'MariaDB', emoji: '🦭', color: '#c0765a',
    category: 'databases', executionMode: 'server',
    description: 'Open-source MySQL-compatible relational database.',
    tags: ['sql', 'relational', 'mariadb', 'mysql'],
    fields: [t('host','Host','localhost',true), n('port','Port','3306'), t('database','Database','',true), t('username','User','',true), p('password','Password'), ta('query','SQL Query','SELECT * FROM users LIMIT 1000')],
  },
  {
    id: 'tidb', name: 'TiDB', emoji: '🐯', color: '#e63946',
    category: 'databases', executionMode: 'server',
    description: 'Distributed MySQL-compatible HTAP database.',
    tags: ['sql', 'distributed', 'mysql', 'tidb'],
    fields: [t('host','Host','gateway01.us-east-1.prod.aws.tidbcloud.com',true), n('port','Port','4000'), t('database','Database','',true), t('username','User','',true), p('password','Password'), ta('query','SQL Query','SELECT * FROM users LIMIT 1000')],
  },
  {
    id: 'couchdb', name: 'CouchDB', emoji: '🛋️', color: '#e42528',
    category: 'databases', executionMode: 'client',
    description: 'Fetch JSON documents from CouchDB.',
    tags: ['nosql', 'document', 'couchdb'],
    fields: [u('url','CouchDB URL','http://localhost:5984',true), t('database','Database','',true), t('username','Username'), p('password','Password')],
  },
  {
    id: 'firebase', name: 'Firebase Firestore', emoji: '🔥', color: '#ffca28',
    category: 'databases', executionMode: 'client', popular: true,
    description: 'Query collections from Firebase Firestore.',
    tags: ['nosql', 'google', 'firebase', 'firestore', 'realtime'],
    fields: [t('projectId','Project ID','',true), p('apiKey','Web API Key'), t('collection','Collection','users',true), n('limit','Limit','500')],
  },
  {
    id: 'supabase', name: 'Supabase', emoji: '⚡', color: '#3ecf8e',
    category: 'databases', executionMode: 'client', popular: true,
    description: 'Query Supabase tables via the REST API.',
    tags: ['postgres', 'supabase', 'baas', 'rest'],
    fields: [u('url','Project URL','https://xxxx.supabase.co',true), p('key','Anon / Service Key'), t('table','Table Name','users',true), n('limit','Row Limit','1000')],
  },
  {
    id: 'neon', name: 'Neon', emoji: '🌿', color: '#12a594',
    category: 'databases', executionMode: 'server',
    description: 'Serverless Postgres with branching.',
    tags: ['postgres', 'serverless', 'neon'],
    fields: [t('host','Host','ep-xxx.us-east-2.aws.neon.tech',true), t('database','Database','neondb',true), t('username','User','',true), p('password','Password'), ta('query','SQL Query','SELECT * FROM users LIMIT 1000')],
  },
  {
    id: 'planetscale', name: 'PlanetScale', emoji: '🪐', color: '#f4f4f4',
    category: 'databases', executionMode: 'server',
    description: 'Serverless MySQL-compatible platform.',
    tags: ['mysql', 'serverless', 'planetscale'],
    fields: [t('host','Host','aws.connect.psdb.cloud',true), t('database','Database','',true), t('username','Username','',true), p('password','Password'), ta('query','SQL Query','SELECT * FROM users LIMIT 1000')],
  },
  {
    id: 'turso', name: 'Turso', emoji: '🦎', color: '#4ff8d2',
    category: 'databases', executionMode: 'server',
    description: 'Edge SQLite database with libSQL.',
    tags: ['sqlite', 'edge', 'turso'],
    fields: [u('url','Database URL','libsql://db-org.turso.io',true), p('token','Auth Token'), ta('query','SQL Query','SELECT * FROM users LIMIT 1000')],
  },
  {
    id: 'dynamodb', name: 'DynamoDB', emoji: '⚡', color: '#ff9900',
    category: 'databases', executionMode: 'client',
    description: 'Full-scan any DynamoDB table with automatic pagination.',
    tags: ['aws', 'nosql', 'dynamodb'],
    fields: [t('accessKeyId','Access Key ID','',true), p('secretAccessKey','Secret Access Key'), t('region','Region','us-east-1'), t('tableName','Table Name','',true)],
  },
  {
    id: 'upstash', name: 'Upstash Redis', emoji: '🔺', color: '#00e9a3',
    category: 'databases', executionMode: 'client',
    description: 'Serverless Redis via REST API.',
    tags: ['redis', 'serverless', 'upstash'],
    fields: [u('url','REST URL','https://xxx.upstash.io',true), p('token','REST Token')],
  },

  // ── DATA WAREHOUSES ────────────────────────────────────────────────────────
  {
    id: 'snowflake', name: 'Snowflake', emoji: '❄️', color: '#29b5e8',
    category: 'warehouses', executionMode: 'server', popular: true,
    description: 'Query any Snowflake warehouse database.',
    tags: ['warehouse', 'sql', 'snowflake', 'cloud'],
    fields: [t('account','Account ID','org-account.snowflakecomputing.com',true), t('username','Username','',true), p('password','Password'), t('warehouse','Warehouse','COMPUTE_WH'), t('database','Database'), t('schema','Schema','PUBLIC'), ta('query','SQL Query','SELECT * FROM my_table LIMIT 1000')],
  },
  {
    id: 'databricks', name: 'Databricks', emoji: '🧱', color: '#ff3621',
    category: 'warehouses', executionMode: 'client', popular: true,
    description: 'Run SQL against Databricks lakehouse via HTTP.',
    tags: ['warehouse', 'spark', 'databricks', 'lakehouse'],
    fields: [t('host','Server Hostname','xxx.azuredatabricks.net',true), t('httpPath','HTTP Path','/sql/1.0/warehouses/xxx',true), p('token','Personal Access Token'), ta('query','SQL Query','SELECT * FROM my_table LIMIT 1000')],
  },
  {
    id: 'bigquery', name: 'Google BigQuery', emoji: '🔵', color: '#4285f4',
    category: 'warehouses', executionMode: 'server', popular: true,
    description: 'Query BigQuery datasets with standard SQL.',
    tags: ['warehouse', 'google', 'bigquery', 'analytics'],
    fields: [t('projectId','Project ID','',true), ta('serviceAccount','Service Account JSON (paste here)','{"type":"service_account",...}'), ta('query','SQL Query','SELECT * FROM `project.dataset.table` LIMIT 1000')],
  },
  {
    id: 'redshift', name: 'Amazon Redshift', emoji: '🔴', color: '#8c4fff',
    category: 'warehouses', executionMode: 'server',
    description: 'Query Redshift data warehouses.',
    tags: ['warehouse', 'aws', 'redshift', 'sql'],
    fields: [t('host','Cluster Endpoint','cluster.region.redshift.amazonaws.com',true), n('port','Port','5439'), t('database','Database','',true), t('username','Username','',true), p('password','Password'), ta('query','SQL Query','SELECT * FROM schema.table LIMIT 1000')],
  },
  {
    id: 'clickhouse', name: 'ClickHouse', emoji: '🖱️', color: '#faff69',
    category: 'warehouses', executionMode: 'client', popular: true,
    description: 'Real-time analytics via ClickHouse HTTP interface.',
    tags: ['warehouse', 'olap', 'clickhouse', 'analytics'],
    fields: [u('url','HTTP URL','https://host:8443',true), t('database','Database','default'), t('username','Username','default'), p('password','Password'), ta('query','SQL Query','SELECT * FROM my_table LIMIT 1000')],
  },
  {
    id: 'motherduck', name: 'MotherDuck', emoji: '🦆', color: '#f5d800',
    category: 'warehouses', executionMode: 'server',
    description: 'Serverless DuckDB analytics in the cloud.',
    tags: ['warehouse', 'duckdb', 'analytics', 'serverless'],
    fields: [p('token','Service Token'), t('database','Database Name'), ta('query','SQL Query','SELECT * FROM my_table LIMIT 1000')],
  },
  {
    id: 'synapse', name: 'Azure Synapse', emoji: '🟦', color: '#0078d4',
    category: 'warehouses', executionMode: 'server',
    description: 'Azure Synapse Analytics data warehouses.',
    tags: ['warehouse', 'azure', 'sql', 'microsoft'],
    fields: [t('server','Server','xxx.sql.azuresynapse.net',true), t('database','Database','',true), t('username','Username','',true), p('password','Password'), ta('query','SQL Query','SELECT TOP 1000 * FROM dbo.MyTable')],
  },
  {
    id: 'firebolt', name: 'Firebolt', emoji: '🔥', color: '#ff3a1c',
    category: 'warehouses', executionMode: 'server',
    description: 'High-performance cloud data warehouse.',
    tags: ['warehouse', 'olap', 'firebolt'],
    fields: [t('clientId','Client ID','',true), p('clientSecret','Client Secret'), t('account','Account Name','',true), t('database','Database'), ta('query','SQL Query')],
  },
  {
    id: 'starburst', name: 'Starburst / Trino', emoji: '⭐', color: '#dd00a1',
    category: 'warehouses', executionMode: 'server',
    description: 'Distributed SQL query engine across any source.',
    tags: ['warehouse', 'trino', 'starburst', 'federated'],
    fields: [u('host','Host','https://xxx.trino.galaxy.starburst.io',true), t('catalog','Catalog','',true), t('schema','Schema'), t('username','Username','',true), p('password','Password'), ta('query','SQL Query')],
  },

  // ── FILE STORAGE ───────────────────────────────────────────────────────────
  {
    id: 'local-file', name: 'Local File', emoji: '📄', color: '#ffffff',
    category: 'storage', executionMode: 'client', popular: true,
    description: 'Live-link TXT, CSV, JSON, Markdown, or HTML from disk.',
    tags: ['file', 'local', 'csv', 'json', 'text'],
    fields: [],
  },
  {
    id: 'google-drive', name: 'Google Drive', emoji: '📁', color: '#4285f4',
    category: 'storage', executionMode: 'client', popular: true,
    description: 'Docs, Sheets, and files from Google Drive.',
    tags: ['google', 'drive', 'docs', 'sheets', 'files'],
    fields: [t('clientId','Google OAuth Client ID','xxx.apps.googleusercontent.com',true), oauth()],
    oauth: google(['https://www.googleapis.com/auth/drive.readonly']),
  },
  {
    id: 'onedrive', name: 'OneDrive', emoji: '☁️', color: '#0078d4',
    category: 'storage', executionMode: 'client',
    description: 'Files and documents from Microsoft OneDrive.',
    tags: ['microsoft', 'onedrive', 'files'],
    fields: [t('clientId','Azure App Client ID','',true), oauth()],
    oauth: microsoft(['Files.Read']),
  },
  {
    id: 'dropbox', name: 'Dropbox', emoji: '📦', color: '#0061ff',
    category: 'storage', executionMode: 'client',
    description: 'Read files from Dropbox.',
    tags: ['dropbox', 'files', 'storage'],
    fields: [p('accessToken','Access Token (from Dropbox App Console)')],
  },
  {
    id: 'box', name: 'Box', emoji: '🎁', color: '#0061d5',
    category: 'storage', executionMode: 'client',
    description: 'Access enterprise files from Box.',
    tags: ['box', 'files', 'enterprise'],
    fields: [p('accessToken','Developer Token')],
  },
  {
    id: 'sharepoint', name: 'SharePoint', emoji: '🟦', color: '#0078d4',
    category: 'storage', executionMode: 'client', popular: true,
    description: 'Lists, libraries, and documents from SharePoint Online.',
    tags: ['microsoft', 'sharepoint', 'office365'],
    fields: [t('clientId','Azure App Client ID','',true), t('siteUrl','Site URL','https://org.sharepoint.com/sites/my-site',true), oauth()],
    oauth: microsoft(['Sites.Read.All']),
  },
  {
    id: 'aws-s3', name: 'Amazon S3', emoji: '🪣', color: '#ff9900',
    category: 'storage', executionMode: 'client', popular: true,
    description: 'Read documents and files from S3 buckets.',
    tags: ['aws', 's3', 'storage', 'files'],
    fields: [t('accessKeyId','Access Key ID','',true), p('secretAccessKey','Secret Access Key'), t('region','Region','us-east-1'), t('bucket','Bucket Name','',true), t('key','Object Key / Path','',true)],
  },
  {
    id: 'gcs', name: 'Google Cloud Storage', emoji: '🌐', color: '#4285f4',
    category: 'storage', executionMode: 'server',
    description: 'Read objects from GCS buckets.',
    tags: ['google', 'gcs', 'storage', 'cloud'],
    fields: [t('bucket','Bucket Name','',true), t('object','Object Path','data/file.json',true), ta('serviceAccount','Service Account JSON')],
  },
  {
    id: 'azure-blob', name: 'Azure Blob Storage', emoji: '🔷', color: '#0078d4',
    category: 'storage', executionMode: 'client',
    description: 'Read files from Azure Blob Storage via SAS URL.',
    tags: ['azure', 'blob', 'storage', 'microsoft'],
    fields: [u('sasUrl','SAS URL (with read permissions)','',true)],
  },
  {
    id: 'cloudflare-r2', name: 'Cloudflare R2', emoji: '🟠', color: '#f48120',
    category: 'storage', executionMode: 'client',
    description: 'S3-compatible object storage from Cloudflare.',
    tags: ['cloudflare', 'r2', 'storage', 's3'],
    fields: [t('accountId','Account ID','',true), t('accessKeyId','R2 Access Key'), p('secretAccessKey','R2 Secret Access Key'), t('bucket','Bucket','',true), t('key','Object Key','',true)],
  },
  {
    id: 'backblaze', name: 'Backblaze B2', emoji: '🅱️', color: '#d02020',
    category: 'storage', executionMode: 'client',
    description: 'Read files from Backblaze B2.',
    tags: ['backblaze', 'b2', 'storage'],
    fields: [t('keyId','Application Key ID','',true), p('applicationKey','Application Key'), t('bucket','Bucket Name','',true), t('fileName','File Name','',true)],
  },
  {
    id: 'minio', name: 'MinIO', emoji: '🪄', color: '#c72c48',
    category: 'storage', executionMode: 'client',
    description: 'Self-hosted S3-compatible object storage.',
    tags: ['minio', 's3', 'self-hosted'],
    fields: [u('endpoint','Endpoint','http://localhost:9000',true), t('accessKey','Access Key','',true), p('secretKey','Secret Key'), t('bucket','Bucket','',true), t('object','Object Path')],
  },

  // ── CRM & SALES ───────────────────────────────────────────────────────────
  {
    id: 'hubspot', name: 'HubSpot', emoji: '🟠', color: '#ff7a59',
    category: 'crm', executionMode: 'client', popular: true,
    description: 'Contacts, deals, companies, and tickets from HubSpot.',
    tags: ['crm', 'sales', 'marketing', 'hubspot'],
    fields: [p('accessToken','Private App Access Token', 'Create in HubSpot → Settings → Integrations → Private Apps')],
  },
  {
    id: 'salesforce', name: 'Salesforce', emoji: '☁️', color: '#00a1e0',
    category: 'crm', executionMode: 'client', popular: true,
    description: 'Contacts, leads, opportunities from Salesforce.',
    tags: ['crm', 'salesforce', 'enterprise'],
    fields: [t('instanceUrl','Instance URL','https://yourorg.salesforce.com',true), p('accessToken','Access Token'), t('soql','SOQL Query','SELECT Id, Name, Email FROM Contact LIMIT 1000')],
  },
  {
    id: 'pipedrive', name: 'Pipedrive', emoji: '🔧', color: '#017737',
    category: 'crm', executionMode: 'client',
    description: 'Deals, contacts, and activities from Pipedrive.',
    tags: ['crm', 'pipedrive', 'sales'],
    fields: [p('apiToken','API Token')],
  },
  {
    id: 'zoho-crm', name: 'Zoho CRM', emoji: '🅩', color: '#e42527',
    category: 'crm', executionMode: 'client',
    description: 'Leads, contacts, and deals from Zoho CRM.',
    tags: ['crm', 'zoho', 'sales'],
    fields: [p('accessToken','OAuth Access Token'), t('domain','Domain','zohoapis.com')],
  },
  {
    id: 'freshsales', name: 'Freshsales', emoji: '🌿', color: '#1abc9c',
    category: 'crm', executionMode: 'client',
    description: 'Contacts, accounts, and deals from Freshsales.',
    tags: ['crm', 'freshsales', 'freshworks'],
    fields: [t('domain','Domain','mycompany.freshsales.io',true), p('apiKey','API Key')],
  },
  {
    id: 'close', name: 'Close CRM', emoji: '🔒', color: '#5f3dc4',
    category: 'crm', executionMode: 'client',
    description: 'Leads and activities from Close CRM.',
    tags: ['crm', 'close', 'sales'],
    fields: [p('apiKey','API Key')],
  },
  {
    id: 'attio', name: 'Attio', emoji: '🔗', color: '#1a1a2e',
    category: 'crm', executionMode: 'client',
    description: 'Records and lists from Attio CRM.',
    tags: ['crm', 'attio'],
    fields: [p('apiKey','API Key')],
  },
  {
    id: 'copper', name: 'Copper', emoji: '🟤', color: '#b87333',
    category: 'crm', executionMode: 'client',
    description: 'Google Workspace-native CRM contacts and deals.',
    tags: ['crm', 'copper', 'google'],
    fields: [t('email','Your Email','',true), p('apiKey','API Key')],
  },

  // ── MARKETING ─────────────────────────────────────────────────────────────
  {
    id: 'mailchimp', name: 'Mailchimp', emoji: '🐵', color: '#ffe01b',
    category: 'marketing', executionMode: 'client', popular: true,
    description: 'Campaigns, subscribers, and audience data.',
    tags: ['email', 'marketing', 'mailchimp', 'newsletter'],
    fields: [p('apiKey','API Key (ends with -dc, e.g. -us1)')],
  },
  {
    id: 'klaviyo', name: 'Klaviyo', emoji: '📣', color: '#000000',
    category: 'marketing', executionMode: 'client',
    description: 'Profiles, flows, and metrics from Klaviyo.',
    tags: ['email', 'marketing', 'klaviyo', 'ecommerce'],
    fields: [p('privateKey','Private API Key')],
  },
  {
    id: 'brevo', name: 'Brevo', emoji: '📮', color: '#0b996e',
    category: 'marketing', executionMode: 'client',
    description: 'Email campaigns and contacts from Brevo.',
    tags: ['email', 'marketing', 'brevo', 'sendinblue'],
    fields: [p('apiKey','API Key')],
  },
  {
    id: 'convertkit', name: 'ConvertKit', emoji: '✉️', color: '#fb6970',
    category: 'marketing', executionMode: 'client',
    description: 'Subscribers and sequences from ConvertKit.',
    tags: ['email', 'marketing', 'convertkit', 'creators'],
    fields: [p('apiSecret','API Secret')],
  },
  {
    id: 'activecampaign', name: 'ActiveCampaign', emoji: '⚡', color: '#356ae6',
    category: 'marketing', executionMode: 'client',
    description: 'Contacts, campaigns, and automations.',
    tags: ['email', 'marketing', 'activecampaign', 'crm'],
    fields: [u('apiUrl','API URL','https://account.api-us1.com',true), p('apiKey','API Key')],
  },
  {
    id: 'sendgrid', name: 'SendGrid', emoji: '📨', color: '#1a82e2',
    category: 'marketing', executionMode: 'client',
    description: 'Email activity and stats from SendGrid.',
    tags: ['email', 'sendgrid', 'twilio'],
    fields: [p('apiKey','API Key')],
  },
  {
    id: 'customerio', name: 'Customer.io', emoji: '📫', color: '#f3c117',
    category: 'marketing', executionMode: 'client',
    description: 'Segments, campaigns, and customer data.',
    tags: ['email', 'marketing', 'customerio'],
    fields: [p('appApiKey','App API Key'), t('siteId','Site ID')],
  },

  // ── PRODUCTIVITY ──────────────────────────────────────────────────────────
  {
    id: 'notion', name: 'Notion', emoji: '◾', color: '#ffffff',
    category: 'productivity', executionMode: 'client', popular: true,
    description: 'Databases and pages from Notion workspaces.',
    tags: ['notion', 'docs', 'wiki', 'database'],
    fields: [p('integrationToken','Integration Token'), sel('resourceType','Resource Type',[['database','Database'],['page','Page']]), t('resourceId','Database or Page ID','',true)],
  },
  {
    id: 'airtable', name: 'Airtable', emoji: '📊', color: '#18bfff',
    category: 'productivity', executionMode: 'client', popular: true,
    description: 'All records from any Airtable base and table.',
    tags: ['airtable', 'spreadsheet', 'database'],
    fields: [p('accessToken','Personal Access Token'), t('baseId','Base ID','appXXXXXXXXXXXXXX',true), t('tableName','Table Name','',true)],
  },
  {
    id: 'coda', name: 'Coda', emoji: '📝', color: '#f46a54',
    category: 'productivity', executionMode: 'client',
    description: 'Tables and pages from Coda documents.',
    tags: ['coda', 'docs', 'spreadsheet'],
    fields: [p('apiToken','API Token'), t('docId','Document ID','',true), t('tableId','Table ID (optional)')],
  },
  {
    id: 'monday', name: 'Monday.com', emoji: '🗓️', color: '#ff3d57',
    category: 'productivity', executionMode: 'client',
    description: 'Boards, items, and columns from Monday.',
    tags: ['monday', 'project', 'crm', 'workflow'],
    fields: [p('apiToken','API Token'), t('boardId','Board ID')],
  },
  {
    id: 'asana', name: 'Asana', emoji: '🅰️', color: '#f06a6a',
    category: 'productivity', executionMode: 'client',
    description: 'Tasks and projects from Asana.',
    tags: ['asana', 'project', 'tasks'],
    fields: [p('accessToken','Personal Access Token'), t('projectGid','Project GID (optional)')],
  },
  {
    id: 'clickup', name: 'ClickUp', emoji: '✅', color: '#7b68ee',
    category: 'productivity', executionMode: 'client',
    description: 'Tasks and spaces from ClickUp.',
    tags: ['clickup', 'project', 'tasks'],
    fields: [p('apiToken','API Token'), t('listId','List ID')],
  },
  {
    id: 'trello', name: 'Trello', emoji: '📋', color: '#0052cc',
    category: 'productivity', executionMode: 'client',
    description: 'Boards and cards from Trello.',
    tags: ['trello', 'kanban', 'project'],
    fields: [t('apiKey','API Key','',true), p('token','Token'), t('boardId','Board ID')],
  },
  {
    id: 'jira', name: 'Jira', emoji: '🔵', color: '#0052cc',
    category: 'productivity', executionMode: 'client', popular: true,
    description: 'Issues and sprints from Jira Cloud.',
    tags: ['jira', 'atlassian', 'project', 'bugs'],
    fields: [u('baseUrl','Base URL','https://org.atlassian.net',true), t('email','Email','',true), p('apiToken','API Token'), ta('jql','JQL Query','project = MY-PROJECT ORDER BY created DESC')],
  },
  {
    id: 'confluence', name: 'Confluence', emoji: '📚', color: '#0052cc',
    category: 'productivity', executionMode: 'client',
    description: 'Pages and spaces from Atlassian Confluence.',
    tags: ['confluence', 'atlassian', 'wiki', 'docs'],
    fields: [u('baseUrl','Base URL','https://org.atlassian.net/wiki',true), t('email','Email','',true), p('apiToken','API Token'), t('spaceKey','Space Key (optional)')],
  },
  {
    id: 'linear', name: 'Linear', emoji: '🔷', color: '#5e6ad2',
    category: 'productivity', executionMode: 'client', popular: true,
    description: 'Issues, projects, and cycles from Linear.',
    tags: ['linear', 'project', 'bugs', 'engineering'],
    fields: [p('apiKey','API Key')],
  },
  {
    id: 'basecamp', name: 'Basecamp', emoji: '🏕️', color: '#1d2d35',
    category: 'productivity', executionMode: 'client',
    description: 'Projects, messages, and todos from Basecamp.',
    tags: ['basecamp', 'project', 'collaboration'],
    fields: [p('accessToken','Access Token'), t('accountId','Account ID')],
  },
  {
    id: 'smartsheet', name: 'Smartsheet', emoji: '📋', color: '#00aeef',
    category: 'productivity', executionMode: 'client',
    description: 'Sheet data and reports from Smartsheet.',
    tags: ['smartsheet', 'spreadsheet', 'project'],
    fields: [p('accessToken','Access Token'), t('sheetId','Sheet ID')],
  },

  // ── COMMUNICATION ─────────────────────────────────────────────────────────
  {
    id: 'gmail', name: 'Gmail', emoji: '📧', color: '#ea4335',
    category: 'communication', executionMode: 'client', popular: true,
    description: 'Full Gmail inbox — all emails fetched and indexed.',
    tags: ['gmail', 'google', 'email', 'inbox'],
    fields: [t('clientId','Google OAuth Client ID','xxx.apps.googleusercontent.com',true), oauth()],
    oauth: google(['https://www.googleapis.com/auth/gmail.readonly']),
  },
  {
    id: 'outlook', name: 'Outlook / Exchange', emoji: '📨', color: '#0078d4',
    category: 'communication', executionMode: 'client', popular: true,
    description: 'Full Outlook inbox via Microsoft Graph API.',
    tags: ['outlook', 'microsoft', 'email', 'exchange'],
    fields: [t('clientId','Azure App Client ID','',true), oauth()],
    oauth: microsoft(['Mail.Read']),
  },
  {
    id: 'google-calendar', name: 'Google Calendar', emoji: '📅', color: '#4285f4',
    category: 'communication', executionMode: 'client',
    description: 'Events and schedules from Google Calendar.',
    tags: ['calendar', 'google', 'events'],
    fields: [t('clientId','Google OAuth Client ID','',true), oauth()],
    oauth: google(['https://www.googleapis.com/auth/calendar.readonly']),
  },
  {
    id: 'outlook-calendar', name: 'Outlook Calendar', emoji: '📆', color: '#0078d4',
    category: 'communication', executionMode: 'client',
    description: 'Events from Microsoft Outlook Calendar.',
    tags: ['calendar', 'microsoft', 'outlook', 'events'],
    fields: [t('clientId','Azure App Client ID','',true), oauth()],
    oauth: microsoft(['Calendars.Read']),
  },
  {
    id: 'slack', name: 'Slack', emoji: '💬', color: '#4a154b',
    category: 'communication', executionMode: 'client', popular: true,
    description: 'Messages, channels, and files from Slack workspaces.',
    tags: ['slack', 'chat', 'messages', 'channels'],
    fields: [p('token','Bot Token (xoxb-…) or User Token (xoxp-…)')],
  },
  {
    id: 'microsoft-teams', name: 'Microsoft Teams', emoji: '🟣', color: '#6264a7',
    category: 'communication', executionMode: 'client',
    description: 'Messages and channels from Microsoft Teams.',
    tags: ['teams', 'microsoft', 'chat', 'office365'],
    fields: [t('clientId','Azure App Client ID','',true), oauth()],
    oauth: microsoft(['ChannelMessage.Read.All', 'Channel.ReadBasic.All']),
  },
  {
    id: 'discord', name: 'Discord', emoji: '🎮', color: '#5865f2',
    category: 'communication', executionMode: 'server',
    description: 'Messages from Discord servers via bot token.',
    tags: ['discord', 'chat', 'gaming', 'community'],
    fields: [p('botToken','Bot Token'), t('guildId','Server ID','',true), t('channelId','Channel ID (optional)')],
  },
  {
    id: 'telegram', name: 'Telegram', emoji: '✈️', color: '#2ca5e0',
    category: 'communication', executionMode: 'server',
    description: 'Messages from Telegram bots and channels.',
    tags: ['telegram', 'chat', 'bot'],
    fields: [p('botToken','Bot Token'), t('chatId','Chat ID','',true)],
  },
  {
    id: 'intercom', name: 'Intercom', emoji: '💭', color: '#286efa',
    category: 'communication', executionMode: 'client',
    description: 'Conversations and users from Intercom.',
    tags: ['intercom', 'support', 'crm', 'chat'],
    fields: [p('accessToken','Access Token')],
  },
  {
    id: 'zendesk', name: 'Zendesk', emoji: '🎯', color: '#03363d',
    category: 'communication', executionMode: 'client', popular: true,
    description: 'Support tickets and conversations from Zendesk.',
    tags: ['zendesk', 'support', 'tickets', 'crm'],
    fields: [t('subdomain','Subdomain','mycompany',true), t('email','Email','',true), p('apiToken','API Token')],
  },
  {
    id: 'freshdesk', name: 'Freshdesk', emoji: '🌊', color: '#25c16f',
    category: 'communication', executionMode: 'client',
    description: 'Tickets and conversations from Freshdesk.',
    tags: ['freshdesk', 'support', 'freshworks'],
    fields: [t('domain','Domain','mycompany.freshdesk.com',true), p('apiKey','API Key')],
  },
  {
    id: 'front', name: 'Front', emoji: '🏠', color: '#fa412d',
    category: 'communication', executionMode: 'client',
    description: 'Conversations and inbox from Front.',
    tags: ['front', 'email', 'support', 'inbox'],
    fields: [p('apiToken','API Token')],
  },
  {
    id: 'calendly', name: 'Calendly', emoji: '📆', color: '#006bff',
    category: 'communication', executionMode: 'client',
    description: 'Scheduled events and availability from Calendly.',
    tags: ['calendly', 'scheduling', 'calendar'],
    fields: [p('accessToken','Personal Access Token')],
  },

  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  {
    id: 'google-analytics', name: 'Google Analytics 4', emoji: '📈', color: '#e37400',
    category: 'analytics', executionMode: 'client', popular: true,
    description: 'Traffic, events, and conversions from GA4.',
    tags: ['analytics', 'google', 'ga4', 'traffic'],
    fields: [t('propertyId','GA4 Property ID','123456789',true), t('clientId','Google OAuth Client ID','',true), oauth()],
    oauth: google(['https://www.googleapis.com/auth/analytics.readonly']),
  },
  {
    id: 'mixpanel', name: 'Mixpanel', emoji: '📊', color: '#7856ff',
    category: 'analytics', executionMode: 'client',
    description: 'User events and funnels from Mixpanel.',
    tags: ['analytics', 'mixpanel', 'events', 'funnels'],
    fields: [t('projectId','Project ID','',true), p('serviceAccountSecret','Service Account Secret'), t('serviceAccountUser','Service Account Username')],
  },
  {
    id: 'amplitude', name: 'Amplitude', emoji: '🔊', color: '#1153f3',
    category: 'analytics', executionMode: 'client',
    description: 'Events and user cohorts from Amplitude.',
    tags: ['analytics', 'amplitude', 'events'],
    fields: [t('apiKey','API Key','',true), p('secretKey','Secret Key')],
  },
  {
    id: 'posthog', name: 'PostHog', emoji: '🦔', color: '#f54e00',
    category: 'analytics', executionMode: 'client', popular: true,
    description: 'Product analytics events and person data.',
    tags: ['analytics', 'posthog', 'events', 'open-source'],
    fields: [u('host','Host','https://app.posthog.com'), p('personalApiKey','Personal API Key'), t('projectId','Project ID')],
  },
  {
    id: 'segment', name: 'Segment', emoji: '🟢', color: '#52bd94',
    category: 'analytics', executionMode: 'client',
    description: 'Customer event data from Segment.',
    tags: ['analytics', 'segment', 'cdp', 'events'],
    fields: [p('accessToken','API Access Token'), t('workspaceId','Workspace ID')],
  },
  {
    id: 'heap', name: 'Heap', emoji: '🏔️', color: '#ff6f61',
    category: 'analytics', executionMode: 'client',
    description: 'Behavioral events and user data from Heap.',
    tags: ['analytics', 'heap', 'events'],
    fields: [p('apiKey','API Key')],
  },
  {
    id: 'plausible', name: 'Plausible', emoji: '📉', color: '#5850ec',
    category: 'analytics', executionMode: 'client',
    description: 'Privacy-friendly analytics from Plausible.',
    tags: ['analytics', 'plausible', 'privacy'],
    fields: [u('baseUrl','Base URL','https://plausible.io'), p('apiKey','API Key'), t('siteId','Site Domain','',true)],
  },
  {
    id: 'datadog', name: 'Datadog', emoji: '🐕', color: '#632ca6',
    category: 'analytics', executionMode: 'client',
    description: 'Logs, metrics, and traces from Datadog.',
    tags: ['datadog', 'observability', 'metrics', 'logs'],
    fields: [p('apiKey','API Key'), p('appKey','Application Key'), t('query','Log Query','service:myapp status:error')],
  },
  {
    id: 'newrelic', name: 'New Relic', emoji: '🍎', color: '#1ce783',
    category: 'analytics', executionMode: 'client',
    description: 'Performance metrics and traces from New Relic.',
    tags: ['newrelic', 'observability', 'metrics', 'apm'],
    fields: [p('userKey','User API Key'), t('accountId','Account ID','',true), ta('nrql','NRQL Query','SELECT * FROM Transaction SINCE 1 day ago')],
  },
  {
    id: 'hotjar', name: 'Hotjar', emoji: '🔥', color: '#f9363f',
    category: 'analytics', executionMode: 'client',
    description: 'Heatmaps and session data from Hotjar.',
    tags: ['hotjar', 'ux', 'heatmap', 'sessions'],
    fields: [p('apiKey','API Key'), t('siteId','Site ID')],
  },

  // ── DEVELOPER TOOLS ───────────────────────────────────────────────────────
  {
    id: 'github', name: 'GitHub', emoji: '🐙', color: '#ffffff',
    category: 'devtools', executionMode: 'client', popular: true,
    description: 'Repos, issues, PRs, and commits from GitHub.',
    tags: ['github', 'git', 'code', 'issues', 'prs'],
    fields: [p('token','Personal Access Token (classic or fine-grained)'), t('owner','Owner / Org','',true), t('repo','Repository (optional)')],
  },
  {
    id: 'gitlab', name: 'GitLab', emoji: '🦊', color: '#fc6d26',
    category: 'devtools', executionMode: 'client',
    description: 'Projects, issues, and merge requests from GitLab.',
    tags: ['gitlab', 'git', 'code', 'cicd'],
    fields: [u('baseUrl','GitLab URL','https://gitlab.com'), p('accessToken','Personal Access Token'), t('projectId','Project ID or Path','',true)],
  },
  {
    id: 'bitbucket', name: 'Bitbucket', emoji: '🗑️', color: '#0052cc',
    category: 'devtools', executionMode: 'client',
    description: 'Repos, PRs, and commits from Bitbucket.',
    tags: ['bitbucket', 'git', 'atlassian', 'code'],
    fields: [t('username','Username','',true), p('appPassword','App Password'), t('workspace','Workspace','',true), t('repo','Repository (optional)')],
  },
  {
    id: 'sentry', name: 'Sentry', emoji: '🚨', color: '#362d59',
    category: 'devtools', executionMode: 'client',
    description: 'Errors, issues, and performance from Sentry.',
    tags: ['sentry', 'errors', 'monitoring', 'debugging'],
    fields: [p('authToken','Auth Token'), t('organization','Organization Slug','',true), t('project','Project Slug (optional)')],
  },
  {
    id: 'pagerduty', name: 'PagerDuty', emoji: '🚒', color: '#06ac38',
    category: 'devtools', executionMode: 'client',
    description: 'Incidents and on-call schedules from PagerDuty.',
    tags: ['pagerduty', 'incidents', 'oncall', 'devops'],
    fields: [p('apiToken','API Token'), t('serviceId','Service ID (optional)')],
  },
  {
    id: 'vercel', name: 'Vercel', emoji: '▲', color: '#ffffff',
    category: 'devtools', executionMode: 'client',
    description: 'Deployments, projects, and logs from Vercel.',
    tags: ['vercel', 'deployments', 'serverless', 'frontend'],
    fields: [p('token','Access Token'), t('teamId','Team ID (optional)')],
  },
  {
    id: 'netlify', name: 'Netlify', emoji: '🌐', color: '#00c7b7',
    category: 'devtools', executionMode: 'client',
    description: 'Sites, deploys, and functions from Netlify.',
    tags: ['netlify', 'deployments', 'hosting'],
    fields: [p('accessToken','Personal Access Token'), t('siteId','Site ID (optional)')],
  },
  {
    id: 'grafana', name: 'Grafana', emoji: '📊', color: '#f46800',
    category: 'devtools', executionMode: 'client',
    description: 'Dashboards and metric queries from Grafana.',
    tags: ['grafana', 'metrics', 'dashboards', 'observability'],
    fields: [u('baseUrl','Grafana URL','https://grafana.mycompany.com',true), p('apiKey','API Key'), t('datasourceId','Datasource UID')],
  },

  // ── FINANCE ───────────────────────────────────────────────────────────────
  {
    id: 'stripe', name: 'Stripe', emoji: '💳', color: '#6772e5',
    category: 'finance', executionMode: 'client', popular: true,
    description: 'Charges, customers, subscriptions from Stripe.',
    tags: ['stripe', 'payments', 'billing', 'finance'],
    fields: [p('secretKey','Secret Key (sk_live_… or sk_test_…)')],
  },
  {
    id: 'quickbooks', name: 'QuickBooks', emoji: '📗', color: '#2ca01c',
    category: 'finance', executionMode: 'client',
    description: 'Accounting and financial data from QuickBooks Online.',
    tags: ['quickbooks', 'accounting', 'finance', 'intuit'],
    fields: [p('accessToken','OAuth Access Token'), t('companyId','Company/Realm ID','',true), t('query','Query','SELECT * FROM Invoice MAXRESULTS 1000')],
  },
  {
    id: 'xero', name: 'Xero', emoji: '🟦', color: '#13b5ea',
    category: 'finance', executionMode: 'client',
    description: 'Invoices, contacts, and accounts from Xero.',
    tags: ['xero', 'accounting', 'finance'],
    fields: [p('accessToken','OAuth Access Token'), t('tenantId','Tenant/Organisation ID','',true)],
  },
  {
    id: 'brex', name: 'Brex', emoji: '💰', color: '#ff6900',
    category: 'finance', executionMode: 'client',
    description: 'Transactions and expenses from Brex.',
    tags: ['brex', 'finance', 'expenses', 'corporate'],
    fields: [p('accessToken','API Access Token')],
  },
  {
    id: 'plaid', name: 'Plaid', emoji: '🏦', color: '#0b3c72',
    category: 'finance', executionMode: 'server',
    description: 'Bank transactions and account data via Plaid.',
    tags: ['plaid', 'banking', 'transactions', 'fintech'],
    fields: [t('clientId','Client ID','',true), p('secret','Secret'), p('accessToken','Access Token'), sel('env','Environment',[['sandbox','Sandbox'],['development','Development'],['production','Production']])],
  },

  // ── E-COMMERCE ────────────────────────────────────────────────────────────
  {
    id: 'shopify', name: 'Shopify', emoji: '🛍️', color: '#96bf48',
    category: 'ecommerce', executionMode: 'client', popular: true,
    description: 'Products, orders, and customers from Shopify.',
    tags: ['shopify', 'ecommerce', 'products', 'orders'],
    fields: [t('shop','Shop Domain','mystore.myshopify.com',true), p('accessToken','Admin API Access Token')],
  },
  {
    id: 'woocommerce', name: 'WooCommerce', emoji: '🟣', color: '#96588a',
    category: 'ecommerce', executionMode: 'client',
    description: 'Orders, products, and customers from WooCommerce.',
    tags: ['woocommerce', 'wordpress', 'ecommerce'],
    fields: [u('baseUrl','Store URL','https://mystore.com',true), t('consumerKey','Consumer Key','',true), p('consumerSecret','Consumer Secret')],
  },
  {
    id: 'bigcommerce', name: 'BigCommerce', emoji: '🔷', color: '#34313f',
    category: 'ecommerce', executionMode: 'client',
    description: 'Products, orders, and customers from BigCommerce.',
    tags: ['bigcommerce', 'ecommerce'],
    fields: [t('storeHash','Store Hash','',true), p('accessToken','API Access Token')],
  },
  {
    id: 'square', name: 'Square', emoji: '⬛', color: '#3e4348',
    category: 'ecommerce', executionMode: 'client',
    description: 'Payments, orders, and items from Square.',
    tags: ['square', 'payments', 'pos', 'ecommerce'],
    fields: [p('accessToken','Access Token'), sel('env','Environment',[['production','Production'],['sandbox','Sandbox']])],
  },

  // ── CUSTOM ────────────────────────────────────────────────────────────────
  {
    id: 'rest-api', name: 'REST API', emoji: '🌐', color: '#61dafb',
    category: 'custom', executionMode: 'client', popular: true,
    description: 'Any HTTP endpoint — GET with auth and JSON path extraction.',
    tags: ['rest', 'api', 'http', 'json', 'custom'],
    fields: [u('url','Endpoint URL','https://api.example.com/data',true), sel('authType','Auth Type',[['none','None'],['bearer','Bearer Token'],['apikey','API Key Header'],['basic','Basic (user:pass)']]), p('authValue','Token / Credentials'), t('authHeader','Header Name (API Key only)','X-API-Key'), t('jsonPath','JSON Path (optional)','data.items')],
  },
  {
    id: 'graphql', name: 'GraphQL', emoji: '⬡', color: '#e535ab',
    category: 'custom', executionMode: 'client',
    description: 'Query any GraphQL endpoint with custom queries.',
    tags: ['graphql', 'api', 'query'],
    fields: [u('url','GraphQL Endpoint','',true), p('token','Bearer Token (optional)'), ta('query','GraphQL Query','{ users { id name email } }'), ta('variables','Variables JSON (optional)','{}')],
  },
  {
    id: 'rss-feed', name: 'RSS / Atom Feed', emoji: '📡', color: '#f26522',
    category: 'custom', executionMode: 'client',
    description: 'Parse any RSS or Atom feed as structured content.',
    tags: ['rss', 'atom', 'feed', 'news'],
    fields: [u('url','Feed URL','https://example.com/feed.xml',true)],
  },
  {
    id: 'web-scrape', name: 'Web Page', emoji: '🕸️', color: '#43853d',
    category: 'custom', executionMode: 'server',
    description: 'Extract readable content from any public URL.',
    tags: ['scrape', 'web', 'html', 'url'],
    fields: [u('url','Page URL','https://example.com',true)],
  },
  {
    id: 'paste', name: 'Paste Text', emoji: '📋', color: '#ffffff',
    category: 'custom', executionMode: 'client', popular: true,
    description: 'Paste any text, JSON, CSV, or markdown directly.',
    tags: ['text', 'paste', 'manual', 'json', 'csv'],
    fields: [ta('content','Paste your content here')],
  },
];

// ── Derived lookups ────────────────────────────────────────────────────────────
export const CONNECTORS_BY_ID: Record<string, Connector> = Object.fromEntries(
  CONNECTORS.map(c => [c.id, c])
);

export const CONNECTORS_BY_CATEGORY = CATEGORIES.reduce(
  (acc, cat) => {
    acc[cat.id as CategoryId] = CONNECTORS.filter(c => c.category === cat.id);
    return acc;
  },
  {} as Record<CategoryId, Connector[]>
);
