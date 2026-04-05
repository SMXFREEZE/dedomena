/**
 * RAG (Retrieval-Augmented Generation) engine.
 *
 * Enables unlimited dataset support: instead of dumping everything into the
 * AI context window, we chunk every source, score every chunk against the
 * query, and send only the most relevant pieces.
 *
 * A 10 GB database → chunked → scored → top ~800 k chars sent to AI.
 * The AI never sees irrelevant data and never crashes on large inputs.
 */

export interface RagChunk {
  sourceId:   string;
  sourceName: string;
  sourceType: string;
  text:       string;
  score:      number;
}

export interface RagResult {
  chunks:         RagChunk[];
  totalChunks:    number;           // across all sources before selection
  usedChars:      number;
  droppedSources: string[];         // sources whose chunks were entirely cut
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might",
  "it","its","this","that","these","those","i","you","he","she","we","they",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

// ── Chunking ──────────────────────────────────────────────────────────────────

const CHUNK_SIZE    = 600;   // chars per chunk
const CHUNK_OVERLAP = 120;   // overlap between consecutive chunks

export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    // Try to break at a word boundary
    let end = Math.min(start + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);
      if (boundary > start + CHUNK_SIZE / 2) end = boundary;
    }
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(c => c.length > 20);
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * BM25-inspired chunk scorer.
 * Rewards term overlap, penalises very long chunks (length normalisation).
 */
function scoreChunk(queryTokens: string[], chunk: string): number {
  const chunkTokens = tokenize(chunk);
  if (!chunkTokens.length) return 0;

  const termFreq = new Map<string, number>();
  for (const t of chunkTokens) termFreq.set(t, (termFreq.get(t) ?? 0) + 1);

  const k1 = 1.5;
  const b  = 0.75;
  const avgLen = CHUNK_SIZE / 5; // approximate average token count

  let score = 0;
  for (const term of new Set(queryTokens)) {
    const tf = termFreq.get(term) ?? 0;
    if (tf === 0) continue;
    const normTf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (chunkTokens.length / avgLen)));
    score += normTf; // IDF omitted (single-corpus), weights are term overlap
  }

  // Exact phrase bonus (substring of query found verbatim)
  const queryPhrase = queryTokens.slice(0, 4).join(" ");
  if (queryPhrase.length > 6 && chunk.toLowerCase().includes(queryPhrase)) {
    score += 3;
  }

  return score;
}

// ── Main retrieval function ───────────────────────────────────────────────────

/**
 * Retrieve the most relevant chunks from any number of sources.
 * Handles datasets of any size — only the top `maxChars` worth of content
 * is returned, scored by BM25 relevance to the query.
 */
export function retrieveChunks(
  query:    string,
  sources:  Array<{
    id:          string;
    name:        string;
    type:        string;
    content:     string;
    contentType?: string;
  }>,
  maxChars = 800_000
): RagResult {
  const queryTokens = tokenize(query);
  const allChunks: RagChunk[] = [];

  for (const src of sources) {
    if (!src.content) continue;
    // Images and PDFs are handled separately (multimodal blocks) — skip here
    if (src.contentType === "image" || src.contentType === "pdf") continue;

    const texts = chunkText(src.content);
    for (const text of texts) {
      allChunks.push({
        sourceId:   src.id,
        sourceName: src.name,
        sourceType: src.type,
        text,
        score: queryTokens.length > 0 ? scoreChunk(queryTokens, text) : 0,
      });
    }
  }

  const totalChunks = allChunks.length;

  // Sort descending by relevance
  allChunks.sort((a, b) => b.score - a.score);

  // Greedy selection within char budget
  const selected: RagChunk[]   = [];
  const usedSourceIds           = new Set<string>();
  let usedChars                 = 0;

  for (const chunk of allChunks) {
    if (usedChars + chunk.text.length > maxChars) continue;
    selected.push(chunk);
    usedSourceIds.add(chunk.sourceId);
    usedChars += chunk.text.length;
  }

  // Sources whose content was entirely excluded from selected
  const allSourceIds  = new Set(sources.map(s => s.id));
  const droppedIds    = [...allSourceIds].filter(id => !usedSourceIds.has(id));
  const droppedSources = sources
    .filter(s => droppedIds.includes(s.id))
    .map(s => s.name);

  return { chunks: selected, totalChunks, usedChars, droppedSources };
}

// ── Build context string from chunks ─────────────────────────────────────────

/**
 * Groups selected chunks by source and formats them as a readable context
 * string for the AI prompt. Each source gets a header; chunks appear in order.
 */
export function buildRagContext(result: RagResult): string {
  // Group by source, preserving relevance-ranked order within each source
  const bySource = new Map<string, { name: string; type: string; chunks: string[] }>();

  for (const chunk of result.chunks) {
    if (!bySource.has(chunk.sourceId)) {
      bySource.set(chunk.sourceId, { name: chunk.sourceName, type: chunk.sourceType, chunks: [] });
    }
    bySource.get(chunk.sourceId)!.chunks.push(chunk.text);
  }

  const parts: string[] = [];

  if (result.droppedSources.length > 0) {
    parts.push(
      `[NOTE: The following sources had low relevance to this query and were excluded to stay within analysis limits: ${result.droppedSources.join(", ")}]`
    );
  }

  for (const { name, type, chunks } of bySource.values()) {
    parts.push(`\n=== SOURCE: ${name} (${type}) ===`);
    parts.push(chunks.join("\n…\n"));
  }

  return parts.join("\n");
}
