"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Network, ArrowRightLeft, Eraser, CheckCircle2 } from "lucide-react";

export function EngineerView() {
  const [rules, setRules] = useState({
    impute: true,
    normalize: true,
    deduplicate: true,
  });

  const toggle = (key: keyof typeof rules) =>
    setRules(prev => ({ ...prev, [key]: !prev[key] }));

  const ruleList = [
    { key: "impute" as const,      icon: Eraser,          label: "Impute Missing Nulls" },
    { key: "normalize" as const,   icon: ArrowRightLeft,  label: "Normalize Types" },
    { key: "deduplicate" as const, icon: CheckCircle2,    label: "Deduplicate" },
  ];

  return (
    <motion.div 
      className="absolute inset-0 p-8 lg:p-12 overflow-y-auto w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="max-w-4xl mx-auto pb-24">
        {/* Header */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
            <Network size={12} className="text-coral-500" />
            <span>Data Operations</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter leading-[1.1]">
            Clean messy data <br />
            <span className="text-white/40">automatically.</span>
          </h2>
          <p className="text-white/40 max-w-lg mt-4 text-sm leading-relaxed">
            Select an asset. Our pipeline will evaluate structure, resolve missing values, handle duplications, and standardise schema autonomously.
          </p>
        </motion.div>

        {/* Config Bento */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.1}} className="lg:col-span-8">
            <GlassCard className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-10 bg-gradient-to-b from-white/[0.02] to-transparent">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
                <Network size={24} className="text-white/30" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Asset Selected</h3>
              <p className="text-sm text-white/40 max-w-sm mb-6">Select a dataset from the sidebar to begin data normalisation and engineering operations.</p>
              <Button variant="glass">Select Dataset</Button>
            </GlassCard>
          </motion.div>

          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2}} className="lg:col-span-4 space-y-6">
            <GlassCard>
              <h4 className="text-xs uppercase tracking-widest text-white/30 font-bold mb-4">Pipeline Rules</h4>
              <div className="space-y-3">
                {ruleList.map((rule) => {
                  const active = rules[rule.key];
                  return (
                    <button
                      type="button"
                      key={rule.key}
                      onClick={() => toggle(rule.key)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <rule.icon size={14} className={active ? "text-quartz-500" : "text-white/30"} />
                        <span className="text-xs font-medium">{rule.label}</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full border border-white/10 relative transition-colors ${active ? "bg-coral-500" : "bg-white/10"}`}>
                        <div className={`w-3 h-3 rounded-full bg-white absolute top-[1px] transition-all ${active ? "right-[1px]" : "left-[1px]"}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
