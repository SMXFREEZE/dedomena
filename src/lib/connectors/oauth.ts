import { Connector, CredentialMap } from './types';

const PENDING_KEY = 'dedomena_oauth_pending';

interface PendingOAuth {
  sourceId: string;
  connectorId: string;
  sourceName: string;
  codeVerifier?: string;
}

export interface OAuthCallbackResult {
  sourceId: string;
  connectorId: string;
  sourceName: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────
function randomBase64url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function sha256Base64url(plain: string): Promise<string> {
  const encoded = new TextEncoder().encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Initiate OAuth redirect ───────────────────────────────────────────────────
export async function initiateOAuth(
  connector: Connector,
  credentials: CredentialMap,
  sourceId: string,
  sourceName: string
): Promise<void> {
  const oauthCfg = connector.oauth;
  if (!oauthCfg) throw new Error(`Connector ${connector.id} has no OAuth config`);

  const clientIdField = oauthCfg.clientIdField ?? 'clientId';
  const clientId = credentials[clientIdField];
  if (!clientId) throw new Error(`Client ID is required to authenticate`);

  const redirectUri = window.location.origin + '/';
  const codeVerifier = randomBase64url(64);
  const codeChallenge = await sha256Base64url(codeVerifier);

  const pending: PendingOAuth = { sourceId, connectorId: connector.id, sourceName, codeVerifier };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',        // implicit flow for SPAs — works for all current connectors
    scope: oauthCfg.scopes.join(' '),
    state: btoa(JSON.stringify({ sourceId, connectorId: connector.id, sourceName })),
    code_challenge: codeChallenge, // some providers accept this even in implicit flow
    code_challenge_method: 'S256',
    ...oauthCfg.additionalParams,
  });

  window.location.href = `${oauthCfg.authUrl}?${params}`;
}

// ── Detect OAuth callback ─────────────────────────────────────────────────────
export function detectOAuthCallback(): OAuthCallbackResult | null {
  // Implicit flow — token arrives in hash fragment
  const hash = window.location.hash;
  if (hash.includes('access_token=')) {
    const p = new URLSearchParams(hash.slice(1));
    const accessToken = p.get('access_token');
    if (!accessToken) return null;

    const pending = readPending();
    if (!pending) return null;

    return {
      sourceId: pending.sourceId,
      connectorId: pending.connectorId,
      sourceName: pending.sourceName,
      accessToken,
      expiresIn: p.get('expires_in') ? Number(p.get('expires_in')) : undefined,
    };
  }

  // Authorization code flow — code arrives in query string
  const qs = new URLSearchParams(window.location.search);
  const code = qs.get('code');
  if (code) {
    const pending = readPending();
    if (!pending) return null;
    // PKCE exchange must be done asynchronously by caller via exchangeCode()
    // We return a sentinel so page.tsx can call exchangeCode()
    return {
      sourceId: pending.sourceId,
      connectorId: pending.connectorId,
      sourceName: pending.sourceName,
      accessToken: `__code__:${code}:${pending.codeVerifier ?? ''}`,
    };
  }

  return null;
}

// ── Exchange authorization code for token (PKCE) ──────────────────────────────
export async function exchangeCode(
  code: string,
  codeVerifier: string,
  connector: Connector,
  credentials: CredentialMap
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const oauthCfg = connector.oauth;
  if (!oauthCfg) throw new Error('No OAuth config');

  const tokenUrlMap: Record<string, string> = {
    'https://accounts.google.com/o/oauth2/v2/auth':
      'https://oauth2.googleapis.com/token',
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize':
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  };
  const tokenUrl = tokenUrlMap[oauthCfg.authUrl];
  if (!tokenUrl) throw new Error(`No token URL known for ${connector.id}`);

  const clientIdField = oauthCfg.clientIdField ?? 'clientId';
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: window.location.origin + '/',
      client_id: credentials[clientIdField] ?? '',
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error_description || `Token exchange failed: ${res.status}`);
  }
  const d = await res.json();
  return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresIn: d.expires_in };
}

// ── Clean OAuth artifacts from URL ───────────────────────────────────────────
export function cleanOAuthFromUrl(): void {
  history.replaceState(null, '', window.location.pathname);
  sessionStorage.removeItem(PENDING_KEY);
}

// ── Internal helpers ──────────────────────────────────────────────────────────
function readPending(): PendingOAuth | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingOAuth) : null;
  } catch {
    return null;
  }
}
