// ── AWS Sig4 ──────────────────────────────────────────────────────────────────
async function sha256Hex(msg: string | Uint8Array) {
  const d = typeof msg === "string" ? new TextEncoder().encode(msg) : msg;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", d as BufferSource))].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function hmacBytes(key: string | Uint8Array, msg: string) {
  const kb = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const k = await crypto.subtle.importKey("raw", kb as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
}
async function awsSigningKey(secret: string, ds: string, region: string, svc: string) {
  return hmacBytes(await hmacBytes(await hmacBytes(await hmacBytes("AWS4" + secret, ds), region), svc), "aws4_request");
}
async function signedAwsFetch(url: string, { accessKeyId, secretAccessKey, region, service, method = "GET", body = "", extra = {} }: any) {
  const ep = new URL(url);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const ds = amzDate.slice(0, 8);
  const ph = await sha256Hex(body);
  const hdrs: any = { host: ep.host, "x-amz-date": amzDate, "x-amz-content-sha256": ph, ...extra };
  const sk = Object.keys(hdrs).sort();
  const chdr = sk.map(k => `${k}:${hdrs[k]}\n`).join("");
  const shdr = sk.join(";");
  const cr = [method, ep.pathname || "/", ep.searchParams.toString(), chdr, shdr, ph].join("\n");
  const cred = `${ds}/${region}/${service}/aws4_request`;
  const s2s = `AWS4-HMAC-SHA256\n${amzDate}\n${cred}\n${await sha256Hex(cr)}`;
  const sigKey = await awsSigningKey(secretAccessKey, ds, region, service);
  const sig = [...await hmacBytes(sigKey, s2s)].map(b => b.toString(16).padStart(2, "0")).join("");
  return fetch(url, {
    method, body: body || undefined,
    headers: { ...hdrs, Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${cred}, SignedHeaders=${shdr}, Signature=${sig}` }
  });
}

// ── Azure Cosmos auth ─────────────────────────────────────────────────────────
async function cosmosAuth(masterKey: string, verb: string, resType: string, resId: string, date: string) {
  const txt = `${verb}\n${resType}\n${resId}\n${date}\n\n`.toLowerCase();
  const kb = Uint8Array.from(atob(masterKey), c => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("raw", kb, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(txt)))));
  return encodeURIComponent(`type=master&ver=1.0&sig=${sig}`);
}

function notionPropsToText(props: any = {}) {
  return Object.entries(props).map(([k, v]: any) => {
    const t = v.type; let val = "";
    if (t === "title") val = v.title?.map((r: any) => r.plain_text).join("") || "";
    else if (t === "rich_text") val = v.rich_text?.map((r: any) => r.plain_text).join("") || "";
    else if (t === "number") val = String(v.number ?? "");
    else if (t === "select") val = v.select?.name || "";
    else if (t === "multi_select") val = v.multi_select?.map((s: any) => s.name).join(", ") || "";
    else if (t === "date") val = v.date?.start || "";
    else if (t === "checkbox") val = v.checkbox ? "Yes" : "No";
    else if (t === "url") val = v.url || "";
    else if (t === "email") val = v.email || "";
    return val ? `${k}: ${val}` : null;
  }).filter(Boolean).join("\n");
}

function getPath(obj: any, path: string) {
  if (!path || obj == null) return obj;
  return path.split(".").reduce((a, k) => a?.[k], obj);
}

// ── Data fetchers ─────────────────────────────────────────────────────────────
export async function fetchRest(cfg: any) {
  const { url, authType, authValue, authHeader, jsonPath } = cfg;
  const h: any = {};
  if (authType === "bearer" && authValue) h["Authorization"] = `Bearer ${authValue}`;
  else if (authType === "apikey" && authValue) h[authHeader || "X-API-Key"] = authValue;
  else if (authType === "basic" && authValue) h["Authorization"] = `Basic ${btoa(authValue)}`;
  const res = await fetch(url, { headers: h });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) {
    const data = await res.json();
    const ex = jsonPath ? getPath(data, jsonPath) : data;
    return typeof ex === "string" ? ex : JSON.stringify(ex, null, 2);
  }
  return res.text();
}

export async function fetchNotion(cfg: any) {
  const { integrationToken, resourceType, resourceId } = cfg;
  const h = { "Authorization": `Bearer ${integrationToken}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" };
  if (resourceType === "database") {
    const res = await fetch(`https://api.notion.com/v1/databases/${resourceId}/query`, { method: "POST", headers: h, body: JSON.stringify({ page_size: 100 }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Notion: ${e.message || res.status}`); }
    const d = await res.json();
    return d.results.map((p: any, i: number) => `--- Page ${i + 1} ---\n${notionPropsToText(p.properties)}`).join("\n\n");
  } else {
    const res = await fetch(`https://api.notion.com/v1/blocks/${resourceId}/children?page_size=100`, { headers: h });
    if (!res.ok) throw new Error(`Notion: ${res.status}`);
    const d = await res.json();
    return d.results.map((b: any) => { const c = b[b.type]; return c?.rich_text?.map((r: any) => r.plain_text).join("") || ""; }).filter(Boolean).join("\n");
  }
}

export async function fetchAirtable(cfg: any) {
  const { accessToken, baseId, tableName } = cfg;
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?maxRecords=100`, { headers: { "Authorization": `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Airtable: ${res.status}`);
  const d = await res.json();
  return (d.records || []).map((r: any, i: number) => `--- Record ${i + 1} ---\n${Object.entries(r.fields).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n")}`).join("\n\n");
}

export async function fetchAwsS3(cfg: any) {
  const { accessKeyId, secretAccessKey, region, bucket, key } = cfg;
  const res = await signedAwsFetch(`https://${bucket}.s3.${region}.amazonaws.com/${key}`, { accessKeyId, secretAccessKey, region, service: "s3" });
  if (!res.ok) throw new Error(`S3: ${res.status}`);
  return res.text();
}

export async function fetchAwsDynamo(cfg: any) {
  const { accessKeyId, secretAccessKey, region, tableName, limit = 50 } = cfg;
  const body = JSON.stringify({ TableName: tableName, Limit: parseInt(limit) || 50 });
  const res = await signedAwsFetch(`https://dynamodb.${region}.amazonaws.com/`, {
    accessKeyId, secretAccessKey, region, service: "dynamodb", method: "POST", body,
    extra: { "content-type": "application/x-amz-json-1.0", "x-amz-target": "DynamoDB_20120810.Scan" }
  });
  if (!res.ok) throw new Error(`DynamoDB: ${res.status}`);
  const d = await res.json();
  return (d.Items || []).map((item: any, i: number) => `--- Item ${i + 1} ---\n${Object.entries(item).map(([k, v]: any) => `${k}: ${v.S || v.N || (v.BOOL != null ? v.BOOL : JSON.stringify(v))}`).join("\n")}`).join("\n\n");
}

export async function fetchAzureCosmos(cfg: any) {
  const { endpoint, masterKey, databaseId, containerId } = cfg;
  const date = new Date().toUTCString();
  const resId = `dbs/${databaseId}/colls/${containerId}`;
  const auth = await cosmosAuth(masterKey, "get", "docs", resId, date);
  const res = await fetch(`${endpoint.replace(/\/$/, "")}/${resId}/docs`, {
    headers: { Authorization: auth, "x-ms-date": date, "x-ms-version": "2018-12-31", "Content-Type": "application/json" }
  });
  if (!res.ok) throw new Error(`Cosmos DB: ${res.status}`);
  const d = await res.json();
  return (d.Documents || []).map((doc: any, i: number) => `--- Doc ${i + 1} ---\n${JSON.stringify(doc, null, 2)}`).join("\n\n");
}

export async function fetchAzureBlob(cfg: any) {
  const res = await fetch(cfg.sasUrl);
  if (!res.ok) throw new Error(`Azure Blob: ${res.status}`);
  return res.text();
}

// ── AI search ─────────────────────────────────────────────────────────────────
export async function aiSearch(query: string, sources: any[], getStorageContent: (id: string) => string, settings: any) {
  const { provider, apiKey, model } = settings;
  if (!apiKey) throw new Error("No API key set. Open settings gear icon.");
  const MAX = 60000;
  let ctx = "";
  for (const src of sources) {
    const content = getStorageContent(src.id);
    if (!content) continue;
    const chunk = `\n\n=== SOURCE: ${src.name} (${src.type}) ===\n${content}`;
    if (ctx.length + chunk.length > MAX) { ctx += chunk.slice(0, MAX - ctx.length - 50) + "\n[truncated]"; break; }
    ctx += chunk;
  }
  if (!ctx.trim()) throw new Error("No source content available. Add data sources first.");

  const sys = `You are an enterprise document intelligence and data aggregation engine. Analyze the provided sources and return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{"summary":"2-3 sentence precise analytical summary","found":true,"hits":[{"sourceName":"exact name","excerpt":"relevant quote \u2264400 chars","relevance":"why relevant"}]}
If nothing found: {"summary":"No relevant content found across integrated assets.","found":false,"hits":[]}`;

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: model || "claude-3-5-sonnet-20240620", max_tokens: 2048, system: sys, messages: [{ role: "user", content: `ASSETS:\n${ctx}\n\n---\nQUERY: ${query}` }] })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Anthropic ${res.status}`); }
    const d = await res.json();
    return JSON.parse(d.content?.[0]?.text?.trim() || "{}");
  } else {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model || "gpt-4o", messages: [{ role: "system", content: sys }, { role: "user", content: `ASSETS:\n${ctx}\n\n---\nQUERY: ${query}` }], max_tokens: 2048, response_format: { type: "json_object" } })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `OpenAI ${res.status}`); }
    const d = await res.json();
    return JSON.parse(d.choices?.[0]?.message?.content?.trim() || "{}");
  }
}
