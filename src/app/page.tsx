"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { IntelligenceView } from "@/components/views/intelligence-view";
import { EngineerView } from "@/components/views/engineer-view";
import { AnalystView } from "@/components/views/analyst-view";
import { AddSourceModal } from "@/components/modals/add-source-modal";
import { SettingsModal } from "@/components/modals/settings-modal";
import { AnimatePresence } from "framer-motion";
import { useAppStore, ContentStorage } from "@/store";
import { fetchGmail } from "@/lib/api";
import { toast } from "sonner";

export default function Home() {
  const [activeTab, setActiveTab] = useState("intelligence");
  const [showAddSource, setShowAddSource] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { addSourceMeta } = useAppStore();

  // Handle Gmail OAuth callback — Google redirects back with #access_token=... in the URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token=")) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    if (!accessToken) return;

    // Clean the token from the URL immediately
    history.replaceState(null, "", window.location.pathname);

    const name = sessionStorage.getItem("gmail_oauth_name") || "Gmail";
    sessionStorage.removeItem("gmail_oauth_name");
    sessionStorage.removeItem("gmail_oauth_client");

    const toastId = toast.loading(`Fetching all emails from ${name}…`);

    fetchGmail(accessToken)
      .then(content => {
        const id = Math.random().toString(36).slice(2, 11);
        ContentStorage.save(id, content);
        const emailCount = content.split("\n\n---\n\n").length;
        addSourceMeta({ id, name, type: "gmail", charCount: content.length });
        toast.success(`${name} connected — ${emailCount.toLocaleString()} emails imported`, { id: toastId });
      })
      .catch(e => {
        toast.error(`Gmail error: ${e.message}`, { id: toastId });
      });
  }, [addSourceMeta]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      <Sidebar
        onAddSource={() => setShowAddSource(true)}
        onOpenSettings={() => setShowSettings(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 relative overflow-hidden flex flex-col bg-black/40">
        <AnimatePresence mode="wait">
          {activeTab === "intelligence" && <IntelligenceView key="intel" />}
          {activeTab === "engineer" && <EngineerView key="eng" />}
          {activeTab === "analyst" && <AnalystView key="data" />}
        </AnimatePresence>
      </main>

      <AddSourceModal isOpen={showAddSource} onClose={() => setShowAddSource(false)} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
