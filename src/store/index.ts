import { create } from "zustand";
import { persist } from "zustand/middleware";
import { genId } from "@/lib/utils";

export type SourceType = string;
export type ContentType = "text" | "image" | "pdf" | "spreadsheet";

export interface DataSourceMeta {
  id: string;
  name: string;
  type: SourceType;
  contentType?: ContentType;
  status: "connected" | "loading" | "error";
  charCount: number;
  dateAdded: string;
  lastRefreshed?: string;
  summary?: string;
}

export interface AppSettings {
  provider: "anthropic" | "openai";
  apiKey: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
}

export interface QueryRecord {
  id: string;
  query: string;
  mode: "chat" | "structured";
  timestamp: string;
  sourceNames: string[];
}

interface AppState {
  sources: DataSourceMeta[];
  settings: AppSettings;
  queryHistory: QueryRecord[];

  addSourceMeta: (meta: Omit<DataSourceMeta, "id" | "dateAdded" | "status"> & { id?: string }) => void;
  updateSourceMeta: (id: string, patch: Partial<DataSourceMeta>) => void;
  removeSource: (id: string, storageDelete: (id: string) => void) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addQueryRecord: (record: Omit<QueryRecord, "id">) => void;
  clearHistory: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sources: [],
      queryHistory: [],
      settings: {
        provider: "anthropic",
        apiKey: "",
        model: "claude-sonnet-4-6",
        systemPrompt: "",
        maxTokens: 16000,
      },

      addSourceMeta: (meta) => set((state) => ({
        sources: [
          ...state.sources,
          { ...meta, id: meta.id ?? genId(), dateAdded: new Date().toISOString(), status: "connected" },
        ],
      })),

      updateSourceMeta: (id, patch) => set((state) => ({
        sources: state.sources.map(s => s.id === id ? { ...s, ...patch } : s),
      })),

      removeSource: (id, storageDelete) => set((state) => {
        storageDelete(id);
        return { sources: state.sources.filter(s => s.id !== id) };
      }),

      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings },
      })),

      addQueryRecord: (record) => set((state) => ({
        // Keep last 50 queries
        queryHistory: [
          { ...record, id: genId() },
          ...state.queryHistory,
        ].slice(0, 50),
      })),

      clearHistory: () => set({ queryHistory: [] }),
    }),
    {
      name: "dedomena_meta_v2",
      partialize: (state) => ({
        sources: state.sources,
        settings: state.settings,
        queryHistory: state.queryHistory,
      }),
    }
  )
);

// Content storage — kept off Zustand to avoid persisted-store bloat.
// Limit: 10 MB total, 5 MB per source.
const CONTENT_KEY = "dedomena_content_v2";
const MAX_SOURCE_BYTES = 5_000_000;  // 5 MB per source
const MAX_TOTAL_BYTES  = 10_000_000; // 10 MB total

export const ContentStorage = {
  get: (id: string): string => {
    try {
      return JSON.parse(localStorage.getItem(CONTENT_KEY) ?? "{}")[id] ?? "";
    } catch {
      return "";
    }
  },

  save: (id: string, content: string) => {
    try {
      const all = JSON.parse(localStorage.getItem(CONTENT_KEY) ?? "{}");
      all[id] = (content ?? "").slice(0, MAX_SOURCE_BYTES);

      // Check total size and evict oldest if needed
      const serialized = JSON.stringify(all);
      if (serialized.length > MAX_TOTAL_BYTES) {
        // Remove oldest entries until under limit
        const keys = Object.keys(all);
        while (JSON.stringify(all).length > MAX_TOTAL_BYTES && keys.length > 1) {
          delete all[keys.shift()!];
        }
      }

      localStorage.setItem(CONTENT_KEY, JSON.stringify(all));
    } catch (e) {
      console.error("ContentStorage: write failed", e);
    }
  },

  del: (id: string) => {
    try {
      const all = JSON.parse(localStorage.getItem(CONTENT_KEY) ?? "{}");
      delete all[id];
      localStorage.setItem(CONTENT_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  },

  totalBytes: (): number => {
    try {
      return (localStorage.getItem(CONTENT_KEY) ?? "").length;
    } catch {
      return 0;
    }
  },
};
