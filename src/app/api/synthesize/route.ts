import { NextRequest, NextResponse } from "next/server";

// Parses a data URL into its parts
function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { mediaType: match[1], base64: match[2] };
}

// Build the Claude user message content — may be mixed (text + images + PDFs)
function buildUserContent(query: string, sourcesData: any[]): any {
  const contentBlocks: any[] = [];
  const textParts: string[] = [];

  for (const src of sourcesData) {
    if (!src.content) continue;
    const ct = src.contentType ?? 'text';

    if (ct === 'image') {
      const parsed = parseDataUrl(src.content);
      if (!parsed) continue;
      const supportedImages = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!supportedImages.includes(parsed.mediaType)) continue;
      textParts.push(`\n=== IMAGE SOURCE: ${src.name} ===`);
      contentBlocks.push({
        type: 'text',
        text: `\n=== IMAGE SOURCE: ${src.name} (${src.type}) ===`,
      });
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: parsed.mediaType, data: parsed.base64 },
      });
    } else if (ct === 'pdf') {
      const parsed = parseDataUrl(src.content);
      if (!parsed) continue;
      contentBlocks.push({
        type: 'text',
        text: `\n=== PDF SOURCE: ${src.name} (${src.type}) ===`,
      });
      contentBlocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: parsed.base64 },
      });
    } else {
      // Plain text — append to the text context block
      const chunk = `\n\n=== SOURCE: ${src.name} (${src.type}) ===\n${src.content}`;
      textParts.push(chunk);
    }
  }

  // Build final content array
  const MAX_TEXT = 600000;
  let combinedText = textParts.join('');
  if (combinedText.length > MAX_TEXT) {
    combinedText = combinedText.slice(0, MAX_TEXT) + '\n[text truncated — too large]';
  }

  const result: any[] = [];

  // Text block first (context + sources)
  if (combinedText.trim()) {
    result.push({ type: 'text', text: `ASSETS:${combinedText}` });
  }

  // Then image/PDF blocks
  result.push(...contentBlocks);

  // Query always last
  result.push({ type: 'text', text: `\n---\nQUERY: ${query}` });

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { query, sourcesData, systemPrompt, mode } = await req.json();
    // mode: "structured" (default) = JSON output with hits
    //       "chat" = free-form conversational answer

    const provider = process.env.AI_PROVIDER || "anthropic";
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const model = process.env.AI_MODEL || "claude-sonnet-4-6";

    if (provider === "anthropic" && !anthropicKey) {
      return NextResponse.json({ error: "Anthropic API Key not configured." }, { status: 500 });
    }
    if (provider === "openai" && !openaiKey) {
      return NextResponse.json({ error: "OpenAI API Key not configured." }, { status: 500 });
    }

    // Check there's at least some content
    const hasContent = sourcesData.some((s: any) => s.content?.length > 0);
    if (!hasContent) {
      return NextResponse.json({ error: "No source content provided. Import at least one data asset before querying." }, { status: 400 });
    }

    const userInstructions = systemPrompt?.trim() ? `${systemPrompt.trim()}\n\n` : "";

    const isChat = mode === "chat";

    const sys = isChat
      ? `${userInstructions}You are a data analyst assistant. Answer the user's question based ONLY on the provided data sources (text, images, PDFs, spreadsheets). Be thorough, precise, and cite the specific source when making claims. If the data does not contain enough information to answer, say so clearly — do not guess or use prior knowledge.`
      : `${userInstructions}CRITICAL RULES — follow without exception:
1. Answer ONLY from the ASSETS provided. Never use prior knowledge or make assumptions.
2. If the answer cannot be found, set found=false.
3. Never guess or extrapolate beyond what is explicitly in the data.
4. Always cite the exact source name and a direct excerpt for every claim.

Return ONLY valid JSON (no markdown, no code fences):
{"summary":"precise answer grounded only in the provided data","found":true,"hits":[{"sourceName":"exact source name","excerpt":"relevant quote ≤400 chars","relevance":"why this answers the query"}]}
If not found: {"summary":"The imported data does not contain relevant information for this query.","found":false,"hits":[]}`;

    const userContent = buildUserContent(query, sourcesData);
    const hasMultimodal = userContent.some((b: any) => b.type === 'image' || b.type === 'document');

    if (provider === "anthropic") {
      const body: any = {
        model,
        max_tokens: isChat ? 8192 : 4096,
        system: sys,
        messages: [{ role: "user", content: userContent }],
      };

      // Enable PDF beta if we have PDF documents
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey!,
        "anthropic-version": "2023-06-01",
      };
      if (hasMultimodal) {
        headers["anthropic-beta"] = "pdfs-2024-09-25,files-api-2025-04-14";
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error?.message || `Anthropic ${res.status}`);
      }
      const d = await res.json();
      const text = d.content?.[0]?.text?.trim() || "";

      if (isChat) {
        return NextResponse.json({ result: { summary: text, found: true, hits: [], mode: "chat" } });
      }
      try {
        return NextResponse.json({ result: JSON.parse(text) });
      } catch {
        // If JSON parse fails, return as chat response
        return NextResponse.json({ result: { summary: text, found: true, hits: [], mode: "chat" } });
      }

    } else {
      // OpenAI — images supported, PDFs sent as text description
      const openAiContent: any[] = [];

      for (const src of sourcesData) {
        if (!src.content) continue;
        const ct = src.contentType ?? 'text';
        if (ct === 'image') {
          const parsed = parseDataUrl(src.content);
          if (parsed) {
            openAiContent.push({ type: 'text', text: `Image source: ${src.name}` });
            openAiContent.push({ type: 'image_url', image_url: { url: src.content } });
          }
        } else {
          openAiContent.push({ type: 'text', text: `=== ${src.name} ===\n${src.content?.slice(0, 100000)}` });
        }
      }
      openAiContent.push({ type: 'text', text: `QUERY: ${query}` });

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: sys }, { role: "user", content: openAiContent }],
          max_tokens: isChat ? 8192 : 4096,
          ...(!isChat ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error?.message || `OpenAI ${res.status}`);
      }
      const d = await res.json();
      const text = d.choices?.[0]?.message?.content?.trim() || "";
      if (isChat) {
        return NextResponse.json({ result: { summary: text, found: true, hits: [], mode: "chat" } });
      }
      try {
        return NextResponse.json({ result: JSON.parse(text) });
      } catch {
        return NextResponse.json({ result: { summary: text, found: true, hits: [], mode: "chat" } });
      }
    }

  } catch (error: any) {
    console.error("Synthesize API Error:", error);
    return NextResponse.json({ error: error.message || "Synthesis failed" }, { status: 500 });
  }
}
