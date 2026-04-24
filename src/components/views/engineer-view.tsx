"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { ConnectorIcon } from "@/components/ui/connector-icon";
import { CONNECTORS_BY_ID } from "@/lib/connectors/registry";
import { useAppStore, ContentStorage } from "@/store";
import {
  parseData,
  analyzeColumns,
  applyTransformations,
  serializeCSV,
  TransformOptions,
} from "@/lib/data-parser";
import {
  Network,
  ArrowRightLeft,
  Eraser,
  CheckCircle2,
  Scissors,
  Download,
  Play,
  AlertCircle,
  ChevronRight,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Stat pill ─────────────────────────────────────────────────────────────────

function Pill({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white/[0.03] rounded-xl p-3 text-center border border-white/5">
      <div className={cn("text-xl font-bold mb-0.5", accent ?? "text-white/90")}>{value}</div>
      <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[9px] text-white/20 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Toggle rule row ───────────────────────────────────────────────────────────

function RuleRow({
  icon: Icon,
  label,
  description,
  active,
  onToggle,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          active ? "bg-[#18bfff]/15" : "bg-white/5")}>
          <Icon size={13} className={active ? "text-[#18bfff]" : "text-white/30"} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white/80">{label}</div>
          <div className="text-[10px] text-white/30 leading-tight mt-0.5">{description}</div>
        </div>
      </div>
      <div className={cn("w-9 h-5 rounded-full border border-white/10 relative transition-colors shrink-0 ml-3",
        active ? "bg-[#18bfff]" : "bg-white/10")}>
        <div className={cn("w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-all",
          active ? "right-[3px]" : "left-[3px]")} />
      </div>
    </button>
  );
}

// ── Column quality bar ────────────────────────────────────────────────────────

function ColRow({ name, type, fillRate, nullCount }: { name: string; type: string; fillRate: number; nullCount: number }) {
  const color = fillRate > 0.9 ? "bg-coral-500" : fillRate > 0.7 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[11px] font-mono text-white/60 w-32 truncate shrink-0">{name}</span>
      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-white/30 shrink-0 w-16 text-center">{type}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded overflow-hidden">
        <div className={cn("h-full rounded transition-all", color)} style={{ width: `${fillRate * 100}%` }} />
      </div>
      <span className="text-[10px] font-mono text-white/30 w-8 text-right shrink-0">{Math.round(fillRate * 100)}%</span>
      {nullCount > 0 && (
        <span className="text-[9px] text-red-400/60 w-14 text-right shrink-0">{nullCount} null</span>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function EngineerView() {
  const sources = useAppStore(s => s.sources);
  const [selectedId, setSelectedId] = useState<string>("");
  const [rules, setRules] = useState<TransformOptions>({
    trimWhitespace: true,
    deduplicate:    true,
    imputeNulls:    true,
    normalizeTypes: true,
  });
  const [result, setResult] = useState<{
    changes: string[];
    removedDupes: number;
    imputedCells: number;
    rowsBefore: number;
    rowsAfter: number;
    csvBlob: string;
  } | null>(null);
  const [running, setRunning] = useState(false);

  const toggle = (key: keyof TransformOptions) =>
    setRules(prev => ({ ...prev, [key]: !prev[key] }));

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

  const qualityScore = useMemo(() => {
    if (!stats.length) return 0;
    return Math.round(stats.reduce((a, s) => a + s.fillRate, 0) / stats.length * 100);
  }, [stats]);

  const nullCols  = stats.filter(s => s.nullCount > 0).length;
  const numericCols = stats.filter(s => s.type === "numeric").length;

  function runPipeline() {
    if (!parsed || !stats.length) return;
    setRunning(true);
    setResult(null);

    // Run synchronously (data is already in memory)
    setTimeout(() => {
      const tr = applyTransformations(parsed, stats, rules);
      const csv = serializeCSV(parsed.headers, tr.rows);
      setResult({
        changes:      tr.changes,
        removedDupes: tr.removedDupes,
        imputedCells: tr.imputedCells,
        rowsBefore:   parsed.rows.length,
        rowsAfter:    tr.rows.length,
        csvBlob:      csv,
      });
      setRunning(false);
    }, 0);
  }

  function downloadCSV() {
    if (!result) return;
    const blob = new Blob([result.csvBlob], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${selectedSource?.name ?? "cleaned"}_engineered.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ruleList = [
    {
      key:         "trimWhitespace" as const,
      icon:        Scissors,
      label:       "Trim Whitespace",
      description: "Strip leading/trailing spaces from all cells",
    },
    {
      key:         "deduplicate" as const,
      icon:        CheckCircle2,
      label:       "Remove Duplicates",
      description: "Drop fully identical rows",
    },
    {
      key:         "imputeNulls" as const,
      icon:        Eraser,
      label:       "Impute Nulls",
      description: "Fill blanks: mean for numeric, mode for categorical",
    },
    {
      key:         "normalizeTypes" as const,
      icon:        ArrowRightLeft,
      label:       "Normalize Types",
      description: "Remove thousand separators from numeric columns",
    },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col w-full h-full overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="max-w-6xl mx-auto w-full p-8 lg:p-12 pb-24 space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
            <Network size={12} className="text-[#18bfff]" />
            <span>Data Engineer</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tighter">
            Clean &amp; transform data.<br />
            <span className="text-white/30">Deduplicate, impute, normalize.</span>
          </h2>
        </motion.div>

        {sources.length === 0 ? (
          <GlassCard className="py-20 flex flex-col items-center gap-4 text-center">
            <Network size={32} className="text-white/20" />
            <p className="text-sm text-white/40">No data sources connected. Import a dataset to begin engineering.</p>
          </GlassCard>
        ) : (
          <>
            {/* Source selector */}
            <div className="flex gap-2 flex-wrap">
              {sources.map(src => {
                const conn   = CONNECTORS_BY_ID[src.type];
                const active = (selectedId || sources[0]?.id) === src.id;
                return (
                  <button
                    type="button"
                    key={src.id}
                    onClick={() => { setSelectedId(src.id); setResult(null); }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all",
                      active
                        ? "border-[#18bfff]/30 bg-[#18bfff]/10 text-white"
                        : "border-white/5 bg-white/[0.02] text-white/40 hover:text-white/70"
                    )}
                  >
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
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left: schema + quality */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                  className="lg:col-span-8 space-y-5"
                >
                  {/* Overview pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Pill label="Rows"        value={parsed.totalRows.toLocaleString()} sub={parsed.truncated ? "preview" : "full"} />
                    <Pill label="Columns"     value={parsed.headers.length} sub={parsed.format.toUpperCase()} />
                    <Pill label="Quality"     value={`${qualityScore}%`} sub="fill rate" accent={qualityScore > 85 ? "text-coral-400" : qualityScore > 65 ? "text-amber-400" : "text-red-400"} />
                    <Pill label="Null Cols"   value={nullCols} sub={`${numericCols} numeric`} accent={nullCols > 0 ? "text-amber-400" : "text-coral-400"} />
                  </div>

                  {/* Schema quality list */}
                  <GlassCard>
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart2 size={14} className="text-[#18bfff]" />
                      <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Schema &amp; Fill Rates</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto pr-1 space-y-0">
                      {stats.map(s => (
                        <ColRow key={s.name} name={s.name} type={s.type} fillRate={s.fillRate} nullCount={s.nullCount} />
                      ))}
                    </div>
                  </GlassCard>

                  {/* Result panel */}
                  <AnimatePresence>
                    {result && (
                      <motion.div
                        key="result"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <GlassCard className="space-y-4 border border-coral-500/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={14} className="text-coral-400" />
                              <span className="text-sm font-semibold text-coral-400">Pipeline complete</span>
                            </div>
                            <button
                              type="button"
                              onClick={downloadCSV}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18bfff]/10 border border-[#18bfff]/20 text-[#18bfff] text-xs font-medium hover:bg-[#18bfff]/20 transition-colors"
                            >
                              <Download size={12} />
                              Export CSV
                            </button>
                          </div>

                          {/* Before / after */}
                          <div className="grid grid-cols-3 gap-3">
                            <Pill label="Rows Before" value={result.rowsBefore.toLocaleString()} />
                            <Pill label="Rows After"  value={result.rowsAfter.toLocaleString()} accent={result.rowsAfter < result.rowsBefore ? "text-amber-400" : "text-white/90"} />
                            <Pill label="Imputed"     value={result.imputedCells.toLocaleString()} sub="cells filled" accent={result.imputedCells > 0 ? "text-[#18bfff]" : "text-white/90"} />
                          </div>

                          {/* Change log */}
                          {result.changes.length > 0 && (
                            <ul className="space-y-1.5">
                              {result.changes.map((c, i) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-white/50">
                                  <ChevronRight size={10} className="text-coral-400 shrink-0" />
                                  {c}
                                </li>
                              ))}
                            </ul>
                          )}

                          {result.changes.length === 0 && (
                            <p className="text-xs text-white/30">No changes were necessary — your data is already clean.</p>
                          )}
                        </GlassCard>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Right: rules + run */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="lg:col-span-4 space-y-4"
                >
                  <GlassCard className="space-y-3">
                    <h4 className="text-xs uppercase tracking-widest text-white/30 font-bold">Pipeline Rules</h4>
                    {ruleList.map(rule => (
                      <RuleRow
                        key={rule.key}
                        icon={rule.icon}
                        label={rule.label}
                        description={rule.description}
                        active={rules[rule.key]}
                        onToggle={() => toggle(rule.key)}
                      />
                    ))}
                  </GlassCard>

                  <button
                    type="button"
                    onClick={runPipeline}
                    disabled={running || !parsed?.rows.length}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#18bfff]/10 border border-[#18bfff]/20 text-[#18bfff] text-sm font-semibold hover:bg-[#18bfff]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Play size={14} className={running ? "animate-pulse" : ""} />
                    {running ? "Processing…" : "Run Pipeline"}
                  </button>

                  {parsed.truncated && (
                    <p className="text-[10px] text-amber-400/60 text-center leading-tight">
                      Preview capped at 10 000 rows. Exported CSV reflects preview only.
                    </p>
                  )}
                </motion.div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
