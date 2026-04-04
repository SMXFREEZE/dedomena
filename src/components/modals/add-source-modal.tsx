"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Database, Globe, Cloud, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

const TYPES = [
  { id: "file", label: "File Upload", desc: "TXT, CSV, JSON, MD", icon: FileText, color: "text-quartz-500" },
  { id: "rest", label: "REST API", desc: "Any GET endpoint", icon: Globe, color: "text-coral-500" },
  { id: "notion", label: "Notion", desc: "Database/Page", icon: LayoutGrid, color: "text-white/80" },
  { id: "aws", label: "AWS", desc: "S3 or DynamoDB", icon: Cloud, color: "text-[#ff9900]" },
  { id: "azure", label: "Azure", desc: "Cosmos or Blob", icon: Cloud, color: "text-[#0078d4]" },
  { id: "airtable", label: "Airtable", desc: "Base & Table", icon: Database, color: "text-[#18bfff]" },
];

export function AddSourceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-dark-surface border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl relative"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Add Data Asset</h2>
            <p className="text-sm text-white/40">Select a source to integrate into your workspace.</p>
          </div>
          <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors bg-white/5 rounded-full">
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {TYPES.map((type) => (
              <button
                key={type.id}
                onClick={onClose} // In a complete implementation, this would open a specific sub-form
                className="flex items-start text-left gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all group"
              >
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                  <type.icon size={18} className={type.color} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{type.label}</h3>
                  <p className="text-xs text-white/40">{type.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
