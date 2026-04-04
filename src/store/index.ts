import { create } from "zustand";
import { persist } from "zustand/middleware";
import { genId } from "@/lib/utils";

export type SourceType = "file" | "paste" | "rest" | "notion" | "airtable" | "gmail" | "aws" | "azure";

export interface DataSourceMeta {
  id: string;
  name: string;
  type: SourceType;
  status: "connected" | "loading" | "error";
  charCount: number;
  dateAdded: string;
  summary?: string; 
}

export interface AppSettings {
  provider: "anthropic" | "openai";
  apiKey: string;
  model: string;
  systemPrompt: string;
}

interface AppState {
  sources: DataSourceMeta[];
  settings: AppSettings;
  addSourceMeta: (meta: Omit<DataSourceMeta, "id" | "dateAdded" | "status"> & { id?: string }) => void;
  removeSource: (id: string, storageDelete: (id: string) => void) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sources: [],
      settings: {
        provider: "anthropic",
        apiKey: "",
        model: "claude-sonnet-4-6",
        systemPrompt: "",
      },
      addSourceMeta: (meta) => set((state) => ({
        sources: [
          ...state.sources,
          {
            ...meta,
            id: meta.id || genId(),
            dateAdded: new Date().toISOString(),
            status: "connected",
          }
        ]
      })),
      removeSource: (id, storageDelete) => set((state) => {
        storageDelete(id);
        return {
          sources: state.sources.filter(s => s.id !== id)
        };
      }),
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      }))
    }),
    {
      name: "dedomena_meta_v2",
      partialize: (state) => ({ sources: state.sources, settings: state.settings })
    }
  )
);

// We keep heavy content off the persisted Zustand store to avoid hitting 
// localStorage limits automatically. We expose helpers instead.
export const ContentStorage = {
  get: (id: string) => {
    try { return JSON.parse(localStorage.getItem("dedomena_content_v2") || "{}")[id] || ""; } catch { return ""; }
  },
  save: (id: string, content: string) => {
    try {
      const all = JSON.parse(localStorage.getItem("dedomena_content_v2") || "{}");
      all[id] = (content || "").slice(0, 2000000);
      localStorage.setItem("dedomena_content_v2", JSON.stringify(all));
    } catch (e) {
      console.error("Storage full", e);
    }
  },
  del: (id: string) => {
    try {
      const all = JSON.parse(localStorage.getItem("dedomena_content_v2") || "{}");
      delete all[id];
      localStorage.setItem("dedomena_content_v2", JSON.stringify(all));
    } catch {}
  }
};
