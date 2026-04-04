"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { IntelligenceView } from "@/components/views/intelligence-view";
import { EngineerView } from "@/components/views/engineer-view";
import { AnalystView } from "@/components/views/analyst-view";
import { AddSourceModal } from "@/components/modals/add-source-modal";
import { SettingsModal } from "@/components/modals/settings-modal";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [activeTab, setActiveTab] = useState("intelligence");
  const [showAddSource, setShowAddSource] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
