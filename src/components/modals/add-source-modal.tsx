"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Database, Globe, Cloud, LayoutGrid, Mail } from "lucide-react";
import { useState } from "react";
import { useAppStore, ContentStorage } from "@/store";
import { LocalFileForm, RestForm, GmailForm, AwsForm, SimpleForm } from "./source-forms";
import { toast } from "sonner";

const TYPES = [
  { id: "file", label: "Local File Link", desc: "Live syncing TXT, CSV, JSON", icon: FileText, color: "text-quartz-500" },
  { id: "rest", label: "REST API", desc: "Any GET endpoint", icon: Globe, color: "text-emerald-500" },
  { id: "gmail", label: "Gmail", desc: "Google OAuth Inbox", icon: Mail, color: "text-coral-500" },
  { id: "aws", label: "AWS", desc: "S3 or DynamoDB", icon: Cloud, color: "text-[#ff9900]" },
  { id: "notion", label: "Notion", desc: "Database/Page", icon: LayoutGrid, color: "text-white/80" },
  { id: "azure", label: "Azure", desc: "Cosmos or Blob", icon: Cloud, color: "text-[#0078d4]" },
  { id: "airtable", label: "Airtable", desc: "Base & Table", icon: Database, color: "text-[#18bfff]" },
];

export function AddSourceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState<string>("select");
  const { addSourceMeta } = useAppStore();

  if (!isOpen) return null;

  const handleAdd = ({ name, type, content, handle }: any) => {
    const id = Math.random().toString(36).slice(2, 11);
    ContentStorage.save(id, content);
    
    // In a full implementation, the handle would be cached in a non-serializable store or indexedDB
    // to allow re-fetching on mount or via a "Sync Now" button.
    addSourceMeta({ id, name: name || "Unnamed Asset", type, charCount: content?.length || 0 });
    
    toast.success(`Successfully connected: ${name}`);
    setStep("select");
    onClose();
  };

  const handleClose = () => {
    setStep("select");
    onClose();
  };

  const renderForm = () => {
    switch (step) {
      case "file": return <LocalFileForm onAdd={handleAdd} onBack={() => setStep("select")} />;
      case "rest": return <RestForm onAdd={handleAdd} onBack={() => setStep("select")} />;
      case "gmail": return <GmailForm onAdd={handleAdd} onBack={() => setStep("select")} />;
      case "aws": return <AwsForm onAdd={handleAdd} onBack={() => setStep("select")} />;
      default: return <SimpleForm type={step} onAdd={handleAdd} onBack={() => setStep("select")} />;
    }
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
        
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {step === "select" ? "Add Data Asset" : `Configure ${TYPES.find(t => t.id === step)?.label}`}
            </h2>
            <p className="text-sm text-white/40">
              {step === "select" ? "Select a source to integrate dynamically." : "Provide credentials to establish connection."}
            </p>
          </div>
          <button onClick={handleClose} className="p-2 text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full">
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: step === "select" ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: step === "select" ? 10 : -10 }}
              transition={{ duration: 0.2 }}
            >
              {step === "select" ? (
                <div className="grid grid-cols-2 gap-4">
                  {TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setStep(type.id)}
                      className="flex items-start text-left gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/15 transition-all group"
                    >
                      <div className={`p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors ${type.color}`}>
                        <type.icon size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold mb-1 text-white/90 group-hover:text-white transition-colors">{type.label}</h3>
                        <p className="text-xs text-white/40 group-hover:text-white/50">{type.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : renderForm()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
