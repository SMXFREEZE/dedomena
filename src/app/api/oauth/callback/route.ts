import { NextRequest } from 'next/server';
import { OAUTH_PROVIDERS } from '@/lib/connectors/managed-oauth';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');

  // Read stored meta cookie
  const jar = await cookies();
  const rawMeta = jar.get('dedomena_oauth_meta')?.value;
  jar.delete('dedomena_oauth_meta');

  if (!rawMeta) {
    return postMessageHtml(null, null, 'OAuth session expired or invalid. Please try again.');
  }

  let meta: { provider: string; connectorId: string; sourceId: string; sourceName: string; state: string; shopDomain?: string };
  try {
    meta = JSON.parse(rawMeta);
  } catch {
    return postMessageHtml(null, null, 'Malformed OAuth session data.');
  }

  // CSRF check
  if (state && meta.state && state !== meta.state) {
    return postMessageHtml(meta, null, 'OAuth state mismatch — possible CSRF attack. Please try again.');
  }

  if (error) {
    return postMessageHtml(meta, null, errorDesc ?? error);
  }

  if (!code) {
    return postMessageHtml(meta, null, 'No authorization code received from provider.');
  }

  const cfg = OAUTH_PROVIDERS[meta.provider];
  if (!cfg) {
    return postMessageHtml(meta, null, `Unknown provider: ${meta.provider}`);
  }

  const clientId     = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];
  if (!clientId || !clientSecret) {
    return postMessageHtml(meta, null, `OAuth credentials for ${meta.provider} are not configured on the server.`);
  }

  // Handle template URLs
  let tokenUrl = cfg.tokenUrl;
  if (meta.shopDomain) tokenUrl = tokenUrl.replace('[shop]', meta.shopDomain).replace('[subdomain]', meta.shopDomain);

  const redirectUri = new URL('/api/oauth/callback', req.nextUrl.origin).toString();

  try {
    const body = new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id:    clientId,
      client_secret: clientSecret,
    });

    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };

    // Some providers require Basic auth for token exchange
    if (cfg.tokenAuthMethod === 'basic') {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    }

    const res = await fetch(tokenUrl, { method: 'POST', headers, body });
    const data = await res.json();

    if (!res.ok || data.error) {
      const msg = data.error_description ?? data.error ?? `Token exchange failed (${res.status})`;
      return postMessageHtml(meta, null, msg);
    }

    // Different providers use different field names
    const accessToken  = data.access_token ?? data.token;
    const refreshToken = data.refresh_token;
    const expiresIn    = data.expires_in;

    if (!accessToken) {
      return postMessageHtml(meta, null, 'Provider returned no access token.');
    }

    return postMessageHtml(meta, { accessToken, refreshToken, expiresIn });

  } catch (err: any) {
    return postMessageHtml(meta, null, err.message ?? 'Token exchange request failed.');
  }
}

// ── Build the response HTML that closes the popup ──────────────────────────────

type OAuthSuccess = { accessToken: string; refreshToken?: string; expiresIn?: number };

function postMessageHtml(
  meta: { provider: string; connectorId: string; sourceId: string; sourceName: string } | null,
  success: OAuthSuccess | null,
  error?: string
) {
  const payload = success
    ? JSON.stringify({
        type:         'dedomena_oauth_result',
        sourceId:     meta!.sourceId,
        connectorId:  meta!.connectorId,
        sourceName:   meta!.sourceName,
        accessToken:  success.accessToken,
        refreshToken: success.refreshToken ?? null,
        expiresIn:    success.expiresIn ?? null,
      })
    : JSON.stringify({
        type:      'dedomena_oauth_result',
        sourceId:  meta?.sourceId ?? null,
        error:     error ?? 'Unknown error',
      });

  const html = `<!DOCTYPE html>
<html>
<head>
<title>${success ? 'Connected' : 'Error'}</title>
<style>
  body { font-family: system-ui; background: #0b0b0e; color: #fff; display: flex;
         align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
  .icon { font-size: 48px; margin-bottom: 12px; }
  h2 { margin: 0 0 8px; font-size: 20px; }
  p  { color: rgba(255,255,255,0.5); font-size: 14px; margin: 0; }
</style>
</head>
<body>
  <div>
    <div class="icon">${success ? '✓' : '✕'}</div>
    <h2>${success ? `Connected` : 'Connection Failed'}</h2>
    <p>${success ? 'You can close this window.' : (error ?? 'Unknown error')}</p>
  </div>
  <script>
    (function() {
      var payload = ${payload};
      if (window.opener) {
        window.opener.postMessage(payload, window.location.origin);
        window.close();
      } else {
        // Fallback: redirect with hash (tab flow, not popup)
        var encoded = encodeURIComponent(JSON.stringify(payload));
        window.location.href = '/?dedomena_oauth=' + encoded;
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
