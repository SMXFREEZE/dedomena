import { CredentialMap } from './types';

// ── Shared helpers ─────────────────────────────────────────────────────────────
function fmt(items: any[], rowFn: (item: any, i: number) => string): string {
  return items.map(rowFn).join('\n\n---\n\n');
}

async function gGet(url: string, token: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${new URL(url).hostname}: HTTP ${res.status}`);
  return res.json();
}

async function paginate<T>(
  firstUrl: string,
  headers: Record<string, string>,
  getItems: (d: any) => T[],
  getNext: (d: any) => string | null
): Promise<T[]> {
  const all: T[] = [];
  let url: string | null = firstUrl;
  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) break;
    const d = await res.json();
    all.push(...getItems(d));
    url = getNext(d);
  }
  return all;
}

// ── Gmail ──────────────────────────────────────────────────────────────────────
async function fetchGmail(creds: CredentialMap): Promise<string> {
  const base = 'https://gmail.googleapis.com/gmail/v1/users/me';
  const h = { Authorization: `Bearer ${creds.accessToken}` };

  // Collect all message IDs
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ maxResults: '500' });
    if (pageToken) params.set('pageToken', pageToken);
    const d = await (await fetch(`${base}/messages?${params}`, { headers: h })).json();
    for (const m of d.messages ?? []) ids.push(m.id);
    pageToken = d.nextPageToken;
  } while (pageToken);

  if (!ids.length) return 'No emails found.';

  const emails: string[] = [];
  const BATCH = 10;
  for (let i = 0; i < ids.length; i += BATCH) {
    const results = await Promise.all(
      ids.slice(i, i + BATCH).map(id =>
        fetch(`${base}/messages/${id}?format=full`, { headers: h }).then(r => r.json()).catch(() => null)
      )
    );
    for (const msg of results) {
      if (!msg?.payload) continue;
      const hdrs = Object.fromEntries((msg.payload.headers ?? []).map((h: any) => [h.name, h.value]));
      const body = extractBody(msg.payload).slice(0, 3000).trim();
      emails.push([
        `From: ${hdrs.From ?? ''}`, `To: ${hdrs.To ?? ''}`,
        `Date: ${hdrs.Date ?? ''}`, `Subject: ${hdrs.Subject ?? ''}`,
        body ? `Body:\n${body}` : `Preview: ${msg.snippet ?? ''}`,
      ].join('\n'));
    }
  }
  return emails.join('\n\n---\n\n');
}

function extractBody(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  if (payload.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === 'text/plain' && p.body?.data)
        return atob(p.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    for (const p of payload.parts) { const b = extractBody(p); if (b) return b; }
  }
  return '';
}

// ── Outlook ────────────────────────────────────────────────────────────────────
async function fetchOutlook(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.accessToken}` };
  const messages = await paginate(
    'https://graph.microsoft.com/v1.0/me/messages?$top=50&$select=subject,from,toRecipients,receivedDateTime,bodyPreview,body',
    h,
    d => d.value ?? [],
    d => d['@odata.nextLink'] ?? null
  );
  return fmt(messages, (m, i) => [
    `--- Email ${i + 1} ---`,
    `From: ${m.from?.emailAddress?.address ?? ''}`,
    `To: ${(m.toRecipients ?? []).map((r: any) => r.emailAddress?.address).join(', ')}`,
    `Date: ${m.receivedDateTime ?? ''}`,
    `Subject: ${m.subject ?? ''}`,
    `Body: ${(m.body?.content ?? m.bodyPreview ?? '').replace(/<[^>]+>/g, ' ').slice(0, 2000)}`,
  ].join('\n'));
}

// ── Google Calendar ────────────────────────────────────────────────────────────
async function fetchGoogleCalendar(creds: CredentialMap): Promise<string> {
  const d = await gGet('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=2500&singleEvents=true&orderBy=startTime', creds.accessToken);
  return fmt(d.items ?? [], (e, i) => [
    `--- Event ${i + 1} ---`,
    `Title: ${e.summary ?? ''}`, `Start: ${e.start?.dateTime ?? e.start?.date ?? ''}`,
    `End: ${e.end?.dateTime ?? e.end?.date ?? ''}`, `Location: ${e.location ?? ''}`,
    `Description: ${(e.description ?? '').slice(0, 500)}`,
  ].join('\n'));
}

// ── Outlook Calendar ───────────────────────────────────────────────────────────
async function fetchOutlookCalendar(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.accessToken}` };
  const events = await paginate(
    'https://graph.microsoft.com/v1.0/me/events?$top=50&$select=subject,start,end,location,bodyPreview,organizer',
    h, d => d.value ?? [], d => d['@odata.nextLink'] ?? null
  );
  return fmt(events, (e, i) => [
    `--- Event ${i + 1} ---`, `Title: ${e.subject ?? ''}`,
    `Start: ${e.start?.dateTime ?? ''}`, `End: ${e.end?.dateTime ?? ''}`,
    `Location: ${e.location?.displayName ?? ''}`, `Organizer: ${e.organizer?.emailAddress?.address ?? ''}`,
    `Preview: ${e.bodyPreview ?? ''}`,
  ].join('\n'));
}

// ── OneDrive ───────────────────────────────────────────────────────────────────
async function fetchOneDrive(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.accessToken}` };
  const files = await paginate(
    'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=100',
    h, d => d.value ?? [], d => d['@odata.nextLink'] ?? null
  );
  return fmt(files, (f, i) => `--- File ${i + 1} ---\nName: ${f.name}\nSize: ${f.size} bytes\nModified: ${f.lastModifiedDateTime}\nType: ${f.file?.mimeType ?? 'folder'}`);
}

// ── SharePoint ─────────────────────────────────────────────────────────────────
async function fetchSharePoint(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.accessToken}` };
  const siteUrl = creds.siteUrl?.replace(/\/$/, '');
  const d = await (await fetch(`https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteUrl ?? '')}/lists`, { headers: h })).json();
  const lists = d.value ?? [];
  const results: string[] = [];
  for (const list of lists.slice(0, 5)) {
    const items = await (await fetch(`https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteUrl ?? '')}/lists/${list.id}/items?expand=fields`, { headers: h })).json();
    results.push(`=== List: ${list.displayName} ===\n${(items.value ?? []).map((it: any) => JSON.stringify(it.fields)).join('\n')}`);
  }
  return results.join('\n\n');
}

// ── Google Drive ───────────────────────────────────────────────────────────────
async function fetchGoogleDrive(creds: CredentialMap): Promise<string> {
  const d = await gGet('https://www.googleapis.com/drive/v3/files?pageSize=100&fields=files(id,name,mimeType,modifiedTime,size)', creds.accessToken);
  return fmt(d.files ?? [], (f, i) => `--- File ${i + 1} ---\nName: ${f.name}\nType: ${f.mimeType}\nModified: ${f.modifiedTime}\nSize: ${f.size ?? 'N/A'} bytes`);
}

// ── Slack ──────────────────────────────────────────────────────────────────────
async function fetchSlack(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.token}` };
  const chRes = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', { headers: h });
  const channels = ((await chRes.json()).channels ?? []) as any[];
  const results: string[] = [];
  for (const ch of channels.slice(0, 50)) {
    const mRes = await fetch(`https://slack.com/api/conversations.history?channel=${ch.id}&limit=200`, { headers: h });
    const msgs = ((await mRes.json()).messages ?? []) as any[];
    results.push(`=== #${ch.name} ===\n${msgs.map(m => `[${new Date(Number(m.ts) * 1000).toISOString()}] ${m.text}`).join('\n')}`);
  }
  return results.join('\n\n');
}

// ── Notion ─────────────────────────────────────────────────────────────────────
async function fetchNotion(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.integrationToken}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
  if (creds.resourceType === 'database') {
    const rows: any[] = [];
    let cursor: string | undefined;
    do {
      const body: any = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;
      const d = await (await fetch(`https://api.notion.com/v1/databases/${creds.resourceId}/query`, { method: 'POST', headers: h, body: JSON.stringify(body) })).json();
      rows.push(...(d.results ?? []));
      cursor = d.has_more ? d.next_cursor : undefined;
    } while (cursor);
    return fmt(rows, (p, i) => `--- Page ${i + 1} ---\n${notionProps(p.properties)}`);
  } else {
    const blocks: string[] = [];
    let cursor: string | undefined;
    do {
      const params = new URLSearchParams({ page_size: '100' });
      if (cursor) params.set('start_cursor', cursor);
      const d = await (await fetch(`https://api.notion.com/v1/blocks/${creds.resourceId}/children?${params}`, { headers: h })).json();
      for (const b of d.results ?? []) {
        const text = b[b.type]?.rich_text?.map((r: any) => r.plain_text).join('') ?? '';
        if (text) blocks.push(text);
      }
      cursor = d.has_more ? d.next_cursor : undefined;
    } while (cursor);
    return blocks.join('\n');
  }
}

function notionProps(props: any = {}) {
  return Object.entries(props).map(([k, v]: any) => {
    const t = v.type; let val = '';
    if (t === 'title') val = v.title?.map((r: any) => r.plain_text).join('') ?? '';
    else if (t === 'rich_text') val = v.rich_text?.map((r: any) => r.plain_text).join('') ?? '';
    else if (t === 'number') val = String(v.number ?? '');
    else if (t === 'select') val = v.select?.name ?? '';
    else if (t === 'multi_select') val = v.multi_select?.map((s: any) => s.name).join(', ') ?? '';
    else if (t === 'date') val = v.date?.start ?? '';
    else if (t === 'checkbox') val = v.checkbox ? 'Yes' : 'No';
    else if (t === 'url') val = v.url ?? '';
    return val ? `${k}: ${val}` : null;
  }).filter(Boolean).join('\n');
}

// ── Airtable ───────────────────────────────────────────────────────────────────
async function fetchAirtable(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.accessToken}` };
  const records: any[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    const d = await (await fetch(`https://api.airtable.com/v0/${creds.baseId}/${encodeURIComponent(creds.tableName)}?${params}`, { headers: h })).json();
    records.push(...(d.records ?? []));
    offset = d.offset;
  } while (offset);
  return fmt(records, (r, i) => `--- Record ${i + 1} ---\n${Object.entries(r.fields).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')}`);
}

// ── HubSpot ────────────────────────────────────────────────────────────────────
async function fetchHubSpot(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' };
  const sections: string[] = [];
  for (const obj of ['contacts', 'companies', 'deals']) {
    const d = await (await fetch(`https://api.hubapi.com/crm/v3/objects/${obj}?limit=100&properties=*`, { headers: h })).json();
    sections.push(`=== ${obj.toUpperCase()} ===\n${(d.results ?? []).map((r: any) => JSON.stringify(r.properties)).join('\n')}`);
  }
  return sections.join('\n\n');
}

// ── Salesforce ─────────────────────────────────────────────────────────────────
async function fetchSalesforce(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.accessToken}` };
  const query = encodeURIComponent(creds.soql || 'SELECT Id, Name, Email FROM Contact LIMIT 1000');
  const d = await (await fetch(`${creds.instanceUrl}/services/data/v59.0/query?q=${query}`, { headers: h })).json();
  return fmt(d.records ?? [], (r, i) => `--- Record ${i + 1} ---\n${Object.entries(r).filter(([k]) => k !== 'attributes').map(([k, v]) => `${k}: ${v}`).join('\n')}`);
}

// ── GitHub ─────────────────────────────────────────────────────────────────────
async function fetchGitHub(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.token}`, Accept: 'application/vnd.github+json' };
  const sections: string[] = [];
  const base = creds.repo ? `/repos/${creds.owner}/${creds.repo}` : '';
  if (base) {
    const [issues, prs] = await Promise.all([
      (await fetch(`https://api.github.com${base}/issues?state=all&per_page=100`, { headers: h })).json(),
      (await fetch(`https://api.github.com${base}/pulls?state=all&per_page=100`, { headers: h })).json(),
    ]);
    sections.push(`=== ISSUES ===\n${(issues as any[]).map(i => `#${i.number} [${i.state}] ${i.title}\n${i.body?.slice(0, 500) ?? ''}`).join('\n\n')}`);
    sections.push(`=== PULL REQUESTS ===\n${(prs as any[]).map(p => `#${p.number} [${p.state}] ${p.title}`).join('\n')}`);
  } else {
    const repos = await (await fetch(`https://api.github.com/orgs/${creds.owner}/repos?per_page=100`, { headers: h })).json();
    sections.push(`=== REPOSITORIES ===\n${(repos as any[]).map((r: any) => `${r.full_name} — ${r.description ?? ''} (⭐ ${r.stargazers_count})`).join('\n')}`);
  }
  return sections.join('\n\n');
}

// ── Jira ───────────────────────────────────────────────────────────────────────
async function fetchJira(creds: CredentialMap): Promise<string> {
  const auth = btoa(`${creds.email}:${creds.apiToken}`);
  const h = { Authorization: `Basic ${auth}`, Accept: 'application/json' };
  const jql = encodeURIComponent(creds.jql || 'ORDER BY created DESC');
  const d = await (await fetch(`${creds.baseUrl}/rest/api/3/search?jql=${jql}&maxResults=100&fields=summary,status,assignee,priority,description,created,updated`, { headers: h })).json();
  return fmt((d.issues ?? []), (issue, i) => [
    `--- Issue ${i + 1}: ${issue.key} ---`,
    `Summary: ${issue.fields?.summary ?? ''}`,
    `Status: ${issue.fields?.status?.name ?? ''}`,
    `Priority: ${issue.fields?.priority?.name ?? ''}`,
    `Assignee: ${issue.fields?.assignee?.displayName ?? 'Unassigned'}`,
    `Created: ${issue.fields?.created ?? ''}`,
  ].join('\n'));
}

// ── Linear ─────────────────────────────────────────────────────────────────────
async function fetchLinear(creds: CredentialMap): Promise<string> {
  const query = `{ issues(first: 250) { nodes { id title state { name } assignee { name } priority createdAt description } } }`;
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { Authorization: creds.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const d = await res.json();
  return fmt(d.data?.issues?.nodes ?? [], (issue, i) => [
    `--- Issue ${i + 1} ---`, `Title: ${issue.title}`,
    `State: ${issue.state?.name ?? ''}`, `Assignee: ${issue.assignee?.name ?? 'Unassigned'}`,
    `Priority: ${issue.priority}`, `Description: ${(issue.description ?? '').slice(0, 400)}`,
  ].join('\n'));
}

// ── Stripe ─────────────────────────────────────────────────────────────────────
async function fetchStripe(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.secretKey}` };
  const sections: string[] = [];
  for (const [name, path] of [['Customers', 'customers'], ['Charges', 'charges'], ['Subscriptions', 'subscriptions']]) {
    const d = await (await fetch(`https://api.stripe.com/v1/${path}?limit=100`, { headers: h })).json();
    sections.push(`=== ${name} ===\n${(d.data ?? []).map((r: any) => JSON.stringify(r)).join('\n')}`);
  }
  return sections.join('\n\n');
}

// ── Shopify ────────────────────────────────────────────────────────────────────
async function fetchShopify(creds: CredentialMap): Promise<string> {
  const h = { 'X-Shopify-Access-Token': creds.accessToken };
  const base = `https://${creds.shop}/admin/api/2024-01`;
  const [products, orders] = await Promise.all([
    (await fetch(`${base}/products.json?limit=250`, { headers: h })).json(),
    (await fetch(`${base}/orders.json?limit=250&status=any`, { headers: h })).json(),
  ]);
  return [
    `=== PRODUCTS ===\n${(products.products ?? []).map((p: any) => `${p.title} — $${p.variants?.[0]?.price} — Status: ${p.status}`).join('\n')}`,
    `=== ORDERS ===\n${(orders.orders ?? []).map((o: any) => `Order #${o.order_number} — ${o.total_price} ${o.currency} — ${o.financial_status}`).join('\n')}`,
  ].join('\n\n');
}

// ── Mailchimp ──────────────────────────────────────────────────────────────────
async function fetchMailchimp(creds: CredentialMap): Promise<string> {
  const dc = (creds.apiKey ?? '').split('-').pop() ?? 'us1';
  const h = { Authorization: `Bearer ${creds.apiKey}` };
  const base = `https://${dc}.api.mailchimp.com/3.0`;
  const lists = await (await fetch(`${base}/lists?count=100`, { headers: h })).json();
  const sections: string[] = [];
  for (const list of (lists.lists ?? []).slice(0, 3)) {
    const members = await (await fetch(`${base}/lists/${list.id}/members?count=1000&fields=members.email_address,members.status,members.merge_fields`, { headers: h })).json();
    sections.push(`=== ${list.name} (${list.stats?.member_count ?? 0} members) ===\n${(members.members ?? []).map((m: any) => `${m.email_address} — ${m.status}`).join('\n')}`);
  }
  return sections.join('\n\n');
}

// ── Zendesk ────────────────────────────────────────────────────────────────────
async function fetchZendesk(creds: CredentialMap): Promise<string> {
  const auth = btoa(`${creds.email}/token:${creds.apiToken}`);
  const h = { Authorization: `Basic ${auth}` };
  const tickets = await paginate(
    `https://${creds.subdomain}.zendesk.com/api/v2/tickets.json?per_page=100`,
    h, d => d.tickets ?? [], d => d.next_page ?? null
  );
  return fmt(tickets, (t, i) => [
    `--- Ticket ${i + 1}: #${t.id} ---`, `Subject: ${t.subject}`,
    `Status: ${t.status}`, `Priority: ${t.priority ?? 'none'}`,
    `Created: ${t.created_at}`, `Description: ${(t.description ?? '').slice(0, 400)}`,
  ].join('\n'));
}

// ── Google Analytics 4 ─────────────────────────────────────────────────────────
async function fetchGA4(creds: CredentialMap): Promise<string> {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${creds.propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }, { name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'bounceRate' }],
      limit: 1000,
    }),
  });
  const d = await res.json();
  const headers = [...(d.dimensionHeaders ?? []), ...(d.metricHeaders ?? [])].map((h: any) => h.name);
  const rows = (d.rows ?? []).map((r: any) =>
    [...(r.dimensionValues ?? []), ...(r.metricValues ?? [])].map((v: any) => v.value).join(' | ')
  );
  return `GA4 Report (last 30 days)\n${headers.join(' | ')}\n${rows.join('\n')}`;
}

// ── Datadog ────────────────────────────────────────────────────────────────────
async function fetchDatadog(creds: CredentialMap): Promise<string> {
  const h = { 'DD-API-KEY': creds.apiKey, 'DD-APPLICATION-KEY': creds.appKey };
  const now = Math.floor(Date.now() / 1000);
  const res = await fetch(`https://api.datadoghq.com/api/v2/logs/events/search`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter: { query: creds.query || '*', from: new Date((now - 3600) * 1000).toISOString(), to: new Date(now * 1000).toISOString() }, page: { limit: 1000 } }),
  });
  const d = await res.json();
  return fmt(d.data ?? [], (log, i) => `--- Log ${i + 1} ---\n${JSON.stringify(log.attributes)}`);
}

// ── PostHog ────────────────────────────────────────────────────────────────────
async function fetchPostHog(creds: CredentialMap): Promise<string> {
  const base = (creds.host ?? 'https://app.posthog.com').replace(/\/$/, '');
  const h = { Authorization: `Bearer ${creds.personalApiKey}` };
  const events = await (await fetch(`${base}/api/projects/${creds.projectId}/events/?limit=500`, { headers: h })).json();
  return fmt(events.results ?? [], (e, i) => `--- Event ${i + 1} ---\nEvent: ${e.event}\nPerson: ${e.distinct_id}\nTimestamp: ${e.timestamp}\nProperties: ${JSON.stringify(e.properties).slice(0, 400)}`);
}

// ── Pipedrive ──────────────────────────────────────────────────────────────────
async function fetchPipedrive(creds: CredentialMap): Promise<string> {
  const sections: string[] = [];
  for (const res of ['persons', 'deals', 'organizations']) {
    const d = await (await fetch(`https://api.pipedrive.com/v1/${res}?api_token=${creds.apiToken}&limit=500`)).json();
    sections.push(`=== ${res.toUpperCase()} ===\n${(d.data ?? []).map((r: any) => JSON.stringify(r)).join('\n')}`);
  }
  return sections.join('\n\n');
}

// ── Confluence ─────────────────────────────────────────────────────────────────
async function fetchConfluence(creds: CredentialMap): Promise<string> {
  const auth = btoa(`${creds.email}:${creds.apiToken}`);
  const h = { Authorization: `Basic ${auth}`, Accept: 'application/json' };
  const cql = creds.spaceKey ? `space=${creds.spaceKey}` : '';
  const d = await (await fetch(`${creds.baseUrl}/rest/api/content?type=page&limit=100&expand=body.storage${cql ? `&spaceKey=${creds.spaceKey}` : ''}`, { headers: h })).json();
  return fmt(d.results ?? [], (page, i) => `--- Page ${i + 1}: ${page.title} ---\n${(page.body?.storage?.value ?? '').replace(/<[^>]+>/g, ' ').slice(0, 1000)}`);
}

// ── REST API (generic) ─────────────────────────────────────────────────────────
async function fetchRestApi(creds: CredentialMap): Promise<string> {
  const h: Record<string, string> = {};
  if (creds.authType === 'bearer') h.Authorization = `Bearer ${creds.authValue}`;
  else if (creds.authType === 'apikey') h[creds.authHeader || 'X-API-Key'] = creds.authValue;
  else if (creds.authType === 'basic') h.Authorization = `Basic ${btoa(creds.authValue)}`;
  const res = await fetch(creds.url, { headers: h });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('json')) {
    const data = await res.json();
    const ex = creds.jsonPath ? creds.jsonPath.split('.').reduce((a: any, k: string) => a?.[k], data) : data;
    return typeof ex === 'string' ? ex : JSON.stringify(ex, null, 2);
  }
  return res.text();
}

// ── GraphQL ────────────────────────────────────────────────────────────────────
async function fetchGraphQL(creds: CredentialMap): Promise<string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (creds.token) h.Authorization = `Bearer ${creds.token}`;
  const res = await fetch(creds.url, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ query: creds.query, variables: creds.variables ? JSON.parse(creds.variables) : {} }),
  });
  const d = await res.json();
  return JSON.stringify(d.data ?? d, null, 2);
}

// ── Paste text ─────────────────────────────────────────────────────────────────
async function fetchPaste(creds: CredentialMap): Promise<string> {
  return creds.content ?? '';
}

// ── Dropbox ────────────────────────────────────────────────────────────────────
async function fetchDropbox(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' };
  const d = await (await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST', headers: h,
    body: JSON.stringify({ path: '', recursive: false, limit: 2000 }),
  })).json();
  return fmt(d.entries ?? [], (f, i) => `--- ${i + 1}: ${f.name} ---\nType: ${f['.tag']}\nPath: ${f.path_lower}\nModified: ${f.client_modified ?? ''}\nSize: ${f.size ?? 'N/A'} bytes`);
}

// ── Supabase ───────────────────────────────────────────────────────────────────
async function fetchSupabase(creds: CredentialMap): Promise<string> {
  const res = await fetch(`${creds.url}/rest/v1/${creds.table}?limit=${creds.limit ?? 1000}`, {
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
  });
  const d = await res.json();
  return fmt(Array.isArray(d) ? d : [d], (r, i) => `--- Row ${i + 1} ---\n${JSON.stringify(r)}`);
}

// ── Firebase Firestore ─────────────────────────────────────────────────────────
async function fetchFirestore(creds: CredentialMap): Promise<string> {
  const url = `https://firestore.googleapis.com/v1/projects/${creds.projectId}/databases/(default)/documents/${creds.collection}?key=${creds.apiKey}&pageSize=300`;
  const d = await (await fetch(url)).json();
  return fmt(d.documents ?? [], (doc, i) => `--- Document ${i + 1} ---\nID: ${doc.name?.split('/').pop() ?? ''}\n${JSON.stringify(doc.fields)}`);
}

// ── ClickHouse ─────────────────────────────────────────────────────────────────
async function fetchClickHouse(creds: CredentialMap): Promise<string> {
  const url = new URL(creds.url);
  url.searchParams.set('query', (creds.query ?? 'SELECT 1') + ' FORMAT JSONEachRow');
  url.searchParams.set('database', creds.database ?? 'default');
  const headers: Record<string, string> = {};
  if (creds.username) headers['X-ClickHouse-User'] = creds.username;
  if (creds.password) headers['X-ClickHouse-Key'] = creds.password;
  const res = await fetch(url.toString(), { headers });
  return res.text();
}

// ── Databricks SQL ─────────────────────────────────────────────────────────────
async function fetchDatabricks(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' };
  const startRes = await fetch(`https://${creds.host}/api/2.0/sql/statements`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ warehouse_id: creds.httpPath?.split('/').pop(), statement: creds.query ?? 'SELECT 1', wait_timeout: '30s' }),
  });
  const d = await startRes.json();
  const rows = d.result?.data_array ?? [];
  const cols = d.manifest?.schema?.columns?.map((c: any) => c.name) ?? [];
  return [cols.join(' | '), ...rows.map((r: any[]) => r.join(' | '))].join('\n');
}

// ── RSS Feed ───────────────────────────────────────────────────────────────────
async function fetchRSS(creds: CredentialMap): Promise<string> {
  const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(creds.url)}&count=100`);
  const d = await res.json();
  return fmt(d.items ?? [], (item, i) => [
    `--- Item ${i + 1} ---`, `Title: ${item.title}`, `Date: ${item.pubDate}`,
    `Link: ${item.link}`, `Content: ${(item.description ?? '').replace(/<[^>]+>/g, ' ').slice(0, 500)}`,
  ].join('\n'));
}

// ── Vercel ─────────────────────────────────────────────────────────────────────
async function fetchVercel(creds: CredentialMap): Promise<string> {
  const h = { Authorization: `Bearer ${creds.token}` };
  const params = new URLSearchParams({ limit: '100' });
  if (creds.teamId) params.set('teamId', creds.teamId);
  const d = await (await fetch(`https://api.vercel.com/v6/deployments?${params}`, { headers: h })).json();
  return fmt(d.deployments ?? [], (dep, i) => `--- Deployment ${i + 1} ---\nProject: ${dep.name}\nURL: ${dep.url}\nState: ${dep.state}\nCreated: ${new Date(dep.createdAt).toISOString()}`);
}

// ── DynamoDB via AWS REST API ──────────────────────────────────────────────────
async function fetchDynamoDB(creds: CredentialMap): Promise<string> {
  // AWS Signature V4 for DynamoDB REST
  const region   = creds.region || 'us-east-1';
  const table    = creds.tableName;
  if (!table) throw new Error('Table Name is required for DynamoDB.');
  if (!creds.accessKeyId || !creds.secretAccessKey) throw new Error('Access Key ID and Secret Access Key are required.');

  const endpoint = `https://dynamodb.${region}.amazonaws.com/`;
  const body     = JSON.stringify({ TableName: table, Limit: 500 });
  const now      = new Date();
  const amzDate  = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  // SHA-256 hash helper (browser + Node compatible via Web Crypto)
  const sha256hex = async (data: string) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  };
  const hmac = async (key: ArrayBuffer, data: string): Promise<ArrayBuffer> => {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
  };

  const bodyHash = await sha256hex(body);
  const canonicalHeaders = `content-type:application/x-amz-json-1.0\nhost:dynamodb.${region}.amazonaws.com\nx-amz-date:${amzDate}\nx-amz-target:DynamoDB_20120810.Scan\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, bodyHash].join('\n');
  const credScope = `${dateStamp}/${region}/dynamodb/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, await sha256hex(canonicalRequest)].join('\n');

  const enc = new TextEncoder();
  const kDate    = await hmac(enc.encode(`AWS4${creds.secretAccessKey}`).buffer as ArrayBuffer, dateStamp);
  const kRegion  = await hmac(kDate, region);
  const kService = await hmac(kRegion, 'dynamodb');
  const kSigning = await hmac(kService, 'aws4_request');
  const sigBuf   = await hmac(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': 'DynamoDB_20120810.Scan',
      'X-Amz-Date': amzDate,
      'Authorization': authHeader,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? err.__type ?? `DynamoDB error ${res.status}`);
  }

  const data = await res.json();
  const items = data.Items ?? [];
  // Deserialize DynamoDB attribute format { "S": "value" } → plain string
  const deser = (attr: any): any => {
    if (attr.S !== undefined) return attr.S;
    if (attr.N !== undefined) return Number(attr.N);
    if (attr.BOOL !== undefined) return attr.BOOL;
    if (attr.NULL) return null;
    if (attr.L) return attr.L.map(deser);
    if (attr.M) return Object.fromEntries(Object.entries(attr.M).map(([k, v]) => [k, deser(v)]));
    return JSON.stringify(attr);
  };
  const rows = items.map((item: any) => Object.fromEntries(Object.entries(item).map(([k, v]) => [k, deser(v)])));
  return rows.map((r: any, i: number) =>
    `--- Item ${i + 1} ---\n${Object.entries(r).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}`
  ).join('\n\n');
}

// ── Main dispatcher ────────────────────────────────────────────────────────────
export async function runClientFetcher(connectorId: string, creds: CredentialMap): Promise<string> {
  switch (connectorId) {
    case 'gmail':           return fetchGmail(creds);
    case 'outlook':         return fetchOutlook(creds);
    case 'google-calendar': return fetchGoogleCalendar(creds);
    case 'outlook-calendar':return fetchOutlookCalendar(creds);
    case 'onedrive':        return fetchOneDrive(creds);
    case 'sharepoint':      return fetchSharePoint(creds);
    case 'google-drive':    return fetchGoogleDrive(creds);
    case 'slack':           return fetchSlack(creds);
    case 'notion':          return fetchNotion(creds);
    case 'airtable':        return fetchAirtable(creds);
    case 'hubspot':         return fetchHubSpot(creds);
    case 'salesforce':      return fetchSalesforce(creds);
    case 'github':          return fetchGitHub(creds);
    case 'jira':            return fetchJira(creds);
    case 'linear':          return fetchLinear(creds);
    case 'stripe':          return fetchStripe(creds);
    case 'shopify':         return fetchShopify(creds);
    case 'mailchimp':       return fetchMailchimp(creds);
    case 'zendesk':         return fetchZendesk(creds);
    case 'google-analytics':return fetchGA4(creds);
    case 'datadog':         return fetchDatadog(creds);
    case 'posthog':         return fetchPostHog(creds);
    case 'pipedrive':       return fetchPipedrive(creds);
    case 'confluence':      return fetchConfluence(creds);
    case 'rest-api':        return fetchRestApi(creds);
    case 'graphql':         return fetchGraphQL(creds);
    case 'paste':           return fetchPaste(creds);
    case 'dropbox':         return fetchDropbox(creds);
    case 'supabase':        return fetchSupabase(creds);
    case 'firebase':        return fetchFirestore(creds);
    case 'clickhouse':      return fetchClickHouse(creds);
    case 'databricks':      return fetchDatabricks(creds);
    case 'rss-feed':        return fetchRSS(creds);
    case 'vercel':          return fetchVercel(creds);
    case 'couchdb': {
      const res = await fetch(`${creds.url}/${creds.database}/_all_docs?include_docs=true`, {
        headers: { Authorization: `Basic ${btoa(`${creds.username}:${creds.password}`)}` },
      });
      const d = await res.json();
      return fmt(d.rows ?? [], (r: any, i) => `--- Doc ${i + 1} ---\n${JSON.stringify(r.doc)}`);
    }
    case 'upstash': {
      const res = await fetch(`${creds.url}/keys/*`, { headers: { Authorization: `Bearer ${creds.token}` } });
      return JSON.stringify(await res.json(), null, 2);
    }
    default:
      throw new Error(`No client fetcher for connector: ${connectorId}. It may require server-side execution.`);
  }
}
