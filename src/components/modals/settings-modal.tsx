"use client";

import { motion } from "framer-motion";
import { X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#030304]/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-[#0b0b0e] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
      >
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-quartz-500/30 to-transparent" />
        
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">System Configuration</h2>
            <p className="text-sm text-white/40">Security and platform settings.</p>
          </div>
          <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors bg-white/5 rounded-full">
            <X size={16} />
          </button>
        </div>

        <div className="p-8 space-y-6 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-2">
            <ShieldCheck size={32} className="text-emerald-500" />
          </div>
          
          <div>
            <h3 className="text-white/90 font-medium mb-2">Enterprise Security Enabled</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              API Keys and core model configurations are managed securely on the backend environment. 
              Users do not need to provide their own authentication keys.
            </p>
          </div>

          <div className="pt-4 w-full">
            <Button className="w-full" onClick={onClose}>Understood</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
