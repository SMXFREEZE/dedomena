"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  X, ShieldCheck, Terminal, BarChart2, BookOpen, Code,
  PenTool, List, AlertTriangle, Database, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store";
import { AI_PRESETS, PRESETS_BY_ID } from "@/lib/presets";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, any> = {
  shield: ShieldCheck,
  "bar-chart": BarChart2,
  "book-open": BookOpen,
  code: Code,
  "pen-tool": PenTool,
  list: List,
  "alert-triangle": AlertTriangle,
  database: Database,
};

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { settings, updateSettings } = useAppStore();
  const [prompt, setPrompt] = useState(settings.systemPrompt);
  const [activePreset, setActivePreset] = useState(settings.activePreset || "default");

  if (!isOpen) return null;

  const selectPreset = (id: string) => {
    setActivePreset(id);
    const preset = PRESETS_BY_ID[id];
    if (preset) {
      setPrompt(preset.systemPrompt);
    }
  };

  const save = () => {
    updateSettings({ systemPrompt: prompt, activePreset });
    toast.success("Settings saved");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#030304]/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-[#0b0b0e] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col"
      >
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-quartz-500/30 to-transparent" />

        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">System Configuration</h2>
            <p className="text-sm text-white/40">Configure AI behaviour, presets, and data grounding.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}
            className="p-2 text-white/40 hover:text-white transition-colors bg-white/5 rounded-full">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto no-scrollbar">
          {/* AI Presets */}
          <div className="space-y-3">
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.1em]">
              AI Preset
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AI_PRESETS.map(preset => {
                const Icon = ICON_MAP[preset.icon] ?? ShieldCheck;
                const isActive = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => selectPreset(preset.id)}
                    className={cn(
                      "relative flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-all duration-150",
                      isActive
                        ? "border-[rgba(147,112,255,0.3)] bg-[rgba(147,112,255,0.08)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                        : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]"
                    )}
                  >
                    {isActive && (
                      <div className="absolute top-2 right-2">
                        <Check size={12} className="text-[#9370ff]" />
                      </div>
                    )}
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center",
                      isActive
                        ? "bg-[rgba(147,112,255,0.2)] text-[#9370ff]"
                        : "bg-white/5 text-white/30"
                    )}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className={cn(
                        "text-[11px] font-semibold",
                        isActive ? "text-white/90" : "text-white/60"
                      )}>
                        {preset.name}
                      </p>
                      <p className="text-[9px] text-white/30 leading-tight mt-0.5 line-clamp-2">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-coral-500/5 border border-coral-500/20">
            <ShieldCheck size={16} className="text-coral-500 shrink-0" />
            <p className="text-xs text-white/50">
              The AI engine is selected automatically based on your query complexity and dataset size.
              It will <strong className="text-white/70">never answer</strong> without imported data.
            </p>
          </div>

          {/* Custom system prompt */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
              <Terminal size={13} className="text-quartz-500" />
              {activePreset === "default" ? "Custom Instructions" : `${PRESETS_BY_ID[activePreset]?.name ?? "Preset"} Prompt`}
            </label>
            <textarea
              value={prompt}
              onChange={e => {
                setPrompt(e.target.value);
                if (activePreset !== "default") {
                  const preset = PRESETS_BY_ID[activePreset];
                  if (preset && e.target.value !== preset.systemPrompt) {
                    // User customized the preset prompt — keep the preset selection
                  }
                }
              }}
              placeholder={`Optional persona or focus. Example:\n"You are analyzing our company's Q3 sales data. Focus on regional performance and flag anything below target."\n\nLeave empty for default strict data-grounding mode.`}
              rows={5}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-quartz-500 resize-none leading-relaxed"
            />
            <p className="text-xs text-white/25 leading-relaxed">
              The AI always stays grounded to your imported data — it cannot answer without data and will never guess.
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
