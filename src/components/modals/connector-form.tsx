"use client";

import { useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { Connector, ConnectorField, CredentialMap } from "@/lib/connectors/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CredentialStorage } from "@/store/credential-store";
import { initiateOAuth } from "@/lib/connectors/oauth";
import { runClientFetcher } from "@/lib/connectors/fetchers";
import { ContentStorage } from "@/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ConnectorFormProps {
  connector: Connector;
  onAdd: (result: { name: string; type: string; content: string }) => void;
  onBack: () => void;
}

export function ConnectorForm({ connector, onAdd, onBack }: ConnectorFormProps) {
  const sourceId = useState(() => Math.random().toString(36).slice(2, 11))[0];
  const [name, setName] = useState(connector.name);
  const [values, setValues] = useState<CredentialMap>(() => CredentialStorage.get(sourceId) ?? {});
  const [loading, setLoading] = useState(false);

  const set = (key: string, val: string) => setValues(prev => ({ ...prev, [key]: val }));

  // Special case: local file picker
  if (connector.id === 'local-file') {
    return <LocalFileForm name={name} setName={setName} onAdd={onAdd} onBack={onBack} />;
  }

  // Special case: paste text
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
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-quartz-500 resize-none"
          />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button
            onClick={() => {
              if (!values.content?.trim()) return toast.error('Nothing to import');
              onAdd({ name, type: connector.id, content: values.content });
            }}
          >
            Import
          </Button>
        </div>
      </div>
    );
  }

  const visibleFields = connector.fields.filter(f => {
    if (!f.dependsOn) return true;
    return values[f.dependsOn.field] === f.dependsOn.value;
  });

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

  const handleOAuth = async () => {
    const missingClientId = connector.oauth?.clientIdField && !values[connector.oauth.clientIdField];
    if (missingClientId) {
      toast.error('Enter the Client ID first');
      return;
    }
    // Store name so callback can use it
    await initiateOAuth(connector, values, sourceId, name);
    // Page will redirect — no further code runs here
  };

  const hasOAuthButton = visibleFields.some(f => f.type === 'oauth_button');
  const nonOAuthFields = visibleFields.filter(f => f.type !== 'oauth_button');
  const requiredMissing = nonOAuthFields.some(f => f.required && !values[f.key]?.trim());

  return (
    <div className="space-y-4">
      {/* Source name */}
      <Input label="Source Name" value={name} onChange={e => setName(e.target.value)} />

      {/* Dynamic fields */}
      {visibleFields.map(field => (
        <FieldRenderer key={field.key} field={field} value={values[field.key] ?? ''} onChange={v => set(field.key, v)} />
      ))}

      {/* Footer */}
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        {hasOAuthButton ? (
          <Button onClick={handleOAuth} disabled={loading}>
            Connect with OAuth <ExternalLink size={13} className="ml-1.5" />
          </Button>
        ) : (
          <Button onClick={connect} disabled={loading || requiredMissing}>
            {loading ? <RefreshCw size={14} className="animate-spin mr-2" /> : null}
            {loading ? 'Connecting…' : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Field renderer ─────────────────────────────────────────────────────────────
function FieldRenderer({ field, value, onChange }: { field: ConnectorField; value: string; onChange: (v: string) => void }) {
  if (field.type === 'oauth_button') return null; // rendered separately above

  if (field.type === 'select') {
    return (
      <div className="space-y-1.5 flex flex-col">
        <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{field.label}</label>
        <select
          aria-label={field.label}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-quartz-500"
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
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-quartz-500 resize-none font-mono"
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
function LocalFileForm({ name, setName, onAdd, onBack }: any) {
  const [loading, setLoading] = useState(false);

  const pick = async () => {
    if (!(window as any).showOpenFilePicker) {
      return toast.error('Your browser does not support the File System Access API');
    }
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: 'Text files', accept: { 'text/*': ['.txt', '.csv', '.json', '.md', '.html', '.xml', '.yaml', '.yml'] } }],
      });
      setLoading(true);
      const file = await handle.getFile();
      const content = await file.text();
      onAdd({ name: name || file.name, type: 'local-file', content });
      toast.success(`Linked: ${file.name}`);
    } catch (e: any) {
      if (e.name !== 'AbortError') toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-white/50 text-xs bg-quartz-500/10 p-4 rounded-xl border border-quartz-500/20">
        Creates a live browser link — re-sync from your hard drive any time without re-uploading.
      </div>
      <Input label="Source Name (optional)" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="My Dataset" />
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={pick} disabled={loading}>
          {loading ? <RefreshCw size={14} className="animate-spin mr-2" /> : null}
          Select File
        </Button>
      </div>
    </div>
  );
}
