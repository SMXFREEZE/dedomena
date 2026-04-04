import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query, sourcesData } = await req.json();

    const provider = process.env.AI_PROVIDER || "anthropic";
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const model = process.env.AI_MODEL || "claude-3-5-sonnet-20240620";

    if (provider === "anthropic" && !anthropicKey) {
      return NextResponse.json({ error: "Anthropic API Key not configured on the backend." }, { status: 500 });
    }
    if (provider === "openai" && !openaiKey) {
      return NextResponse.json({ error: "OpenAI API Key not configured on the backend." }, { status: 500 });
    }

    const MAX = 60000;
    let ctx = "";
    for (const src of sourcesData) {
      if (!src.content) continue;
      const chunk = `\n\n=== SOURCE: ${src.name} (${src.type}) ===\n${src.content}`;
      if (ctx.length + chunk.length > MAX) { 
        ctx += chunk.slice(0, MAX - ctx.length - 50) + "\n[truncated]"; 
        break; 
      }
      ctx += chunk;
    }

    if (!ctx.trim()) {
      return NextResponse.json({ error: "No source content provided to backend." }, { status: 400 });
    }

    const sys = `You are an elite enterprise document intelligence engine. Output ONLY valid JSON:
{"summary":"A highly precise, structured analytical summary. Maximum precision, no fluff.","found":true,"hits":[{"sourceName":"exact name","excerpt":"relevant quote \u2264400 chars","relevance":"brief explanation"}]}
If nothing found: {"summary":"No relevant context identified in connected assets.","found":false,"hits":[]}`;

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
          max_tokens: 2048, 
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
          max_tokens: 2048, 
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
