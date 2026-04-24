"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, ContentStorage } from "@/store";
import { CONNECTORS_BY_ID } from "@/lib/connectors/registry";
import { CredentialStorage } from "@/store/credential-store";
import { runClientFetcher } from "@/lib/connectors/fetchers";
import { Database, Plus, Settings, Sparkles, Trash2, ChevronDown, ChevronRight, RefreshCw, AlertCircle, Bot, StickyNote, Plug, BarChart3, Globe, Mic, Mail, Home } from "lucide-react";
import Link from "next/link";
import { ConnectorIcon } from "@/components/ui/connector-icon";
import { cn, fmtChars } from "@/lib/utils";
import { toast } from "sonner";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m  = Math.floor(ms / 60_000);
  const h  = Math.floor(m / 60);
  const d  = Math.floor(h / 24);
  if (d > 0)  return `${d}d ago`;
  if (h > 0)  return `${h}h ago`;
  if (m > 0)  return `${m}m ago`;
  return "just now";
}

function freshnessColor(iso?: string): string {
  if (!iso) return "text-white/20";
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1)  return "text-coral-400";
  if (h < 24) return "text-amber-400";
  return "text-red-400/70";
}

export function Sidebar({
  onAddSource,
  onOpenSettings,
  onToggleNotepad,
  activeTab,
  setActiveTab,
}: {
  onAddSource: () => void;
  onOpenSettings: () => void;
  onToggleNotepad: () => void;
  activeTab: string;
  setActiveTab: (v: string) => void;
}) {
  const sources         = useAppStore(s => s.sources);
  const removeSource    = useAppStore(s => s.removeSource);
  const updateSourceMeta = useAppStore(s => s.updateSourceMeta);
  const [hoveredId, setHoveredId]   = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const totalChars = sources.reduce((acc, s) => acc + (s.charCount || 0), 0);

  const navSections = [
    {
      label: "Intelligence",
      items: [
        { id: "intelligence", icon: Sparkles, label: "Ask AI", desc: "Chat, search & reports" },
        { id: "agent",        icon: Bot,      label: "Agent",  desc: "Browser, files, email, shell", badgeIcons: [Globe, Mic, Mail] },
      ],
    },
    {
      label: "Data Tools",
      items: [
        { id: "analyze", icon: BarChart3, label: "Analyze", desc: "Charts, insights & cleaning" },
      ],
    },
    {
      label: "Connections",
      items: [
        { id: "connect", icon: Plug, label: "Connect", desc: "Cloud, databases & services" },
      ],
    },
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

  const handleRefresh = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const src = sources.find(s => s.id === id);
    if (!src) return;

    const creds = CredentialStorage.get(id);
    if (!creds) {
      toast.error("No credentials saved for this source. Re-connect it to refresh.");
      return;
    }

    setRefreshing(id);
    const toastId = toast.loading(`Refreshing ${src.name}…`);
    try {
      let content: string;
      const connector = CONNECTORS_BY_ID[src.type];

      if (connector?.executionMode === "server") {
        const res = await fetch("/api/connector/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectorId: src.type, credentials: creds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Refresh failed");
        content = data.content;
      } else {
        content = await runClientFetcher(src.type, creds);
      }

      ContentStorage.save(id, content);
      updateSourceMeta(id, {
        charCount: content.length,
        lastRefreshed: new Date().toISOString(),
        status: "connected",
      });
      toast.success(`${src.name} refreshed`, { id: toastId });
    } catch (err: any) {
      updateSourceMeta(id, { status: "error" });
      toast.error(`Refresh failed: ${err.message}`, { id: toastId });
    } finally {
      setRefreshing(null);
    }
  };

  return (
    <aside className="w-72 h-full flex flex-col shrink-0 border-r border-[rgba(255,255,255,0.05)] bg-[#06080a]/70 backdrop-blur-2xl z-20">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.04)]">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[1.2rem] font-semibold tracking-[-0.03em] text-white/90 leading-none">
            dedomena
          </h1>
          <span className="brand-sigma text-[1.8rem] text-white/25 leading-none select-none">Σ</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/"
            title="Home"
            className="p-1.5 rounded-lg text-white/30 hover:text-white/80 hover:bg-[rgba(255,255,255,0.05)] border border-transparent hover:border-[rgba(255,255,255,0.08)] transition-all"
          >
            <Home size={14} />
          </Link>
          <button
            type="button"
            title="Notepad"
            onClick={onToggleNotepad}
            className="p-1.5 rounded-lg text-white/30 hover:text-amber-400/70 hover:bg-[rgba(255,255,255,0.05)] border border-transparent hover:border-[rgba(255,255,255,0.08)] transition-all"
          >
            <StickyNote size={14} />
          </button>
          <button
            type="button"
            title="Settings"
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/80 hover:bg-[rgba(255,255,255,0.05)] border border-transparent hover:border-[rgba(255,255,255,0.08)] transition-all"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Navigation — grouped by section */}
      <div className="px-3 py-3 space-y-3">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-[9px] uppercase tracking-[0.14em] text-white/20 font-semibold px-3 mb-1">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left group",
                      isActive
                        ? "bg-[rgba(255,255,255,0.06)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_-1px_0_0_rgba(0,0,0,0.15)] border border-[rgba(255,255,255,0.08)]"
                        : "hover:bg-[rgba(255,255,255,0.03)] border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center transition-all shrink-0",
                      isActive
                        ? "bg-gradient-to-br from-[rgba(147,130,255,0.25)] to-[rgba(255,107,107,0.15)] text-white/90"
                        : "bg-[rgba(255,255,255,0.04)] text-white/35 group-hover:text-white/55"
                    )}>
                      <item.icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[13px] transition-colors tracking-[-0.01em]",
                          isActive ? "text-white font-medium" : "text-white/50 group-hover:text-white/80"
                        )}>
                          {item.label}
                        </span>
                        {(item as any).badgeIcons && (
                          <span className="flex items-center gap-1 ml-auto">
                            {(item as any).badgeIcons.map((BadgeIcon: any, bi: number) => (
                              <span key={bi} className="w-4 h-4 rounded flex items-center justify-center bg-white/[0.04]">
                                <BadgeIcon size={9} className="text-white/25" />
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        "text-[10px] leading-tight mt-0.5",
                        isActive ? "text-white/35" : "text-white/20"
                      )}>
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sources header */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[10px] uppercase tracking-[0.1em] text-white/25 font-semibold flex items-center gap-2">
            Connected Assets
            {sources.length > 0 && (
              <span className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 rounded-md text-white/50 text-[9px] font-mono">
                {sources.length}
              </span>
            )}
          </h2>
          {sources.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[9px] text-white/20 hover:text-red-400/60 uppercase tracking-wider transition-colors"
            >
              clear all
            </button>
          )}
        </div>
        {sources.length > 0 && (
          <p className="text-[9px] text-white/20 font-mono tracking-wide">{fmtChars(totalChars)} indexed</p>
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
              const connector  = CONNECTORS_BY_ID[src.type];
              const isExpanded = expandedId === src.id;
              const isHovered  = hoveredId === src.id;
              const isRefresh  = refreshing === src.id;
              const preview    = isExpanded ? ContentStorage.get(src.id)?.slice(0, 200) : null;
              const hasError   = src.status === "error";

              return (
                <motion.div
                  key={src.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10, height: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    "rounded-xl border transition-all duration-150 overflow-hidden",
                    hasError
                      ? "bg-red-500/[0.03] border-red-400/15 hover:border-red-400/25"
                      : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.1)]"
                  )}
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
                        color={connector?.color ?? "#888888"}
                        size={18}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium truncate flex-1 text-white/80">{src.name}</span>
                          <span className="text-[9px] text-white/25 font-mono shrink-0">{fmtChars(src.charCount)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {hasError
                            ? <AlertCircle size={9} className="text-red-400 shrink-0" />
                            : <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isRefresh ? "bg-amber-400 animate-pulse" : "bg-coral-500")} />
                          }
                          <span className={cn("text-[9px] tracking-wider font-mono shrink-0", freshnessColor(src.lastRefreshed ?? src.dateAdded))}>
                            {timeAgo(src.lastRefreshed ?? src.dateAdded)}
                          </span>
                          <span className="text-[9px] text-white/20 truncate">· {src.type}</span>
                        </div>
                      </div>

                      {/* Actions — visible on hover */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {(isHovered || isExpanded) && (
                          <>
                            <motion.button
                              type="button"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={(e) => handleRefresh(src.id, e)}
                              disabled={isRefresh}
                              className="p-1 rounded text-white/20 hover:text-[#18bfff] hover:bg-[#18bfff]/10 transition-all disabled:opacity-40"
                              title="Refresh data"
                            >
                              <RefreshCw size={11} className={isRefresh ? "animate-spin" : ""} />
                            </motion.button>
                            <motion.button
                              type="button"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={(e) => handleDelete(src.id, src.name, e)}
                              className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
                              title="Remove source"
                            >
                              <Trash2 size={11} />
                            </motion.button>
                          </>
                        )}
                        <span className="text-white/20 ml-0.5">
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
                          {src.lastRefreshed && (
                            <p className="text-[9px] text-white/20">
                              Last refreshed: {new Date(src.lastRefreshed).toLocaleString()}
                            </p>
                          )}
                          {preview ? (
                            <p className="text-[10px] text-white/35 leading-relaxed font-mono bg-white/[0.02] rounded-lg p-2 max-h-20 overflow-hidden">
                              {preview}{preview.length >= 200 ? "…" : ""}
                            </p>
                          ) : (
                            <p className="text-[10px] text-white/20 italic">No preview available</p>
                          )}
                          {hasError && (
                            <p className="text-[10px] text-red-400/70">
                              Last refresh failed. Click the refresh icon to retry.
                            </p>
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

      {/* Import CTA — Raycast-style semi-transparent white pill */}
      <div className="p-3 border-t border-[rgba(255,255,255,0.04)]">
        <button
          type="button"
          onClick={onAddSource}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold tracking-[-0.01em] transition-all duration-150",
            "bg-[hsla(0,0%,100%,0.9)] text-[#0d0f11] hover:bg-white",
            "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),inset_0_-1px_0_0_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.35)]",
            "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,1),0_4px_16px_rgba(0,0,0,0.4)]",
            "active:scale-[0.98]"
          )}
        >
          <Plus size={14} strokeWidth={2.5} /> Import Asset
        </button>
      </div>
    </aside>
  );
}
