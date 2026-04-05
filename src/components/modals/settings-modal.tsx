"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, ShieldCheck, Terminal, Cpu, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store";
import { toast } from "sonner";

const ANTHROPIC_MODELS = [
  { id: "claude-opus-4-6",           label: "Claude Opus 4.6",    desc: "Most capable — best for complex enterprise analysis" },
  { id: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6",  desc: "Balanced — fast and highly capable (recommended)" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",   desc: "Fastest — best for quick queries on large datasets" },
];

const OPENAI_MODELS = [
  { id: "gpt-4o",      label: "GPT-4o",       desc: "Most capable OpenAI model with vision" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini",  desc: "Fast and cost-efficient" },
  { id: "o1",          label: "o1",            desc: "Best for complex reasoning tasks" },
];

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { settings, updateSettings } = useAppStore();

  const [provider, setProvider] = useState(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [prompt, setPrompt] = useState(settings.systemPrompt);

  if (!isOpen) return null;

  const models = provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;

  const handleProviderChange = (p: "anthropic" | "openai") => {
    setProvider(p);
    // Default to first model of new provider
    const first = p === "anthropic" ? ANTHROPIC_MODELS[1].id : OPENAI_MODELS[0].id;
    setModel(first);
  };

  const save = () => {
    updateSettings({ provider, model, systemPrompt: prompt });
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

        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">System Configuration</h2>
            <p className="text-sm text-white/40">AI model, provider, and behaviour.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}
            className="p-2 text-white/40 hover:text-white transition-colors bg-white/5 rounded-full">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar">
          {/* Security notice */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
            <p className="text-xs text-white/50">
              API keys are configured server-side. The AI will <strong className="text-white/70">never answer</strong> without imported data — no guessing, no prior knowledge.
            </p>
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
              <Cpu size={13} className="text-quartz-500" /> AI Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["anthropic", "openai"] as const).map(p => (
                <button
                  type="button"
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    provider === p
                      ? "border-quartz-500/40 bg-quartz-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/40 hover:text-white/70"
                  }`}
                >
                  {p === "anthropic" ? "Anthropic (Claude)" : "OpenAI (GPT)"}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
              <Zap size={13} className="text-quartz-500" /> Model
            </label>
            <div className="space-y-2">
              {models.map(m => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    model === m.id
                      ? "border-quartz-500/40 bg-quartz-500/10"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 transition-colors ${
                    model === m.id ? "border-quartz-500 bg-quartz-500" : "border-white/20"
                  }`} />
                  <div>
                    <div className="text-xs font-semibold text-white/80">{m.label}</div>
                    <div className="text-[11px] text-white/35 mt-0.5">{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* System prompt */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
              <Terminal size={13} className="text-quartz-500" /> AI System Prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`Optional persona or focus instructions.\n\nExample: "You are analyzing our company's Q3 sales data. Focus on regional performance and flag anything below target. Always cite your sources."\n\nLeave empty for default strict data-grounding mode.`}
              rows={6}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-quartz-500 resize-none leading-relaxed"
            />
            <p className="text-xs text-white/25 leading-relaxed">
              The AI always stays grounded to your imported data — it cannot answer without data and will never guess.
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save Settings</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
