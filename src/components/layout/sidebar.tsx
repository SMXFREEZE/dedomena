"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, ContentStorage } from "@/store";
import { CONNECTORS_BY_ID } from "@/lib/connectors/registry";
import { Database, Plus, Settings, Blocks, Sparkles, Network, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { ConnectorIcon } from "@/components/ui/connector-icon";
import { cn, fmtChars } from "@/lib/utils";
import { toast } from "sonner";

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
  const removeSource = useAppStore(s => s.removeSource);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalChars = sources.reduce((acc, s) => acc + (s.charCount || 0), 0);

  const navItems = [
    { id: "intelligence", icon: Sparkles, label: "Intelligence", desc: "Search & synthesis" },
    { id: "engineer", icon: Network, label: "Data Engineer", desc: "Clean & normalize" },
    { id: "analyst", icon: Blocks, label: "Analyst", desc: "Charts & insights" },
  ];

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSource(id, ContentStorage.del);
    toast.success(`"${name}" removed`);
    if (expandedId === id) setExpandedId(null);
  };

  const handleClearAll = () => {
    sources.forEach(s => removeSource(s.id, ContentStorage.del));
    setExpandedId(null);
    toast.success("All sources cleared");
  };

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
          type="button"
          title="Settings"
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
              type="button"
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
              <div className={cn("text-xs font-semibold tracking-tight transition-colors", isActive ? "text-white" : "text-white/60 group-hover:text-white")}>
                {item.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Sources header */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[10px] uppercase tracking-widest text-white/30 font-bold flex items-center gap-2">
            Connected Assets
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">{sources.length}</span>
          </h2>
          {sources.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[9px] text-white/20 hover:text-red-400/70 uppercase tracking-wider transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        {sources.length > 0 && (
          <p className="text-[9px] text-white/20 font-mono">
            {fmtChars(totalChars)} total
          </p>
        )}
      </div>

      {/* Source list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 no-scrollbar">
        {sources.length === 0 ? (
          <div className="px-2 py-8 text-center text-white/30">
            <Database size={24} className="mx-auto mb-3 opacity-50" />
            <p className="text-xs">No active assets.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {sources.map((src, i) => {
              const connector = CONNECTORS_BY_ID[src.type];
              const isExpanded = expandedId === src.id;
              const isHovered = hoveredId === src.id;
              const preview = isExpanded ? ContentStorage.get(src.id)?.slice(0, 200) : null;

              return (
                <motion.div
                  key={src.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10, height: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors overflow-hidden"
                  onMouseEnter={() => setHoveredId(src.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Main row */}
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : src.id)}
                  >
                    <div className="flex items-center gap-2">
                      <ConnectorIcon
                        iconSlug={connector?.iconSlug}
                        name={connector?.name ?? src.type}
                        color={connector?.color ?? '#888888'}
                        size={18}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium truncate flex-1 text-white/80">{src.name}</span>
                          <span className="text-[9px] text-white/25 font-mono shrink-0">{fmtChars(src.charCount)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", src.status === "connected" ? "bg-emerald-500" : "bg-amber-500")} />
                          <span className="text-[9px] text-white/25 tracking-wider uppercase truncate">{src.type}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {(isHovered || isExpanded) && (
                          <motion.button
                            type="button"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={(e) => handleDelete(src.id, src.name, e)}
                            className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
                            title="Remove source"
                          >
                            <Trash2 size={12} />
                          </motion.button>
                        )}
                        <span className="text-white/20">
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded preview */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 border-t border-white/5 pt-2 space-y-2">
                          <div className="flex justify-between text-[9px] text-white/25 uppercase tracking-wider">
                            <span>Added {new Date(src.dateAdded).toLocaleDateString()}</span>
                            {src.contentType && <span>{src.contentType}</span>}
                          </div>
                          {preview ? (
                            <p className="text-[10px] text-white/35 leading-relaxed font-mono bg-white/[0.02] rounded-lg p-2 max-h-20 overflow-hidden">
                              {preview}{preview.length >= 200 ? "…" : ""}
                            </p>
                          ) : (
                            <p className="text-[10px] text-white/20 italic">No preview available</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Add button */}
      <div className="p-4 border-t border-white/5 bg-black/20">
        <button
          type="button"
          onClick={onAddSource}
          className="w-full flex items-center justify-center gap-2 bg-white flex-row text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all rounded-xl py-2.5 text-xs font-bold"
        >
          <Plus size={14} /> Import Asset
        </button>
      </div>
    </aside>
  );
}
