"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Command } from "lucide-react";

const fadeUpParams = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as const }
};

export function IntelligenceView() {
  const [query, setQuery] = useState("");

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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50 mb-6">
            <Sparkles size={12} className="text-quartz-500" />
            <span>Neural Synthesis Engine</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter leading-[1.1]">
            Unlock insights across <br />
            <span className="text-white/40">all connected assets.</span>
          </h2>
        </motion.div>

        {/* Action Center - Bento Cell */}
        <motion.div {...fadeUpParams} transition={{ delay: 0.1 }}>
          <GlassCard className="p-2 sm:p-2 bg-gradient-to-br from-white/[0.03] to-transparent ring-1 ring-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-quartz-500/10 blur-[100px] rounded-full mix-blend-screen pointer-events-none" />
            
            <div className="relative flex items-center gap-4 w-full bg-black/40 rounded-xl border border-white/5 p-2">
              <Search className="ml-4 text-white/30" />
              <input
                type="text"
                placeholder="Ask about your infrastructure, contracts, or customer data..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-lg py-4"
              />
              <Button size="lg" className="rounded-lg gap-2 text-sm">
                <Command size={14} /> Synthesize
              </Button>
            </div>
          </GlassCard>
        </motion.div>

        {/* Suggestion Bento Grid */}
        <motion.div 
          {...fadeUpParams} 
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {["Identify contract risks", "Summarize latest AWS logs", "Generate customer intel"].map((s, i) => (
            <GlassCard key={i} hoverEffect className="group" onClick={() => setQuery(s)}>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                <Sparkles size={14} className="text-white/40 group-hover:text-coral-500 transition-colors" />
              </div>
              <h3 className="text-sm font-semibold opacity-80 mb-2">{s}</h3>
              <p className="text-xs text-white/40 line-clamp-2">Quickly synthesize connected context to answer this query across all integrated sources automatically.</p>
            </GlassCard>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
