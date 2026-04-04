"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Command, RefreshCw, Layers } from "lucide-react";
import { useAppStore, ContentStorage } from "@/store";
import { toast } from "sonner";

const fadeUpParams = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as const }
};

export function IntelligenceView() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const sources = useAppStore(s => s.sources);
  const settings = useAppStore(s => s.settings);

  const executeSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    if (sources.length === 0) {
      toast.error("Please import at least one data asset to synthesize.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const sourcesData = sources.map(s => ({
        ...s,
        content: ContentStorage.get(s.id)
      }));

      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, sourcesData, systemPrompt: settings.systemPrompt })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Synthesis failed");

      setResult(data.result);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      className="absolute inset-0 p-8 lg:p-12 overflow-y-auto w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="max-w-4xl mx-auto space-y-12 pb-24">
        {/* Header Section */}
        <motion.div {...fadeUpParams} className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50 mb-6 font-mono tracking-widest uppercase">
            <Sparkles size={12} className="text-quartz-500" />
            <span>Neural Synthesis Engine</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter leading-[1.1]">
            Unlock insights across <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/40 to-white/10">all connected assets.</span>
          </h2>
        </motion.div>

        {/* Action Center - Bento Cell */}
        <motion.div {...fadeUpParams} transition={{ delay: 0.1 }}>
          <GlassCard className="p-2 sm:p-2 bg-gradient-to-br from-white/[0.02] to-transparent ring-1 ring-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-quartz-500/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-coral-500/5 blur-[100px] rounded-full mix-blend-screen pointer-events-none" />
            
            <div className="relative flex items-center gap-3 w-full bg-black/40 rounded-xl border border-white/10 p-2 shadow-inner">
              <Search className="ml-4 text-white/30" size={18} />
              <input
                type="text"
                placeholder="Ask about your infrastructure, contracts, or customer data..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeSearch(query)}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-lg py-4 placeholder:font-light"
              />
              <Button size="lg" className="rounded-lg gap-2 text-sm" onClick={() => executeSearch(query)} disabled={loading}>
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Command size={14} />} Synthesize
              </Button>
            </div>
          </GlassCard>
        </motion.div>

        {/* Dynamic Display Area */}
        <AnimatePresence mode="wait">
          {loading ? (
             <motion.div 
               key="loading"
               initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
               className="py-12 flex flex-col items-center justify-center space-y-4"
             >
                <div className="w-12 h-12 relative flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-t border-quartz-500 animate-[spin_1.5s_linear_infinite]" />
                  <Sparkles size={16} className="text-quartz-500/50 animate-pulse" />
                </div>
                <p className="text-xs text-white/40 font-mono tracking-widest uppercase">Processing across {sources.length} assets...</p>
             </motion.div>
          ) : result ? (
             <motion.div 
               key="result"
               initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
               className="space-y-6"
             >
                <GlassCard className="bg-quartz-500/5 border-quartz-500/20 shadow-[0_0_40px_rgba(144,202,249,0.03)]">
                  <div className="flex items-center gap-3 mb-4 text-quartz-500">
                    <Sparkles size={16} />
                    <h3 className="font-semibold text-sm tracking-widest uppercase">Executive Synthesis</h3>
                  </div>
                  <p className="text-white/80 leading-relaxed text-[15px]">{result.summary}</p>
                </GlassCard>

                {result.hits?.length > 0 && (
                  <div className="pt-4 space-y-4">
                    <h4 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-2 px-1">Source Attributions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.hits.map((hit: any, i: number) => (
                        <GlassCard key={i} className="bg-white/[0.01]">
                          <div className="flex items-center gap-2 mb-3">
                            <Layers size={14} className="text-white/30" />
                            <span className="text-sm font-semibold truncate text-white/90">{hit.sourceName}</span>
                          </div>
                          {hit.excerpt && (
                            <div className="pl-3 border-l-2 border-quartz-500/30 text-sm text-white/60 mb-3 italic">
                              "{hit.excerpt}"
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
            <motion.div 
              key="suggestions"
              {...fadeUpParams} transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {[
                { title: "Identify operational risks", desc: "Synthesizes standard context to identify missing links." },
                { title: "Summarize engineering logs", desc: "Correlates server metrics with the recent push timelines." },
                { title: "Generate customer intel", desc: "Consolidates Stripe metrics and Zendesk feedback." }
              ].map((s, i) => (
                <GlassCard key={i} hoverEffect className="group" onClick={() => executeSearch(s.title)}>
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
      </div>
    </motion.div>
  );
}
