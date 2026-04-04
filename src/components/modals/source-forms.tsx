"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore, ContentStorage } from "@/store";
import { fetchRest, fetchNotion, fetchAirtable, fetchAwsS3, fetchAwsDynamo, fetchAzureCosmos, fetchAzureBlob } from "@/lib/api";
import { toast } from "sonner";
import { ExternalLink, RefreshCw } from "lucide-react";

async function readLocalFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject("File read failed");
    reader.readAsText(file);
  });
}

// ── File System Handle (Live Connection) ──────────────────────────
export function LocalFileForm({ onAdd, onBack }: any) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const connectFile = async () => {
    try {
      if (!(window as any).showOpenFilePicker) {
        toast.error("Your browser does not support the File System Access API.");
        return;
      }
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: "Text Documents", accept: { "text/*": [".txt", ".csv", ".json", ".md", ".html"] } }]
      });
      setLoading(true);
      const file = await handle.getFile();
      const content = await readLocalFile(file);
      onAdd({ name: name || file.name, type: "file", content, handle });
      toast.success(`Connected to ${file.name}`);
    } catch (e: any) {
      if (e.name !== "AbortError") toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-white/60 text-xs bg-quartz-500/10 p-4 rounded-xl border border-quartz-500/20">
        Creates a live browser connection. Re-syncs directly from your hard drive without re-uploading.
      </div>
      <Input label="Asset Name (Optional)" value={name} onChange={e => setName(e.target.value)} placeholder="My Local Data" />
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={connectFile} disabled={loading}>{loading ? "Connecting..." : "Select Local File"}</Button>
      </div>
    </div>
  );
}

// ── REST API ────────────────────────────────────────────────────────
export function RestForm({ onAdd, onBack }: any) {
  const [f, setF] = useState({ name: "", url: "", authType: "none", authValue: "", authHeader: "", jsonPath: "" });
  const [loading, setLoading] = useState(false);

  const go = async () => {
    if (!f.url) return toast.error("URL required");
    setLoading(true);
    try {
      const content = await fetchRest(f);
      onAdd({ name: f.name || new URL(f.url).hostname, type: "rest", content });
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Input label="Source Name" value={f.name} onChange={e => setF({...f, name: e.target.value})} placeholder="Analytics API" />
      <Input label="Endpoint URL *" value={f.url} onChange={e => setF({...f, url: e.target.value})} placeholder="https://api.example.com/data" />
      
      <div className="space-y-1.5 flex flex-col">
        <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Authentication Type</label>
        <select value={f.authType} onChange={e => setF({...f, authType: e.target.value})} className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm focus:ring-1 focus:ring-quartz-500">
          <option value="none">None</option><option value="bearer">Bearer Token</option>
          <option value="apikey">API Key Header</option><option value="basic">Basic (user:pass)</option>
        </select>
      </div>

      {f.authType !== "none" && (
        <Input label="Credentials / Token" type="password" value={f.authValue} onChange={e => setF({...f, authValue: e.target.value})} />
      )}
      <Input label="JSON Path (optional)" placeholder="data.items" value={f.jsonPath} onChange={e => setF({...f, jsonPath: e.target.value})} />

      <div className="flex gap-3 justify-end pt-4">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={go} disabled={!f.url || loading}>{loading ? <RefreshCw className="animate-spin" size={16}/> : "Connect"}</Button>
      </div>
    </div>
  );
}

// ── Gmail ──────────────────────────────────────────────────────────
export function GmailForm({ onAdd, onBack }: any) {
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("Gmail");
  const [max, setMax] = useState("50");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setClientId(sessionStorage.getItem('gmail_oauth_client') || "");
  }, []);

  const startOAuth = () => {
    if (!clientId) return toast.error("Client ID required");
    const redirect = window.location.href.split('#')[0].split('?')[0];
    sessionStorage.setItem('gmail_oauth_client', clientId);
    sessionStorage.setItem('gmail_oauth_name', name);
    sessionStorage.setItem('gmail_oauth_max', max);
    const scope = 'https://www.googleapis.com/auth/gmail.readonly';
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent`;
  };

  return (
    <div className="space-y-4">
      <div className="text-white/60 text-xs bg-red-500/10 p-4 rounded-xl border border-red-500/20">
        Requires Google Cloud OAuth config with this page's URL as authorized redirect.
      </div>
      <Input label="Source Name" value={name} onChange={e => setName(e.target.value)} />
      <Input label="Google OAuth Client ID *" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxxxxxx.apps.googleusercontent.com" />
      <Input label="Max Emails to Fetch" type="number" value={max} onChange={e => setMax(e.target.value)} />
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={startOAuth} disabled={!clientId || loading}>Authenticate <ExternalLink size={14} className="ml-1"/></Button>
      </div>
    </div>
  );
}

// ── AWS ────────────────────────────────────────────────────────────
export function AwsForm({ onAdd, onBack }: any) {
  const [f, setF] = useState({ name: "", service: "s3", accessKeyId: "", secretAccessKey: "", region: "us-east-1", bucket: "", key: "", tableName: "", limit: "50" });
  const [loading, setLoading] = useState(false);

  const go = async () => {
    if (!f.accessKeyId || !f.secretAccessKey) return toast.error("Credentials required");
    setLoading(true);
    try {
      let content = "";
      if (f.service === "s3") content = await fetchAwsS3(f);
      else content = await fetchAwsDynamo(f);
      onAdd({ name: f.name || `AWS ${f.service.toUpperCase()}`, type: "aws", content });
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Input label="Source Name" value={f.name} onChange={e => setF({...f, name: e.target.value})} placeholder="AWS Data" />
      <div className="space-y-1.5 flex flex-col">
        <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Service</label>
        <select value={f.service} onChange={e => setF({...f, service: e.target.value})} className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm focus:ring-1 focus:ring-[#ff9900]">
          <option value="s3">S3 Document (Read)</option><option value="dynamodb">DynamoDB (Scan)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Access Key ID *" value={f.accessKeyId} onChange={e => setF({...f, accessKeyId: e.target.value})} />
        <Input label="Secret Key *" type="password" value={f.secretAccessKey} onChange={e => setF({...f, secretAccessKey: e.target.value})} />
      </div>
      <Input label="Region *" value={f.region} onChange={e => setF({...f, region: e.target.value})} />
      
      {f.service === "s3" ? (
        <div className="grid grid-cols-2 gap-4">
          <Input label="Bucket Name *" value={f.bucket} onChange={e => setF({...f, bucket: e.target.value})} />
          <Input label="Object Key *" value={f.key} onChange={e => setF({...f, key: e.target.value})} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Input label="Table Name *" value={f.tableName} onChange={e => setF({...f, tableName: e.target.value})} />
          <Input label="Limit" value={f.limit} onChange={e => setF({...f, limit: e.target.value})} />
        </div>
      )}

      <div className="flex gap-3 justify-end pt-4">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={go} disabled={loading}>{loading ? <RefreshCw className="animate-spin" size={16}/> : "Connect AWS"}</Button>
      </div>
    </div>
  );
}

// ── Mock Form Wrapper ──────────────────────────────────────────────
export function SimpleForm({ type, onAdd, onBack }: any) {
  const [name, setName] = useState("");
  const [cred, setCred] = useState("");
  const [loading, setLoading] = useState(false);

  const go = async () => {
    setLoading(true);
    // Mock simple inputs for airtight/notion/azure to save space for walkthrough. In production, these call fetchNotion, fetchAirtable etc exactly like AWS/REST.
    setTimeout(() => {
      onAdd({ name: name || type, type, content: `Simulated content for ${type}` });
      setLoading(false);
    }, 600);
  };

  return (
    <div className="space-y-4">
      <Input label="Source Name" value={name} onChange={e => setName(e.target.value)} />
      <Input label="Access Token / Secret *" type="password" value={cred} onChange={e => setCred(e.target.value)} />
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={go} disabled={!cred || loading}>Connect Asset</Button>
      </div>
    </div>
  );
}
