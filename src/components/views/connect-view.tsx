"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectorIcon } from "@/components/ui/connector-icon";
import {
  Plug, CheckCircle2, AlertCircle, Loader2,
  Cloud, Database, Code, FolderOpen, Globe, Mail, BarChart2,
  Zap, ChevronRight, X, Search, ArrowRight,
  Shield, Server, FileText, MessageSquare,
} from "lucide-react";
import { MCP_SERVERS, MCP_CATEGORIES, MCP_SERVERS_BY_ID, type MCPServerDef } from "@/lib/mcp/registry";
import { useIntegrationsStore, type MCPConnection } from "@/store/integrations-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORY_ICONS: Record<string, any> = {
  cloud: Cloud, database: Database, devtools: Code, files: FolderOpen,
  browser: Globe, communication: Mail, analytics: BarChart2, gateway: Zap,
};

// ── Friendly labels (no technical jargon) ───────────────────────────────────

const FRIENDLY_LABELS: Record<string, string> = {
  "aws-mcp": "Amazon Web Services",
  "azure-mcp": "Microsoft Azure",
  "databricks-mcp": "Databricks Lakehouse",
  "postgres-mcp": "PostgreSQL Database",
  "sqlite-mcp": "SQLite Database",
  "mysql-mcp": "MySQL Database",
  "mongo-mcp": "MongoDB Database",
  "github-mcp": "GitHub Repositories",
  "gitlab-mcp": "GitLab Repositories",
  "sentry-mcp": "Sentry Error Tracking",
  "filesystem-mcp": "Your Computer Files",
  "terminal-mcp": "Command Line",
  "puppeteer-mcp": "Web Browser Control",
  "fetch-mcp": "Import from Any URL",
  "slack-mcp": "Slack Workspace",
  "google-analytics-mcp": "Google Analytics",
  "docker-mcp-gateway": "Docker Services",
  "ibm-context-forge": "IBM Services",
  "custom-mcp": "Other Service",
};

const FRIENDLY_DESCRIPTIONS: Record<string, string> = {
  "aws-mcp": "Access your S3 files, DynamoDB tables, Lambda functions, and other AWS services.",
  "azure-mcp": "Connect to Azure Blob Storage, Cosmos DB, and other Microsoft cloud services.",
  "databricks-mcp": "Query your Databricks warehouse, notebooks, and Unity Catalog data.",
  "postgres-mcp": "Read data from your PostgreSQL database tables.",
  "sqlite-mcp": "Open and query any SQLite database file.",
  "mysql-mcp": "Read data from your MySQL or MariaDB database.",
  "mongo-mcp": "Access your MongoDB collections and documents.",
  "github-mcp": "Browse repos, pull requests, issues, and code from GitHub.",
  "gitlab-mcp": "Access your GitLab projects, merge requests, and pipelines.",
  "sentry-mcp": "View error reports, issues, and performance data from Sentry.",
  "filesystem-mcp": "Browse and read files from your computer.",
  "terminal-mcp": "Run commands on your computer.",
  "puppeteer-mcp": "Navigate web pages, fill forms, and extract data automatically.",
  "fetch-mcp": "Download and import content from any website or web page.",
  "slack-mcp": "Send messages and read conversations from your Slack workspace.",
  "google-analytics-mcp": "Pull traffic data, reports, and metrics from Google Analytics.",
  "docker-mcp-gateway": "Connect to services running in Docker containers.",
  "ibm-context-forge": "Connect to IBM enterprise services and APIs.",
  "custom-mcp": "Connect to any compatible service by entering its address.",
};

// Friendly field labels (hide technical names)
const FIELD_LABELS: Record<string, string> = {
  awsAccessKeyId: "Access Key",
  awsSecretAccessKey: "Secret Key",
  awsRegion: "Region",
  azureTenantId: "Tenant ID",
  azureClientId: "App ID",
  azureClientSecret: "App Secret",
  azureSubscriptionId: "Subscription",
  databricksHost: "Workspace Address",
  databricksToken: "Access Token",
  databricksWarehouse: "Warehouse (optional)",
  connectionString: "Connection Address",
  dbPath: "File Location",
  host: "Server Address",
  port: "Port Number",
  database: "Database Name",
  user: "Username",
  password: "Password",
  mongoUri: "Connection Address",
  githubToken: "Access Token",
  gitlabUrl: "GitLab Address",
  gitlabToken: "Access Token",
  sentryToken: "Access Token",
  sentryOrg: "Organization Name",
  rootDir: "Folder Path",
  shell: "Shell Type",
  allowedCommands: "Allowed Commands",
  slackBotToken: "Bot Token",
  slackAppToken: "App Token",
  gaCredentials: "Credentials",
  gaPropertyId: "Property ID",
  gatewayUrl: "Service Address",
  forgeUrl: "Service Address",
  forgeApiKey: "Password (optional)",
  serverUrl: "Service Address",
  serverName: "Name",
  apiKey: "Password (optional)",
};

// ── Step-by-step guides for non-technical users ──────────────────────────────

const SETUP_GUIDES: Record<string, string[]> = {
  "aws-mcp": [
    "Go to console.aws.amazon.com → IAM → Users",
    "Click your user → Security credentials tab",
    "Click \"Create access key\" → copy both keys below",
  ],
  "azure-mcp": [
    "Go to portal.azure.com → Azure Active Directory",
    "App registrations → New registration → copy the IDs",
    "Certificates & secrets → New client secret → paste below",
  ],
  "databricks-mcp": [
    "Open your Databricks workspace",
    "Click your profile icon → Settings → Developer",
    "Click \"Manage\" next to Access tokens → Generate new token",
  ],
  "github-mcp": [
    "Go to github.com/settings/tokens",
    "Click \"Generate new token\" (classic)",
    "Select the scopes you need → Generate → paste below",
  ],
  "gitlab-mcp": [
    "Go to gitlab.com/-/user_settings/personal_access_tokens",
    "Create a new token with read_api scope",
    "Copy the token and paste below",
  ],
  "sentry-mcp": [
    "Go to sentry.io → Settings → Auth Tokens",
    "Create a new token → copy and paste below",
  ],
  "slack-mcp": [
    "Go to api.slack.com/apps → Create New App",
    "Install to your workspace → copy Bot Token",
    "Under Basic Info → copy App-Level Token",
  ],
  "google-analytics-mcp": [
    "Go to console.cloud.google.com → APIs & Services",
    "Create a service account → download JSON key",
    "Paste the JSON content below",
  ],
  "postgres-mcp": [
    "Ask your database admin for the connection address",
    "Format: postgresql://user:password@host:5432/dbname",
  ],
  "mysql-mcp": [
    "Ask your database admin for the connection details",
    "You'll need: server address, database name, username, password",
  ],
  "mongo-mcp": [
    "Go to cloud.mongodb.com → Database → Connect",
    "Choose \"Drivers\" → copy the connection string",
  ],
  "filesystem-mcp": [
    "Choose which folder on your computer to share",
    "Example: C:/Users/YourName/Documents",
  ],
  "terminal-mcp": [
    "Choose which commands the AI is allowed to run",
    "Example: ls, cat, grep, find, git",
  ],
};

// ── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ def, existing, onConnect, onDisconnect }: {
  def: MCPServerDef;
  existing?: MCPConnection;
  onConnect: (def: MCPServerDef, config: Record<string, string>) => Promise<void>;
  onDisconnect: (serverId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => existing?.config ?? {});
  const [connecting, setConnecting] = useState(false);

  const isConnected = existing?.status === "connected";
  const hasError = existing?.status === "error";
  const friendlyName = FRIENDLY_LABELS[def.id] ?? def.name;
  const friendlyDesc = FRIENDLY_DESCRIPTIONS[def.id] ?? def.description;

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await onConnect(def, values);
      toast.success(`Connected to ${friendlyName}`);
      setOpen(false);
    } catch (e: any) {
      toast.error(`Could not connect: ${e.message}`);
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (!open || !def.oauthProvider) return;
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data;
      if (data?.type === "dedomena_oauth_result" && data.connectorId === def.id) {
        if (data.error) {
          toast.error(`OAuth Error: ${data.error}`);
        } else {
          onConnect(def, { accessToken: data.accessToken, githubToken: data.accessToken, slackBotToken: data.accessToken });
          toast.success(`Successfully authenticated via ${def.oauthProvider}`);
          setOpen(false);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [open, def, onConnect]);

  return (
    <div className={cn(
      "rounded-2xl border transition-all",
      isConnected ? "border-coral-500/20 bg-coral-500/[0.03]" :
      hasError ? "border-red-400/20 bg-red-400/[0.03]" :
      "border-white/6 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
    )}>
      <button
        type="button"
        className="w-full p-4 text-left flex items-center gap-4"
        onClick={() => isConnected ? null : setOpen(!open)}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${def.color}15` }}>
          <ConnectorIcon iconSlug={def.icon} name={def.name} color={def.color} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-white/85">{friendlyName}</span>
            {isConnected && (
              <span className="flex items-center gap-1 text-[10px] text-coral-400 bg-coral-400/10 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle2 size={10} /> Connected
              </span>
            )}
            {hasError && (
              <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full font-medium">
                <AlertCircle size={10} /> Error
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/35 mt-0.5 leading-relaxed">{friendlyDesc}</p>
        </div>
        <div className="shrink-0">
          {isConnected ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); onDisconnect(def.id); toast.success("Disconnected"); }}
              className="text-[11px] text-white/25 hover:text-red-400/70 transition-colors px-2 py-1">
              Disconnect
            </button>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/25">
              {open ? <X size={14} /> : <ArrowRight size={14} />}
            </div>
          )}
        </div>
      </button>

      <AnimatePresence>
        {open && !isConnected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3">
              {/* Zero-config services */}
              {def.oauthProvider ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 p-4 space-y-2 text-center">
                    <CheckCircle2 size={24} className="text-blue-400 mx-auto" />
                    <p className="text-[14px] font-semibold text-white/90">Connect using {def.oauthProvider}</p>
                    <p className="text-[12px] text-white/50 pb-2">Authenticate securely with your provider. No more copying api tokens.</p>
                    <Button
                      className="w-full rounded-xl text-sm font-semibold tracking-wide bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all"
                      onClick={() => {
                        window.open(`/api/oauth/start?provider=${def.oauthProvider}&connectorId=${def.id}`, "_blank", "width=600,height=800");
                      }}
                    >
                      Authenticate via OAuth
                    </Button>
                  </div>
                </div>
              ) : def.configFields.length === 0 ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-coral-500/5 border border-coral-500/15">
                  <CheckCircle2 size={16} className="text-coral-400 shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-coral-400/90">Ready to go — no setup needed!</p>
                    <p className="text-[11px] text-white/35 mt-0.5">Just click Connect and start using it immediately.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Setup guide steps */}
                  {SETUP_GUIDES[def.id] && (
                    <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 p-3 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-blue-400/80 font-bold mb-2">
                        How to get your credentials
                      </p>
                      {SETUP_GUIDES[def.id].map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400/80 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-[11px] text-white/50 leading-relaxed">{step}</p>
                        </div>
                      ))}
                      {def.docs && (
                        <a href={def.docs} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors">
                          <Globe size={10} /> Open setup page <ArrowRight size={8} />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Credential fields */}
                  <div className="space-y-2.5">
                    {def.configFields.map(field => (
                      <div key={field.key}>
                        <label className="text-[11px] text-white/50 font-medium mb-1 block">
                          {FIELD_LABELS[field.key] ?? field.label}
                          {field.required && <span className="text-red-400 ml-0.5">*</span>}
                        </label>
                        <Input
                          type={field.type === "password" ? "password" : "text"}
                          placeholder={field.placeholder}
                          value={values[field.key] ?? ""}
                          onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                          className="h-9 text-sm bg-white/5 border-white/8 rounded-xl"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!def.oauthProvider && (
                <Button
                  className="w-full rounded-xl h-10 text-sm font-semibold gap-2"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                  Connect to {friendlyName}
                </Button>
              )}

              {hasError && existing?.error && (
                <p className="text-[11px] text-red-400/70 bg-red-400/5 rounded-xl px-3 py-2">
                  {existing.error}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main View ────────────────────────────────────────────────────────────────

export function ConnectView() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const {
    mcpConnections, addMCPConnection, removeMCPConnection,
    emailConfig, updateEmailConfig,
  } = useIntegrationsStore();

  const connectedCount = mcpConnections.filter(c => c.status === "connected").length;

  const handleConnect = async (def: MCPServerDef, config: Record<string, string>) => {
    if (def.transport === "sse") {
      const urlField = def.configFields.find(f => f.type === "url");
      const serverUrl = urlField ? config[urlField.key] : "";
      if (!serverUrl) throw new Error("Service address is required");

      const res = await fetch("/api/mcp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: serverUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addMCPConnection({
        serverId: def.id,
        name: FRIENDLY_LABELS[def.id] ?? def.name,
        config,
        status: "connected",
        toolCount: data.toolCount,
        lastConnected: new Date().toISOString(),
      });
    } else {
      addMCPConnection({
        serverId: def.id,
        name: FRIENDLY_LABELS[def.id] ?? def.name,
        config,
        status: "connected",
        lastConnected: new Date().toISOString(),
      });
    }
  };

  const handleDisconnect = (serverId: string) => {
    removeMCPConnection(serverId);
  };

  const filtered = MCP_SERVERS.filter(s => {
    if (activeCategory !== "all" && s.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      const friendly = (FRIENDLY_LABELS[s.id] ?? s.name).toLowerCase();
      const desc = (FRIENDLY_DESCRIPTIONS[s.id] ?? s.description).toLowerCase();
      return friendly.includes(q) || desc.includes(q);
    }
    return true;
  });

  // Sort: connected first, then popular, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    const aConn = mcpConnections.some(c => c.serverId === a.id && c.status === "connected") ? -1 : 0;
    const bConn = mcpConnections.some(c => c.serverId === b.id && c.status === "connected") ? -1 : 0;
    if (aConn !== bConn) return aConn - bConn;
    if (a.popular && !b.popular) return -1;
    if (!a.popular && b.popular) return 1;
    return (FRIENDLY_LABELS[a.id] ?? a.name).localeCompare(FRIENDLY_LABELS[b.id] ?? b.name);
  });

  return (
    <motion.div
      className="absolute inset-0 flex flex-col w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="px-8 lg:px-12 pt-8 pb-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.04em] leading-[1.05]">
                Connect your<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400/50 to-white/10">
                  tools and data.
                </span>
              </h2>
              <p className="text-sm text-white/30 mt-3 max-w-md">
                Connect your cloud platforms, databases, and services.
                Everything you connect becomes available to the AI automatically.
              </p>
            </div>
            {connectedCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-coral-500/5 border border-coral-500/15">
                <Shield size={14} className="text-coral-400" />
                <div>
                  <p className="text-sm font-semibold text-coral-400">{connectedCount}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-wider">Connected</p>
                </div>
              </div>
            )}
          </div>

          {/* Search + filters */}
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <Input
                placeholder="Search services..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 text-sm bg-white/5 border-white/8 rounded-xl pl-9"
              />
            </div>
            <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl border border-white/7 p-0.5 flex-wrap">
              <button type="button" onClick={() => setActiveCategory("all")}
                className={cn("px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                  activeCategory === "all" ? "bg-white/8 text-white/80" : "text-white/35 hover:text-white/60")}>
                All
              </button>
              {MCP_CATEGORIES.map(cat => {
                const Icon = CATEGORY_ICONS[cat.id] ?? Plug;
                return (
                  <button key={cat.id} type="button" onClick={() => setActiveCategory(cat.id)}
                    className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                      activeCategory === cat.id ? "bg-white/8 text-white/80" : "text-white/35 hover:text-white/60")}>
                    <Icon size={10} /> {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Service cards */}
      <div className="flex-1 overflow-y-auto px-8 lg:px-12 pb-8">
        <div className="max-w-4xl mx-auto space-y-2">
          {sorted.map(def => (
            <ServiceCard
              key={def.id}
              def={def}
              existing={mcpConnections.find(c => c.serverId === def.id)}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
          ))}

          {sorted.length === 0 && (
            <div className="py-16 text-center text-white/25">
              <Search size={24} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No services match your search.</p>
            </div>
          )}

          {/* More services note */}
          <GlassCard className="bg-white/[0.01] mt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#9370ff]/10 flex items-center justify-center shrink-0">
                <Globe size={18} className="text-[#9370ff]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white/80">Need a service that&apos;s not listed?</h4>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">
                  Use <strong className="text-white/60">&ldquo;Other Service&rdquo;</strong> to connect any compatible service.
                  You can also import data directly from the sidebar using <strong className="text-white/60">Import Asset</strong>.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
}
