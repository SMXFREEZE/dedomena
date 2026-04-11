import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// ── Helpers ──────────────────────────────────────────────────────────────────

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function gFetch(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeader(token), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function b64decode(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractGmailBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return b64decode(payload.body.data);
  if (payload.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === "text/plain" && p.body?.data) return b64decode(p.body.data);
    }
    for (const p of payload.parts) { const b = extractGmailBody(p); if (b) return b; }
  }
  return "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Gmail ────────────────────────────────────────────────────────────────────

async function gmailOp(op: string, params: any, token: string): Promise<string> {
  const base = "https://gmail.googleapis.com/gmail/v1/users/me";
  const h = authHeader(token);

  switch (op) {
    case "list": {
      const q = new URLSearchParams({ maxResults: String(params.count ?? 20) });
      if (params.query) q.set("q", params.query);
      if (params.labelIds) q.set("labelIds", params.labelIds);
      const d = await (await fetch(`${base}/messages?${q}`, { headers: h })).json();
      const ids = (d.messages ?? []).map((m: any) => m.id);
      if (!ids.length) return "No emails found.";
      const emails: string[] = [];
      for (const id of ids.slice(0, 25)) {
        const msg = await (await fetch(`${base}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, { headers: h })).json();
        const hdrs = Object.fromEntries((msg.payload?.headers ?? []).map((h: any) => [h.name, h.value]));
        emails.push(`ID: ${id}\nFrom: ${hdrs.From ?? ""}\nTo: ${hdrs.To ?? ""}\nDate: ${hdrs.Date ?? ""}\nSubject: ${hdrs.Subject ?? ""}\nSnippet: ${msg.snippet ?? ""}`);
      }
      return emails.join("\n\n---\n\n");
    }

    case "search": {
      const q = new URLSearchParams({ maxResults: String(params.count ?? 20), q: params.query ?? "" });
      const d = await (await fetch(`${base}/messages?${q}`, { headers: h })).json();
      const ids = (d.messages ?? []).map((m: any) => m.id);
      if (!ids.length) return `No emails matching: "${params.query}"`;
      const emails: string[] = [];
      for (const id of ids.slice(0, 15)) {
        const msg = await (await fetch(`${base}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, { headers: h })).json();
        const hdrs = Object.fromEntries((msg.payload?.headers ?? []).map((h: any) => [h.name, h.value]));
        emails.push(`ID: ${id}\nFrom: ${hdrs.From ?? ""}\nSubject: ${hdrs.Subject ?? ""}\nDate: ${hdrs.Date ?? ""}\nSnippet: ${msg.snippet ?? ""}`);
      }
      return emails.join("\n\n---\n\n");
    }

    case "get": {
      const msg = await (await fetch(`${base}/messages/${params.messageId}?format=full`, { headers: h })).json();
      const hdrs = Object.fromEntries((msg.payload?.headers ?? []).map((h: any) => [h.name, h.value]));
      const body = extractGmailBody(msg.payload).slice(0, 5000);
      return `From: ${hdrs.From ?? ""}\nTo: ${hdrs.To ?? ""}\nDate: ${hdrs.Date ?? ""}\nSubject: ${hdrs.Subject ?? ""}\n\n${body || msg.snippet || ""}`;
    }

    case "send": {
      const raw = [
        `To: ${params.to}`,
        `Subject: ${params.subject}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        "",
        params.body,
      ].join("\r\n");
      const encoded = Buffer.from(raw).toString("base64url");
      await fetch(`${base}/messages/send`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: encoded }),
      });
      return `Email sent to ${params.to} — subject: "${params.subject}"`;
    }

    case "reply": {
      const original = await (await fetch(`${base}/messages/${params.messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID`, { headers: h })).json();
      const oHdrs = Object.fromEntries((original.payload?.headers ?? []).map((h: any) => [h.name, h.value]));
      const raw = [
        `To: ${oHdrs.From}`,
        `Subject: Re: ${oHdrs.Subject}`,
        `In-Reply-To: ${oHdrs["Message-ID"] ?? ""}`,
        `References: ${oHdrs["Message-ID"] ?? ""}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        "",
        params.body,
      ].join("\r\n");
      const encoded = Buffer.from(raw).toString("base64url");
      await fetch(`${base}/messages/send`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: encoded, threadId: original.threadId }),
      });
      return `Reply sent to ${oHdrs.From}`;
    }

    case "labels": {
      const d = await (await fetch(`${base}/labels`, { headers: h })).json();
      return (d.labels ?? []).map((l: any) => `${l.name} (${l.type}) — ${l.messagesTotal ?? 0} messages, ${l.messagesUnread ?? 0} unread`).join("\n");
    }

    case "markRead": {
      await fetch(`${base}/messages/${params.messageId}/modify`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
      });
      return `Message ${params.messageId} marked as read.`;
    }

    default: return `Unknown Gmail operation: ${op}`;
  }
}

// ── Outlook ──────────────────────────────────────────────────────────────────

async function outlookOp(op: string, params: any, token: string): Promise<string> {
  const base = "https://graph.microsoft.com/v1.0/me";
  const h = authHeader(token);

  switch (op) {
    case "list": {
      const top = params.count ?? 20;
      const d = await (await fetch(`${base}/messages?$top=${top}&$select=id,subject,from,receivedDateTime,bodyPreview&$orderby=receivedDateTime desc`, { headers: h })).json();
      return (d.value ?? []).map((m: any) =>
        `ID: ${m.id}\nFrom: ${m.from?.emailAddress?.address ?? ""}\nDate: ${m.receivedDateTime}\nSubject: ${m.subject}\nPreview: ${m.bodyPreview?.slice(0, 200) ?? ""}`
      ).join("\n\n---\n\n") || "No emails found.";
    }

    case "search": {
      const d = await (await fetch(`${base}/messages?$search="${encodeURIComponent(params.query)}"&$top=${params.count ?? 20}&$select=id,subject,from,receivedDateTime,bodyPreview`, { headers: h })).json();
      return (d.value ?? []).map((m: any) =>
        `ID: ${m.id}\nFrom: ${m.from?.emailAddress?.address ?? ""}\nSubject: ${m.subject}\nDate: ${m.receivedDateTime}\nPreview: ${m.bodyPreview?.slice(0, 200) ?? ""}`
      ).join("\n\n---\n\n") || "No results.";
    }

    case "get": {
      const m = await (await fetch(`${base}/messages/${params.messageId}?$select=subject,from,toRecipients,receivedDateTime,body`, { headers: h })).json();
      return `From: ${m.from?.emailAddress?.address ?? ""}\nTo: ${(m.toRecipients ?? []).map((r: any) => r.emailAddress?.address).join(", ")}\nDate: ${m.receivedDateTime}\nSubject: ${m.subject}\n\n${stripHtml(m.body?.content ?? "").slice(0, 5000)}`;
    }

    case "send": {
      await fetch(`${base}/sendMail`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject: params.subject,
            body: { contentType: "Text", content: params.body },
            toRecipients: [{ emailAddress: { address: params.to } }],
          },
        }),
      });
      return `Email sent to ${params.to} — subject: "${params.subject}"`;
    }

    default: return `Unknown Outlook operation: ${op}`;
  }
}

// ── Google Calendar ──────────────────────────────────────────────────────────

async function gcalOp(op: string, params: any, token: string): Promise<string> {
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary";
  const h = authHeader(token);

  switch (op) {
    case "list": {
      const now = new Date();
      const timeMin = params.timeMin ?? now.toISOString();
      const timeMax = params.timeMax ?? new Date(now.getTime() + 7 * 86400000).toISOString();
      const d = await gFetch(`${base}/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=50&singleEvents=true&orderBy=startTime`, token);
      return (d.items ?? []).map((e: any) =>
        `ID: ${e.id}\nTitle: ${e.summary ?? "(no title)"}\nStart: ${e.start?.dateTime ?? e.start?.date ?? ""}\nEnd: ${e.end?.dateTime ?? e.end?.date ?? ""}\nLocation: ${e.location ?? ""}\nDescription: ${(e.description ?? "").slice(0, 200)}`
      ).join("\n\n---\n\n") || "No events found.";
    }

    case "create": {
      const event = {
        summary: params.title,
        description: params.description,
        location: params.location,
        start: { dateTime: params.startTime, timeZone: params.timeZone ?? "America/New_York" },
        end: { dateTime: params.endTime, timeZone: params.timeZone ?? "America/New_York" },
        attendees: params.attendees?.map((email: string) => ({ email })),
      };
      const d = await (await fetch(`${base}/events`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      })).json();
      return `Event created: "${d.summary}" on ${d.start?.dateTime ?? d.start?.date} — ID: ${d.id}`;
    }

    case "delete": {
      await fetch(`${base}/events/${params.eventId}`, { method: "DELETE", headers: h });
      return `Event ${params.eventId} deleted.`;
    }

    default: return `Unknown Calendar operation: ${op}`;
  }
}

// ── Slack ─────────────────────────────────────────────────────────────────────

async function slackOp(op: string, params: any, token: string): Promise<string> {
  const h = authHeader(token);

  switch (op) {
    case "list_channels": {
      const d = await (await fetch("https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200", { headers: h })).json();
      return (d.channels ?? []).map((c: any) => `#${c.name} — ${c.purpose?.value ?? ""} (${c.num_members} members)`).join("\n") || "No channels.";
    }

    case "read_channel": {
      const d = await (await fetch(`https://slack.com/api/conversations.history?channel=${params.channelId}&limit=${params.count ?? 50}`, { headers: h })).json();
      return (d.messages ?? []).map((m: any) => `[${new Date(Number(m.ts) * 1000).toISOString()}] ${m.user ?? "bot"}: ${m.text}`).join("\n") || "No messages.";
    }

    case "post_message": {
      const d = await (await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: params.channel, text: params.text }),
      })).json();
      if (!d.ok) return `Slack error: ${d.error}`;
      return `Message posted to ${params.channel}: "${params.text.slice(0, 100)}"`;
    }

    case "search": {
      const d = await (await fetch(`https://slack.com/api/search.messages?query=${encodeURIComponent(params.query)}&count=${params.count ?? 20}`, { headers: h })).json();
      return (d.messages?.matches ?? []).map((m: any) => `[#${m.channel?.name}] ${m.username}: ${m.text?.slice(0, 300)}`).join("\n\n---\n\n") || "No results.";
    }

    default: return `Unknown Slack operation: ${op}`;
  }
}

// ── Salesforce ────────────────────────────────────────────────────────────────

async function salesforceOp(op: string, params: any, token: string): Promise<string> {
  const instanceUrl = params.instanceUrl ?? "";
  const h = authHeader(token);
  const ver = "v59.0";

  switch (op) {
    case "query": {
      const soql = encodeURIComponent(params.soql ?? "SELECT Id, Name FROM Account LIMIT 20");
      const d = await (await fetch(`${instanceUrl}/services/data/${ver}/query?q=${soql}`, { headers: h })).json();
      return (d.records ?? []).map((r: any) => JSON.stringify(r, null, 2)).join("\n\n") || "No records.";
    }

    case "get_record": {
      const d = await (await fetch(`${instanceUrl}/services/data/${ver}/sobjects/${params.objectType}/${params.recordId}`, { headers: h })).json();
      return JSON.stringify(d, null, 2);
    }

    case "create_record": {
      const d = await (await fetch(`${instanceUrl}/services/data/${ver}/sobjects/${params.objectType}`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify(params.fields),
      })).json();
      return `Created ${params.objectType}: ${d.id}`;
    }

    case "update_record": {
      await fetch(`${instanceUrl}/services/data/${ver}/sobjects/${params.objectType}/${params.recordId}`, {
        method: "PATCH", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify(params.fields),
      });
      return `Updated ${params.objectType} ${params.recordId}`;
    }

    default: return `Unknown Salesforce operation: ${op}`;
  }
}

// ── HubSpot ──────────────────────────────────────────────────────────────────

async function hubspotOp(op: string, params: any, token: string): Promise<string> {
  const h = { ...authHeader(token), "Content-Type": "application/json" };

  switch (op) {
    case "list_contacts": {
      const d = await (await fetch(`https://api.hubapi.com/crm/v3/objects/contacts?limit=${params.count ?? 50}`, { headers: h })).json();
      return (d.results ?? []).map((c: any) => `ID: ${c.id} — ${c.properties?.firstname ?? ""} ${c.properties?.lastname ?? ""} — ${c.properties?.email ?? ""}`).join("\n") || "No contacts.";
    }

    case "search": {
      const d = await (await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST", headers: h,
        body: JSON.stringify({
          query: params.query,
          limit: params.count ?? 20,
        }),
      })).json();
      return (d.results ?? []).map((c: any) => `ID: ${c.id} — ${JSON.stringify(c.properties)}`).join("\n\n") || "No results.";
    }

    case "create_contact": {
      const d = await (await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST", headers: h,
        body: JSON.stringify({ properties: params.properties }),
      })).json();
      return `Contact created: ${d.id}`;
    }

    case "create_deal": {
      const d = await (await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
        method: "POST", headers: h,
        body: JSON.stringify({ properties: params.properties }),
      })).json();
      return `Deal created: ${d.id}`;
    }

    default: return `Unknown HubSpot operation: ${op}`;
  }
}

// ── Jira ──────────────────────────────────────────────────────────────────────

async function jiraOp(op: string, params: any, token: string): Promise<string> {
  const baseUrl = params.baseUrl ?? "";
  const h = { ...authHeader(token), "Content-Type": "application/json" };

  switch (op) {
    case "search_issues": {
      const jql = encodeURIComponent(params.jql ?? "ORDER BY created DESC");
      const d = await (await fetch(`${baseUrl}/rest/api/3/search?jql=${jql}&maxResults=${params.count ?? 20}&fields=summary,status,assignee,priority,created`, { headers: h })).json();
      return (d.issues ?? []).map((i: any) =>
        `${i.key}: ${i.fields?.summary ?? ""} [${i.fields?.status?.name ?? ""}] — ${i.fields?.assignee?.displayName ?? "Unassigned"} — ${i.fields?.priority?.name ?? ""}`
      ).join("\n") || "No issues.";
    }

    case "get_issue": {
      const d = await (await fetch(`${baseUrl}/rest/api/3/issue/${params.issueKey}?fields=summary,status,assignee,priority,description,comment`, { headers: h })).json();
      return `${d.key}: ${d.fields?.summary}\nStatus: ${d.fields?.status?.name}\nAssignee: ${d.fields?.assignee?.displayName ?? "Unassigned"}\nPriority: ${d.fields?.priority?.name}\nDescription:\n${d.fields?.description?.content?.map((b: any) => b.content?.map((c: any) => c.text).join("")).join("\n") ?? ""}`;
    }

    case "create_issue": {
      const d = await (await fetch(`${baseUrl}/rest/api/3/issue`, {
        method: "POST", headers: h,
        body: JSON.stringify({
          fields: {
            project: { key: params.projectKey },
            summary: params.summary,
            description: params.description ? { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: params.description }] }] } : undefined,
            issuetype: { name: params.issueType ?? "Task" },
            priority: params.priority ? { name: params.priority } : undefined,
          },
        }),
      })).json();
      return `Created: ${d.key} — ${params.summary}`;
    }

    case "comment": {
      await fetch(`${baseUrl}/rest/api/3/issue/${params.issueKey}/comment`, {
        method: "POST", headers: h,
        body: JSON.stringify({
          body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: params.text }] }] },
        }),
      });
      return `Comment added to ${params.issueKey}`;
    }

    default: return `Unknown Jira operation: ${op}`;
  }
}

// ── Linear ───────────────────────────────────────────────────────────────────

async function linearOp(op: string, params: any, token: string): Promise<string> {
  async function gql(query: string, variables?: any) {
    const d = await (await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    })).json();
    return d.data;
  }

  switch (op) {
    case "list_issues": {
      const d = await gql(`{ issues(first: 50, orderBy: createdAt) { nodes { id identifier title state { name } assignee { name } priority createdAt } } }`);
      return (d?.issues?.nodes ?? []).map((i: any) =>
        `${i.identifier}: ${i.title} [${i.state?.name ?? ""}] — ${i.assignee?.name ?? "Unassigned"} — P${i.priority}`
      ).join("\n") || "No issues.";
    }

    case "create_issue": {
      const d = await gql(`mutation($input: IssueCreateInput!) { issueCreate(input: $input) { issue { identifier title } } }`, {
        input: { title: params.title, description: params.description, teamId: params.teamId, priority: params.priority },
      });
      return `Created: ${d?.issueCreate?.issue?.identifier} — ${params.title}`;
    }

    default: return `Unknown Linear operation: ${op}`;
  }
}

// ── Notion ───────────────────────────────────────────────────────────────────

async function notionOp(op: string, params: any, token: string): Promise<string> {
  const h = { ...authHeader(token), "Notion-Version": "2022-06-28", "Content-Type": "application/json" };

  switch (op) {
    case "search": {
      const d = await (await fetch("https://api.notion.com/v1/search", {
        method: "POST", headers: h,
        body: JSON.stringify({ query: params.query, page_size: params.count ?? 20 }),
      })).json();
      return (d.results ?? []).map((r: any) => {
        const title = r.properties?.title?.title?.[0]?.plain_text ?? r.properties?.Name?.title?.[0]?.plain_text ?? r.url ?? r.id;
        return `[${r.object}] ${title} — ${r.url ?? r.id}`;
      }).join("\n") || "No results.";
    }

    case "query_database": {
      const d = await (await fetch(`https://api.notion.com/v1/databases/${params.databaseId}/query`, {
        method: "POST", headers: h,
        body: JSON.stringify({ page_size: params.count ?? 50 }),
      })).json();
      return (d.results ?? []).map((p: any) => JSON.stringify(p.properties)).join("\n\n") || "No records.";
    }

    case "create_page": {
      const d = await (await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers: h,
        body: JSON.stringify({
          parent: params.parentId ? { page_id: params.parentId } : { database_id: params.databaseId },
          properties: params.properties ?? { title: { title: [{ text: { content: params.title ?? "Untitled" } }] } },
          children: params.content ? [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: params.content } }] } }] : undefined,
        }),
      })).json();
      return `Page created: ${d.id} — ${d.url}`;
    }

    default: return `Unknown Notion operation: ${op}`;
  }
}

// ── GitHub ────────────────────────────────────────────────────────────────────

async function githubOp(op: string, params: any, token: string): Promise<string> {
  const h = { ...authHeader(token), Accept: "application/vnd.github+json" };

  switch (op) {
    case "list_repos": {
      const d = await (await fetch(`https://api.github.com/user/repos?per_page=50&sort=updated`, { headers: h })).json();
      return (d as any[]).map((r: any) => `${r.full_name} — ${r.description ?? "(no description)"} ⭐ ${r.stargazers_count}`).join("\n") || "No repos.";
    }

    case "list_issues": {
      const d = await (await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/issues?state=${params.state ?? "open"}&per_page=50`, { headers: h })).json();
      return (d as any[]).map((i: any) => `#${i.number} [${i.state}] ${i.title} — ${i.assignee?.login ?? "unassigned"}`).join("\n") || "No issues.";
    }

    case "create_issue": {
      const d = await (await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/issues`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ title: params.title, body: params.body, labels: params.labels }),
      })).json();
      return `Issue created: #${d.number} — ${d.html_url}`;
    }

    case "comment": {
      const d = await (await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}/comments`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ body: params.body }),
      })).json();
      return `Comment added: ${d.html_url}`;
    }

    default: return `Unknown GitHub operation: ${op}`;
  }
}

// ── Google Drive ─────────────────────────────────────────────────────────────

async function gdriveOp(op: string, params: any, token: string): Promise<string> {
  switch (op) {
    case "list": {
      const d = await gFetch(`https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType,modifiedTime,size)&orderBy=modifiedTime desc`, token);
      return (d.files ?? []).map((f: any) => `${f.name} — ${f.mimeType} — ${f.modifiedTime} — ${f.size ?? "N/A"} bytes — ID: ${f.id}`).join("\n") || "No files.";
    }

    case "search": {
      const q = encodeURIComponent(`name contains '${params.query}'`);
      const d = await gFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=20&fields=files(id,name,mimeType,modifiedTime)`, token);
      return (d.files ?? []).map((f: any) => `${f.name} — ${f.mimeType} — ID: ${f.id}`).join("\n") || "No files matching query.";
    }

    default: return `Unknown Drive operation: ${op}`;
  }
}

// ── Zendesk ──────────────────────────────────────────────────────────────────

async function zendeskOp(op: string, params: any, token: string): Promise<string> {
  const subdomain = params.subdomain ?? "";
  const h = authHeader(token);

  switch (op) {
    case "list_tickets": {
      const d = await (await fetch(`https://${subdomain}.zendesk.com/api/v2/tickets.json?per_page=${params.count ?? 25}&sort_by=created_at&sort_order=desc`, { headers: h })).json();
      return (d.tickets ?? []).map((t: any) =>
        `#${t.id}: ${t.subject} [${t.status}] — Priority: ${t.priority ?? "none"} — Created: ${t.created_at}`
      ).join("\n") || "No tickets.";
    }

    case "create_ticket": {
      const d = await (await fetch(`https://${subdomain}.zendesk.com/api/v2/tickets.json`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: { subject: params.subject, description: params.description, priority: params.priority ?? "normal" },
        }),
      })).json();
      return `Ticket created: #${d.ticket?.id} — ${params.subject}`;
    }

    default: return `Unknown Zendesk operation: ${op}`;
  }
}

// ── Stripe ───────────────────────────────────────────────────────────────────

async function stripeOp(op: string, params: any, token: string): Promise<string> {
  const h = authHeader(token);

  switch (op) {
    case "list_customers": {
      const d = await (await fetch(`https://api.stripe.com/v1/customers?limit=${params.count ?? 25}`, { headers: h })).json();
      return (d.data ?? []).map((c: any) => `${c.id}: ${c.name ?? c.email ?? "(unnamed)"} — ${c.email ?? ""}`).join("\n") || "No customers.";
    }

    case "list_charges": {
      const d = await (await fetch(`https://api.stripe.com/v1/charges?limit=${params.count ?? 25}`, { headers: h })).json();
      return (d.data ?? []).map((c: any) => `${c.id}: $${(c.amount / 100).toFixed(2)} ${c.currency} — ${c.status} — ${c.description ?? ""}`).join("\n") || "No charges.";
    }

    case "list_subscriptions": {
      const d = await (await fetch(`https://api.stripe.com/v1/subscriptions?limit=${params.count ?? 25}`, { headers: h })).json();
      return (d.data ?? []).map((s: any) => `${s.id}: ${s.status} — $${(s.items?.data?.[0]?.price?.unit_amount ?? 0) / 100}/mo — Customer: ${s.customer}`).join("\n") || "No subscriptions.";
    }

    default: return `Unknown Stripe operation: ${op}`;
  }
}

// ── Google Analytics ─────────────────────────────────────────────────────────

async function gaOp(op: string, params: any, token: string): Promise<string> {
  switch (op) {
    case "run_report": {
      const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${params.propertyId}:runReport`, {
        method: "POST",
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: params.startDate ?? "30daysAgo", endDate: params.endDate ?? "today" }],
          dimensions: (params.dimensions ?? ["pagePath"]).map((d: string) => ({ name: d })),
          metrics: (params.metrics ?? ["sessions", "activeUsers"]).map((m: string) => ({ name: m })),
          limit: params.limit ?? 50,
        }),
      });
      const d = await res.json();
      const headers = [...(d.dimensionHeaders ?? []), ...(d.metricHeaders ?? [])].map((h: any) => h.name);
      const rows = (d.rows ?? []).map((r: any) =>
        [...(r.dimensionValues ?? []), ...(r.metricValues ?? [])].map((v: any) => v.value).join(" | ")
      );
      return `${headers.join(" | ")}\n${rows.join("\n")}`;
    }

    default: return `Unknown Analytics operation: ${op}`;
  }
}

// ── Shopify ──────────────────────────────────────────────────────────────────

async function shopifyOp(op: string, params: any, token: string): Promise<string> {
  const shop = params.shop ?? "";
  const h = { "X-Shopify-Access-Token": token };
  const base = `https://${shop}/admin/api/2024-01`;

  switch (op) {
    case "list_orders": {
      const d = await (await fetch(`${base}/orders.json?limit=${params.count ?? 50}&status=any`, { headers: h })).json();
      return (d.orders ?? []).map((o: any) =>
        `Order #${o.order_number}: $${o.total_price} ${o.currency} — ${o.financial_status} — ${o.fulfillment_status ?? "unfulfilled"}`
      ).join("\n") || "No orders.";
    }

    case "list_products": {
      const d = await (await fetch(`${base}/products.json?limit=${params.count ?? 50}`, { headers: h })).json();
      return (d.products ?? []).map((p: any) =>
        `${p.title} — $${p.variants?.[0]?.price ?? "?"} — ${p.status} — ID: ${p.id}`
      ).join("\n") || "No products.";
    }

    default: return `Unknown Shopify operation: ${op}`;
  }
}

// ── Main dispatcher ──────────────────────────────────────────────────────────

const SERVICE_HANDLERS: Record<string, (op: string, params: any, token: string) => Promise<string>> = {
  gmail: gmailOp,
  outlook: outlookOp,
  "google-calendar": gcalOp,
  "outlook-calendar": gcalOp, // same pattern, but will use Outlook API
  slack: slackOp,
  salesforce: salesforceOp,
  hubspot: hubspotOp,
  jira: jiraOp,
  linear: linearOp,
  notion: notionOp,
  github: githubOp,
  "google-drive": gdriveOp,
  zendesk: zendeskOp,
  stripe: stripeOp,
  "google-analytics": gaOp,
  shopify: shopifyOp,
};

export async function POST(req: NextRequest) {
  try {
    const { service, operation, params, accessToken } = await req.json();

    if (!service || !operation) {
      return NextResponse.json({ error: "Missing service or operation" }, { status: 400 });
    }
    if (!accessToken) {
      return NextResponse.json({ error: `No access token provided for ${service}. Connect this service first.` }, { status: 401 });
    }

    const handler = SERVICE_HANDLERS[service];
    if (!handler) {
      return NextResponse.json({ error: `Unsupported service: ${service}. Available: ${Object.keys(SERVICE_HANDLERS).join(", ")}` }, { status: 400 });
    }

    const result = await handler(operation, params ?? {}, accessToken);
    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("Service proxy error:", error);
    return NextResponse.json({ error: error.message ?? "Service request failed" }, { status: 500 });
  }
}
