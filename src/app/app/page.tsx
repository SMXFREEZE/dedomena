"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Menu, Plus } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { IntelligenceView } from "@/components/views/intelligence-view";
import { AgentView } from "@/components/views/agent-view";
import { AnalyzeView } from "@/components/views/analyze-view";
import { ConnectView } from "@/components/views/connect-view";
import { AddSourceModal } from "@/components/modals/add-source-modal";
import { SettingsModal } from "@/components/modals/settings-modal";
import { NotepadPanel } from "@/components/panels/notepad-panel";
import { useAppStore, ContentStorage } from "@/store";
import { CredentialStorage } from "@/store/credential-store";
import { detectOAuthCallback, cleanOAuthFromUrl, exchangeCode } from "@/lib/connectors/oauth";
import { runClientFetcher } from "@/lib/connectors/fetchers";
import { CONNECTORS_BY_ID } from "@/lib/connectors/registry";
import { toast } from "sonner";

const TAB_LABELS: Record<string, string> = {
  intelligence: "Ask AI",
  agent: "Agent",
  analyze: "Analyze",
  connect: "Connect",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState("intelligence");
  const [showAddSource, setShowAddSource] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotepad, setShowNotepad] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { addSourceMeta } = useAppStore();

  // Generic OAuth callback handler — works for all connectors
  useEffect(() => {
    const result = detectOAuthCallback();
    if (!result) return;

    cleanOAuthFromUrl();

    const { sourceId, connectorId, sourceName, accessToken } = result;
    const connector = CONNECTORS_BY_ID[connectorId];
    if (!connector) return;

    const handleToken = async (token: string, refreshToken?: string, expiresIn?: number) => {
      CredentialStorage.saveOAuth(sourceId, {
        accessToken: token,
        ...(refreshToken ? { refreshToken } : {}),
        ...(expiresIn ? { expiresAt: String(Date.now() + expiresIn * 1000) } : {}),
      });

      const toastId = toast.loading(`Fetching data from ${sourceName}…`);
      try {
        const content = await runClientFetcher(connectorId, { accessToken: token });
        ContentStorage.save(sourceId, content);
        addSourceMeta({ id: sourceId, name: sourceName, type: connectorId as any, charCount: content.length });
        toast.success(`${sourceName} connected`, { id: toastId });
      } catch (e: any) {
        toast.error(`${sourceName}: ${e.message}`, { id: toastId });
      }
    };

    // Authorization code flow (PKCE)
    if (accessToken.startsWith('__code__:')) {
      const [, code, codeVerifier] = accessToken.split(':');
      const savedCreds = CredentialStorage.get(sourceId) ?? {};
      exchangeCode(code, codeVerifier, connector, savedCreds)
        .then(({ accessToken: at, refreshToken, expiresIn }) => handleToken(at, refreshToken, expiresIn))
        .catch(e => toast.error(`OAuth exchange failed: ${e.message}`));
    } else {
      // Implicit token flow
      handleToken(accessToken);
    }
  }, [addSourceMeta]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">

      {/* ── Mobile top bar ───────────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-12 flex items-center px-4 gap-3 bg-black/70 backdrop-blur-xl border-b border-white/[0.05]">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          title="Open menu"
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
        >
          <Menu size={18} />
        </button>
        <span className="flex-1 text-sm font-medium text-white/80 tracking-tight">
          {TAB_LABELS[activeTab] ?? activeTab}
        </span>
        <button
          type="button"
          onClick={() => setShowAddSource(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 text-black text-xs font-semibold"
        >
          <Plus size={13} strokeWidth={2.5} /> Import
        </button>
      </div>

      {/* ── Mobile sidebar overlay ───────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar (drawer on mobile, always visible on desktop) ───────────── */}
      <div className={[
        "fixed md:relative inset-y-0 left-0 z-50 md:z-auto transition-transform duration-300 ease-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}>
        <Sidebar
          onAddSource={() => { setShowAddSource(true); setSidebarOpen(false); }}
          onOpenSettings={() => { setShowSettings(true); setSidebarOpen(false); }}
          onToggleNotepad={() => { setShowNotepad(v => !v); setSidebarOpen(false); }}
          activeTab={activeTab}
          setActiveTab={(t) => { setActiveTab(t); setSidebarOpen(false); }}
        />
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 relative overflow-hidden flex flex-col bg-black/40 pt-12 md:pt-0">
        <AnimatePresence mode="wait">
          {activeTab === "intelligence" && <IntelligenceView key="intel" />}
          {activeTab === "agent" && <AgentView key="agent" />}
          {activeTab === "analyze" && <AnalyzeView key="analyze" />}
          {activeTab === "connect" && <ConnectView key="connect" />}
        </AnimatePresence>
      </main>

      <AddSourceModal isOpen={showAddSource} onClose={() => setShowAddSource(false)} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <AnimatePresence>
        {showNotepad && <NotepadPanel isOpen={showNotepad} onClose={() => setShowNotepad(false)} />}
      </AnimatePresence>
    </div>
  );
}
