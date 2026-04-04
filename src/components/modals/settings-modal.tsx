"use client";

import { motion } from "framer-motion";
import { X, Key } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store";
import { useState } from "react";
import { toast } from "sonner";

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { settings, updateSettings } = useAppStore();
  const [key, setKey] = useState(settings.apiKey || "");

  if (!isOpen) return null;

  const handleSave = () => {
    updateSettings({ apiKey: key });
    toast.success("Settings saved. Keys are stored safely in local storage.");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-dark-surface border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Intelligence Config</h2>
            <p className="text-sm text-white/40">Manage your language models.</p>
          </div>
          <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors bg-white/5 rounded-full">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <Input 
            label="Anthropic API Key"
            type="password"
            placeholder="sk-ant-api03-..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          
          <div className="p-4 rounded-lg bg-quartz-500/10 border border-quartz-500/20 text-xs text-white/60">
            Keys are completely secure. Dedomena only stores configuration in your local browser and accesses the Anthropic direct connection API securely.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save Configuration</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
