import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query, sourcesData, systemPrompt } = await req.json();

    const provider = process.env.AI_PROVIDER || "anthropic";
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const model = process.env.AI_MODEL || "claude-sonnet-4-6";

    if (provider === "anthropic" && !anthropicKey) {
      return NextResponse.json({ error: "Anthropic API Key not configured on the backend." }, { status: 500 });
    }
    if (provider === "openai" && !openaiKey) {
      return NextResponse.json({ error: "OpenAI API Key not configured on the backend." }, { status: 500 });
    }

    // ~150k tokens — well within Claude's 200k context window
    const MAX = 600000;
    let ctx = "";
    for (const src of sourcesData) {
      if (!src.content) continue;
      const chunk = `\n\n=== SOURCE: ${src.name} (${src.type}) ===\n${src.content}`;
      if (ctx.length + chunk.length > MAX) {
        ctx += chunk.slice(0, MAX - ctx.length - 50) + "\n[truncated — source too large]";
        break;
      }
      ctx += chunk;
    }

    if (!ctx.trim()) {
      return NextResponse.json({ error: "No source content provided. Import at least one data asset before querying." }, { status: 400 });
    }

    const userInstructions = systemPrompt?.trim() ? `${systemPrompt.trim()}\n\n` : "";

    const sys = `${userInstructions}CRITICAL RULES — follow without exception:
1. Answer ONLY from the ASSETS provided below. Never use prior knowledge, training data, or make assumptions.
2. If the answer cannot be found in the assets, set found=false and explain that the data does not contain the relevant information.
3. Never guess, infer, or extrapolate beyond what is explicitly stated in the provided data.
4. Always cite the exact source name and a direct excerpt for every claim.

Return ONLY valid JSON (no markdown, no code fences):
{"summary":"precise answer grounded only in the provided data","found":true,"hits":[{"sourceName":"exact source name","excerpt":"relevant quote ≤400 chars","relevance":"why this excerpt answers the query"}]}
If not found in the data: {"summary":"The imported data does not contain information relevant to this query. I cannot answer without the relevant data being present in the connected assets.","found":false,"hits":[]}`;

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey!,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: sys,
          messages: [{ role: "user", content: `ASSETS:\n${ctx}\n\n---\nQUERY: ${query}` }]
        })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error?.message || `Anthropic ${res.status}`);
      }
      const d = await res.json();
      return NextResponse.json({ result: JSON.parse(d.content?.[0]?.text?.trim() || "{}") });

    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: `ASSETS:\n${ctx}\n\n---\nQUERY: ${query}` }
          ],
          max_tokens: 4096,
          response_format: { type: "json_object" }
        })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error?.message || `OpenAI ${res.status}`);
      }
      const d = await res.json();
      return NextResponse.json({ result: JSON.parse(d.choices?.[0]?.message?.content?.trim() || "{}") });
    }
  } catch (error: any) {
    console.error("Synthesize API Error:", error);
    return NextResponse.json({ error: error.message || "Synthesis failed" }, { status: 500 });
  }
}
