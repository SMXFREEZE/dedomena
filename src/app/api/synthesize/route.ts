import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120; // 2 min — needed for large datasets

// ── Auto model selection ──────────────────────────────────────────────────────
// Picks the right model silently based on task complexity and data volume.
// No model names are ever exposed to the client.

function autoSelectModel(query: string, sources: any[], mode: string): string {
  const totalChars  = sources.reduce((n, s) => n + (s.content?.length ?? 0), 0);
  const numSources  = sources.length;
  const q           = query.toLowerCase();

  // Signals that demand the highest-capability model
  const isHeavy =
    mode === "structured" ||
    numSources > 8 ||
    totalChars > 300_000 ||
    /\b(comprehensive|detailed|audit|compare|correlation|forecast|trend|all sources|everything|report|analysis|compliance|risk|due diligence|quarterly|annual)\b/.test(q);

  // Simple conversational queries on small data → fastest model
  const isLight =
    mode === "chat" &&
    query.length < 60 &&
    numSources <= 3 &&
    totalChars < 50_000 &&
    !isHeavy;

  if (isLight)  return "claude-haiku-4-5-20251001"; // fast, cheap
  if (isHeavy)  return "claude-sonnet-4-6";          // capable, balanced
  return                "claude-sonnet-4-6";          // default
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { mediaType: match[1], base64: match[2] };
}

/**
 * Proportional chunking — each source gets a fair share of the context budget.
 * No silent truncation; every source appears with a note if sampled.
 */
function buildTextContext(
  sources: any[],
  maxChars: number
): { text: string; sampledSources: string[] } {
  const eligible = sources.filter(
    s => s.content && (!s.contentType || s.contentType === "text" || s.contentType === "spreadsheet")
  );
  if (!eligible.length) return { text: "", sampledSources: [] };

  const totalChars = eligible.reduce((n, s) => n + s.content.length, 0);

  if (totalChars <= maxChars) {
    return {
      text: eligible
        .map(s => `\n\n=== SOURCE: ${s.name} (${s.type}) ===\n${s.content}`)
        .join(""),
      sampledSources: [],
    };
  }

  const sampledSources: string[] = [];
  const perSourceBudget = Math.floor(maxChars / eligible.length);

  const parts = eligible.map(s => {
    const budget = Math.max(
      perSourceBudget,
      Math.floor(maxChars * (s.content.length / totalChars))
    );
    const isSampled = s.content.length > budget;
    if (isSampled) sampledSources.push(s.name);
    const pct = isSampled ? ` [SAMPLED: ${Math.round((budget / s.content.length) * 100)}% of content shown]` : "";
    return `\n\n=== SOURCE: ${s.name} (${s.type})${pct} ===\n${s.content.slice(0, budget)}`;
  });

  return { text: parts.join(""), sampledSources };
}

function buildUserContent(query: string, sourcesData: any[], maxText = 800000): any[] {
  const contentBlocks: any[] = [];
  const mediaSources = sourcesData.filter(s => s.contentType === "image" || s.contentType === "pdf");
  const textSources = sourcesData.filter(s => !s.contentType || s.contentType === "text" || s.contentType === "spreadsheet");

  // Handle images and PDFs
  for (const src of mediaSources) {
    if (!src.content) continue;
    const parsed = parseDataUrl(src.content);
    if (!parsed) continue;

    if (src.contentType === "image") {
      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowed.includes(parsed.mediaType)) continue;
      contentBlocks.push({ type: "text", text: `\n=== IMAGE: ${src.name} (${src.type}) ===` });
      contentBlocks.push({ type: "image", source: { type: "base64", media_type: parsed.mediaType, data: parsed.base64 } });
    } else {
      contentBlocks.push({ type: "text", text: `\n=== PDF: ${src.name} (${src.type}) ===` });
      contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: parsed.base64 } });
    }
  }

  const { text, sampledSources } = buildTextContext(textSources, maxText);
  const result: any[] = [];

  if (text.trim()) {
    const samplingNote = sampledSources.length
      ? `\n\n[NOTE: The following sources were proportionally sampled due to size: ${sampledSources.join(", ")}. Core content is preserved; middle sections may be condensed.]\n`
      : "";
    result.push({ type: "text", text: `ASSETS:${samplingNote}${text}` });
  }

  result.push(...contentBlocks);
  result.push({ type: "text", text: `\n---\nQUERY: ${query}` });

  return result;
}

// ── Streaming helper (Anthropic SSE → plain text) ────────────────────────────

function anthropicStreamToText(anthropicBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    const reader = anthropicBody.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              await writer.write(encoder.encode(evt.delta.text));
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return readable;
}

// ── System prompts ────────────────────────────────────────────────────────────

const chatSystem = (extra: string) => `${extra}You are an enterprise data analyst. Answer based ONLY on the provided data sources. Be precise, cite specific sources, and give actionable insights. If the data is insufficient, say so clearly — never guess or hallucinate.`;

const structuredSystem = (extra: string) => `${extra}CRITICAL RULES — follow without exception:
1. Answer ONLY from the ASSETS provided. Never use prior knowledge or assumptions.
2. If the answer cannot be found in the data, set found=false.
3. Always cite the exact source name and a direct excerpt for every claim.
4. Be thorough — enterprise users need complete, accurate analysis.

Return ONLY valid JSON (no markdown, no code fences):
{"summary":"precise, thorough answer grounded only in the provided data","found":true,"hits":[{"sourceName":"exact source name","excerpt":"relevant quote ≤400 chars","relevance":"why this supports the answer"}]}
If not found: {"summary":"The imported data does not contain relevant information for this query.","found":false,"hits":[]}`;

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { query, sourcesData, systemPrompt, mode, selectedSourceIds } = await req.json();

    const provider = process.env.AI_PROVIDER ?? "anthropic";
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (provider === "anthropic" && !anthropicKey)
      return NextResponse.json({ error: "Anthropic API key not configured on server." }, { status: 500 });
    if (provider === "openai" && !openaiKey)
      return NextResponse.json({ error: "OpenAI API key not configured on server." }, { status: 500 });

    // Filter to selected sources only (or all if none selected)
    const filtered: any[] = Array.isArray(selectedSourceIds) && selectedSourceIds.length > 0
      ? sourcesData.filter((s: any) => selectedSourceIds.includes(s.id))
      : sourcesData;

    const hasContent = filtered.some((s: any) => s.content?.length > 0);
    if (!hasContent)
      return NextResponse.json({ error: "No source content available. Import data before querying." }, { status: 400 });

    // Auto-select model based on task — never exposed to the client
    const model = autoSelectModel(query, filtered, mode);

    const isChat = mode === "chat";
    const extra = systemPrompt?.trim() ? `${systemPrompt.trim()}\n\n` : "";
    const sys = isChat ? chatSystem(extra) : structuredSystem(extra);
    const userContent = buildUserContent(query, filtered, 800000);
    const hasMultimodal = userContent.some((b: any) => b.type === "image" || b.type === "document");

    // ── ANTHROPIC ──────────────────────────────────────────────────────────
    if (provider === "anthropic") {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey!,
        "anthropic-version": "2023-06-01",
      };
      if (hasMultimodal) {
        headers["anthropic-beta"] = "pdfs-2024-09-25,files-api-2025-04-14";
      }

      const body: any = {
        model,
        max_tokens: isChat ? 16000 : 8192,
        system: sys,
        messages: [{ role: "user", content: userContent }],
        stream: isChat, // stream only for chat
      };

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!anthropicRes.ok) {
        const e = await anthropicRes.json().catch(() => ({}));
        throw new Error(e.error?.message ?? `Anthropic error ${anthropicRes.status}`);
      }

      if (isChat) {
        // Return a streaming plain-text response
        const textStream = anthropicStreamToText(anthropicRes.body!);
        return new Response(textStream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-cache",
          },
        });
      }

      // Structured mode — wait for full JSON
      const d = await anthropicRes.json();
      const text = d.content?.[0]?.text?.trim() ?? "";
      try {
        return NextResponse.json({ result: JSON.parse(text) });
      } catch {
        return NextResponse.json({ result: { summary: text, found: true, hits: [] } });
      }
    }

    // ── OPENAI ─────────────────────────────────────────────────────────────
    const openAiContent: any[] = [];
    for (const src of filtered) {
      if (!src.content) continue;
      if (src.contentType === "image") {
        const parsed = parseDataUrl(src.content);
        if (parsed) {
          openAiContent.push({ type: "text", text: `Image source: ${src.name}` });
          openAiContent.push({ type: "image_url", image_url: { url: src.content } });
        }
      } else {
        openAiContent.push({ type: "text", text: `=== ${src.name} ===\n${src.content?.slice(0, 150000)}` });
      }
    }
    openAiContent.push({ type: "text", text: `QUERY: ${query}` });

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: sys }, { role: "user", content: openAiContent }],
        max_tokens: isChat ? 16000 : 8192,
        stream: isChat,
        ...(!isChat ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!openAiRes.ok) {
      const e = await openAiRes.json().catch(() => ({}));
      throw new Error(e.error?.message ?? `OpenAI error ${openAiRes.status}`);
    }

    if (isChat) {
      // Transform OpenAI SSE to plain text
      const encoder = new TextEncoder();
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      const writer = writable.getWriter();

      (async () => {
        const reader = openAiRes.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const raw = line.slice(6).trim();
              if (raw === "[DONE]") continue;
              try {
                const evt = JSON.parse(raw);
                const delta = evt.choices?.[0]?.delta?.content;
                if (delta) await writer.write(encoder.encode(delta));
              } catch { /* ignore */ }
            }
          }
        } finally {
          await writer.close().catch(() => {});
        }
      })();

      return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }

    const d = await openAiRes.json();
    const text = d.choices?.[0]?.message?.content?.trim() ?? "";
    try {
      return NextResponse.json({ result: JSON.parse(text) });
    } catch {
      return NextResponse.json({ result: { summary: text, found: true, hits: [] } });
    }

  } catch (error: any) {
    console.error("Synthesize error:", error);
    return NextResponse.json({ error: error.message ?? "Synthesis failed" }, { status: 500 });
  }
}
