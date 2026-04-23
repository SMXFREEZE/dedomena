"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
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

export default function Home() {
  const [activeTab, setActiveTab] = useState("intelligence");
  const [showAddSource, setShowAddSource] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotepad, setShowNotepad] = useState(false);
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
      <Sidebar
        onAddSource={() => setShowAddSource(true)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleNotepad={() => setShowNotepad(v => !v)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <main className="flex-1 relative overflow-hidden flex flex-col bg-black/40">
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
