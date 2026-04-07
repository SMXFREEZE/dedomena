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

  if (connector.id === 'desktop-connect') {
    return <DesktopConnectForm onAdd={onAdd} onAddSilent={onAddSilent} onBack={onBack} />;
  }

  if (connector.id === 'desktop-bridge') {
    return <DesktopBridgeForm name={name} setName={setName} onAdd={onAdd} onBack={onBack} />;
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

// Recursively collect all File objects from a FileSystemEntry tree
async function collectFromEntry(entry: any): Promise<File[]> {
  if (entry.isFile) {
    return new Promise(resolve => entry.file((f: File) => resolve([f]), () => resolve([])));
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const allEntries: any[] = [];
    // readEntries may return results in batches — keep reading until empty
    await new Promise<void>(resolve => {
      const readBatch = () => {
        reader.readEntries((batch: any[]) => {
          if (batch.length === 0) { resolve(); return; }
          allEntries.push(...batch);
          readBatch();
        }, () => resolve());
      };
      readBatch();
    });
    const nested = await Promise.all(allEntries.map(collectFromEntry));
    return nested.flat();
  }
  return [];
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

    // Use DataTransferItem entry API so dropped folders are traversed recursively
    const items = Array.from(e.dataTransfer.items ?? []);
    const entries = items
      .filter(i => i.kind === 'file')
      .map(i => (i as any).webkitGetAsEntry?.())
      .filter(Boolean);

    if (entries.length > 0) {
      const nested = await Promise.all(entries.map(collectFromEntry));
      await processFiles(nested.flat());
    } else {
      // Fallback for browsers without entry API
      await processFiles(Array.from(e.dataTransfer.files ?? []));
    }
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
                  <p className="text-sm text-white/70 font-medium">Drop files or folders here, or click to browse</p>
                  <p className="text-xs text-white/30 mt-1">Files, folders, or mixed — PDF · CSV · JSON · Excel · Images · any text</p>
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

// ── Desktop connect form ───────────────────────────────────────────────────────
async function* walkDirectory(dirHandle: any): AsyncGenerator<File> {
  for await (const [, handle] of dirHandle) {
    if (handle.kind === 'file') {
      yield handle.getFile();
    } else if (handle.kind === 'directory') {
      yield* walkDirectory(handle);
    }
  }
}

function DesktopConnectForm({ onAdd, onAddSilent, onBack }: any) {
  const [status, setStatus]   = useState<'idle' | 'scanning' | 'importing' | 'done' | 'error'>('idle');
  const [dirName, setDirName] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const connect = async () => {
    if (!(window as any).showDirectoryPicker) {
      setErrorMsg('Your browser does not support the File System Access API. Use Chrome or Edge.');
      setStatus('error');
      return;
    }
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
      setDirName(dirHandle.name);
      setStatus('scanning');

      // Collect all files first so we know the total count
      const files: File[] = [];
      for await (const file of walkDirectory(dirHandle)) {
        files.push(file);
      }

      if (files.length === 0) {
        setErrorMsg('No files found in that folder.');
        setStatus('error');
        return;
      }

      setStatus('importing');
      setProgress({ done: 0, total: files.length });

      let done = 0;
      const errors: string[] = [];

      for (const file of files) {
        try {
          const { content, contentType } = await extractFileContent(file);
          (onAddSilent ?? onAdd)({ name: file.name, type: 'desktop-connect', content, contentType });
        } catch {
          errors.push(file.name);
        }
        done++;
        setProgress({ done, total: files.length });
      }

      const imported = files.length - errors.length;
      if (errors.length > 0) toast.error(`${errors.length} file(s) could not be read`);
      if (imported > 0) toast.success(`${imported} file${imported > 1 ? 's' : ''} imported from "${dirHandle.name}"`);

      setStatus('done');
      setProgress(null);

      setTimeout(() => onBack(), 1200);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setStatus('idle'); // user cancelled picker
      } else {
        setErrorMsg(e?.message ?? 'Failed to access folder');
        setStatus('error');
      }
    }
  };

  const isLoading = status === 'scanning' || status === 'importing';

  return (
    <div className="space-y-4">
      {/* Idle / error — show connect button */}
      {(status === 'idle' || status === 'error') && (
        <button
          type="button"
          onClick={connect}
          className="w-full border-2 border-dashed border-white/10 hover:border-[#a78bfa]/50 hover:bg-[#a78bfa]/5 rounded-xl p-10 text-center transition-all cursor-pointer group"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#a78bfa]/10 border border-[#a78bfa]/20 flex items-center justify-center text-3xl group-hover:bg-[#a78bfa]/15 transition-colors">
              🖥️
            </div>
            <div>
              <p className="text-sm text-white/80 font-semibold">Connect your Desktop</p>
              <p className="text-xs text-white/35 mt-1.5 leading-relaxed max-w-xs mx-auto">
                Grant access to any folder — your Desktop, Documents, or a project directory.
                Claude will read every file inside and can answer questions about all of it.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {['Desktop', 'Documents', 'Downloads', 'Any folder'].map(l => (
                <span key={l} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/5">{l}</span>
              ))}
            </div>
          </div>
        </button>
      )}

      {/* Scanning */}
      {status === 'scanning' && (
        <div className="border border-white/10 rounded-xl p-8 text-center space-y-3">
          <RefreshCw size={24} className="animate-spin text-[#a78bfa]/60 mx-auto" />
          <p className="text-sm text-white/60">Scanning <span className="text-white/80 font-medium">"{dirName}"</span>…</p>
          <p className="text-xs text-white/30">Counting files</p>
        </div>
      )}

      {/* Importing */}
      {status === 'importing' && progress && (
        <div className="border border-white/10 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#a78bfa]/10 flex items-center justify-center text-2xl mx-auto">🖥️</div>
          <div>
            <p className="text-sm text-white/70 font-medium">Importing from "{dirName}"</p>
            <p className="text-xs text-white/40 mt-1">{progress.done} / {progress.total} files</p>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#a78bfa]/60 rounded-full transition-all duration-150"
              style={{ '--p': `${(progress.done / progress.total) * 100}%`, width: 'var(--p)' } as React.CSSProperties}
            />
          </div>
        </div>
      )}

      {/* Done */}
      {status === 'done' && (
        <div className="border border-emerald-500/20 rounded-xl p-8 text-center space-y-2 bg-emerald-500/5">
          <p className="text-2xl">✓</p>
          <p className="text-sm text-emerald-400 font-medium">All files imported</p>
          <p className="text-xs text-white/30">Returning to catalog…</p>
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-red-400/80 px-1">{errorMsg}</p>
      )}

      <div className="flex gap-3 justify-end pt-1">
        <Button variant="ghost" onClick={onBack} disabled={isLoading}>Back</Button>
        {(status === 'idle' || status === 'error') && (
          <Button onClick={connect}>Connect Folder</Button>
        )}
      </div>
    </div>
  );
}

// ── Desktop Bridge form ────────────────────────────────────────────────────────
const BRIDGE_PORT = 7432;

const REQUIRED_BRIDGE_VERSION = '3.0.0';

function DesktopBridgeForm({ name, setName, onAdd, onBack }: any) {
  const [status, setStatus]       = useState<'idle' | 'testing' | 'ok' | 'outdated' | 'error'>('idle');
  const [rootPath, setRootPath]   = useState('');
  const [bridgeVer, setBridgeVer] = useState('');
  const [errorMsg, setErrorMsg]   = useState('');

  const testConnection = async () => {
    setStatus('testing');
    setErrorMsg('');
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/status`, { signal: ctrl.signal }).finally(() => clearTimeout(t));
      if (!res.ok) throw new Error(`Bridge returned ${res.status}`);
      const data = await res.json();
      setRootPath(data.rootPath ?? '');
      setBridgeVer(data.version ?? '?');
      // Compare versions — require 3.0.0+
      const ver = (data.version ?? '0').split('.').map(Number);
      const req = REQUIRED_BRIDGE_VERSION.split('.').map(Number);
      const isOld = ver[0] < req[0] || (ver[0] === req[0] && ver[1] < req[1]);
      setStatus(isOld ? 'outdated' : 'ok');
    } catch (e: any) {
      setErrorMsg('Bridge not running — close the old window, re-download the .bat, and double-click it.');
      setStatus('error');
    }
  };

  const handleConnect = () => {
    // Store rootPath as the content so intelligence-view can retrieve it
    const meta = JSON.stringify({ __bridge__: true, rootPath });
    onAdd({
      name: name || `Local Bridge (${rootPath.split(/[/\\]/).pop() ?? 'Home'})`,
      type: 'desktop-bridge',
      content: meta,
    });
  };

  return (
    <div className="space-y-4">
      <Input
        label="Source Name (optional)"
        value={name}
        onChange={(e: any) => setName(e.target.value)}
        placeholder="My Desktop"
      />

      {/* Step 1 — Windows: one-click launcher */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#34d399]/15 border border-[#34d399]/30 text-[#34d399] text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
          <p className="text-[12px] text-white/70 font-medium">Download the launcher</p>
        </div>

        {/* Windows */}
        <div className="space-y-1.5">
          <p className="text-[9px] text-white/25 uppercase tracking-widest">Windows</p>
          <a
            href="/dedomena-bridge.bat"
            download="dedomena-bridge.bat"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[rgba(52,211,153,0.08)] border border-[rgba(52,211,153,0.2)] text-[#34d399] text-[12px] font-medium hover:bg-[rgba(52,211,153,0.14)] transition-colors"
          >
            <span className="text-lg">⬇</span>
            <div>
              <p className="font-semibold">dedomena-bridge.bat</p>
              <p className="text-[10px] text-white/30">Download · double-click · done</p>
            </div>
          </a>
        </div>

        {/* Mac / Linux */}
        <div className="space-y-1.5">
          <p className="text-[9px] text-white/25 uppercase tracking-widest">Mac / Linux</p>
          <a
            href="/dedomena-bridge.js"
            download="dedomena-bridge.js"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] text-white/60 text-[12px] font-medium hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          >
            <span className="text-lg">⬇</span>
            <div>
              <p className="font-semibold">dedomena-bridge.js</p>
              <p className="text-[10px] text-white/30">Then run: <code className="font-mono text-white/40">node ~/Downloads/dedomena-bridge.js</code></p>
            </div>
          </a>
        </div>

        <p className="text-[10px] text-white/20 leading-relaxed">
          Node.js must be installed — <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-white/35 hover:text-white/60 underline underline-offset-2">nodejs.org</a>.
          No npm install, no account, runs 100% locally.
        </p>
      </div>

      {/* Step 3 — Test */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#34d399]/15 border border-[#34d399]/30 text-[#34d399] text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
          <p className="text-[12px] text-white/70 font-medium">Test the connection</p>
        </div>

        {status === 'ok' && (
          <div className="flex items-center gap-2 text-emerald-400 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Bridge v{bridgeVer} · root: <code className="font-mono text-white/45 text-[10px]">{rootPath}</code>
          </div>
        )}
        {status === 'outdated' && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 space-y-1">
            <p className="text-[12px] text-amber-400 font-semibold">⚠ Old bridge running (v{bridgeVer})</p>
            <p className="text-[11px] text-white/50">
              Close the terminal, re-download <strong>dedomena-bridge.bat</strong> above, and double-click it to get v3.
            </p>
          </div>
        )}
        {status === 'error' && (
          <p className="text-[11px] text-red-400/80">{errorMsg}</p>
        )}

        <Button
          variant={status === 'ok' ? 'ghost' : 'glass'}
          onClick={testConnection}
          disabled={status === 'testing'}
          className="w-full"
        >
          {status === 'testing' ? (
            <><RefreshCw size={13} className="animate-spin" /> Testing…</>
          ) : status === 'ok' ? (
            '✓ Connected — retest'
          ) : (
            'Test Connection'
          )}
        </Button>
      </div>

      {/* Privacy note */}
      <p className="text-[10px] text-white/20 leading-relaxed px-1">
        The bridge runs only on your machine. When you ask a question, dedomena searches
        your files <em>on the fly</em> and sends only the relevant excerpts to the AI —
        nothing is uploaded or stored.
      </p>

      <div className="flex gap-3 justify-end pt-1">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        {status === 'ok' && <Button onClick={handleConnect}>Connect Bridge</Button>}
        {status === 'outdated' && <Button variant="ghost" disabled>Update required</Button>}
      </div>
    </div>
  );
}
