"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Network, Wrench } from "lucide-react";
import { EngineerView } from "./engineer-view";
import { AnalystView } from "./analyst-view";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "analyst",  icon: BarChart3, label: "Charts & Insights" },
  { id: "engineer", icon: Wrench,    label: "Clean & Transform" },
] as const;

export function AnalyzeView() {
  const [tab, setTab] = useState<"analyst" | "engineer">("analyst");

  return (
    <motion.div
      className="absolute inset-0 flex flex-col w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Sub-tab bar */}
      <div className="px-8 lg:px-12 pt-6 pb-0 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-1 p-1 bg-[rgba(255,255,255,0.03)] rounded-lg border border-[rgba(255,255,255,0.07)] w-fit">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-md text-[12px] font-medium transition-all duration-150",
                tab === id
                  ? "bg-[rgba(255,255,255,0.08)] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                  : "text-white/35 hover:text-white/65"
              )}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* View content — positioned to fill remaining space */}
      <div className="flex-1 relative overflow-hidden">
        {tab === "analyst" && <AnalystView />}
        {tab === "engineer" && <EngineerView />}
      </div>
    </motion.div>
  );
}
