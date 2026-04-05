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
import { ContentType } from "@/store";

interface ConnectorFormProps {
  connector: Connector;
  onAdd: (result: { name: string; type: string; content: string; contentType?: ContentType }) => void;
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

// ── Local file form — accepts any file type ────────────────────────────────────
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
    reader.onload = () => resolve(reader.result as string); // data:mime;base64,xxx
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

async function extractFileContent(file: File): Promise<{ content: string; contentType: 'text' | 'image' | 'pdf' | 'spreadsheet' }> {
  const ct = detectContentType(file);

  if (ct === 'image' || ct === 'pdf') {
    // Store as base64 data URL — Claude handles these natively
    const dataUrl = await readFileAsBase64(file);
    return { content: dataUrl, contentType: ct };
  }

  if (ct === 'spreadsheet' && file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
    // Parse Excel to CSV text using SheetJS
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheets = wb.SheetNames.map(sn => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn]);
        return `=== Sheet: ${sn} ===\n${csv}`;
      });
      return { content: sheets.join('\n\n'), contentType: 'spreadsheet' };
    } catch {
      // Fallback: read as text
      return { content: await file.text(), contentType: 'text' };
    }
  }

  // Everything else: read as plain text
  return { content: await file.text(), contentType: 'text' };
}

function LocalFileForm({ name, setName, onAdd, onBack }: any) {
  const [loading, setLoading] = useState(false);
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

  const pick = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) await processFile(file);
    };
    input.click();
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  return (
    <div className="space-y-4">
      <Input label="Source Name (optional)" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="My Dataset" />

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={pick}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          dragOver ? "border-quartz-500/60 bg-quartz-500/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
        )}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-white/40" />
            <p className="text-sm text-white/50">Processing file…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <p className="text-3xl">📂</p>
            <div>
              <p className="text-sm text-white/70 font-medium">Drop any file here, or click to browse</p>
              <p className="text-xs text-white/30 mt-1">
                PDF · Images · Excel · Word · CSV · JSON · Markdown · any text format
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILE_TYPES.map(ft => (
          <span key={ft.label} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/5">
            {ft.label}
          </span>
        ))}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/5">+ more</span>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onBack}>Back</Button>
      </div>
    </div>
  );
}
