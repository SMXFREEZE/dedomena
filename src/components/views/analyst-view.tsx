"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Blocks, BarChart3, LineChart, PieChart } from "lucide-react";

export function AnalystView() {
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
            <Blocks size={12} className="text-[#18bfff]" />
            <span>Insight Generation</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter leading-[1.1]">
            Visualize trends from <br />
            <span className="text-white/40">raw complexity.</span>
          </h2>
          <p className="text-white/40 max-w-lg mt-4 text-sm leading-relaxed">
            Extract aggregate information, compute metrics, and generate dynamic visual representations from connected databases or documents.
          </p>
        </motion.div>

        {/* Charts Bento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.1}} className="col-span-1 md:col-span-2">
            <GlassCard className="h-64 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-white/[0.04] to-transparent ring-[1px]">
               <BarChart3 className="text-white/20 mb-4" size={32} />
               <p className="text-sm font-medium text-white/60 mb-1">Waiting for Query</p>
               <p className="text-xs text-white/30">Connect a dataset and request a chart representation</p>
            </GlassCard>
          </motion.div>

          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2}}>
            <GlassCard hoverEffect className="group">
              <LineChart size={18} className="text-white/40 mb-3 group-hover:text-[#18bfff] transition-colors" />
              <h3 className="text-sm font-semibold mb-1">Time Series Analysis</h3>
              <p className="text-xs text-white/40">Plot dates automatically extracted from raw text documents against frequency.</p>
            </GlassCard>
          </motion.div>

          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.3}}>
            <GlassCard hoverEffect className="group">
              <PieChart size={18} className="text-white/40 mb-3 group-hover:text-coral-500 transition-colors" />
              <h3 className="text-sm font-semibold mb-1">Distribution Clustering</h3>
              <p className="text-xs text-white/40">Group categorical terms into segments for immediate structural insights.</p>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
