"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Command, RefreshCw, Layers, MessageSquare, BarChart2 } from "lucide-react";
import { useAppStore, ContentStorage } from "@/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mode = "structured" | "chat";

interface Message {
  role: "user" | "assistant";
  content: string;
  hits?: any[];
  found?: boolean;
  mode?: Mode;
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as const },
};

export function IntelligenceView() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("structured");
  const [messages, setMessages] = useState<Message[]>([]);
  const [structuredResult, setStructuredResult] = useState<any>(null);

  const sources = useAppStore(s => s.sources);
  const settings = useAppStore(s => s.settings);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, structuredResult]);

  const execute = async (q: string) => {
    if (!q.trim()) return;
    if (sources.length === 0) {
      toast.error("Import at least one data asset first.");
      return;
    }

    setLoading(true);
    if (mode === "chat") {
      setMessages(prev => [...prev, { role: "user", content: q }]);
    } else {
      setStructuredResult(null);
    }
    setQuery("");

    try {
      const sourcesData = sources.map(s => ({
        ...s,
        content: ContentStorage.get(s.id),
      }));

      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, sourcesData, systemPrompt: settings.systemPrompt, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Synthesis failed");

      if (mode === "chat") {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.result.summary,
          hits: data.result.hits,
          found: data.result.found,
          mode: "chat",
        }]);
      } else {
        setStructuredResult(data.result);
      }
    } catch (e: any) {
      toast.error(e.message);
      if (mode === "chat") {
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${e.message}`, found: false }]);
      }
    } finally {
      setLoading(false);
    }
  };

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
          <motion.div {...fadeUp} className="flex items-center justify-between mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50 mb-3 font-mono tracking-widest uppercase">
                <Sparkles size={12} className="text-quartz-500" />
                <span>Neural Synthesis Engine</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tighter leading-tight">
                Ask anything about<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/40 to-white/10">your connected data.</span>
              </h2>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 self-start mt-1">
              <button
                type="button"
                onClick={() => setMode("structured")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  mode === "structured" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                <BarChart2 size={12} /> Structured
              </button>
              <button
                type="button"
                onClick={() => { setMode("chat"); setStructuredResult(null); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  mode === "chat" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                <MessageSquare size={12} /> Chat
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-8 lg:px-12 pb-4">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ── CHAT MODE ── */}
          {mode === "chat" && (
            <div className="space-y-4">
              {messages.length === 0 && !loading && (
                <motion.div {...fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {[
                    { q: "Summarize the key themes across all my data" },
                    { q: "What patterns do you notice in this dataset?" },
                    { q: "Give me a detailed breakdown and analysis" },
                  ].map((s, i) => (
                    <GlassCard key={i} hoverEffect className="group cursor-pointer" onClick={() => execute(s.q)}>
                      <MessageSquare size={14} className="text-white/30 group-hover:text-quartz-500 mb-3 transition-colors" />
                      <p className="text-xs text-white/60 group-hover:text-white/80 transition-colors">{s.q}</p>
                    </GlassCard>
                  ))}
                </motion.div>
              )}

              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {msg.role === "user" ? (
                      <div className="max-w-[75%] bg-white/10 border border-white/10 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white/90">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="max-w-[90%] space-y-3">
                        <GlassCard className="bg-quartz-500/5 border-quartz-500/20">
                          <div className="flex items-center gap-2 mb-3 text-quartz-500">
                            <Sparkles size={13} />
                            <span className="text-xs font-semibold tracking-widest uppercase">Analysis</span>
                          </div>
                          <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </GlassCard>
                        {msg.hits && msg.hits.length > 0 && (
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

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 pl-1">
                  <div className="w-6 h-6 rounded-full border-t border-quartz-500 animate-[spin_1.5s_linear_infinite]" />
                  <span className="text-xs text-white/40 font-mono">Analysing {sources.length} source{sources.length !== 1 ? 's' : ''}…</span>
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
                  className="py-16 flex flex-col items-center gap-4"
                >
                  <div className="w-12 h-12 relative flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-t border-quartz-500 animate-[spin_1.5s_linear_infinite]" />
                    <Sparkles size={16} className="text-quartz-500/50 animate-pulse" />
                  </div>
                  <p className="text-xs text-white/40 font-mono tracking-widest uppercase">
                    Processing {sources.length} asset{sources.length !== 1 ? 's' : ''}…
                  </p>
                </motion.div>
              ) : structuredResult ? (
                <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <GlassCard className="bg-quartz-500/5 border-quartz-500/20">
                    <div className="flex items-center gap-3 mb-4 text-quartz-500">
                      <Sparkles size={16} />
                      <h3 className="font-semibold text-sm tracking-widest uppercase">Executive Synthesis</h3>
                    </div>
                    <p className="text-white/80 leading-relaxed text-[15px] whitespace-pre-wrap">{structuredResult.summary}</p>
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
                </motion.div>
              ) : (
                <motion.div key="suggestions" {...fadeUp} transition={{ delay: 0.1 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4"
                >
                  {[
                    { title: "Identify operational risks", desc: "Find gaps and missing links across your assets." },
                    { title: "Summarise engineering logs", desc: "Correlate metrics with recent deployment timelines." },
                    { title: "Generate customer intelligence", desc: "Consolidate CRM and support data into insights." },
                  ].map((s, i) => (
                    <GlassCard key={i} hoverEffect className="group cursor-pointer" onClick={() => execute(s.title)}>
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                        <Sparkles size={14} className="text-white/40 group-hover:text-coral-500 transition-colors" />
                      </div>
                      <h3 className="text-sm font-semibold opacity-80 mb-2">{s.title}</h3>
                      <p className="text-xs text-white/40 line-clamp-2">{s.desc}</p>
                    </GlassCard>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Input bar — pinned to bottom */}
      <div className="shrink-0 px-8 lg:px-12 py-4 border-t border-white/5 bg-black/20">
        <div className="max-w-4xl mx-auto">
          <GlassCard className="p-2 bg-gradient-to-br from-white/[0.02] to-transparent ring-1 ring-white/10">
            <div className="flex items-center gap-3 w-full bg-black/40 rounded-xl border border-white/10 p-2 shadow-inner">
              {mode === "chat" ? <MessageSquare className="ml-4 text-white/30" size={18} /> : <Search className="ml-4 text-white/30" size={18} />}
              <input
                type="text"
                placeholder={mode === "chat"
                  ? "Ask anything about your data — general questions, stats, summaries…"
                  : "Ask about your infrastructure, contracts, or customer data…"}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && execute(query)}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm py-3 placeholder:font-light"
              />
              <Button size="lg" className="rounded-lg gap-2 text-sm" onClick={() => execute(query)} disabled={loading}>
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Command size={14} />}
                {mode === "chat" ? "Send" : "Synthesize"}
              </Button>
            </div>
          </GlassCard>
          {mode === "chat" && messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="mt-2 text-[11px] text-white/25 hover:text-white/50 transition-colors w-full text-center"
            >
              Clear conversation
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
