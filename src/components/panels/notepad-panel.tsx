"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  StickyNote, Plus, Trash2, ChevronDown, ChevronRight,
  Edit3, Check, X, Copy,
} from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function NotepadPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const notepad = useAppStore(s => s.notepad);
  const addNote = useAppStore(s => s.addNote);
  const removeNote = useAppStore(s => s.removeNote);
  const updateNote = useAppStore(s => s.updateNote);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [showNewNote, setShowNewNote] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  if (!isOpen) return null;

  const handleSaveNew = () => {
    if (!newContent.trim() && !newTitle.trim()) return;
    addNote({
      title: newTitle.trim() || "Untitled Note",
      content: newContent.trim(),
    });
    setNewTitle("");
    setNewContent("");
    setShowNewNote(false);
    toast.success("Note saved");
  };

  const handleStartEdit = (id: string) => {
    const note = notepad.find(n => n.id === id);
    if (!note) return;
    setEditingId(id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateNote(editingId, { title: editTitle, content: editContent });
    setEditingId(null);
    toast.success("Note updated");
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-0 top-0 h-full w-80 bg-[#0a0b0e]/95 backdrop-blur-2xl border-l border-white/5 z-30 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <StickyNote size={14} className="text-amber-400/70" />
          <h3 className="text-sm font-semibold tracking-tight">Notepad</h3>
          {notepad.length > 0 && (
            <span className="text-[9px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
              {notepad.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowNewNote(true)}
            className="p-1.5 rounded-lg text-white/30 hover:text-amber-400/70 hover:bg-white/5 transition-all"
            title="New note"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-2">
        {/* New note form */}
        <AnimatePresence>
          {showNewNote && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 space-y-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Note title..."
                  className="w-full bg-transparent border-none outline-none text-xs text-white/80 placeholder:text-white/25 font-medium"
                  autoFocus
                />
                <textarea
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="Write your note..."
                  rows={4}
                  className="w-full bg-white/5 rounded-lg border border-white/5 px-3 py-2 text-[11px] text-white/70 placeholder:text-white/20 outline-none resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowNewNote(false)}
                    className="text-[10px] text-white/30 hover:text-white/60 px-2 py-1">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSaveNew}
                    className="text-[10px] text-amber-400/70 hover:text-amber-400 px-2 py-1 bg-amber-400/10 rounded-lg font-medium">
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notes list */}
        {notepad.length === 0 && !showNewNote ? (
          <div className="py-12 text-center">
            <StickyNote size={24} className="mx-auto mb-3 text-white/15" />
            <p className="text-xs text-white/25">No saved notes yet.</p>
            <p className="text-[10px] text-white/15 mt-1">Pin AI responses or create your own.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {notepad.map(note => {
              const isExpanded = expandedId === note.id;
              const isEditing = editingId === note.id;

              return (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-all overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left flex items-center gap-2"
                    onClick={() => setExpandedId(isExpanded ? null : note.id)}
                  >
                    <span className="text-white/20">
                      {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </span>
                    <span className="text-[11px] font-medium text-white/70 truncate flex-1">
                      {note.title}
                    </span>
                    <span className="text-[9px] text-white/20 font-mono shrink-0">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 border-t border-white/5 pt-2 space-y-2">
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-xs text-white/80 font-medium"
                              />
                              <textarea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                rows={6}
                                className="w-full bg-white/5 rounded-lg border border-white/5 px-3 py-2 text-[10px] text-white/60 outline-none resize-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setEditingId(null)}
                                  className="p-1 text-white/30 hover:text-white/60">
                                  <X size={12} />
                                </button>
                                <button type="button" onClick={handleSaveEdit}
                                  className="p-1 text-coral-400/70 hover:text-coral-400">
                                  <Check size={12} />
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-[10px] text-white/50 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto no-scrollbar">
                                {note.content}
                              </p>
                              {note.sourceQuery && (
                                <p className="text-[9px] text-white/20 italic">
                                  From query: &ldquo;{note.sourceQuery}&rdquo;
                                </p>
                              )}
                              <div className="flex items-center gap-1 pt-1">
                                <button type="button" onClick={() => handleCopy(note.content)}
                                  className="p-1 rounded text-white/20 hover:text-white/50 transition-all" title="Copy">
                                  <Copy size={10} />
                                </button>
                                <button type="button" onClick={() => handleStartEdit(note.id)}
                                  className="p-1 rounded text-white/20 hover:text-white/50 transition-all" title="Edit">
                                  <Edit3 size={10} />
                                </button>
                                <button type="button" onClick={() => { removeNote(note.id); toast.success("Note deleted"); }}
                                  className="p-1 rounded text-white/20 hover:text-red-400/70 transition-all" title="Delete">
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
