/**
 * MCP (Model Context Protocol) Client — SSE transport for serverless environments.
 * Connects to any MCP-compliant server over HTTP/SSE.
 * Supports tool listing, tool execution, and resource reading.
 */

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, any>;
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPToolResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: "sse" | "stdio";
  url?: string;         // For SSE transport
  command?: string;      // For stdio transport
  args?: string[];       // For stdio transport
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, any>;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export class MCPClient {
  private config: MCPServerConfig;
  private messageEndpoint: string | null = null;
  private nextId = 1;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /**
   * Initialize SSE connection and discover the message endpoint.
   */
  async connect(): Promise<void> {
    if (this.config.transport !== "sse" || !this.config.url) {
      throw new Error("Only SSE transport is supported in serverless mode.");
    }

    // For SSE servers, the endpoint URL is typically the base URL + /message
    // Some servers advertise the endpoint via SSE, others use convention
    this.messageEndpoint = this.config.url.replace(/\/sse\/?$/, "") + "/message";
  }

  /**
   * Send a JSON-RPC request to the MCP server.
   */
  private async request(method: string, params?: Record<string, any>): Promise<any> {
    if (!this.messageEndpoint) {
      await this.connect();
    }

    const id = this.nextId++;
    const body: JSONRPCRequest = { jsonrpc: "2.0", id, method, params };

    const res = await fetch(this.messageEndpoint!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.headers ?? {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`MCP server error: HTTP ${res.status}`);
    }

    const data: JSONRPCResponse = await res.json();
    if (data.error) {
      throw new Error(`MCP error: ${data.error.message}`);
    }

    return data.result;
  }

  /**
   * Initialize the MCP session.
   */
  async initialize(): Promise<{ serverInfo: any; capabilities: any }> {
    await this.connect();
    const result = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "dedomena", version: "1.0.0" },
    });
    // Send initialized notification
    await this.request("notifications/initialized").catch(() => {});
    return result;
  }

  /**
   * List all tools the server provides.
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.request("tools/list");
    return result?.tools ?? [];
  }

  /**
   * Execute a tool on the server.
   */
  async callTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    return await this.request("tools/call", { name, arguments: args });
  }

  /**
   * List available resources.
   */
  async listResources(): Promise<MCPResource[]> {
    const result = await this.request("resources/list");
    return result?.resources ?? [];
  }

  /**
   * Read a specific resource.
   */
  async readResource(uri: string): Promise<any> {
    return await this.request("resources/read", { uri });
  }

  /**
   * List available prompts.
   */
  async listPrompts(): Promise<any[]> {
    const result = await this.request("prompts/list");
    return result?.prompts ?? [];
  }

  disconnect(): void {
    this.messageEndpoint = null;
  }
}

/**
 * Server-side MCP client that can run MCP servers as child processes (stdio transport).
 * Only available in Node.js runtime (API routes), not in browser.
 */
export async function createStdioMCPClient(config: MCPServerConfig) {
  if (config.transport !== "stdio" || !config.command) {
    throw new Error("stdio transport requires a command.");
  }

  const { spawn } = await import("child_process");

  const child = spawn(config.command, config.args ?? [], {
    env: { ...process.env, ...(config.env ?? {}) },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let nextId = 1;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  let buffer = "";

  child.stdout!.on("data", (data: Buffer) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id)!;
          pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      } catch { /* ignore parse errors */ }
    }
  });

  const request = (method: string, params?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
      child.stdin!.write(msg);
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`MCP timeout: ${method}`));
        }
      }, 30000);
    });
  };

  return {
    initialize: () => request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "dedomena", version: "1.0.0" },
    }),
    listTools: async () => (await request("tools/list"))?.tools ?? [],
    callTool: (name: string, args: any) => request("tools/call", { name, arguments: args }),
    listResources: async () => (await request("resources/list"))?.resources ?? [],
    readResource: (uri: string) => request("resources/read", { uri }),
    disconnect: () => { child.kill(); },
  };
}
