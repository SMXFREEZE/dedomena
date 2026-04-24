/**
 * Enterprise MCP Server Registry
 * Pre-configured definitions for connecting to cloud platforms, databases,
 * dev tools, and enterprise services via MCP.
 */

export interface MCPServerDef {
  id: string;
  name: string;
  description: string;
  category: MCPCategory;
  icon: string;
  color: string;
  transport: "sse" | "stdio";
  configFields: MCPConfigField[];
  command?: string;
  args?: string[];
  envMapping?: Record<string, string>;   // maps config field key → env var name
  defaultUrl?: string;
  docs?: string;
  popular?: boolean;
  oauthProvider?: string;
}

export interface MCPConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

export type MCPCategory =
  | "cloud" | "database" | "devtools" | "files"
  | "browser" | "communication" | "analytics" | "gateway";

export interface MCPCategoryDef {
  id: MCPCategory;
  label: string;
}

export const MCP_CATEGORIES: MCPCategoryDef[] = [
  { id: "cloud",         label: "Cloud Platforms" },
  { id: "database",      label: "Databases" },
  { id: "devtools",      label: "Code & Dev" },
  { id: "files",         label: "Files & Terminal" },
  { id: "browser",       label: "Browser & Web" },
  { id: "communication", label: "Communication" },
  { id: "analytics",     label: "Analytics" },
  { id: "gateway",       label: "MCP Gateways" },
];

// ── Field shorthand helpers ────────────────────────────────────────────────
const text = (key: string, label: string, ph = "", req = false): MCPConfigField =>
  ({ key, label, type: "text", placeholder: ph, required: req });
const pass = (key: string, label: string, ph = ""): MCPConfigField =>
  ({ key, label, type: "password", placeholder: ph, required: true });
const url = (key: string, label: string, ph = ""): MCPConfigField =>
  ({ key, label, type: "url", placeholder: ph, required: true });

export const MCP_SERVERS: MCPServerDef[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOUD PLATFORMS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "aws-mcp",
    name: "AWS",
    description: "Connect to AWS services — S3, DynamoDB, Lambda, CloudWatch, IAM, and more.",
    category: "cloud", icon: "aws", color: "#FF9900",
    transport: "stdio", popular: true,
    command: "npx", args: ["-y", "@awslabs/mcp"],
    configFields: [
      pass("awsAccessKeyId", "Access Key ID", "AKIA..."),
      pass("awsSecretAccessKey", "Secret Access Key"),
      text("awsRegion", "Region", "us-east-1"),
    ],
    envMapping: { awsAccessKeyId: "AWS_ACCESS_KEY_ID", awsSecretAccessKey: "AWS_SECRET_ACCESS_KEY", awsRegion: "AWS_REGION" },
    docs: "https://github.com/awslabs/mcp",
  },
  {
    id: "azure-mcp",
    name: "Azure",
    description: "Connect to Microsoft Azure — Blob Storage, Cosmos DB, Azure AI, and more.",
    category: "cloud", icon: "azure", color: "#0078D4",
    transport: "stdio", popular: true,
    command: "npx", args: ["-y", "@microsoft/mcp"],
    configFields: [
      text("azureTenantId", "Tenant ID", "", true),
      pass("azureClientId", "Client ID"),
      pass("azureClientSecret", "Client Secret"),
      text("azureSubscriptionId", "Subscription ID"),
    ],
    envMapping: { azureTenantId: "AZURE_TENANT_ID", azureClientId: "AZURE_CLIENT_ID", azureClientSecret: "AZURE_CLIENT_SECRET" },
    docs: "https://github.com/microsoft/mcp",
  },
  {
    id: "databricks-mcp",
    name: "Databricks",
    description: "Query Databricks Unity Catalog, run SQL, access Genie, and manage notebooks.",
    category: "cloud", icon: "databricks", color: "#FF3621",
    transport: "stdio", popular: true,
    command: "npx", args: ["-y", "databricks-mcp-server"],
    configFields: [
      url("databricksHost", "Workspace URL", "https://adb-xxx.azuredatabricks.net"),
      pass("databricksToken", "Personal Access Token"),
      text("databricksWarehouse", "SQL Warehouse ID", "optional"),
    ],
    envMapping: { databricksHost: "DATABRICKS_HOST", databricksToken: "DATABRICKS_TOKEN" },
    docs: "https://github.com/JustTryAI/databricks-mcp-server",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "postgres-mcp",
    name: "PostgreSQL (MCP)",
    description: "Query PostgreSQL databases directly through MCP. Schema inspection and SQL execution.",
    category: "database", icon: "postgresql", color: "#336791",
    transport: "stdio",
    command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres"],
    configFields: [
      url("connectionString", "Connection String", "postgresql://user:pass@host:5432/db"),
    ],
    envMapping: { connectionString: "POSTGRES_CONNECTION_STRING" },
  },
  {
    id: "sqlite-mcp",
    name: "SQLite (MCP)",
    description: "Read and query any SQLite database file through MCP.",
    category: "database", icon: "sqlite", color: "#003B57",
    transport: "stdio",
    command: "npx", args: ["-y", "@modelcontextprotocol/server-sqlite"],
    configFields: [
      text("dbPath", "Database Path", "/path/to/database.db", true),
    ],
  },
  {
    id: "mysql-mcp",
    name: "MySQL (MCP)",
    description: "Connect to MySQL/MariaDB via MCP for schema exploration and queries.",
    category: "database", icon: "mysql", color: "#4479A1",
    transport: "stdio",
    command: "npx", args: ["-y", "@benborla29/mcp-server-mysql"],
    configFields: [
      text("host", "Host", "localhost", true),
      text("port", "Port", "3306"),
      text("database", "Database", "", true),
      text("user", "Username", "", true),
      pass("password", "Password"),
    ],
    envMapping: { host: "MYSQL_HOST", port: "MYSQL_PORT", database: "MYSQL_DATABASE", user: "MYSQL_USER", password: "MYSQL_PASSWORD" },
  },
  {
    id: "mongo-mcp",
    name: "MongoDB (MCP)",
    description: "Query MongoDB collections, inspect schemas, and run aggregation pipelines.",
    category: "database", icon: "mongodb", color: "#47A248",
    transport: "stdio",
    command: "npx", args: ["-y", "mcp-mongo-server"],
    configFields: [
      url("mongoUri", "Connection URI", "mongodb+srv://user:pass@cluster.mongodb.net/db"),
    ],
    envMapping: { mongoUri: "MONGO_URI" },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CODE & DEV TOOLS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "github-mcp",
    name: "GitHub",
    description: "Access repos, PRs, issues, actions, code search, and more via GitHub's official MCP server.",
    category: "devtools", icon: "github", color: "#181717",
    transport: "stdio", popular: true,
    command: "npx", args: ["-y", "@github/mcp-server"],
    configFields: [
      pass("githubToken", "Personal Access Token (classic or fine-grained)"),
    ],
    envMapping: { githubToken: "GITHUB_PERSONAL_ACCESS_TOKEN" },
    docs: "https://github.com/github/github-mcp-server",
  },
  {
    id: "gitlab-mcp",
    name: "GitLab",
    description: "Access GitLab repos, merge requests, pipelines, and issues.",
    category: "devtools", icon: "gitlab", color: "#FC6D26",
    transport: "stdio",
    command: "npx", args: ["-y", "@zereight/mcp-gitlab"],
    configFields: [
      url("gitlabUrl", "GitLab URL", "https://gitlab.com"),
      pass("gitlabToken", "Access Token"),
    ],
    envMapping: { gitlabUrl: "GITLAB_URL", gitlabToken: "GITLAB_TOKEN" },
  },
  {
    id: "sentry-mcp",
    name: "Sentry",
    description: "Access error tracking, issues, and performance data from Sentry.",
    category: "devtools", icon: "sentry", color: "#362D59",
    transport: "stdio",
    command: "npx", args: ["-y", "@sentry/mcp-server"],
    configFields: [
      pass("sentryToken", "Auth Token"),
      text("sentryOrg", "Organization Slug", "my-org"),
    ],
    envMapping: { sentryToken: "SENTRY_AUTH_TOKEN", sentryOrg: "SENTRY_ORG" },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FILES & TERMINAL
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "filesystem-mcp",
    name: "Filesystem",
    description: "Secure read/write access to local files and directories with configurable permissions.",
    category: "files", icon: "files", color: "#4A90D9",
    transport: "stdio", popular: true,
    command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/"],
    configFields: [
      text("rootDir", "Root Directory", "C:/Users/you/Documents", true),
    ],
  },
  {
    id: "terminal-mcp",
    name: "Terminal / Shell",
    description: "Execute shell commands on the local machine securely.",
    category: "files", icon: "terminal", color: "#1E1E1E",
    transport: "stdio",
    command: "npx", args: ["-y", "mcp-shell-server"],
    configFields: [
      text("shell", "Shell", "bash"),
      text("allowedCommands", "Allowed Commands (comma-separated)", "ls,cat,grep,find,git"),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BROWSER & WEB
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "puppeteer-mcp",
    name: "Browser (Puppeteer)",
    description: "Control a headless browser — navigate, screenshot, click, type, and extract data.",
    category: "browser", icon: "chrome", color: "#4285F4",
    transport: "stdio",
    command: "npx", args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    configFields: [],
  },
  {
    id: "fetch-mcp",
    name: "Web Fetch",
    description: "Fetch and convert web pages to markdown, or retrieve raw content from any URL.",
    category: "browser", icon: "globe", color: "#43853D",
    transport: "stdio",
    command: "npx", args: ["-y", "@modelcontextprotocol/server-fetch"],
    configFields: [],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMUNICATION
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "slack-mcp",
    name: "Slack (MCP)",
    description: "Send messages, read channels, search conversations, and manage Slack workspaces.",
    category: "communication", icon: "slack", color: "#4A154B",
    transport: "stdio",
    command: "npx", args: ["-y", "@anthropic/mcp-server-slack"],
    configFields: [
      pass("slackBotToken", "Bot User OAuth Token", "xoxb-..."),
      pass("slackAppToken", "App-Level Token", "xapp-..."),
    ],
    envMapping: { slackBotToken: "SLACK_BOT_TOKEN", slackAppToken: "SLACK_APP_TOKEN" },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "google-analytics-mcp",
    name: "Google Analytics (MCP)",
    description: "Access Google Analytics data, reports, and real-time metrics.",
    category: "analytics", icon: "google", color: "#E37400",
    transport: "stdio",
    command: "npx", args: ["-y", "mcp-google-analytics"],
    configFields: [
      pass("gaCredentials", "Service Account JSON"),
      text("gaPropertyId", "Property ID", "properties/123456"),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MCP GATEWAYS (connect ANY REST API / service)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "docker-mcp-gateway",
    name: "Docker MCP Gateway",
    description: "Run any MCP server in a Docker container. Secure, isolated, and scalable.",
    category: "gateway", icon: "docker", color: "#2496ED",
    transport: "sse", popular: true,
    configFields: [
      url("gatewayUrl", "Gateway URL", "http://localhost:8811/sse"),
    ],
    docs: "https://github.com/docker/mcp-gateway",
  },
  {
    id: "ibm-context-forge",
    name: "IBM Context Forge",
    description: "Connect REST APIs, gRPC, MCP servers — anything — through IBM's universal gateway.",
    category: "gateway", icon: "ibm", color: "#054ADA",
    transport: "sse",
    configFields: [
      url("forgeUrl", "Gateway URL", "http://localhost:3001/sse"),
      pass("forgeApiKey", "API Key (optional)"),
    ],
    docs: "https://github.com/IBM/mcp-context-forge",
  },
  {
    id: "custom-mcp",
    name: "Custom MCP Server",
    description: "Connect to any MCP-compatible server by URL. Use for self-hosted or third-party servers.",
    category: "gateway", icon: "plug", color: "#9370FF",
    transport: "sse",
    configFields: [
      url("serverUrl", "Server URL (SSE endpoint)", "http://localhost:3000/sse"),
      text("serverName", "Display Name", "My MCP Server"),
      pass("apiKey", "API Key / Bearer Token (optional)"),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTERPRISE APPS (Native integrations)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "gmail",
    name: "Gmail",
    description: "Connect your Gmail inbox for reading, searching, and sending emails.",
    category: "communication", icon: "gmail", color: "#EA4335",
    transport: "stdio", popular: true,
    oauthProvider: "google",
    configFields: [ ],
  },
  {
    id: "outlook",
    name: "Outlook",
    description: "Connect your Microsoft Outlook inbox.",
    category: "communication", icon: "microsoftoutlook", color: "#0078D4",
    transport: "stdio", popular: true,
    oauthProvider: "microsoft",
    configFields: [ ],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Manage events and view schedules from Google Calendar.",
    category: "communication", icon: "googlecalendar", color: "#4285F4",
    transport: "stdio", popular: true,
    configFields: [ pass("accessToken", "Google Access Token") ],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Manage sales pipeline, contacts, and opportunities.",
    category: "cloud", icon: "salesforce", color: "#00A1E0",
    transport: "stdio", popular: true,
    oauthProvider: "salesforce",
    configFields: [ ],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Manage contacts, create deals, and search your CRM.",
    category: "cloud", icon: "hubspot", color: "#FF7A59",
    transport: "stdio", popular: true,
    oauthProvider: "hubspot",
    configFields: [ ],
  },
  {
    id: "jira",
    name: "Jira",
    description: "Manage tickets, issues, sprints and boards.",
    category: "devtools", icon: "jira", color: "#0052CC",
    transport: "stdio", popular: true,
    configFields: [ pass("accessToken", "Jira API Token") ],
  },
  {
    id: "linear",
    name: "Linear",
    description: "Manage issues, projects, and cycles.",
    category: "devtools", icon: "linear", color: "#5E6AD2",
    transport: "stdio", popular: true,
    configFields: [ pass("accessToken", "Linear API Key") ],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Manage workspace pages and databases.",
    category: "files", icon: "notion", color: "#FFFFFF",
    transport: "stdio", popular: true,
    configFields: [ pass("accessToken", "Notion Integration Token") ],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Manage cloud files and storage.",
    category: "files", icon: "googledrive", color: "#4285F4",
    transport: "stdio", popular: true,
    oauthProvider: "google",
    configFields: [ ],
  },
  {
    id: "zendesk",
    name: "Zendesk",
    description: "Manage customer support tickets.",
    category: "communication", icon: "zendesk", color: "#03363D",
    transport: "stdio", popular: true,
    configFields: [ pass("accessToken", "Zendesk API Token") ],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Fetch transaction data, payments, and subscriptions.",
    category: "analytics", icon: "stripe", color: "#635BFF",
    transport: "stdio", popular: true,
    configFields: [ pass("accessToken", "Stripe API Key") ],
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Manage store orders, products, and customers.",
    category: "analytics", icon: "shopify", color: "#95BF47",
    transport: "stdio", popular: true,
    configFields: [ pass("accessToken", "Shopify Access Token") ],
  },
];

export const MCP_SERVERS_BY_ID = Object.fromEntries(MCP_SERVERS.map(s => [s.id, s]));
