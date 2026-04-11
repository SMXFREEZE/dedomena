import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

// Tool definitions the agent can use
const AGENT_TOOLS = [
  {
    name: "read_file",
    description: "Read the contents of a file from the user's local filesystem. Provide the full path.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Absolute file path to read" } },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "List files and folders in a directory. Returns names and types (file/directory).",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute directory path" },
      },
      required: ["path"],
    },
  },
  {
    name: "search_files",
    description: "Search for files matching a pattern in a directory. Returns matching file paths.",
    input_schema: {
      type: "object",
      properties: {
        directory: { type: "string", description: "Directory to search in" },
        pattern: { type: "string", description: "Glob pattern (e.g. *.csv, *.json)" },
      },
      required: ["directory", "pattern"],
    },
  },
  {
    name: "fetch_url",
    description: "Fetch content from a URL (web page, API endpoint, RSS feed, etc). Returns the text content.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch" },
        method: { type: "string", enum: ["GET", "POST"], description: "HTTP method" },
        headers: { type: "object", description: "Optional HTTP headers" },
        body: { type: "string", description: "Optional request body for POST" },
      },
      required: ["url"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute file path to write" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "analyze_data",
    description: "Analyze imported data sources. Use this to query your connected datasets with natural language.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to analyze in the connected data" },
        sourceIds: { type: "array", items: { type: "string" }, description: "Optional: specific source IDs to analyze" },
      },
      required: ["query"],
    },
  },
  // ── Enterprise tools ────────────────────────────────────────────────────────
  {
    name: "email_action",
    description: "Read, search, send, reply, or forward emails. Supported services: gmail, outlook.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Either 'gmail' or 'outlook'" },
        operation: { type: "string", description: "One of: list, search, get, send, reply, labels, markRead" },
        params: { type: "object", description: "Parameters for the operation (e.g. { to, subject, body } for send, { query } for search)" },
      },
      required: ["service", "operation", "params"],
    },
  },
  {
    name: "calendar_action",
    description: "View schedule or manage events. Supported services: google-calendar, outlook-calendar.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Either 'google-calendar' or 'outlook-calendar'" },
        operation: { type: "string", description: "One of: list, create, delete" },
        params: { type: "object", description: "Parameters for the operation" },
      },
      required: ["service", "operation", "params"],
    },
  },
  {
    name: "crm_action",
    description: "Manage sales pipeline, contacts and companies. Supported services: salesforce, hubspot.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Either 'salesforce' or 'hubspot'" },
        operation: { type: "string", description: "One of: query, get_record, create_record, update_record for salesforce. list_contacts, search, create_contact, create_deal for hubspot" },
        params: { type: "object", description: "Parameters for the operation" },
      },
      required: ["service", "operation", "params"],
    },
  },
  {
    name: "project_action",
    description: "Manage tickets, issues, boards. Supported services: jira, linear, notion, github.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", description: "One of that: jira, linear, notion, github" },
        operation: { type: "string", description: "Examples: search_issues, get_issue, create_issue, comment (Jira). list_issues, create_issue (Linear). search, create_page (Notion)." },
        params: { type: "object", description: "Parameters for the operation" },
      },
      required: ["service", "operation", "params"],
    },
  },
  {
    name: "messaging_action",
    description: "Read channels and post messages. Supported services: slack.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Must be 'slack'" },
        operation: { type: "string", description: "One of: list_channels, read_channel, post_message, search" },
        params: { type: "object", description: "Parameters for the operation" },
      },
      required: ["service", "operation", "params"],
    },
  },
  {
    name: "storage_action",
    description: "Manage cloud files and storage. Supported services: google-drive.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Must be 'google-drive'" },
        operation: { type: "string", description: "One of: list, search" },
        params: { type: "object", description: "Parameters for the operation" },
      },
      required: ["service", "operation", "params"],
    },
  },
  {
    name: "support_action",
    description: "Manage customer support desk. Supported services: zendesk.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Must be 'zendesk'" },
        operation: { type: "string", description: "One of: list_tickets, create_ticket" },
        params: { type: "object", description: "Parameters for the operation" },
      },
      required: ["service", "operation", "params"],
    },
  },
  {
    name: "analytics_action",
    description: "Fetch traffic, sales and revenue metrics. Supported services: stripe, shopify, google-analytics.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", description: "One of that: stripe, shopify, google-analytics" },
        operation: { type: "string", description: "Examples: list_customers, list_charges, list_subscriptions (Stripe). list_orders, list_products (Shopify). run_report (GA)" },
        params: { type: "object", description: "Parameters for the operation" },
      },
      required: ["service", "operation", "params"],
    },
  },
  {
    name: "run_shell",
    description: "Execute a shell command on the local machine. Use for running scripts, checking system info, or executing data pipelines.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
        cwd: { type: "string", description: "Working directory (optional)" },
      },
      required: ["command"],
    },
  },
  // ── Browser automation tools ───────────────────────────────────────────────
  {
    name: "browser_navigate",
    description: "Open a URL in a headless browser. Use this when you need to interact with a web page (click buttons, fill forms, take screenshots). Returns the page title and visible text content.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to navigate to" },
        waitFor: { type: "string", description: "Optional CSS selector to wait for before capturing content" },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_screenshot",
    description: "Take a screenshot of the current browser page. Returns a base64-encoded PNG image description. Use this to see what's on the screen.",
    input_schema: {
      type: "object",
      properties: {
        fullPage: { type: "boolean", description: "Capture full scrollable page (default: false, captures viewport only)" },
        selector: { type: "string", description: "Optional CSS selector to screenshot a specific element" },
      },
    },
  },
  {
    name: "browser_click",
    description: "Click on an element in the current page. Use CSS selectors or text content to identify the element.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the element to click (e.g. '#submit-btn', '.login-button', 'a[href=\"/signup\"]')" },
        text: { type: "string", description: "Alternative: click element containing this text" },
      },
    },
  },
  {
    name: "browser_type",
    description: "Type text into an input field on the current page.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the input field (e.g. '#email', 'input[name=\"search\"]')" },
        text: { type: "string", description: "Text to type into the field" },
        clear: { type: "boolean", description: "Clear the field before typing (default: true)" },
        pressEnter: { type: "boolean", description: "Press Enter after typing (default: false)" },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "browser_extract",
    description: "Extract structured data from the current page using CSS selectors. Great for scraping tables, lists, or specific content.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector to extract (e.g. 'table', '.product-card', 'article')" },
        attribute: { type: "string", description: "Extract a specific attribute instead of text (e.g. 'href', 'src')" },
        multiple: { type: "boolean", description: "Extract all matching elements (default: true)" },
      },
      required: ["selector"],
    },
  },
  {
    name: "browser_evaluate",
    description: "Execute JavaScript code in the browser page context. Use for complex interactions or data extraction.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript code to execute in the browser. Must return a value." },
      },
      required: ["code"],
    },
  },
];

// ── Persistent browser session ───────────────────────────────────────────────
let browserInstance: any = null;
let currentPage: any = null;
let browserTimeout: NodeJS.Timeout | null = null;

async function getBrowser() {
  if (browserInstance) return browserInstance;
  const chromium = await import("@sparticuz/chromium");
  const puppeteer = await import("puppeteer-core");
  // @sparticuz/chromium exports the class directly (no .default)
  const chr = (chromium.default ?? chromium) as any;
  browserInstance = await puppeteer.default.launch({
    args: chr.args,
    executablePath: await chr.executablePath(),
    headless: true,
    defaultViewport: { width: 1280, height: 800 },
  });
  // Auto-close browser after 5 minutes of inactivity
  resetBrowserTimeout();
  return browserInstance;
}

function resetBrowserTimeout() {
  if (browserTimeout) clearTimeout(browserTimeout);
  browserTimeout = setTimeout(async () => {
    if (browserInstance) {
      await browserInstance.close().catch(() => {});
      browserInstance = null;
      currentPage = null;
    }
  }, 5 * 60 * 1000);
}

async function getPage() {
  const browser = await getBrowser();
  if (!currentPage || currentPage.isClosed()) {
    currentPage = await browser.newPage();
    await currentPage.setViewport({ width: 1280, height: 800 });
    await currentPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
  }
  resetBrowserTimeout();
  return currentPage;
}

// ── Tool execution ───────────────────────────────────────────────────────────
async function executeTool(tool: string, input: any, serviceTokens: Record<string, string>): Promise<string> {
  const fs = await import("fs/promises");
  const path = await import("path");

  // Enterprise operations handler
  if (["email_action", "calendar_action", "crm_action", "project_action", "messaging_action", "storage_action", "support_action", "analytics_action"].includes(tool)) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    
    const token = serviceTokens[input.service] ?? "";
    if (!token) return `Authentication error: You need to connect ${input.service} in the Data Sources panel first.`;

    try {
      const res = await fetch(`${baseUrl}/api/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: input.service,
          operation: input.operation,
          params: input.params,
          accessToken: token,
        })
      });
      const d = await res.json();
      if (!res.ok) return `Service error (${input.service} ${input.operation}): ${d.error}`;
      return `[${input.service}] ${d.result}`;
    } catch (e: any) {
      return `Service error (${input.service}): ${e.message}`;
    }
  }

  // Handle other tools...
  switch (tool) {
    case "read_file": {
      try {
        const content = await fs.readFile(input.path, "utf-8");
        return content.slice(0, 500_000);
      } catch (e: any) {
        return `Error reading file: ${e.message}`;
      }
    }

    case "list_directory": {
      try {
        const entries = await fs.readdir(input.path, { withFileTypes: true });
        const lines = entries.map(e => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`);
        return lines.join("\n") || "(empty directory)";
      } catch (e: any) {
        return `Error listing directory: ${e.message}`;
      }
    }

    case "search_files": {
      try {
        const results: string[] = [];
        const maxResults = 100;

        async function walk(dir: string, depth: number) {
          if (depth > 4 || results.length >= maxResults) return;
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= maxResults) break;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
              await walk(full, depth + 1);
            } else if (entry.isFile()) {
              const pattern = input.pattern.replace(/\*/g, ".*").replace(/\?/g, ".");
              if (new RegExp(`^${pattern}$`, "i").test(entry.name)) {
                results.push(full);
              }
            }
          }
        }

        await walk(input.directory, 0);
        return results.join("\n") || "No files matched the pattern.";
      } catch (e: any) {
        return `Error searching: ${e.message}`;
      }
    }

    case "fetch_url": {
      try {
        const res = await fetch(input.url, {
          method: input.method ?? "GET",
          headers: {
            "User-Agent": "Dedomena-Agent/1.0",
            ...(input.headers ?? {}),
          },
          ...(input.body ? { body: input.body } : {}),
          signal: AbortSignal.timeout(15000),
        });
        const ct = res.headers.get("content-type") ?? "";
        let text = await res.text();

        if (ct.includes("text/html")) {
          text = text
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }

        return text.slice(0, 500_000);
      } catch (e: any) {
        return `Error fetching URL: ${e.message}`;
      }
    }

    case "write_file": {
      try {
        await fs.mkdir(path.dirname(input.path), { recursive: true });
        await fs.writeFile(input.path, input.content, "utf-8");
        return `File written successfully: ${input.path} (${input.content.length} chars)`;
      } catch (e: any) {
        return `Error writing file: ${e.message}`;
      }
    }

    case "analyze_data": {
      return `[analyze_data] This tool requires client-side source data. The query "${input.query}" should be processed against the user's imported datasets.`;
    }

    case "run_shell": {
      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);
        const { stdout, stderr } = await execAsync(input.command, {
          cwd: input.cwd,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        });
        return (stdout + (stderr ? `\nSTDERR:\n${stderr}` : "")).slice(0, 500_000);
      } catch (e: any) {
        return `Shell error: ${e.message}\n${e.stderr ?? ""}`.slice(0, 5000);
      }
    }

    // ── Browser automation tools ─────────────────────────────────────────────
    case "browser_navigate": {
      try {
        const page = await getPage();
        await page.goto(input.url, { waitUntil: "networkidle2", timeout: 20000 });

        if (input.waitFor) {
          await page.waitForSelector(input.waitFor, { timeout: 5000 }).catch(() => {});
        }

        const title = await page.title();
        const text = await page.evaluate(() => {
          // Remove script/style/nav/footer content
          const clone = document.body.cloneNode(true) as HTMLElement;
          clone.querySelectorAll("script, style, nav, footer, header, noscript").forEach(el => el.remove());
          return clone.innerText?.trim().slice(0, 10000) ?? "";
        });

        const url = page.url();
        return `Navigated to: ${url}\nTitle: ${title}\n\nVisible content (first 10000 chars):\n${text}`;
      } catch (e: any) {
        return `Browser navigation error: ${e.message}`;
      }
    }

    case "browser_screenshot": {
      try {
        const page = await getPage();
        let screenshotBuffer: Buffer;

        if (input.selector) {
          const element = await page.$(input.selector);
          if (!element) return `Element not found: ${input.selector}`;
          screenshotBuffer = await element.screenshot({ type: "png" });
        } else {
          screenshotBuffer = await page.screenshot({
            type: "png",
            fullPage: input.fullPage ?? false,
          });
        }

        // Describe what we see on the page instead of sending the image
        const title = await page.title();
        const url = page.url();
        const dimensions = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
        }));

        // Extract key visible elements for the description
        const elements = await page.evaluate(() => {
          const items: string[] = [];
          // Headings
          document.querySelectorAll("h1, h2, h3").forEach(el => {
            const t = (el as HTMLElement).innerText?.trim();
            if (t) items.push(`[${el.tagName}] ${t}`);
          });
          // Buttons
          document.querySelectorAll("button, a.btn, [role='button']").forEach(el => {
            const t = (el as HTMLElement).innerText?.trim();
            if (t && t.length < 50) items.push(`[BUTTON] ${t}`);
          });
          // Input fields
          document.querySelectorAll("input, textarea, select").forEach(el => {
            const inp = el as HTMLInputElement;
            items.push(`[INPUT ${inp.type ?? "text"}] name="${inp.name}" placeholder="${inp.placeholder ?? ""}"`);
          });
          // Links
          document.querySelectorAll("a[href]").forEach(el => {
            const t = (el as HTMLElement).innerText?.trim();
            const href = (el as HTMLAnchorElement).href;
            if (t && t.length < 80) items.push(`[LINK] "${t}" -> ${href}`);
          });
          return items.slice(0, 50);
        });

        const screenshotSize = screenshotBuffer.length;
        return [
          `Screenshot captured (${screenshotSize} bytes, ${input.fullPage ? "full page" : "viewport"})`,
          `URL: ${url}`,
          `Title: ${title}`,
          `Page dimensions: ${dimensions.width}x${dimensions.height} (viewport: ${dimensions.viewportHeight}px)`,
          `\nVisible elements on page:`,
          ...elements,
        ].join("\n");
      } catch (e: any) {
        return `Screenshot error: ${e.message}`;
      }
    }

    case "browser_click": {
      try {
        const page = await getPage();

        if (input.text) {
          // Click by text content
          const clicked = await page.evaluate((text: string) => {
            const elements = [...document.querySelectorAll("a, button, [role='button'], input[type='submit'], [onclick]")];
            const el = elements.find(e => (e as HTMLElement).innerText?.trim().toLowerCase().includes(text.toLowerCase()));
            if (el) { (el as HTMLElement).click(); return true; }
            return false;
          }, input.text);

          if (!clicked) return `No clickable element found containing text: "${input.text}"`;
          await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
          return `Clicked element containing text: "${input.text}"\nCurrent URL: ${page.url()}`;
        }

        if (input.selector) {
          await page.click(input.selector);
          await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
          return `Clicked: ${input.selector}\nCurrent URL: ${page.url()}`;
        }

        return "No selector or text provided to click.";
      } catch (e: any) {
        return `Click error: ${e.message}`;
      }
    }

    case "browser_type": {
      try {
        const page = await getPage();

        if (input.clear !== false) {
          await page.click(input.selector, { clickCount: 3 });
        }

        await page.type(input.selector, input.text, { delay: 30 });

        if (input.pressEnter) {
          await page.keyboard.press("Enter");
          await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
        }

        return `Typed "${input.text}" into ${input.selector}${input.pressEnter ? " and pressed Enter" : ""}`;
      } catch (e: any) {
        return `Type error: ${e.message}`;
      }
    }

    case "browser_extract": {
      try {
        const page = await getPage();
        const multiple = input.multiple !== false;

        const results = await page.evaluate(
          (sel: string, attr: string | undefined, multi: boolean) => {
            const elements = multi
              ? [...document.querySelectorAll(sel)]
              : [document.querySelector(sel)].filter(Boolean);

            return elements.map((el: any) => {
              if (attr) return el?.getAttribute(attr) ?? "";
              return el?.innerText?.trim() ?? "";
            });
          },
          input.selector,
          input.attribute,
          multiple
        );

        if (results.length === 0) return `No elements found matching: ${input.selector}`;
        return results.slice(0, 50).join("\n---\n");
      } catch (e: any) {
        return `Extract error: ${e.message}`;
      }
    }

    case "browser_evaluate": {
      try {
        const page = await getPage();
        const result = await page.evaluate(input.code);
        return typeof result === "string" ? result : JSON.stringify(result, null, 2);
      } catch (e: any) {
        return `Evaluate error: ${e.message}`;
      }
    }

    default:
      return `Unknown tool: ${tool}`;
  }
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { task, sourcesContext, history, serviceTokens } = await req.json();

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: "Anthropic API key not configured." }, { status: 500 });
    }

    const availableServices = Object.keys(serviceTokens ?? {}).join(", ");

    const systemPrompt = `You are an autonomous operations agent inside the Dedomena enterprise data platform. You can interact with the user's local computer, browse the web, run shell commands, and natively manage enterprise applications.

CAPABILITIES:
- Read and write files on the user's local filesystem
- Control a headless browser
- Access enterprise APIs via action tools (email, messaging, CRM, project management)
${availableServices ? `- You CURRENTLY have access to these services: ${availableServices}` : "- You currently have NO services connected. Tell the user to connect them in the Data Sources tab."}

ENTERPRISE WORKFLOWS (Examples):
- "Check my email and create a Jira ticket" -> email_action(search/get) -> project_action(create_issue)
- "Send our Salesforce leads from today to Slack #sales" -> crm_action(query) -> messaging_action(post_message)
- "Find the Q1 report in Drive and email it to Sarah" -> storage_action(search) -> email_action(send)

RULES:
1. Always explain what you're about to do before using a tool.
2. After each tool use, analyze the result and decide the next step.
3. Be careful with destructive actions (sending email, posting to slack, creating records).
4. Provide a clear summary of what you accomplished at the end.
${sourcesContext ? `\nThe user has these local data sources connected:\n${sourcesContext}\n` : ""}`;

    const messages: any[] = [];

    if (Array.isArray(history) && history.length > 0) {
      messages.push(...history.slice(-20));
    }

    messages.push({ role: "user", content: task });

    const maxIterations = 15;
    const steps: Array<{ type: string; content: any }> = [];

    for (let i = 0; i < maxIterations; i++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: systemPrompt,
          messages,
          tools: AGENT_TOOLS,
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error?.message ?? `API error ${res.status}`);
      }

      const data = await res.json();
      const assistantContent = data.content;

      messages.push({ role: "assistant", content: assistantContent });

      const textParts = assistantContent
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n");

      if (textParts) {
        steps.push({ type: "thinking", content: textParts });
      }

      const toolUses = assistantContent.filter((b: any) => b.type === "tool_use");

      if (toolUses.length === 0) break;

      const toolResults: any[] = [];
      for (const tu of toolUses) {
        steps.push({ type: "tool_call", content: { tool: tu.name, input: tu.input } });

        const result = await executeTool(tu.name, tu.input, serviceTokens ?? {});
        steps.push({ type: "tool_result", content: { tool: tu.name, result: result.slice(0, 3000) } });

        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result,
        });
      }

      messages.push({ role: "user", content: toolResults });
    }

    const lastAssistant = messages.filter(m => m.role === "assistant").pop();

    const finalText = lastAssistant?.content
      ?.filter?.((b: any) => b.type === "text")
      ?.map((b: any) => b.text)
      ?.join("\n") ?? "Agent completed without a final response.";

    return NextResponse.json({ result: finalText, steps });
  } catch (error: any) {
    console.error("Agent error:", error);
    return NextResponse.json({ error: error.message ?? "Agent execution failed" }, { status: 500 });
  }
}
