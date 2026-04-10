import { NextRequest, NextResponse } from "next/server";
import { retrieveChunks, buildRagContext } from "@/lib/rag";

export const maxDuration = 120;

/**
 * Webhook API — External systems can query the AI over REST.
 *
 * POST /api/webhook/query
 * Headers: { "Authorization": "Bearer <webhook-secret>" }
 * Body: { "query": "...", "mode": "chat" | "structured", "sourceIds": [...] }
 *
 * Returns: { "result": "...", "sources": [...] }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (webhookSecret && !authHeader.endsWith(webhookSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query, mode = "structured", sourcesData } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    if (!Array.isArray(sourcesData) || sourcesData.length === 0) {
      return NextResponse.json({ error: "sourcesData array is required" }, { status: 400 });
    }

    // RAG retrieval
    const ragResult = retrieveChunks(query, sourcesData, 800_000);
    const ragContext = buildRagContext(ragResult);

    const isChat = mode === "chat";
    const systemPrompt = isChat
      ? "You are a data intelligence assistant. Answer based ONLY on the provided source excerpts. Be precise and cite sources."
      : `Answer ONLY from the SOURCE EXCERPTS. Return ONLY valid JSON:
{"summary":"answer","found":true,"hits":[{"sourceName":"name","excerpt":"quote","relevance":"why"}]}
If not found: {"summary":"No relevant data found.","found":false,"hits":[]}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `SOURCE EXCERPTS:\n${ragContext}\n\n---\nQUERY: ${query}`,
        }],
      }),
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message ?? `API error ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() ?? "";

    if (isChat) {
      return NextResponse.json({ result: text, chunksUsed: ragResult.chunks.length });
    }

    try {
      const parsed = JSON.parse(text);
      return NextResponse.json({ result: parsed, chunksUsed: ragResult.chunks.length });
    } catch {
      return NextResponse.json({ result: { summary: text, found: true, hits: [] }, chunksUsed: ragResult.chunks.length });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Webhook query failed" }, { status: 500 });
  }
}
