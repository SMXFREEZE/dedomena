"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Connector } from "@/lib/connectors/types";
import { useAppStore, ContentStorage } from "@/store";
import { SourceCatalog } from "./source-catalog";
import { ConnectorForm } from "./connector-form";
import { toast } from "sonner";

export function AddSourceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<Connector | null>(null);
  const { addSourceMeta } = useAppStore();

  if (!isOpen) return null;

  const handleAdd = ({ name, type, content }: { name: string; type: string; content: string }) => {
    const id = Math.random().toString(36).slice(2, 11);
    ContentStorage.save(id, content);
    addSourceMeta({ id, name: name || 'Unnamed Source', type: type as any, charCount: content?.length ?? 0 });
    toast.success(`Connected: ${name}`);
    setSelected(null);
    onClose();
  };

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#030304]/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-[#0b0b0e] border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl relative"
      >
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-quartz-500/30 to-transparent" />

        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-3">
            {selected && (
              <span className="text-xl" role="img" aria-label={selected.name}>{selected.emoji}</span>
            )}
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {selected ? `Configure ${selected.name}` : 'Connect a Data Source'}
              </h2>
              <p className="text-sm text-white/40">
                {selected ? selected.description : 'Search and connect any data source.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="p-2 text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {!selected ? (
              <motion.div
                key="catalog"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
              >
                <SourceCatalog onSelect={setSelected} />
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <ConnectorForm
                  connector={selected}
                  onAdd={handleAdd}
                  onBack={() => setSelected(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
