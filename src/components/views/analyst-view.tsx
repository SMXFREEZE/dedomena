"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { ConnectorIcon } from "@/components/ui/connector-icon";
import { CONNECTORS_BY_ID } from "@/lib/connectors/registry";
import { useAppStore, ContentStorage } from "@/store";
import { parseData, analyzeColumns, ColumnStat } from "@/lib/data-parser";
import { Blocks, BarChart3, Table2, ChevronLeft, ChevronRight, AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

// ── Sparkline bar chart (pure CSS) ────────────────────────────────────────────

function HBar({ value, max, color = "#18bfff" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden">
      <div
        className="h-full rounded transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function CategoryChart({ stat }: { stat: ColumnStat }) {
  if (!stat.topValues?.length) return null;
  const max = stat.topValues[0].count;
  const colors = ["#18bfff", "#a78bfa", "#34d399", "#f472b6", "#fb923c", "#facc15", "#60a5fa", "#f87171", "#a3e635", "#2dd4bf"];

  return (
    <div className="space-y-1.5">
      {stat.topValues.slice(0, 8).map((tv, i) => (
        <div key={tv.value} className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 w-24 truncate text-right">{tv.value || "(empty)"}</span>
          <HBar value={tv.count} max={max} color={colors[i % colors.length]} />
          <span className="text-[10px] text-white/30 w-10 text-right font-mono">{tv.count}</span>
        </div>
      ))}
    </div>
  );
}

function NumericSpark({ stat }: { stat: ColumnStat }) {
  if (stat.mean === undefined) return null;
  const range = parseFloat(stat.max ?? "0") - parseFloat(stat.min ?? "0");
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {[
        { label: "Min", value: stat.min ?? "—" },
        { label: "Mean", value: typeof stat.mean === "number" ? stat.mean.toFixed(2) : "—" },
        { label: "Max", value: stat.max ?? "—" },
      ].map(kv => (
        <div key={kv.label} className="bg-white/[0.03] rounded-lg p-2 text-center">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">{kv.label}</div>
          <div className="text-xs font-mono text-white/70 mt-0.5 truncate">{kv.value}</div>
        </div>
      ))}
    </div>
  );
}

const typeColor: Record<string, string> = {
  numeric:     "text-coral-400 bg-coral-400/10",
  date:        "text-blue-400 bg-blue-400/10",
  categorical: "text-purple-400 bg-purple-400/10",
  boolean:     "text-amber-400 bg-amber-400/10",
  id:          "text-white/30 bg-white/5",
  text:        "text-white/40 bg-white/5",
};

// ── Main view ─────────────────────────────────────────────────────────────────

export function AnalystView() {
  const sources = useAppStore(s => s.sources);
  const [selectedId, setSelectedId] = useState<string>("");
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<"columns" | "table">("columns");

  const selectedSource = sources.find(s => s.id === selectedId) ?? sources[0];

  const parsed = useMemo(() => {
    if (!selectedSource) return null;
    const raw = ContentStorage.get(selectedSource.id);
    if (!raw) return null;
    return parseData(raw);
  }, [selectedSource]);

  const stats = useMemo(() => {
    if (!parsed?.rows.length) return [];
    return analyzeColumns(parsed);
  }, [parsed]);

  const totalPages = parsed ? Math.ceil(parsed.rows.length / PAGE_SIZE) : 0;
  const pageRows   = parsed?.rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) ?? [];

  const qualityScore = useMemo(() => {
    if (!stats.length) return 0;
    const avgFill = stats.reduce((a, s) => a + s.fillRate, 0) / stats.length;
    return Math.round(avgFill * 100);
  }, [stats]);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col w-full h-full overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="max-w-6xl mx-auto w-full p-8 lg:p-12 pb-24 space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
            <Blocks size={12} className="text-[#18bfff]" />
            <span>Data Analyst</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tighter">
            Explore your data.<br />
            <span className="text-white/30">Schema, stats, and distributions.</span>
          </h2>
        </motion.div>

        {sources.length === 0 ? (
          <GlassCard className="py-20 flex flex-col items-center gap-4 text-center">
            <BarChart3 size={32} className="text-white/20" />
            <p className="text-sm text-white/40">No data sources connected. Import a dataset to begin analysis.</p>
          </GlassCard>
        ) : (
          <>
            {/* Source selector */}
            <div className="flex gap-2 flex-wrap">
              {sources.map(src => {
                const conn = CONNECTORS_BY_ID[src.type];
                const active = (selectedId || sources[0]?.id) === src.id;
                return (
                  <button type="button" key={src.id} onClick={() => { setSelectedId(src.id); setPage(0); }}
                    className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all",
                      active ? "border-[#18bfff]/30 bg-[#18bfff]/10 text-white" : "border-white/5 bg-white/[0.02] text-white/40 hover:text-white/70"
                    )}>
                    <ConnectorIcon iconSlug={conn?.iconSlug} name={conn?.name ?? src.type} color={conn?.color ?? "#888"} size={14} />
                    {src.name}
                  </button>
                );
              })}
            </div>

            {!parsed || !parsed.rows.length ? (
              <GlassCard className="py-12 text-center">
                <AlertCircle size={24} className="mx-auto text-white/20 mb-3" />
                <p className="text-sm text-white/40">
                  {!parsed ? "No content found for this source." : `Format: ${parsed?.format} — no rows detected.`}
                </p>
              </GlassCard>
            ) : (
              <>
                {/* Overview cards */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Rows",    value: parsed.totalRows.toLocaleString(), sub: parsed.truncated ? "preview capped at 10k" : "full dataset" },
                    { label: "Columns",       value: parsed.headers.length, sub: parsed.format.toUpperCase() },
                    { label: "Data Quality",  value: `${qualityScore}%`, sub: "fill rate avg" },
                    { label: "Numeric Cols",  value: stats.filter(s => s.type === "numeric").length, sub: "detected" },
                  ].map(kv => (
                    <GlassCard key={kv.label} className="text-center">
                      <div className="text-2xl font-bold text-white/90 mb-1">{kv.value}</div>
                      <div className="text-xs font-semibold text-white/50">{kv.label}</div>
                      <div className="text-[10px] text-white/25 mt-0.5">{kv.sub}</div>
                    </GlassCard>
                  ))}
                </motion.div>

                {/* Tab bar */}
                <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
                  {(["columns", "table"] as const).map(tab => (
                    <button type="button" key={tab} onClick={() => setActiveTab(tab)}
                      className={cn("flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                        activeTab === tab ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                      )}>
                      {tab === "columns" ? <TrendingUp size={12} /> : <Table2 size={12} />}
                      {tab === "columns" ? "Column Analysis" : "Data Table"}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === "columns" ? (
                    <motion.div key="columns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stats.map(stat => (
                        <GlassCard key={stat.name} className="space-y-3">
                          {/* Column header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-semibold text-white/80 truncate">{stat.name}</span>
                              <span className={cn("text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium shrink-0", typeColor[stat.type])}>
                                {stat.type}
                              </span>
                            </div>
                            <div className="text-[10px] text-white/25 font-mono shrink-0 ml-2">
                              {stat.uniqueCount.toLocaleString()} unique
                            </div>
                          </div>

                          {/* Fill rate bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-white/30">
                              <span>Fill rate</span>
                              <span>{Math.round(stat.fillRate * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded overflow-hidden">
                              <div
                                className={cn("h-full rounded transition-all", stat.fillRate > 0.9 ? "bg-coral-500" : stat.fillRate > 0.7 ? "bg-amber-400" : "bg-red-500")}
                                style={{ width: `${stat.fillRate * 100}%` }}
                              />
                            </div>
                            {stat.nullCount > 0 && (
                              <div className="text-[9px] text-white/25">{stat.nullCount.toLocaleString()} nulls</div>
                            )}
                          </div>

                          {/* Type-specific visualisation */}
                          {stat.type === "categorical" || stat.type === "boolean"
                            ? <CategoryChart stat={stat} />
                            : stat.type === "numeric"
                              ? <NumericSpark stat={stat} />
                              : stat.type === "date"
                                ? (
                                  <div className="flex gap-3 text-[11px] text-white/40">
                                    <span>From: <span className="text-white/60">{stat.min}</span></span>
                                    <span>To: <span className="text-white/60">{stat.max}</span></span>
                                  </div>
                                )
                                : (
                                  <div className="flex flex-wrap gap-1">
                                    {stat.sampleValues.map(v => (
                                      <span key={v} className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/40 font-mono truncate max-w-[120px]">{v}</span>
                                    ))}
                                  </div>
                                )
                          }
                        </GlassCard>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="space-y-3">
                      {/* Table */}
                      <div className="overflow-x-auto rounded-xl border border-white/5">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                              <th className="px-3 py-2 text-left text-white/30 font-mono w-10">#</th>
                              {parsed.headers.map(h => (
                                <th key={h} className="px-3 py-2 text-left text-white/50 font-semibold whitespace-nowrap max-w-[160px] truncate">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pageRows.map((row, i) => (
                              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                <td className="px-3 py-2 text-white/20 font-mono">{page * PAGE_SIZE + i + 1}</td>
                                {parsed.headers.map(h => (
                                  <td key={h} className="px-3 py-2 text-white/60 max-w-[160px] truncate font-mono">
                                    {row[h] === "" ? <span className="text-white/20 italic">null</span> : row[h]}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/30">
                            Rows {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, parsed.rows.length)} of {parsed.totalRows.toLocaleString()}
                            {parsed.truncated && " (preview)"}
                          </span>
                          <div className="flex gap-2">
                            <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                              className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white disabled:opacity-30 transition-all">
                              <ChevronLeft size={14} />
                            </button>
                            <span className="text-xs text-white/30 self-center">{page + 1} / {totalPages}</span>
                            <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                              className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white disabled:opacity-30 transition-all">
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
