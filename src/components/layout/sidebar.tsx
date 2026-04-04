"use client";

import { motion } from "framer-motion";
import { useAppStore } from "@/store";
import { Database, Plus, Settings, Blocks, Sparkles, Network } from "lucide-react";
import { cn, fmtChars } from "@/lib/utils";

export function Sidebar({ 
  onAddSource, 
  onOpenSettings,
  activeTab,
  setActiveTab
}: { 
  onAddSource: () => void;
  onOpenSettings: () => void;
  activeTab: string;
  setActiveTab: (v: string) => void;
}) {
  const sources = useAppStore(s => s.sources);

  const navItems = [
    { id: "intelligence", icon: Sparkles, label: "Intelligence", desc: "Search & synthesis" },
    { id: "engineer", icon: Network, label: "Data Engineer", desc: "Clean & normalize" },
    { id: "analyst", icon: Blocks, label: "Analyst", desc: "Charts & insights" },
  ];

  return (
    <aside className="w-72 h-full flex flex-col shrink-0 border-r border-white/5 bg-[#08080a]/50 backdrop-blur-xl z-20">
      {/* Brand */}
      <div className="p-6 flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-[1.35rem] font-semibold tracking-wide text-white/90 leading-none">
              dedomena
            </h1>
            <span className="brand-sigma text-[2rem] text-white/35 leading-none select-none">
              Σ
            </span>
          </div>
        </div>
        <button 
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-white/40 hover:text-white/90 hover:bg-white/5 transition-all"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Navigation */}
      <div className="px-4 py-2 space-y-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group",
                isActive ? "bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" : "hover:bg-white/5"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg transition-colors",
                isActive ? "bg-gradient-to-br from-quartz-500/20 to-coral-500/20 text-coral-500" : "bg-white/5 text-white/40 group-hover:text-white/60"
              )}>
                <item.icon size={15} />
              </div>
              <div>
                <div className={cn("text-xs font-semibold tracking-tight transition-colors", isActive ? "text-white" : "text-white/60 group-hover:text-white")}>
                  {item.label}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="px-6 pt-6 pb-2">
        <h2 className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-3 flex items-center justify-between">
          Connected Assets
          <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">{sources.length}</span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 no-scrollbar">
        {sources.length === 0 ? (
          <div className="px-2 py-8 text-center text-white/30">
            <Database size={24} className="mx-auto mb-3 opacity-50" />
            <p className="text-xs">No active assets.</p>
          </div>
        ) : (
          sources.map((src, i) => (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              key={src.id}
              className="px-3 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-default group"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn("w-1.5 h-1.5 rounded-full", src.status === "connected" ? "bg-emerald-500" : "bg-white/20")} />
                <span className="text-xs font-medium truncate flex-1">{src.name}</span>
                <span className="text-[10px] text-white/30 font-mono">{fmtChars(src.charCount)}</span>
              </div>
              <div className="text-[10px] text-white/40 tracking-wider uppercase pl-3.5">
                {src.type}
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-white/5 bg-black/20">
        <button 
          onClick={onAddSource}
          className="w-full flex items-center justify-center gap-2 bg-white flex-row text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all rounded-xl py-2.5 text-xs font-bold"
        >
          <Plus size={14} /> Import Asset
        </button>
      </div>
    </aside>
  );
}
