"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ExternalLink, Zap, Key, ChevronDown, ChevronUp } from "lucide-react";
import { Connector, ConnectorField, CredentialMap, ManagedOAuthOption } from "@/lib/connectors/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CredentialStorage } from "@/store/credential-store";
import { initiateOAuth } from "@/lib/connectors/oauth";
import { runClientFetcher } from "@/lib/connectors/fetchers";
import { ConnectorIcon } from "@/components/ui/connector-icon";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ContentType } from "@/store";

interface ConnectorFormProps {
  connector: Connector;
  onAdd: (result: { name: string; type: string; content: string; contentType?: ContentType }) => void;
  onBack: () => void;
}

// ── OAuth result payload (sent via postMessage from /api/oauth/callback) ─────

interface OAuthResultMessage {
  type:         'dedomena_oauth_result';
  sourceId:     string;
  connectorId?: string;
  sourceName?:  string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?:  number;
  error?:      string;
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function ConnectorForm({ connector, onAdd, onBack }: ConnectorFormProps) {
  const sourceId = useState(() => Math.random().toString(36).slice(2, 11))[0];
  const [name, setName]   = useState(connector.name);
  const [values, setValues] = useState<CredentialMap>(() => CredentialStorage.get(sourceId) ?? {});
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(!connector.managedOAuth?.length);

  const set = (key: string, val: string) => setValues(prev => ({ ...prev, [key]: val }));

  // ── Listen for postMessage from OAuth popup ──────────────────────────────────
  const handleOAuthMessage = useCallback(async (e: MessageEvent<OAuthResultMessage>) => {
    if (e.data?.type !== 'dedomena_oauth_result') return;
    if (e.data.sourceId !== sourceId) return;

    setOauthLoading(null);

    if (e.data.error) {
      toast.error(`Authentication failed: ${e.data.error}`);
      return;
    }

    const { accessToken, refreshToken, expiresIn, connectorId, sourceName } = e.data;
    if (!accessToken) return;

    CredentialStorage.saveOAuth(sourceId, {
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
      ...(expiresIn   ? { expiresAt: String(Date.now() + expiresIn * 1000) } : {}),
    });

    const toastId = toast.loading(`Fetching data from ${sourceName ?? name}…`);
    try {
      const content = await runClientFetcher(connectorId ?? connector.id, { accessToken });
      toast.success('Connected', { id: toastId });
      onAdd({ name: sourceName ?? name, type: connector.id, content });
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  }, [sourceId, connector.id, name, onAdd]);

  useEffect(() => {
    const handler = (e: Event) => handleOAuthMessage(e as unknown as MessageEvent<OAuthResultMessage>);
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleOAuthMessage]);

  // ── Special case: local file ──────────────────────────────────────────────
  if (connector.id === 'local-file') {
    return <LocalFileForm name={name} setName={setName} onAdd={onAdd} onBack={onBack} />;
  }

  // ── Special case: paste text ──────────────────────────────────────────────
  if (connector.id === 'paste') {
    return (
      <div className="space-y-4">
        <Input label="Source Name" value={name} onChange={e => setName(e.target.value)} />
        <div className="space-y-1.5 flex flex-col">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Content</label>
          <textarea
            value={values.content ?? ''}
            onChange={e => set('content', e.target.value)}
            placeholder="Paste any text, JSON, CSV, or markdown…"
            rows={10}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
          />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button onClick={() => {
            if (!values.content?.trim()) return toast.error('Nothing to import');
            onAdd({ name, type: connector.id, content: values.content });
          }}>Import</Button>
        </div>
      </div>
    );
  }

  // ── Start managed OAuth (popup flow) ────────────────────────────────────────
  const startManagedOAuth = (opt: ManagedOAuthOption) => {
    // If this provider needs a field value first, validate it
    if (opt.requiresField && !values[opt.requiresField]?.trim()) {
      toast.error(`Please enter the required field first.`);
      return;
    }

    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      provider:    opt.provider,
      connectorId: connector.id,
      sourceId,
      sourceName:  name,
      scopes:      opt.scopes.join(' '),
      state,
    });

    // Pass shop domain / subdomain if needed
    if (opt.requiresField && values[opt.requiresField]) {
      params.set('shopDomain', values[opt.requiresField]);
    }

    const popup = window.open(
      `/api/oauth/start?${params}`,
      'dedomena_oauth',
      'width=620,height=720,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      toast.error('Popup was blocked. Allow popups for this site and try again.');
      return;
    }

    setOauthLoading(opt.provider);

    // Detect if popup was manually closed
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        setOauthLoading(prev => prev === opt.provider ? null : prev);
      }
    }, 600);
  };

  // ── Legacy client-side OAuth (some connectors still use it) ─────────────────
  const startLegacyOAuth = async () => {
    const missingClientId = connector.oauth?.clientIdField && !values[connector.oauth.clientIdField];
    if (missingClientId) { toast.error('Enter the Client ID first'); return; }
    await initiateOAuth(connector, values, sourceId, name);
  };

  // ── Manual connect ───────────────────────────────────────────────────────────
  const connect = async () => {
    setLoading(true);
    try {
      let content: string;
      if (connector.executionMode === 'server') {
        const res = await fetch('/api/connector/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectorId: connector.id, credentials: values }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Connection failed');
        content = data.content;
        const count = data.recordCount ? ` · ${data.recordCount.toLocaleString()} records` : '';
        toast.success(`${name} connected${count}`);
      } else {
        content = await runClientFetcher(connector.id, values);
        toast.success(`${name} connected`);
      }
      CredentialStorage.saveApiKey(sourceId, values);
      onAdd({ name, type: connector.id, content });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const hasManagedOAuth = (connector.managedOAuth?.length ?? 0) > 0;
  const hasLegacyOAuth  = !!connector.oauth;

  // Fields visible for manual path
  const visibleFields = connector.fields.filter(f => {
    if (f.type === 'oauth_button') return false;
    if (!f.dependsOn) return true;
    return values[f.dependsOn.field] === f.dependsOn.value;
  });
  const requiredMissing = visibleFields.some(f => f.required && !values[f.key]?.trim());

  // Fields that must be shown before OAuth (e.g. shop domain, org URL)
  const preOAuthFields = hasManagedOAuth
    ? visibleFields.filter(f => connector.managedOAuth!.some(o => o.requiresField === f.key))
    : [];

  const isAnyOAuthLoading = oauthLoading !== null;

  return (
    <div className="space-y-5">
      {/* Source name */}
      <Input label="Source Name" value={name} onChange={e => setName(e.target.value)} />

      {/* ── Pre-OAuth required fields (e.g. Shopify store domain) ── */}
      {preOAuthFields.map(field => (
        <FieldRenderer key={field.key} field={field} value={values[field.key] ?? ''} onChange={v => set(field.key, v)} />
      ))}

      {/* ── OPTION 1: Managed OAuth ── */}
      {hasManagedOAuth && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-[#18bfff]" />
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Option 1 — Connect Instantly</span>
          </div>

          <div className="space-y-2">
            {connector.managedOAuth!.map(opt => (
              <OAuthButton
                key={opt.provider}
                option={opt}
                loading={oauthLoading === opt.provider}
                disabled={isAnyOAuthLoading || loading}
                onClick={() => startManagedOAuth(opt)}
              />
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-white/10" />
            <button
              type="button"
              onClick={() => setShowManual(p => !p)}
              className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors"
            >
              <Key size={10} />
              {showManual ? 'Hide manual setup' : 'Or connect manually'}
              {showManual ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </div>
      )}

      {/* Legacy OAuth button (fallback for older connectors) */}
      {hasLegacyOAuth && !hasManagedOAuth && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-[#18bfff]" />
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Option 1 — Connect via OAuth</span>
          </div>
          <button
            type="button"
            onClick={startLegacyOAuth}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-medium text-white transition-all"
          >
            <ConnectorIcon iconSlug={connector.iconSlug} name={connector.name} color={connector.color} size={18} />
            Connect with {connector.name}
            <ExternalLink size={13} className="text-white/40" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <button type="button" onClick={() => setShowManual(p => !p)}
              className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors">
              <Key size={10} />
              {showManual ? 'Hide manual setup' : 'Or enter credentials manually'}
              {showManual ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </div>
      )}

      {/* ── OPTION 2: Manual credentials ── */}
      {showManual && (
        <div className="space-y-4">
          {hasManagedOAuth && (
            <div className="flex items-center gap-2 mb-1">
              <Key size={12} className="text-white/30" />
              <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Option 2 — API / Credentials</span>
            </div>
          )}

          {/* Fields that aren't pre-OAuth fields */}
          {visibleFields
            .filter(f => !preOAuthFields.includes(f))
            .map(field => (
              <FieldRenderer key={field.key} field={field} value={values[field.key] ?? ''} onChange={v => set(field.key, v)} />
            ))
          }

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="ghost" onClick={onBack} disabled={loading || isAnyOAuthLoading}>Back</Button>
            <Button onClick={connect} disabled={loading || requiredMissing || isAnyOAuthLoading}>
              {loading ? <RefreshCw size={14} className="animate-spin mr-2" /> : null}
              {loading ? 'Connecting…' : 'Connect'}
            </Button>
          </div>
        </div>
      )}

      {/* If no manual path and no OAuth, just show back */}
      {!showManual && !hasManagedOAuth && !hasLegacyOAuth && (
        <div className="flex gap-3 justify-end pt-1">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button onClick={connect} disabled={loading || requiredMissing}>
            {loading ? <RefreshCw size={14} className="animate-spin mr-2" /> : null}
            {loading ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      )}

      {/* When only OAuth options shown (no manual), still have a back button */}
      {!showManual && (hasManagedOAuth || hasLegacyOAuth) && (
        <div className="flex justify-start">
          <Button variant="ghost" onClick={onBack} disabled={isAnyOAuthLoading}>Back</Button>
        </div>
      )}
    </div>
  );
}

// ── Managed OAuth Button ───────────────────────────────────────────────────────

function OAuthButton({ option, loading, disabled, onClick }: {
  option:   ManagedOAuthOption;
  loading:  boolean;
  disabled: boolean;
  onClick:  () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left",
        loading
          ? "border-white/20 bg-white/5 cursor-wait"
          : "border-white/15 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/25",
        disabled && !loading && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Provider icon */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/5">
        {loading
          ? <RefreshCw size={16} className="animate-spin text-white/50" />
          : <ConnectorIcon iconSlug={option.iconSlug} name={option.label} color={option.color ?? '#888'} size={18} />
        }
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white/90">{option.label}</div>
        <div className="text-[11px] text-white/35 mt-0.5">
          {loading ? 'Waiting for authentication…' : 'One-click · Secure · No credentials stored'}
        </div>
      </div>

      {!loading && <ExternalLink size={13} className="text-white/25 shrink-0" />}
    </button>
  );
}

// ── Field renderer ─────────────────────────────────────────────────────────────
function FieldRenderer({ field, value, onChange }: { field: ConnectorField; value: string; onChange: (v: string) => void }) {
  if (field.type === 'oauth_button') return null;

  if (field.type === 'select') {
    return (
      <div className="space-y-1.5 flex flex-col">
        <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{field.label}</label>
        <select
          aria-label={field.label}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
        >
          {field.options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {field.helpText && <p className="text-[11px] text-white/30">{field.helpText}</p>}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="space-y-1.5 flex flex-col">
        <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{field.label}</label>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none font-mono"
        />
        {field.helpText && <p className="text-[11px] text-white/30">{field.helpText}</p>}
      </div>
    );
  }

  return (
    <Input
      label={field.label}
      type={field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : field.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      helpText={field.helpText}
    />
  );
}

// ── Local file form ────────────────────────────────────────────────────────────
const FILE_TYPES: { ext: string[]; mime: string[]; label: string }[] = [
  { ext: ['.txt','.md','.html','.xml','.yaml','.yml','.log','.rtf'], mime: ['text/*'], label: 'Text' },
  { ext: ['.csv'], mime: ['text/csv'], label: 'CSV' },
  { ext: ['.json','.jsonl','.ndjson'], mime: ['application/json'], label: 'JSON' },
  { ext: ['.pdf'], mime: ['application/pdf'], label: 'PDF' },
  { ext: ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.tiff'], mime: ['image/*'], label: 'Image' },
  { ext: ['.xlsx','.xls','.xlsm'], mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], label: 'Excel' },
  { ext: ['.docx','.doc'], mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], label: 'Word' },
  { ext: ['.pptx','.ppt'], mime: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], label: 'PowerPoint' },
];

function detectContentType(file: File): 'text' | 'image' | 'pdf' | 'spreadsheet' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return 'pdf';
  if (file.name.match(/\.(xlsx|xls|xlsm|csv)$/i)) return 'spreadsheet';
  return 'text';
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

async function extractFileContent(file: File): Promise<{ content: string; contentType: 'text' | 'image' | 'pdf' | 'spreadsheet' }> {
  const ct = detectContentType(file);
  if (ct === 'image' || ct === 'pdf') {
    return { content: await readFileAsBase64(file), contentType: ct };
  }
  if (ct === 'spreadsheet' && file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
    try {
      const XLSX = await import('xlsx');
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array' });
      const sheets = wb.SheetNames.map(sn => `=== Sheet: ${sn} ===\n${XLSX.utils.sheet_to_csv(wb.Sheets[sn])}`);
      return { content: sheets.join('\n\n'), contentType: 'spreadsheet' };
    } catch {
      return { content: await file.text(), contentType: 'text' };
    }
  }
  return { content: await file.text(), contentType: 'text' };
}

function LocalFileForm({ name, setName, onAdd, onBack }: any) {
  const [loading, setLoading]   = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processFile = async (file: File) => {
    setLoading(true);
    try {
      const { content, contentType } = await extractFileContent(file);
      onAdd({ name: name || file.name, type: 'local-file', content, contentType });
      toast.success(`Imported: ${file.name}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = async () => { const f = input.files?.[0]; if (f) await processFile(f); };
    input.click();
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) await processFile(f);
  };

  return (
    <div className="space-y-4">
      <Input label="Source Name (optional)" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="My Dataset" />
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={pick}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          dragOver ? "border-[#18bfff]/60 bg-[#18bfff]/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
        )}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-white/40" />
            <p className="text-sm text-white/50">Processing file…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="text-3xl">📂</div>
            <div>
              <p className="text-sm text-white/70 font-medium">Drop any file here, or click to browse</p>
              <p className="text-xs text-white/30 mt-1">PDF · Images · Excel · Word · CSV · JSON · Markdown · any text format</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILE_TYPES.map(ft => (
          <span key={ft.label} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/5">{ft.label}</span>
        ))}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/5">+ more</span>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onBack}>Back</Button>
      </div>
    </div>
  );
}
