"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ConnectorIcon } from "@/components/ui/connector-icon";
import { CONNECTORS_BY_ID } from "@/lib/connectors/registry";
import {
  Search, Sparkles, Command, RefreshCw, Layers,
  MessageSquare, BarChart2, Copy, Check, Download,
  ChevronRight, History, Database, AlertTriangle, StickyNote,
  Mic, MicOff,
} from "lucide-react";
import { useAppStore, ContentStorage } from "@/store";
import { toast } from "sonner";
import { cn, fmtChars } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Mode = "structured" | "chat";

interface Message {
  role: "user" | "assistant";
  content: string;
  hits?: any[];
  found?: boolean;
  streaming?: boolean;
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as const },
};

const BASE_SUGGESTIONS = [
  "Summarise the key themes across all my data",
  "What are the most important metrics or KPIs?",
  "Identify any risks, gaps, or anomalies",
  "Give me a timeline of key events",
  "Who are the main people or entities involved?",
  "What patterns or trends do you see?",
];

const TYPE_SUGGESTIONS: Record<string, string[]> = {
  gmail:            ["What emails need urgent attention?", "Summarise my inbox by sender", "Find emails about payments or invoices"],
  outlook:          ["What emails need urgent attention?", "Summarise my inbox by sender", "What meetings are scheduled?"],
  slack:            ["What are the main discussion topics?", "Any blockers or issues mentioned?", "Who is most active?"],
  notion:           ["Summarise this database", "What tasks are overdue?", "Extract all action items"],
  airtable:         ["Show me a summary of all records", "What fields have the most missing data?", "Find duplicate entries"],
  github:           ["What PRs are open and by whom?", "Any recurring bugs or issues?", "Summarise recent commits"],
  jira:             ["What tickets are unresolved?", "Show sprint progress", "Any blockers this week?"],
  linear:           ["What issues are in progress?", "Any high-priority bugs?", "Show velocity by team member"],
  stripe:           ["Revenue this month vs last month", "Who are my top customers?", "Any failed payments?"],
  shopify:          ["Top selling products", "Any abandoned carts?", "Revenue by region"],
  hubspot:          ["How many leads this week?", "What's the conversion rate?", "Top deals in pipeline"],
  salesforce:       ["Show open opportunities", "Accounts with no activity", "Revenue forecast"],
  postgresql:       ["How many rows in this table?", "Find duplicate records", "Show column summary statistics"],
  mysql:            ["How many rows in this table?", "Find duplicate records", "Show column summary statistics"],
  mongodb:          ["Summarise the document structure", "Find documents with missing fields", "Count by category"],
  snowflake:        ["Query the largest tables", "Data quality summary", "Row counts by schema"],
  bigquery:         ["Summarise this dataset", "Find null values", "Show row count by table"],
  databricks:       ["Summarise the lakehouse schema", "Find data quality issues", "Show recent query patterns"],
  "google-sheets":  ["Summarise the spreadsheet", "Find empty cells or errors", "What trends do you see?"],
  "google-analytics": ["Top pages by traffic", "Bounce rate trends", "Traffic source breakdown"],
  "local-file":     ["Summarise this file", "What are the key data points?", "Extract all tables or lists"],
};

function getSuggestions(sourceTypes: string[]): string[] {
  const specific: string[] = [];
  for (const t of sourceTypes) {
    if (TYPE_SUGGESTIONS[t]) specific.push(...TYPE_SUGGESTIONS[t].slice(0, 2));
  }
  const combined = [...new Set([...specific, ...BASE_SUGGESTIONS])];
  return combined.slice(0, 6);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      title="Copy"
      className={cn("p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all", className)}
    >
      {copied ? <Check size={13} className="text-coral-400" /> : <Copy size={13} />}
    </button>
  );
}

function downloadBlob(content: string, filename: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: mime });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportMarkdown(result: any) {
  const lines = [
    "# Dedomena Analysis\n",
    `> Generated ${new Date().toLocaleString()}\n`,
    "## Executive Synthesis\n",
    result.summary + "\n",
  ];
  if (result.hits?.length) {
    lines.push("## Source Attributions\n");
    result.hits.forEach((h: any) => {
      lines.push(`### ${h.sourceName}`);
      if (h.excerpt) lines.push(`> ${h.excerpt}`);
      if (h.relevance) lines.push(`\n${h.relevance}`);
      lines.push("");
    });
  }
  downloadBlob(lines.join("\n"), `dedomena-analysis-${Date.now()}.md`);
}

function exportChat(messages: Message[]) {
  const lines = [
    "# Dedomena Chat Export\n",
    `> Exported ${new Date().toLocaleString()}\n`,
  ];
  messages.forEach(m => {
    lines.push(`\n## ${m.role === "user" ? "You" : "Assistant"}\n`);
    lines.push(m.content);
    if (m.hits?.length) {
      lines.push("\n**Sources:**");
      m.hits.forEach((h: any) => lines.push(`- **${h.sourceName}**: ${h.excerpt ?? ""}`));
    }
  });
  downloadBlob(lines.join("\n"), `dedomena-chat-${Date.now()}.md`);
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function IntelligenceView() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("structured");
  const [messages, setMessages] = useState<Message[]>([]);
  const [structuredResult, setStructuredResult] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const sources = useAppStore(s => s.sources);
  const suggestions = getSuggestions(sources.map(s => s.type));
  const settings = useAppStore(s => s.settings);
  const queryHistory = useAppStore(s => s.queryHistory);
  const addQueryRecord = useAppStore(s => s.addQueryRecord);
  const clearHistory = useAppStore(s => s.clearHistory);
  const addNote = useAppStore(s => s.addNote);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep selectedIds in sync when sources change
  useEffect(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      // Remove any IDs that no longer exist
      for (const id of next) {
        if (!sources.find(s => s.id === id)) next.delete(id);
      }
      return next;
    });
  }, [sources]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, structuredResult]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleVoiceInput = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    let final = query;
    recognition.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        else interim = e.results[i][0].transcript;
      }
      setQuery(final + interim);
    };
    recognition.onerror = (e: any) => { if (e.error !== "aborted") toast.error(`Voice: ${e.error}`); setListening(false); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, query]);

  const activeSources = selectedIds.size > 0
    ? sources.filter(s => selectedIds.has(s.id))
    : sources;

  const totalActiveChars = activeSources.reduce((n, s) => n + (s.charCount ?? 0), 0);
  const isOverBudget = totalActiveChars > 800000;

  const toggleSource = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      // Empty set = all selected. When user first deselects, populate set with all except deselected.
      if (next.size === 0) {
        sources.forEach(s => { if (s.id !== id) next.add(s.id); });
      } else if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) return new Set(); // back to "all"
      } else {
        next.add(id);
        if (next.size === sources.length) return new Set(); // back to "all"
      }
      return next;
    });
  };

  const execute = useCallback(async (q: string) => {
    if (!q.trim()) return;
    if (sources.length === 0) {
      toast.error("Import at least one data asset first.");
      return;
    }

    setLoading(true);
    const effectiveMode = mode;

    if (effectiveMode === "chat") {
      setMessages(prev => [...prev, { role: "user", content: q }]);
    } else {
      setStructuredResult(null);
    }
    setQuery("");

    // Record query in history
    addQueryRecord({
      query: q,
      mode: effectiveMode,
      timestamp: new Date().toISOString(),
      sourceNames: activeSources.map(s => s.name),
    });

    try {
      const sourcesData = activeSources.map(s => ({ ...s, content: ContentStorage.get(s.id) }));

      const selectedSourceIds = selectedIds.size > 0 ? [...selectedIds] : undefined;

      // Build conversation history for multi-turn context (chat mode only)
      const chatHistory = effectiveMode === "chat" && messages.length > 0
        ? messages.filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content }))
        : undefined;

      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          sourcesData,
          systemPrompt: settings.systemPrompt,
          mode: effectiveMode,
          selectedSourceIds,
          chatHistory,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Synthesis failed");
      }

      const contentType = res.headers.get("content-type") ?? "";

      if (effectiveMode === "chat" && contentType.includes("text/plain")) {
        // ── Streaming chat ──────────────────────────────────────────────
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let lastFlush = 0;

        setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += decoder.decode(value, { stream: true });
            // Throttle re-renders: flush at most every 40ms
            const now = Date.now();
            if (now - lastFlush > 40) {
              lastFlush = now;
              const snap = accumulated;
              setMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { role: "assistant", content: snap, streaming: true };
                return msgs;
              });
            }
          }
        } catch (streamErr: any) {
          // Stream interrupted — keep what we got, mark as done
          accumulated += accumulated ? "\n\n[Response interrupted]" : "[Connection interrupted]";
        } finally {
          reader.cancel().catch(() => {});
        }

        setMessages(prev => {
          const msgs = [...prev];
          msgs[msgs.length - 1] = { role: "assistant", content: accumulated, streaming: false };
          return msgs;
        });
      } else {
        // ── Non-streaming (structured or fallback) ──────────────────────
        const data = await res.json();
        if (effectiveMode === "chat") {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: data.result.summary,
            hits: data.result.hits,
            found: data.result.found,
          }]);
        } else {
          setStructuredResult(data.result);
        }
      }
    } catch (e: any) {
      toast.error(e.message);
      if (effectiveMode === "chat") {
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${e.message}`, found: false }]);
      }
    } finally {
      setLoading(false);
    }
  }, [sources, settings, mode, activeSources, selectedIds, addQueryRecord]);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="px-8 lg:px-12 pt-8 pb-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp} className="flex items-center justify-between mb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-[11px] text-white/40 mb-4 tracking-[0.12em] uppercase">
                <Sparkles size={11} className="text-[#9370ff]" />
                <span>Neural Synthesis Engine</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.04em] leading-[1.05]">
                Ask anything about<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/35 to-white/10">
                  your connected data.
                </span>
              </h2>
            </div>

            <div className="flex flex-col items-end gap-2">
              {/* Mode toggle — Linear luminance-stepped active state */}
              <div className="flex items-center gap-0.5 p-1 bg-[rgba(255,255,255,0.03)] rounded-lg border border-[rgba(255,255,255,0.07)]">
                {([
                  { id: "structured", icon: BarChart2, label: "Structured" },
                  { id: "chat",       icon: MessageSquare, label: "Chat" },
                ] as const).map(({ id, icon: Icon, label }) => (
                  <button key={id} type="button"
                    onClick={() => { setMode(id); if (id === "chat") setStructuredResult(null); }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150",
                      mode === id
                        ? "bg-[rgba(255,255,255,0.08)] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                        : "text-white/35 hover:text-white/65"
                    )}>
                    <Icon size={11} /> {label}
                  </button>
                ))}
              </div>
              {/* History toggle */}
              <button type="button" onClick={() => setShowHistory(v => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all",
                  showHistory
                    ? "bg-[rgba(255,255,255,0.06)] text-white/60 border border-[rgba(255,255,255,0.08)]"
                    : "text-white/25 hover:text-white/55 border border-transparent"
                )}>
                <History size={11} />
                History {queryHistory.length > 0 && `(${queryHistory.length})`}
              </button>
            </div>
          </motion.div>

          {/* Source selector */}
          {sources.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {sources.map(src => {
                  const connector = CONNECTORS_BY_ID[src.type];
                  const isActive = selectedIds.size === 0 || selectedIds.has(src.id);
                  return (
                    <button
                      type="button"
                      key={src.id}
                      onClick={() => toggleSource(src.id)}
                      className={cn(
                        // Linear pill chip style
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] transition-all duration-150",
                        isActive
                          ? "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] text-white/75 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                          : "border-[rgba(255,255,255,0.05)] bg-transparent text-white/25 hover:text-white/50 hover:border-[rgba(255,255,255,0.09)]"
                      )}
                    >
                      <ConnectorIcon
                        iconSlug={connector?.iconSlug}
                        name={connector?.name ?? src.type}
                        color={isActive ? (connector?.color ?? "#888") : "#555"}
                        size={12}
                      />
                      <span className="truncate max-w-[90px] tracking-[-0.01em]">{src.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[10px] font-mono",
                  isOverBudget ? "text-amber-400/70" : "text-white/25"
                )}>
                  {activeSources.length} of {sources.length} sources · {fmtChars(totalActiveChars)}
                  {isOverBudget && " · large dataset — will be proportionally sampled"}
                </span>
                {isOverBudget && <AlertTriangle size={11} className="text-amber-400/70" />}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 lg:px-12 pb-4">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* ── HISTORY PANEL ── */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <GlassCard className="bg-white/[0.01]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Query History</span>
                    {queryHistory.length > 0 && (
                      <button type="button" onClick={clearHistory}
                        className="text-[10px] text-white/20 hover:text-red-400/60 transition-colors">
                        Clear all
                      </button>
                    )}
                  </div>
                  {queryHistory.length === 0 ? (
                    <p className="text-xs text-white/25 italic">No queries yet.</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar">
                      {queryHistory.map(rec => (
                        <button
                          type="button"
                          key={rec.id}
                          onClick={() => { execute(rec.query); setShowHistory(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
                        >
                          <span className={cn(
                            "text-[9px] uppercase font-mono shrink-0 px-1.5 py-0.5 rounded",
                            rec.mode === "chat" ? "bg-quartz-500/15 text-quartz-500/70" : "bg-white/10 text-white/40"
                          )}>
                            {rec.mode}
                          </span>
                          <span className="text-xs text-white/50 group-hover:text-white/80 truncate flex-1 transition-colors">{rec.query}</span>
                          <span className="text-[9px] text-white/20 shrink-0">
                            {new Date(rec.timestamp).toLocaleDateString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── CHAT MODE ── */}
          {mode === "chat" && (
            <div className="space-y-4">
              {messages.length === 0 && !loading && (
                <motion.div {...fadeUp} className="space-y-3 mt-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/20 font-semibold">Suggested queries</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {suggestions.map((q, i) => (
                      <button type="button" key={i} onClick={() => execute(q)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left group transition-all duration-150",
                          "bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]",
                          "hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.11)]",
                          "hover:shadow-[0_0_0_1px_rgba(18,20,24,0.9),inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                        )}>
                        <ChevronRight size={10} className="text-white/15 group-hover:text-[#9370ff]/70 shrink-0 transition-colors" />
                        <span className="text-[12px] text-white/45 group-hover:text-white/80 transition-colors tracking-[-0.01em] leading-snug">{q}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "user" ? (
                      // User bubble — Raycast card style with inset top highlight
                      <div className={cn(
                        "max-w-[75%] px-4 py-3 text-[13px] text-white/90 leading-relaxed rounded-2xl rounded-tr-sm",
                        "bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)]",
                        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                      )}>
                        {msg.content}
                      </div>
                    ) : (
                      <div className="max-w-[90%] space-y-3">
                        {/* Assistant bubble — Linear card with violet accent */}
                        <GlassCard className={cn(
                          "bg-[rgba(147,112,255,0.04)] border-[rgba(147,112,255,0.15)]",
                          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                        )}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-[#9370ff]/80">
                              <Sparkles size={12} />
                              <span className="text-[11px] font-semibold tracking-[0.1em] uppercase">Analysis</span>
                              {msg.streaming && (
                                <div className="w-1 h-3.5 bg-[#9370ff]/50 rounded-sm animate-pulse ml-1" />
                              )}
                            </div>
                            {!msg.streaming && (
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  title="Pin to notepad"
                                  onClick={() => {
                                    addNote({ title: `Chat — ${new Date().toLocaleDateString()}`, content: msg.content, sourceQuery: messages.find(m => m.role === "user")?.content });
                                    toast.success("Pinned to notepad");
                                  }}
                                  className="p-1.5 rounded-lg text-white/20 hover:text-amber-400/60 hover:bg-white/5 transition-all"
                                >
                                  <StickyNote size={12} />
                                </button>
                                <CopyButton text={msg.content} />
                              </div>
                            )}
                          </div>
                          <div className="prose-chat text-[13px] text-white/80 leading-relaxed tracking-[-0.01em]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        </GlassCard>
                        {!msg.streaming && msg.hits && msg.hits.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {msg.hits.map((hit: any, j: number) => (
                              <GlassCard key={j} className="bg-white/[0.01] p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Layers size={12} className="text-white/30" />
                                  <span className="text-xs font-semibold truncate text-white/80">{hit.sourceName}</span>
                                </div>
                                {hit.excerpt && (
                                  <p className="text-xs text-white/50 italic border-l-2 border-quartz-500/30 pl-2 mb-2">
                                    &ldquo;{hit.excerpt}&rdquo;
                                  </p>
                                )}
                                <p className="text-[11px] text-white/35">{hit.relevance}</p>
                              </GlassCard>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && messages[messages.length - 1]?.role !== "assistant" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 pl-1">
                  <div className="w-6 h-6 rounded-full border-t border-quartz-500 animate-[spin_1.5s_linear_infinite]" />
                  <span className="text-xs text-white/40 font-mono">
                    Analysing {activeSources.length} source{activeSources.length !== 1 ? "s" : ""}…
                  </span>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* ── STRUCTURED MODE ── */}
          {mode === "structured" && (
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="py-16 flex flex-col items-center gap-4">
                  <div className="w-12 h-12 relative flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-t border-quartz-500 animate-[spin_1.5s_linear_infinite]" />
                    <Sparkles size={16} className="text-quartz-500/50 animate-pulse" />
                  </div>
                  <p className="text-xs text-white/40 font-mono tracking-widest uppercase">
                    Processing {activeSources.length} asset{activeSources.length !== 1 ? "s" : ""}…
                  </p>
                  {isOverBudget && (
                    <p className="text-[11px] text-amber-400/50 text-center max-w-xs">
                      Large dataset detected — proportionally sampling each source to fit context window.
                    </p>
                  )}
                </motion.div>
              ) : structuredResult ? (
                <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <GlassCard className="bg-quartz-500/5 border-quartz-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 text-quartz-500">
                        <Sparkles size={16} />
                        <h3 className="font-semibold text-sm tracking-widest uppercase">Executive Synthesis</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Pin to notepad"
                          onClick={() => {
                            addNote({ title: `Analysis — ${new Date().toLocaleDateString()}`, content: structuredResult.summary });
                            toast.success("Pinned to notepad");
                          }}
                          className="p-1.5 rounded-lg text-white/20 hover:text-amber-400/60 hover:bg-white/5 transition-all"
                        >
                          <StickyNote size={13} />
                        </button>
                        <CopyButton text={structuredResult.summary} />
                        <button type="button" onClick={() => exportMarkdown(structuredResult)} title="Export as Markdown"
                          className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all">
                          <Download size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="prose-chat text-white/80 leading-relaxed text-[15px]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{structuredResult.summary}</ReactMarkdown>
                    </div>
                  </GlassCard>

                  {structuredResult.hits?.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-xs uppercase tracking-widest font-bold text-white/40 px-1">Source Attributions</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {structuredResult.hits.map((hit: any, i: number) => (
                          <GlassCard key={i} className="bg-white/[0.01]">
                            <div className="flex items-center gap-2 mb-3">
                              <Layers size={14} className="text-white/30" />
                              <span className="text-sm font-semibold truncate text-white/90">{hit.sourceName}</span>
                            </div>
                            {hit.excerpt && (
                              <div className="pl-3 border-l-2 border-quartz-500/30 text-sm text-white/60 mb-3 italic">
                                &ldquo;{hit.excerpt}&rdquo;
                              </div>
                            )}
                            <p className="text-xs text-white/40">{hit.relevance}</p>
                          </GlassCard>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <p className="text-[10px] uppercase tracking-widest text-white/25 font-bold">Follow-up in Chat</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {[
                        "Dig deeper into the key findings",
                        "What actions should I take based on this?",
                        "Summarise this as a bullet-point report",
                      ].map((q, i) => (
                        <button type="button" key={i}
                          onClick={() => { setMode("chat"); setTimeout(() => execute(q), 50); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/15 transition-all text-left group">
                          <ChevronRight size={10} className="text-white/20 group-hover:text-quartz-500 shrink-0 transition-colors" />
                          <span className="text-[11px] text-white/40 group-hover:text-white/70 transition-colors">{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="empty" {...fadeUp} transition={{ delay: 0.1 }} className="space-y-6 mt-2">
                  {sources.length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-4 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                        <Database size={24} className="text-white/20" />
                      </div>
                      <p className="text-sm text-white/40 max-w-sm">
                        No data sources connected yet. Import assets from the sidebar to begin analysis.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                          { title: "Identify operational risks", desc: "Find gaps and anomalies across all your assets." },
                          { title: "Revenue & KPI summary", desc: "Surface key metrics from financial and sales data." },
                          { title: "Customer intelligence", desc: "Consolidate CRM, support, and usage data." },
                        ].map((s, i) => (
                          <GlassCard key={i} hoverEffect className="group cursor-pointer" onClick={() => execute(s.title)}>
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                              <Sparkles size={14} className="text-white/40 group-hover:text-coral-500 transition-colors" />
                            </div>
                            <h3 className="text-sm font-semibold opacity-80 mb-2">{s.title}</h3>
                            <p className="text-xs text-white/40 line-clamp-2">{s.desc}</p>
                          </GlassCard>
                        ))}
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] uppercase tracking-widest text-white/25 font-bold">More suggestions</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {suggestions.map((q, i) => (
                            <button type="button" key={i} onClick={() => execute(q)}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/15 transition-all text-left group">
                              <ChevronRight size={11} className="text-white/20 group-hover:text-quartz-500 shrink-0 transition-colors" />
                              <span className="text-xs text-white/50 group-hover:text-white/80 transition-colors">{q}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-8 lg:px-12 py-4 border-t border-white/5 bg-black/20">
        <div className="max-w-4xl mx-auto">
          <GlassCard className="p-2 bg-gradient-to-br from-white/[0.02] to-transparent ring-1 ring-white/10">
            <div className="flex items-center gap-3 w-full bg-black/40 rounded-xl border border-white/10 p-2 shadow-inner">
              {mode === "chat"
                ? <MessageSquare className="ml-4 text-white/30 shrink-0" size={18} />
                : <Search className="ml-4 text-white/30 shrink-0" size={18} />
              }
              <input
                ref={inputRef}
                type="text"
                placeholder={mode === "chat"
                  ? "Ask anything about your connected data…"
                  : "Describe what you need to know across your datasets…"}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && !loading && execute(query)}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm py-3 placeholder:font-light"
              />
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    listening
                      ? "text-red-400 bg-red-400/10 animate-pulse"
                      : "text-white/20 hover:text-white/50 hover:bg-white/5"
                  )}
                  title={listening ? "Stop listening" : "Voice input"}
                >
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                <span className="text-[10px] text-white/15 font-mono hidden md:block">⌘K</span>
                <Button size="lg" className="rounded-lg gap-2 text-sm" onClick={() => execute(query)} disabled={loading}>
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <Command size={14} />}
                  {mode === "chat" ? "Send" : "Synthesize"}
                </Button>
              </div>
            </div>
          </GlassCard>
          {mode === "chat" && messages.length > 0 && (
            <div className="mt-2 flex items-center justify-center gap-4">
              <button type="button" onClick={() => exportChat(messages)}
                className="text-[11px] text-white/25 hover:text-[#18bfff] transition-colors flex items-center gap-1">
                <Download size={11} /> Export chat
              </button>
              <span className="text-white/10">·</span>
              <button type="button" onClick={() => setMessages([])}
                className="text-[11px] text-white/25 hover:text-white/50 transition-colors">
                Clear conversation
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
