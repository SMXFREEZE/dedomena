import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only HTTP/HTTPS URLs are supported" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Dedomena/1.0; +https://dedomena.app)",
        Accept: "text/html, application/json, text/plain, */*",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}: ${res.statusText}` }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "";
    const raw = await res.text();

    // For HTML, extract readable text
    let content: string;
    if (contentType.includes("text/html")) {
      content = extractTextFromHTML(raw);
    } else {
      content = raw;
    }

    // Limit to 5MB
    content = content.slice(0, 5_000_000);

    return NextResponse.json({
      content,
      title: extractTitle(raw, contentType),
      charCount: content.length,
      contentType: contentType.split(";")[0].trim(),
    });
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return NextResponse.json({ error: "Request timed out after 15 seconds" }, { status: 504 });
    }
    return NextResponse.json({ error: error.message ?? "Fetch failed" }, { status: 500 });
  }
}

function extractTitle(html: string, ct: string): string {
  if (!ct.includes("text/html")) return "";
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim().replace(/\s+/g, " ") : "";
}

function extractTextFromHTML(html: string): string {
  // Remove script, style, nav, footer, header tags and their content
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Convert common block elements to newlines
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|h[1-6]|li|tr|blockquote|section|article|main|aside)[^>]*>/gi, "\n")
    .replace(/<\/?(ul|ol|table|thead|tbody)[^>]*>/gi, "\n")
    .replace(/<td[^>]*>/gi, "\t")
    .replace(/<th[^>]*>/gi, "\t");

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

  // Clean up whitespace
  text = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join("\n");

  return text;
}
