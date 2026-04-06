"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Connector, ConnectorField, CredentialMap } from "@/lib/connectors/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CredentialStorage } from "@/store/credential-store";
import { runClientFetcher } from "@/lib/connectors/fetchers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ContentType } from "@/store";

type AddResult = { name: string; type: string; content: string; contentType?: ContentType };

interface ConnectorFormProps {
  connector: Connector;
  onAdd: (result: AddResult) => void;
  onAddSilent?: (result: AddResult) => void;
  onBack: () => void;
}

export function ConnectorForm({ connector, onAdd, onAddSilent, onBack }: ConnectorFormProps) {
  const sourceId = useState(() => Math.random().toString(36).slice(2, 11))[0];
  const [name, setName]     = useState(connector.name);
  const [values, setValues] = useState<CredentialMap>(() => CredentialStorage.get(sourceId) ?? {});
  const [loading, setLoading] = useState(false);

  const set = (key: string, val: string) => setValues(prev => ({ ...prev, [key]: val }));

  // ── Local file ────────────────────────────────────────────────────────────
  if (connector.id === 'local-file') {
    return <LocalFileForm name={name} setName={setName} onAdd={onAdd} onAddSilent={onAddSilent} onBack={onBack} />;
  }

  if (connector.id === 'screen-capture') {
    return <ScreenCaptureForm name={name} setName={setName} onAdd={onAdd} onBack={onBack} />;
  }

  // ── Paste text ────────────────────────────────────────────────────────────
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

  // ── Standard credentials form ─────────────────────────────────────────────
  const visibleFields = connector.fields.filter(f => {
    if (f.type === 'oauth_button') return false;
    if (!f.dependsOn) return true;
    return values[f.dependsOn.field] === f.dependsOn.value;
  });

  const requiredMissing = visibleFields.some(f => f.required && !values[f.key]?.trim());

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

  return (
    <div className="space-y-4">
      <Input label="Source Name" value={name} onChange={e => setName(e.target.value)} />

      {visibleFields.map(field => (
        <FieldRenderer key={field.key} field={field} value={values[field.key] ?? ''} onChange={v => set(field.key, v)} />
      ))}

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onBack} disabled={loading}>Back</Button>
        <Button onClick={connect} disabled={loading || requiredMissing}>
          {loading ? <RefreshCw size={14} className="animate-spin mr-2" /> : null}
          {loading ? 'Connecting…' : 'Connect'}
        </Button>
      </div>
    </div>
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
const FILE_TYPES: { label: string }[] = [
  { label: 'Text' }, { label: 'CSV' }, { label: 'JSON' },
  { label: 'PDF' }, { label: 'Image' }, { label: 'Excel' },
  { label: 'Word' }, { label: 'PowerPoint' },
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

function LocalFileForm({ name, setName, onAdd, onAddSilent, onBack }: any) {
  const [dragOver, setDragOver]     = useState(false);
  const [pickMode, setPickMode]     = useState<'files' | 'folder'>('files');
  const [progress, setProgress]     = useState<{ done: number; total: number } | null>(null);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    if (files.length === 1) {
      // Single file — use onAdd which closes the modal
      try {
        const { content, contentType } = await extractFileContent(files[0]);
        onAdd({ name: name || files[0].name, type: 'local-file', content, contentType });
      } catch (e: any) {
        toast.error(e.message);
      }
      return;
    }

    // Multiple files — add silently, show progress, close when done
    setProgress({ done: 0, total: files.length });
    let done = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        const { content, contentType } = await extractFileContent(file);
        (onAddSilent ?? onAdd)({ name: file.name, type: 'local-file', content, contentType });
      } catch {
        errors.push(file.name);
      }
      done++;
      setProgress({ done, total: files.length });
    }

    if (errors.length > 0) {
      toast.error(`${errors.length} file(s) failed to import`);
    }
    const imported = files.length - errors.length;
    if (imported > 0) {
      toast.success(`${imported} file${imported > 1 ? 's' : ''} imported`);
    }
    setProgress(null);
    onBack(); // return to catalog; modal stays open so user can add more or close
  };

  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    if (pickMode === 'folder') {
      (input as any).webkitdirectory = true;
    } else {
      input.multiple = true;
      input.accept = '*/*';
    }
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      await processFiles(files);
    };
    input.click();
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    await processFiles(files);
  };

  const isLoading = progress !== null;

  return (
    <div className="space-y-4">
      <Input label="Source Name (optional — used for single file)" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="My Dataset" />

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
        {(['files', 'folder'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setPickMode(m)}
            className={cn(
              "flex-1 py-1.5 rounded-md text-xs font-medium transition-all capitalize",
              pickMode === m ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
            )}
          >
            {m === 'files' ? 'Multiple Files' : 'Folder'}
          </button>
        ))}
      </div>

      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={isLoading ? undefined : pick}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-all",
          isLoading ? "cursor-default border-white/10" : "cursor-pointer",
          dragOver ? "border-[#18bfff]/60 bg-[#18bfff]/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
        )}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-white/40" />
            <p className="text-sm text-white/50">
              Processing {progress!.done} / {progress!.total} files…
            </p>
            <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#18bfff]/60 rounded-full transition-all"
                style={{ '--p': `${(progress!.done / progress!.total) * 100}%`, width: 'var(--p)' } as React.CSSProperties}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="text-3xl">{pickMode === 'folder' ? '📁' : '📂'}</div>
            <div>
              {pickMode === 'folder' ? (
                <>
                  <p className="text-sm text-white/70 font-medium">Drop a folder here, or click to select one</p>
                  <p className="text-xs text-white/30 mt-1">All files inside will be imported</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-white/70 font-medium">Drop files here, or click to browse</p>
                  <p className="text-xs text-white/30 mt-1">Select multiple files at once · PDF · CSV · JSON · Excel · Images · any text</p>
                </>
              )}
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
        <Button variant="ghost" onClick={onBack} disabled={isLoading}>Back</Button>
      </div>
    </div>
  );
}

// ── Screen capture form ────────────────────────────────────────────────────────
function ScreenCaptureForm({ name, setName, onAdd, onBack }: any) {
  const [status, setStatus] = useState<'idle' | 'picking' | 'captured' | 'error'>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const capture = async () => {
    setStatus('picking');
    setErrorMsg('');
    let stream: MediaStream | null = null;
    try {
      stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      }) as MediaStream;
      const track = stream.getVideoTracks()[0];
      const imageCapture = new (window as any).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');

      setPreview(dataUrl);
      setStatus('captured');
    } catch (e: any) {
      if (e?.name === 'NotAllowedError' || e?.message?.toLowerCase().includes('cancel')) {
        setStatus('idle');
      } else {
        setErrorMsg(e?.message ?? 'Screen capture failed');
        setStatus('error');
      }
    } finally {
      stream?.getTracks().forEach(t => t.stop());
    }
  };

  const handleImport = () => {
    if (!preview) return;
    onAdd({
      name: name || `Screen ${new Date().toLocaleTimeString()}`,
      type: 'screen-capture',
      content: preview,
      contentType: 'image',
    });
  };

  const reset = () => { setStatus('idle'); setPreview(null); };

  return (
    <div className="space-y-4">
      <Input
        label="Source Name (optional)"
        value={name}
        onChange={(e: any) => setName(e.target.value)}
        placeholder={`Screen ${new Date().toLocaleTimeString()}`}
      />

      {(status === 'idle' || status === 'error') && (
        <button
          type="button"
          onClick={capture}
          className="w-full border-2 border-dashed border-white/10 hover:border-[#a78bfa]/50 hover:bg-[#a78bfa]/5 rounded-xl p-8 text-center transition-all cursor-pointer"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="text-3xl">🖥️</div>
            <div>
              <p className="text-sm text-white/70 font-medium">Click to share your screen</p>
              <p className="text-xs text-white/30 mt-1">
                Choose a window, tab, or your entire desktop — Claude will see it
              </p>
            </div>
          </div>
        </button>
      )}

      {status === 'picking' && (
        <div className="border-2 border-dashed border-[#a78bfa]/40 rounded-xl p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-[#a78bfa]/60" />
            <p className="text-sm text-white/50">Waiting for screen selection…</p>
          </div>
        </div>
      )}

      {status === 'captured' && preview && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Screen capture preview" className="w-full max-h-48 object-contain bg-black/40" />
            <button
              type="button"
              onClick={reset}
              className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 text-white/60 hover:text-white text-[10px] transition-colors"
            >
              Retake
            </button>
          </div>
          <p className="text-[11px] text-white/30 text-center">
            Claude will analyze this screenshot as an image source
          </p>
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-red-400/80">{errorMsg}</p>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        {status === 'captured' && (
          <Button onClick={handleImport}>Import Screenshot</Button>
        )}
        {(status === 'idle' || status === 'error') && (
          <Button onClick={capture}>Share Screen</Button>
        )}
      </div>
    </div>
  );
}
