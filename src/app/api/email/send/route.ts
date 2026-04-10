import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

/**
 * Send analysis reports via email.
 * Supports Resend, SendGrid, and raw SMTP.
 *
 * POST /api/email/send
 * Body: { "to": "user@company.com", "subject": "...", "body": "...", "html": "..." }
 */
export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, html } = await req.json();

    if (!to || !subject) {
      return NextResponse.json({ error: "to and subject are required" }, { status: 400 });
    }

    const provider = process.env.EMAIL_PROVIDER ?? "resend";
    const fromAddress = process.env.EMAIL_FROM ?? "reports@dedomena.app";
    const fromName = process.env.EMAIL_FROM_NAME ?? "Dedomena";

    // ── Resend ─────────────────────────────────────────────────────────────
    if (provider === "resend") {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: `${fromName} <${fromAddress}>`,
          to: Array.isArray(to) ? to : [to],
          subject,
          text: body,
          html: html ?? formatHTMLReport(subject, body),
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message ?? `Resend error: ${res.status}`);
      }

      const data = await res.json();
      return NextResponse.json({ success: true, id: data.id });
    }

    // ── SendGrid ───────────────────────────────────────────────────────────
    if (provider === "sendgrid") {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "SENDGRID_API_KEY not configured" }, { status: 500 });
      }

      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: Array.isArray(to) ? to.map((e: string) => ({ email: e })) : [{ email: to }] }],
          from: { email: fromAddress, name: fromName },
          subject,
          content: [
            { type: "text/plain", value: body },
            { type: "text/html", value: html ?? formatHTMLReport(subject, body) },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`SendGrid error: ${res.status} ${text}`);
      }

      return NextResponse.json({ success: true });
    }

    // ── SMTP (via Nodemailer) ──────────────────────────────────────────────
    if (provider === "smtp") {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: Array.isArray(to) ? to.join(", ") : to,
        subject,
        text: body,
        html: html ?? formatHTMLReport(subject, body),
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown email provider: ${provider}` }, { status: 400 });
  } catch (error: any) {
    console.error("Email send error:", error);
    return NextResponse.json({ error: error.message ?? "Email send failed" }, { status: 500 });
  }
}

function formatHTMLReport(subject: string, body: string): string {
  const bodyHtml = body
    .split("\n")
    .map(line => {
      if (line.startsWith("# ")) return `<h1 style="color:#1a1a2e;margin:16px 0 8px">${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2 style="color:#333;margin:14px 0 6px">${line.slice(3)}</h2>`;
      if (line.startsWith("- ")) return `<li style="margin:4px 0">${line.slice(2)}</li>`;
      if (line.startsWith("> ")) return `<blockquote style="border-left:3px solid #9370ff;padding-left:12px;color:#666;margin:8px 0">${line.slice(2)}</blockquote>`;
      if (line.trim() === "") return "<br/>";
      return `<p style="margin:6px 0;line-height:1.6">${line}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a2e;background:#fafafa">
  <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <div style="border-bottom:1px solid #eee;padding-bottom:16px;margin-bottom:24px">
      <h1 style="margin:0;font-size:20px;color:#1a1a2e">${subject}</h1>
      <p style="margin:8px 0 0;color:#888;font-size:13px">Generated by Dedomena &middot; ${new Date().toLocaleDateString()}</p>
    </div>
    ${bodyHtml}
  </div>
  <p style="text-align:center;color:#aaa;font-size:11px;margin-top:24px">
    Powered by <strong>Dedomena</strong> &middot; Enterprise Data Intelligence
  </p>
</body>
</html>`;
}
