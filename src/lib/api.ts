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

// ── Gmail helpers ─────────────────────────────────────────────────────────────
function decodeBase64Url(str: string): string {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  try { return atob(b64); } catch { return ""; }
}

function extractEmailBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
    }
    for (const part of payload.parts) {
      const body = extractEmailBody(part);
      if (body) return body;
    }
  }
  return "";
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

// Fetches ALL pages from a Notion database or page using cursor pagination
export async function fetchNotion(cfg: any) {
  const { integrationToken, resourceType, resourceId } = cfg;
  const h = { "Authorization": `Bearer ${integrationToken}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" };

  if (resourceType === "database") {
    const results: any[] = [];
    let cursor: string | undefined;

    do {
      const body: any = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;
      const res = await fetch(`https://api.notion.com/v1/databases/${resourceId}/query`, { method: "POST", headers: h, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Notion: ${e.message || res.status}`); }
      const d = await res.json();
      results.push(...d.results);
      cursor = d.has_more ? d.next_cursor : undefined;
    } while (cursor);

    return results.map((p: any, i: number) => `--- Page ${i + 1} ---\n${notionPropsToText(p.properties)}`).join("\n\n");

  } else {
    const blocks: string[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({ page_size: "100" });
      if (cursor) params.set("start_cursor", cursor);
      const res = await fetch(`https://api.notion.com/v1/blocks/${resourceId}/children?${params}`, { headers: h });
      if (!res.ok) throw new Error(`Notion: ${res.status}`);
      const d = await res.json();
      for (const b of d.results) {
        const c = b[b.type];
        const text = c?.rich_text?.map((r: any) => r.plain_text).join("") || "";
        if (text) blocks.push(text);
      }
      cursor = d.has_more ? d.next_cursor : undefined;
    } while (cursor);

    return blocks.join("\n");
  }
}

// Fetches ALL records from Airtable using offset pagination
export async function fetchAirtable(cfg: any) {
  const { accessToken, baseId, tableName } = cfg;
  const records: any[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${params}`, { headers: { "Authorization": `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Airtable: ${res.status}`);
    const d = await res.json();
    records.push(...(d.records || []));
    offset = d.offset;
  } while (offset);

  return records.map((r: any, i: number) => `--- Record ${i + 1} ---\n${Object.entries(r.fields).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n")}`).join("\n\n");
}

export async function fetchAwsS3(cfg: any) {
  const { accessKeyId, secretAccessKey, region, bucket, key } = cfg;
  const res = await signedAwsFetch(`https://${bucket}.s3.${region}.amazonaws.com/${key}`, { accessKeyId, secretAccessKey, region, service: "s3" });
  if (!res.ok) throw new Error(`S3: ${res.status}`);
  return res.text();
}

// Fetches ALL items from DynamoDB using LastEvaluatedKey pagination
export async function fetchAwsDynamo(cfg: any) {
  const { accessKeyId, secretAccessKey, region, tableName } = cfg;
  const items: any[] = [];
  let lastKey: any;

  do {
    const scanBody: any = { TableName: tableName };
    if (lastKey) scanBody.ExclusiveStartKey = lastKey;
    const body = JSON.stringify(scanBody);
    const res = await signedAwsFetch(`https://dynamodb.${region}.amazonaws.com/`, {
      accessKeyId, secretAccessKey, region, service: "dynamodb", method: "POST", body,
      extra: { "content-type": "application/x-amz-json-1.0", "x-amz-target": "DynamoDB_20120810.Scan" }
    });
    if (!res.ok) throw new Error(`DynamoDB: ${res.status}`);
    const d = await res.json();
    items.push(...(d.Items || []));
    lastKey = d.LastEvaluatedKey;
  } while (lastKey);

  return items.map((item: any, i: number) => `--- Item ${i + 1} ---\n${Object.entries(item).map(([k, v]: any) => `${k}: ${v.S || v.N || (v.BOOL != null ? v.BOOL : JSON.stringify(v))}`).join("\n")}`).join("\n\n");
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

// Fetches ALL Gmail emails using OAuth token — paginates through entire inbox
export async function fetchGmail(accessToken: string): Promise<string> {
  const h = { Authorization: `Bearer ${accessToken}` };
  const base = "https://gmail.googleapis.com/gmail/v1/users/me";

  // Step 1: Collect all message IDs across all pages
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ maxResults: "500" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${base}/messages?${params}`, { headers: h });
    if (!res.ok) throw new Error(`Gmail list failed: ${res.status}`);
    const d = await res.json();
    for (const m of d.messages || []) ids.push(m.id);
    pageToken = d.nextPageToken;
  } while (pageToken);

  if (ids.length === 0) return "No emails found in this inbox.";

  // Step 2: Fetch full message details in parallel batches
  // Uses format=full to get the actual body text, not just snippets
  const emails: string[] = [];
  const BATCH = 10;

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(id =>
        fetch(`${base}/messages/${id}?format=full`, { headers: h })
          .then(r => r.json())
          .catch(() => null)
      )
    );

    for (const msg of results) {
      if (!msg?.payload) continue;
      const msgHeaders = Object.fromEntries(
        (msg.payload.headers || []).map((hdr: any) => [hdr.name, hdr.value])
      );
      // Cap per-email body at 3000 chars to balance depth vs. total size
      const body = extractEmailBody(msg.payload).slice(0, 3000).trim();
      emails.push([
        `From: ${msgHeaders.From || ""}`,
        `To: ${msgHeaders.To || ""}`,
        `Date: ${msgHeaders.Date || ""}`,
        `Subject: ${msgHeaders.Subject || ""}`,
        body ? `Body:\n${body}` : `Preview: ${msg.snippet || ""}`,
      ].join("\n"));
    }
  }

  return emails.join("\n\n---\n\n");
}


