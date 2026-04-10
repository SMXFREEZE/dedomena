import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MCPConnection {
  serverId: string;
  name: string;
  config: Record<string, string>;
  status: "connected" | "disconnected" | "error";
  toolCount?: number;
  lastConnected?: string;
  error?: string;
}

export interface EmailConfig {
  enabled: boolean;
  provider: "resend" | "sendgrid" | "smtp";
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromAddress: string;
  fromName: string;
}

export interface WebhookConfig {
  enabled: boolean;
  secret: string;
  allowedOrigins: string[];
  rateLimit: number;
}

interface IntegrationsState {
  mcpConnections: MCPConnection[];
  emailConfig: EmailConfig;
  webhookConfig: WebhookConfig;

  addMCPConnection: (conn: MCPConnection) => void;
  updateMCPConnection: (serverId: string, patch: Partial<MCPConnection>) => void;
  removeMCPConnection: (serverId: string) => void;
  updateEmailConfig: (config: Partial<EmailConfig>) => void;
  updateWebhookConfig: (config: Partial<WebhookConfig>) => void;
}

function generateSecret(): string {
  const arr = new Uint8Array(32);
  if (typeof crypto !== "undefined") crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
}

export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set) => ({
      mcpConnections: [],

      emailConfig: {
        enabled: false,
        provider: "resend",
        fromAddress: "",
        fromName: "Dedomena",
      },

      webhookConfig: {
        enabled: false,
        secret: generateSecret(),
        allowedOrigins: ["*"],
        rateLimit: 60,
      },

      addMCPConnection: (conn) => set((s) => ({
        mcpConnections: [...s.mcpConnections.filter(c => c.serverId !== conn.serverId), conn],
      })),

      updateMCPConnection: (serverId, patch) => set((s) => ({
        mcpConnections: s.mcpConnections.map(c =>
          c.serverId === serverId ? { ...c, ...patch } : c
        ),
      })),

      removeMCPConnection: (serverId) => set((s) => ({
        mcpConnections: s.mcpConnections.filter(c => c.serverId !== serverId),
      })),

      updateEmailConfig: (config) => set((s) => ({
        emailConfig: { ...s.emailConfig, ...config },
      })),

      updateWebhookConfig: (config) => set((s) => ({
        webhookConfig: { ...s.webhookConfig, ...config },
      })),
    }),
    {
      name: "dedomena_integrations_v1",
      partialize: (s) => ({
        mcpConnections: s.mcpConnections,
        emailConfig: s.emailConfig,
        webhookConfig: s.webhookConfig,
      }),
    }
  )
);
