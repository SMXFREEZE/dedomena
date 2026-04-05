import { NextRequest, NextResponse } from "next/server";
import { retrieveChunks, buildRagContext } from "@/lib/rag";

export const maxDuration = 120;

// ── Auto model selection ──────────────────────────────────────────────────────

function autoSelectModel(query: string, sources: any[], mode: string): string {
  const totalChars = sources.reduce((n, s) => n + (s.content?.length ?? 0), 0);
  const q = query.toLowerCase();

  const isHeavy =
    mode === "structured" ||
    sources.length > 8 ||
    totalChars > 300_000 ||
    /\b(comprehensive|detailed|audit|compare|correlation|forecast|trend|report|analysis|compliance|risk|due diligence|quarterly|annual|all sources|everything)\b/.test(q);

  const isLight =
    mode === "chat" &&
    query.length < 60 &&
    sources.length <= 3 &&
    totalChars < 50_000 &&
    !isHeavy;

  if (isLight) return "claude-haiku-4-5-20251001";
  return "claude-sonnet-4-6";
}

// ── Multimodal block builder ──────────────────────────────────────────────────

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  return match ? { mediaType: match[1], base64: match[2] } : null;
}

function buildMultimodalBlocks(sources: any[]): any[] {
  const blocks: any[] = [];
  for (const src of sources) {
    if (!src.content) continue;
    const parsed = parseDataUrl(src.content);
    if (!parsed) continue;

    if (src.contentType === "image") {
      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowed.includes(parsed.mediaType)) continue;
      blocks.push({ type: "text", text: `\n=== IMAGE: ${src.name} ===` });
      blocks.push({ type: "image", source: { type: "base64", media_type: parsed.mediaType, data: parsed.base64 } });
    } else if (src.contentType === "pdf") {
      blocks.push({ type: "text", text: `\n=== PDF: ${src.name} ===` });
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: parsed.base64 } });
    }
  }
  return blocks;
}

// ── System prompts ────────────────────────────────────────────────────────────

const chatSys = (extra: string) =>
  `${extra}You are an enterprise data intelligence assistant. Answer based ONLY on the provided source excerpts — these are the most relevant passages retrieved from the user's full dataset. Be precise, thorough, and cite specific sources. If the data is insufficient, say so — never guess.`;

const structuredSys = (extra: string) =>
  `${extra}CRITICAL RULES:
1. Answer ONLY from the SOURCE EXCERPTS provided. Never use prior knowledge.
2. These excerpts were retrieved by relevance — treat them as the authoritative data.
3. If the answer cannot be found, set found=false.
4. Always cite the exact source name and a direct excerpt for every claim.

Return ONLY valid JSON:
{"summary":"thorough answer grounded only in the excerpts","found":true,"hits":[{"sourceName":"exact name","excerpt":"≤400 char quote","relevance":"why this answers the query"}]}
If not found: {"summary":"The imported data does not contain relevant information for this query.","found":false,"hits":[]}`;

// ── Anthropic SSE → plain text stream ────────────────────────────────────────

function streamAnthropicToText(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    const reader = body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              await writer.write(enc.encode(evt.delta.text));
            }
          } catch { /* ignore */ }
        }
      }
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return readable;
}

function streamOpenAIToText(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    const reader = body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const delta = JSON.parse(raw).choices?.[0]?.delta?.content;
            if (delta) await writer.write(enc.encode(delta));
          } catch { /* ignore */ }
        }
      }
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return readable;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { query, sourcesData, systemPrompt, mode, selectedSourceIds } = await req.json();

    const provider    = process.env.AI_PROVIDER ?? "anthropic";
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey   = process.env.OPENAI_API_KEY;

    if (provider === "anthropic" && !anthropicKey)
      return NextResponse.json({ error: "Anthropic API key not configured." }, { status: 500 });
    if (provider === "openai" && !openaiKey)
      return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });

    // Filter sources
    const filtered: any[] = Array.isArray(selectedSourceIds) && selectedSourceIds.length
      ? sourcesData.filter((s: any) => selectedSourceIds.includes(s.id))
      : sourcesData;

    const hasContent = filtered.some((s: any) => s.content?.length > 0);
    if (!hasContent)
      return NextResponse.json({ error: "No source content available. Import data before querying." }, { status: 400 });

    const model  = autoSelectModel(query, filtered, mode);
    const isChat = mode === "chat";
    const extra  = systemPrompt?.trim() ? `${systemPrompt.trim()}\n\n` : "";
    const sys    = isChat ? chatSys(extra) : structuredSys(extra);

    // ── RAG retrieval — handles unlimited data ────────────────────────────────
    const ragResult      = retrieveChunks(query, filtered, 800_000);
    const ragContextText = buildRagContext(ragResult);

    // Multimodal sources (images, PDFs) — handled separately
    const multimodalSources = filtered.filter(
      (s: any) => s.contentType === "image" || s.contentType === "pdf"
    );
    const multiBlocks = buildMultimodalBlocks(multimodalSources);
    const hasMultimodal = multiBlocks.length > 0;

    // Metadata for the prompt
    const sourceSummary = [
      `Total sources: ${filtered.length}`,
      `Total chunks indexed: ${ragResult.totalChunks}`,
      `Chunks retrieved for this query: ${ragResult.chunks.length}`,
      `Context used: ${Math.round(ragResult.usedChars / 1000)}k chars`,
      ragResult.droppedSources.length
        ? `Low-relevance sources excluded: ${ragResult.droppedSources.join(", ")}`
        : null,
    ].filter(Boolean).join(" | ");

    // Build user content
    const userContent: any[] = [];

    if (ragContextText.trim()) {
      userContent.push({
        type: "text",
        text: `[${sourceSummary}]\n\nSOURCE EXCERPTS (retrieved by relevance):\n${ragContextText}`,
      });
    }

    userContent.push(...multiBlocks);
    userContent.push({ type: "text", text: `\n---\nQUERY: ${query}` });

    // ── ANTHROPIC ─────────────────────────────────────────────────────────────
    if (provider === "anthropic") {
      const headers: Record<string, string> = {
        "Content-Type":    "application/json",
        "x-api-key":       anthropicKey!,
        "anthropic-version": "2023-06-01",
      };
      if (hasMultimodal) {
        headers["anthropic-beta"] = "pdfs-2024-09-25,files-api-2025-04-14";
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          max_tokens: isChat ? 16000 : 8192,
          system: sys,
          messages: [{ role: "user", content: userContent }],
          stream: isChat,
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error?.message ?? `API error ${res.status}`);
      }

      if (isChat) {
        return new Response(streamAnthropicToText(res.body!), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
        });
      }

      const d = await res.json();
      const text = d.content?.[0]?.text?.trim() ?? "";
      try {
        return NextResponse.json({ result: JSON.parse(text) });
      } catch {
        return NextResponse.json({ result: { summary: text, found: true, hits: [] } });
      }
    }

    // ── OPENAI ────────────────────────────────────────────────────────────────
    const openAiContent: any[] = [];
    if (ragContextText.trim()) {
      openAiContent.push({ type: "text", text: `[${sourceSummary}]\n\nSOURCE EXCERPTS:\n${ragContextText}` });
    }
    for (const src of multimodalSources) {
      if (src.contentType === "image") {
        openAiContent.push({ type: "text", text: `Image: ${src.name}` });
        openAiContent.push({ type: "image_url", image_url: { url: src.content } });
      }
    }
    openAiContent.push({ type: "text", text: `QUERY: ${query}` });

    const openRes = await fetch("https://api.openai.com/v1/chat/completions", {
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

    if (!openRes.ok) {
      const e = await openRes.json().catch(() => ({}));
      throw new Error(e.error?.message ?? `API error ${openRes.status}`);
    }

    if (isChat) {
      return new Response(streamOpenAIToText(openRes.body!), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }

    const d = await openRes.json();
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
