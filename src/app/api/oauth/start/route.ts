import { NextRequest, NextResponse } from 'next/server';
import { OAUTH_PROVIDERS } from '@/lib/connectors/managed-oauth';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const provider    = searchParams.get('provider') ?? '';
  const connectorId = searchParams.get('connectorId') ?? '';
  const sourceId    = searchParams.get('sourceId') ?? '';
  const sourceName  = searchParams.get('sourceName') ?? '';
  const scopes      = searchParams.get('scopes') ?? '';
  const state       = searchParams.get('state') ?? Math.random().toString(36).slice(2);
  const shopDomain  = searchParams.get('shopDomain') ?? '';  // Shopify / Zendesk

  const cfg = OAUTH_PROVIDERS[provider];
  if (!cfg) {
    return new Response(errorHtml(`Unknown OAuth provider: "${provider}"`), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Check env vars
  const clientId = process.env[cfg.clientIdEnv];
  if (!clientId) {
    return new Response(
      errorHtml(
        `OAuth for ${provider} is not configured.\n\n` +
        `Add <code>${cfg.clientIdEnv}</code> and <code>${cfg.clientSecretEnv}</code> ` +
        `to your <code>.env.local</code> file, then restart the server.`
      ),
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Build auth URL (handle template URLs for Shopify/Zendesk)
  let authUrl = cfg.authUrl;
  if (shopDomain) authUrl = authUrl.replace('[shop]', shopDomain).replace('[subdomain]', shopDomain);

  const redirectUri = new URL('/api/oauth/callback', req.nextUrl.origin).toString();

  // Store meta in an httpOnly cookie (expires 10 min)
  const meta = JSON.stringify({ provider, connectorId, sourceId, sourceName, state, shopDomain });
  const jar = await cookies();
  jar.set('dedomena_oauth_meta', meta, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         scopes,
    state,
    ...cfg.additionalParams,
  });

  return NextResponse.redirect(`${authUrl}?${params}`);
}

function errorHtml(msg: string) {
  return `<!DOCTYPE html>
<html>
<head><title>Connection Error</title>
<style>
  body { font-family: system-ui; background: #0b0b0e; color: #fff; display: flex;
         align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .card { background: #1a1a24; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 32px; max-width: 480px; text-align: center; }
  h2 { color: #ef4444; margin-top: 0; }
  code { background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; }
  button { margin-top: 20px; padding: 10px 24px; background: rgba(255,255,255,0.1);
           border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #fff;
           cursor: pointer; font-size: 14px; }
</style>
</head>
<body>
  <div class="card">
    <h2>OAuth Setup Required</h2>
    <p>${msg}</p>
    <button onclick="window.close()">Close</button>
  </div>
</body>
</html>`;
}
