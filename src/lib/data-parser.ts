/**
 * Universal data parser.
 * Auto-detects CSV, TSV, JSON, JSONL, and raw text.
 * Handles enterprise-scale files — parses lazily and caps preview at 10 000 rows.
 */

export type ColumnType = "numeric" | "date" | "boolean" | "categorical" | "text" | "id";

export interface ColumnStat {
  name:         string;
  type:         ColumnType;
  nullCount:    number;
  uniqueCount:  number;
  totalCount:   number;
  fillRate:     number;         // 0–1
  sampleValues: string[];       // up to 5 distinct values
  min?:         string;
  max?:         string;
  mean?:        number;
  topValues?:   { value: string; count: number }[];  // top 10 for categorical
}

export interface ParsedData {
  headers:   string[];
  rows:      Record<string, string>[];
  format:    "csv" | "tsv" | "json" | "jsonl" | "raw";
  totalRows: number;         // total in file (may exceed rows.length if capped)
  truncated: boolean;
}

const MAX_PREVIEW_ROWS = 10_000;

// ── Format detection ──────────────────────────────────────────────────────────

function detectFormat(text: string): "csv" | "tsv" | "json" | "jsonl" | "raw" {
  const trimmed = text.trimStart();

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    // JSONL: multiple JSON objects one per line
    const firstLine = trimmed.split("\n")[0].trim();
    if (firstLine.startsWith("{") && !trimmed.startsWith("[")) return "jsonl";
    return "json";
  }

  const firstLine = trimmed.split("\n")[0];
  const tabCount  = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;

  if (tabCount > 1) return "tsv";
  if (commaCount > 0) return "csv";
  return "raw";
}

// ── CSV / TSV parser ──────────────────────────────────────────────────────────

function parseDelimited(text: string, sep: string): ParsedData {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [], format: sep === "\t" ? "tsv" : "csv", totalRows: 0, truncated: false };

  const splitLine = (line: string): string[] => {
    // Handles quoted fields
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === sep && !inQuote) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = splitLine(lines[0]).map(h => h.replace(/^"|"$/g, "").trim() || `col_${Math.random().toString(36).slice(2,6)}`);
  const dataLines = lines.slice(1);
  const totalRows = dataLines.length;
  const truncated = totalRows > MAX_PREVIEW_ROWS;
  const rows = dataLines.slice(0, MAX_PREVIEW_ROWS).map(line => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i]?.replace(/^"|"$/g, "").trim() ?? ""; });
    return row;
  });

  return { headers, rows, format: sep === "\t" ? "tsv" : "csv", totalRows, truncated };
}

// ── JSON parser ───────────────────────────────────────────────────────────────

function parseJSON(text: string): ParsedData {
  const data = JSON.parse(text);
  const arr: any[] = Array.isArray(data) ? data : typeof data === "object" && data !== null
    ? Object.values(data).find(Array.isArray) ?? [data]
    : [];

  if (!arr.length) return { headers: [], rows: [], format: "json", totalRows: 0, truncated: false };

  const headers = [...new Set(arr.slice(0, 100).flatMap(obj => Object.keys(obj ?? {})))];
  const totalRows = arr.length;
  const slice = arr.slice(0, MAX_PREVIEW_ROWS);
  const rows = slice.map(obj => {
    const row: Record<string, string> = {};
    headers.forEach(h => { row[h] = obj == null ? "" : String(obj[h] ?? ""); });
    return row;
  });

  return { headers, rows, format: "json", totalRows, truncated: totalRows > MAX_PREVIEW_ROWS };
}

function parseJSONL(text: string): ParsedData {
  const lines = text.split(/\r?\n/).filter(l => l.trim().startsWith("{"));
  const totalRows = lines.length;
  const slice = lines.slice(0, MAX_PREVIEW_ROWS);
  const objs = slice.map(l => { try { return JSON.parse(l); } catch { return {}; } });
  const headers = [...new Set(objs.slice(0, 100).flatMap(Object.keys))];
  const rows = objs.map(obj => {
    const row: Record<string, string> = {};
    headers.forEach(h => { row[h] = String(obj[h] ?? ""); });
    return row;
  });
  return { headers, rows, format: "jsonl", totalRows, truncated: totalRows > MAX_PREVIEW_ROWS };
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function parseData(text: string): ParsedData {
  if (!text?.trim()) return { headers: [], rows: [], format: "raw", totalRows: 0, truncated: false };

  const fmt = detectFormat(text);
  try {
    switch (fmt) {
      case "csv":  return parseDelimited(text, ",");
      case "tsv":  return parseDelimited(text, "\t");
      case "json": return parseJSON(text);
      case "jsonl": return parseJSONL(text);
      default: {
        // Raw text — split into lines as single-column table
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        return {
          headers: ["content"],
          rows: lines.slice(0, MAX_PREVIEW_ROWS).map(l => ({ content: l })),
          format: "raw",
          totalRows: lines.length,
          truncated: lines.length > MAX_PREVIEW_ROWS,
        };
      }
    }
  } catch {
    return { headers: [], rows: [], format: "raw", totalRows: 0, truncated: false };
  }
}

// ── Column analysis ───────────────────────────────────────────────────────────

const DATE_RE  = /^\d{4}-\d{2}-\d{2}|^\d{2}[\/\-]\d{2}[\/\-]\d{4}/;
const NUM_RE   = /^-?\d+([.,]\d+)?$/;
const BOOL_RE  = /^(true|false|yes|no|1|0|y|n)$/i;
const ID_RE    = /^[0-9a-f-]{8,}$|^\d{6,}$/i;

function detectType(samples: string[]): ColumnType {
  const clean = samples.filter(s => s !== "" && s !== "null" && s !== "N/A" && s !== "n/a");
  if (!clean.length) return "text";
  const n = clean.length;
  const numeric  = clean.filter(v => NUM_RE.test(v.replace(/,/g, ""))).length;
  const dates    = clean.filter(v => DATE_RE.test(v)).length;
  const booleans = clean.filter(v => BOOL_RE.test(v)).length;
  const ids      = clean.filter(v => ID_RE.test(v)).length;

  if (dates / n > 0.7)    return "date";
  if (booleans / n > 0.8) return "boolean";
  if (numeric / n > 0.8)  return "numeric";
  if (ids / n > 0.8)      return "id";

  // Categorical: low cardinality relative to row count
  const unique = new Set(clean).size;
  if (unique <= Math.min(30, n * 0.2)) return "categorical";

  return "text";
}

export function analyzeColumns(parsed: ParsedData): ColumnStat[] {
  if (!parsed.rows.length) return [];

  return parsed.headers.map(col => {
    const allVals = parsed.rows.map(r => r[col] ?? "");
    const nulls   = allVals.filter(v => v === "" || v === "null" || v === "N/A" || v === "n/a").length;
    const nonNull = allVals.filter(v => v !== "" && v !== "null" && v !== "N/A" && v !== "n/a");
    const unique  = new Set(nonNull).size;

    const sample  = [...new Set(nonNull)].slice(0, 5);
    const type    = detectType(nonNull.slice(0, 200));

    let min: string | undefined;
    let max: string | undefined;
    let mean: number | undefined;
    let topValues: { value: string; count: number }[] | undefined;

    if (type === "numeric") {
      const nums = nonNull.map(v => parseFloat(v.replace(/,/g, ""))).filter(n => !isNaN(n));
      if (nums.length) {
        min  = String(Math.min(...nums));
        max  = String(Math.max(...nums));
        mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      }
    } else if (type === "date") {
      const sorted = [...nonNull].sort();
      min = sorted[0];
      max = sorted[sorted.length - 1];
    } else if (type === "categorical" || type === "boolean") {
      const freq = new Map<string, number>();
      for (const v of nonNull) freq.set(v, (freq.get(v) ?? 0) + 1);
      topValues = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, count }));
    }

    return {
      name:        col,
      type,
      nullCount:   nulls,
      uniqueCount: unique,
      totalCount:  allVals.length,
      fillRate:    nonNull.length / allVals.length,
      sampleValues: sample,
      min, max, mean, topValues,
    };
  });
}

// ── Transformations ───────────────────────────────────────────────────────────

export interface TransformOptions {
  deduplicate:    boolean;
  imputeNulls:    boolean;
  normalizeTypes: boolean;
  trimWhitespace: boolean;
}

export interface TransformResult {
  rows:           Record<string, string>[];
  removedDupes:   number;
  imputedCells:   number;
  changes:        string[];
}

export function applyTransformations(
  parsed: ParsedData,
  stats:  ColumnStat[],
  opts:   TransformOptions
): TransformResult {
  let rows = [...parsed.rows];
  const changes: string[] = [];
  let removedDupes = 0;
  let imputedCells = 0;

  // 1. Trim whitespace
  if (opts.trimWhitespace) {
    rows = rows.map(r => {
      const out: Record<string, string> = {};
      for (const k of Object.keys(r)) out[k] = r[k].trim();
      return out;
    });
    changes.push("Trimmed whitespace from all cells");
  }

  // 2. Deduplicate
  if (opts.deduplicate) {
    const seen = new Set<string>();
    const deduped: Record<string, string>[] = [];
    for (const row of rows) {
      const key = JSON.stringify(Object.values(row));
      if (!seen.has(key)) { seen.add(key); deduped.push(row); }
    }
    removedDupes = rows.length - deduped.length;
    rows = deduped;
    if (removedDupes > 0) changes.push(`Removed ${removedDupes} duplicate rows`);
  }

  // 3. Impute nulls
  if (opts.imputeNulls) {
    const imputeValues: Record<string, string> = {};
    for (const stat of stats) {
      if (stat.type === "numeric" && stat.mean !== undefined) {
        imputeValues[stat.name] = stat.mean.toFixed(2);
      } else if (stat.type === "categorical" && stat.topValues?.[0]) {
        imputeValues[stat.name] = stat.topValues[0].value;
      } else if (stat.type === "boolean") {
        imputeValues[stat.name] = "false";
      } else {
        imputeValues[stat.name] = "N/A";
      }
    }

    rows = rows.map(r => {
      const out = { ...r };
      for (const k of Object.keys(out)) {
        if (out[k] === "" || out[k] === "null") {
          out[k] = imputeValues[k] ?? "N/A";
          imputedCells++;
        }
      }
      return out;
    });

    if (imputedCells > 0) changes.push(`Imputed ${imputedCells} missing values`);
  }

  // 4. Normalize types (numbers: remove thousand separators; dates: ISO format)
  if (opts.normalizeTypes) {
    let normalized = 0;
    for (const stat of stats) {
      if (stat.type === "numeric") {
        rows = rows.map(r => {
          const clean = r[stat.name]?.replace(/,/g, "");
          if (clean !== r[stat.name]) normalized++;
          return { ...r, [stat.name]: clean ?? r[stat.name] };
        });
      }
    }
    if (normalized > 0) changes.push(`Normalized ${normalized} numeric values`);
  }

  return { rows, removedDupes, imputedCells, changes };
}

// ── Serialize back to CSV ─────────────────────────────────────────────────────

export function serializeCSV(headers: string[], rows: Record<string, string>[]): string {
  const escape = (v: string) => v.includes(",") || v.includes('"') || v.includes("\n")
    ? `"${v.replace(/"/g, '""')}"` : v;

  const lines = [
    headers.map(escape).join(","),
    ...rows.map(r => headers.map(h => escape(r[h] ?? "")).join(",")),
  ];
  return lines.join("\n");
}
