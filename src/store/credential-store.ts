import { CredentialMap } from '@/lib/connectors/types';

// OAuth tokens → sessionStorage (expire with session)
// API keys / secrets → localStorage (persist across sessions)
const SESSION_KEY = 'dedomena_creds_session';
const LOCAL_KEY   = 'dedomena_creds_v1';


function readSession(): Record<string, CredentialMap> {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}'); } catch { return {}; }
}
function readLocal(): Record<string, CredentialMap> {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}'); } catch { return {}; }
}
function writeSession(store: Record<string, CredentialMap>) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(store)); } catch {}
}
function writeLocal(store: Record<string, CredentialMap>) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(store)); } catch {}
}

export const CredentialStorage = {
  // Save OAuth tokens — sessionStorage so tokens don't linger if user closes browser
  saveOAuth(sourceId: string, tokens: CredentialMap) {
    const s = readSession();
    s[sourceId] = tokens;
    writeSession(s);
    // Also persist non-sensitive oauth metadata (clientId) to localStorage
    const l = readLocal();
    const safe = Object.fromEntries(Object.entries(tokens).filter(([k]) => k === 'clientId'));
    if (Object.keys(safe).length) { l[sourceId] = { ...(l[sourceId] ?? {}), ...safe }; writeLocal(l); }
  },

  // Save API key credentials — localStorage for persistence
  saveApiKey(sourceId: string, creds: CredentialMap) {
    const l = readLocal();
    l[sourceId] = creds;
    writeLocal(l);
  },

  // Get credentials for a source — tries sessionStorage first, then localStorage
  get(sourceId: string): CredentialMap | null {
    const s = readSession();
    if (s[sourceId]) return s[sourceId];
    const l = readLocal();
    return l[sourceId] ?? null;
  },

  // Delete from both stores
  del(sourceId: string) {
    const s = readSession(); delete s[sourceId]; writeSession(s);
    const l = readLocal();   delete l[sourceId]; writeLocal(l);
  },

  // Check if an OAuth token is expired
  isExpired(sourceId: string): boolean {
    const creds = this.get(sourceId);
    if (!creds?.expiresAt) return false;
    return Date.now() > Number(creds.expiresAt);
  },
};
