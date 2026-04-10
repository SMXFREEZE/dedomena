import { NextRequest, NextResponse } from "next/server";
import { MCPClient } from "@/lib/mcp/client";

export const maxDuration = 30;

/**
 * Connect to an MCP server and list its tools.
 *
 * POST /api/mcp/connect
 * Body: { "url": "http://...", "headers": {} }
 */
export async function POST(req: NextRequest) {
  try {
    const { url, headers } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "Server URL is required" }, { status: 400 });
    }

    const client = new MCPClient({
      id: "probe",
      name: "Probe",
      transport: "sse",
      url,
      headers,
    });

    const serverInfo = await client.initialize();
    const tools = await client.listTools();

    let resources: any[] = [];
    try {
      resources = await client.listResources();
    } catch { /* resources not supported */ }

    client.disconnect();

    return NextResponse.json({
      serverInfo,
      tools: tools.map(t => ({ name: t.name, description: t.description })),
      resources: resources.map(r => ({ uri: r.uri, name: r.name, description: r.description })),
      toolCount: tools.length,
      resourceCount: resources.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Connection failed" }, { status: 500 });
  }
}
