"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, ShieldCheck, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store";
import { toast } from "sonner";

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { settings, updateSettings } = useAppStore();
  const [prompt, setPrompt] = useState(settings.systemPrompt);

  if (!isOpen) return null;

  const save = () => {
    updateSettings({ systemPrompt: prompt });
    toast.success("Settings saved");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#030304]/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-[#0b0b0e] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative"
      >
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-quartz-500/30 to-transparent" />

        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">System Configuration</h2>
            <p className="text-sm text-white/40">Configure AI behaviour and data grounding.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}
            className="p-2 text-white/40 hover:text-white transition-colors bg-white/5 rounded-full">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
            <p className="text-xs text-white/50">
              The AI engine is selected automatically based on your query complexity and dataset size.
              It will <strong className="text-white/70">never answer</strong> without imported data — no guessing, no prior knowledge.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
              <Terminal size={13} className="text-quartz-500" /> AI Behaviour Instructions
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`Optional persona or focus. Example:\n"You are analyzing our company's Q3 sales data. Focus on regional performance and flag anything below target. Always cite your sources."\n\nLeave empty for default strict data-grounding mode.`}
              rows={7}
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
