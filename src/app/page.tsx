"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Sunrise, Sparkles, Database, Shield, ArrowRight } from "lucide-react";
import { VantaBackground } from "@/components/ui/vanta-background";

function isMorning() {
  const h = new Date().getHours();
  return h >= 6 && h < 18;
}

const INTEGRATIONS = [
  { name: "PostgreSQL",     color: "#336791" },
  { name: "MongoDB",        color: "#47A248" },
  { name: "MySQL",          color: "#4479A1" },
  { name: "Redis",          color: "#DC382D" },
  { name: "Snowflake",      color: "#29B5E8" },
  { name: "Databricks",     color: "#FF3621" },
  { name: "Salesforce",     color: "#00A1E0" },
  { name: "AWS S3",         color: "#FF9900" },
  { name: "GitHub",         color: "#ffffff" },
  { name: "Elasticsearch",  color: "#F04E98" },
  { name: "BigQuery",       color: "#4285F4" },
  { name: "Stripe",         color: "#635BFF" },
  { name: "DynamoDB",       color: "#4053D6" },
  { name: "Cassandra",      color: "#1287B1" },
  { name: "MariaDB",        color: "#C0765A" },
];

const STATS = [
  { value: "500+",  label: "Integrations" },
  { value: "10ms",  label: "Avg query time" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "0",     label: "Data copies made" },
];

const DEMO_LINES = [
  { role: "user",  text: "What was our Q4 revenue breakdown by region?" },
  { role: "ai",    text: "Q4 revenue totaled $4.2M across 3 regions:" },
  { role: "data",  lines: ["APAC   ▓▓▓▓▓▓▓▓░░  $1.9M  45%", "EMEA   ▓▓▓▓▓░░░░░  $1.3M  31%", "AMER   ▓▓▓░░░░░░░  $1.0M  24%"] },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "Ask in plain language.",
    desc: "Type a question, get an answer. Dedomena translates intent into queries across all your sources — no SQL, no dashboards.",
    tag: "Intelligence",
  },
  {
    icon: Database,
    title: "Connect once. Query everything.",
    desc: "One platform for every database, API, and file. No data duplication, no ETL pipelines. Live queries, always fresh.",
    tag: "Connectivity",
  },
  {
    icon: Shield,
    title: "Enterprise-grade security.",
    desc: "Credentials stay local. Queries run server-side. Zero data copies means zero data exposure — compliant by design.",
    tag: "Security",
  },
];

export default function LandingPage() {
  const [mode, setMode] = useState<"night" | "morning">("night");
  const [typedIdx, setTypedIdx] = useState(0);

  useEffect(() => {
    setMode(isMorning() ? "morning" : "night");
  }, []);

  // Animate typing the user's query
  useEffect(() => {
    const userText = DEMO_LINES[0].text as string;
    if (typedIdx >= userText.length) return;
    const t = setTimeout(() => setTypedIdx(i => i + 1), 38);
    return () => clearTimeout(t);
  }, [typedIdx]);

  const isNight = mode === "night";
  const userText = DEMO_LINES[0].text as string;

  return (
    <>
      <VantaBackground mode={mode} />
      <div className="grain-overlay fixed inset-0 z-[1] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen text-white">

        {/* ── Nav ─────────────────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-semibold tracking-tight">dedomena</span>
            <span className="brand-sigma text-quartz-500 text-lg">Σ</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMode(m => m === "night" ? "morning" : "night")}
              title={isNight ? "Switch to morning" : "Switch to night"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/50 hover:text-white/80 transition-all"
            >
              {isNight ? <Moon size={12} /> : <Sunrise size={12} />}
              <span className="hidden sm:inline">{isNight ? "Night" : "Morning"}</span>
            </button>
            <Link
              href="/app"
              className="px-3 sm:px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
            >
              Launch app →
            </Link>
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center text-center px-5 sm:px-6 pt-12 sm:pt-20 pb-6 sm:pb-12 overflow-hidden">

          {/* Orbs */}
          <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(120,100,255,0.18) 0%, transparent 70%)", filter: "blur(60px)" }} />
          <div className="absolute top-[10%] right-[10%] w-[350px] h-[350px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(80,140,255,0.12) 0%, transparent 70%)", filter: "blur(50px)" }} />
          <div className="absolute bottom-[0%] left-[40%] w-[400px] h-[300px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(100,80,255,0.10) 0%, transparent 70%)", filter: "blur(70px)" }} />

          <div className="anim-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.10] text-xs text-white/50 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
            Now in public beta
          </div>

          <h1 className="anim-fade-up anim-delay-1 heading-display text-4xl sm:text-6xl md:text-[72px] max-w-4xl mb-6 leading-[1.0]">
            Your data,<br />
            <span className="text-gradient">answered instantly.</span>
          </h1>

          <p className="anim-fade-up anim-delay-2 text-base sm:text-lg text-white/40 max-w-lg mb-8 leading-relaxed">
            Connect every database, API, and file. Ask in plain English.
            Get answers — not dashboards.
          </p>

          <div className="anim-fade-up anim-delay-3 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mb-16">
            <Link
              href="/app"
              className="w-full sm:w-auto text-center px-7 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all shadow-[0_0_40px_rgba(255,255,255,0.10)] hover:shadow-[0_0_70px_rgba(255,255,255,0.18)]"
            >
              Start for free
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl border border-white/10 text-sm font-medium text-white/50 hover:text-white hover:border-white/25 transition-all"
            >
              See how it works <ArrowRight size={13} />
            </a>
          </div>

          {/* ── Product demo card ─────────────────────────────────────────── */}
          <div className="anim-fade-up anim-delay-4 relative w-full max-w-2xl">
            {/* glow behind card */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(120,100,255,0.15) 0%, transparent 70%)", filter: "blur(20px)", transform: "scale(1.1)" }} />

            <div className="relative rounded-2xl border border-white/[0.09] bg-black/60 backdrop-blur-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)]">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="mx-auto w-36 h-5 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <span className="text-[9px] text-white/20 tracking-wide">dedomena — Ask AI</span>
                  </div>
                </div>
              </div>

              {/* Demo content */}
              <div className="p-5 space-y-4 text-left">
                {/* User message */}
                <div className="flex items-start gap-3 justify-end">
                  <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-white/[0.08] border border-white/[0.08]">
                    <p className="text-[13px] text-white/85 leading-relaxed font-mono">
                      {userText.slice(0, typedIdx)}
                      {typedIdx < userText.length && (
                        <span className="inline-block w-[2px] h-[13px] bg-white/60 ml-0.5 animate-pulse align-middle" />
                      )}
                    </p>
                  </div>
                </div>

                {/* AI response — only show when typing done */}
                {typedIdx >= userText.length && (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles size={10} className="text-white/50" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <p className="text-[13px] text-white/70 leading-relaxed anim-fade-in">
                          Q4 revenue totaled <span className="text-white/90 font-semibold">$4.2M</span> across 3 regions:
                        </p>
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5 space-y-2 anim-fade-up anim-delay-1 font-mono text-[11px]">
                          {[
                            { label: "APAC", pct: 45, val: "$1.9M", w: "72%" },
                            { label: "EMEA", pct: 31, val: "$1.3M", w: "50%" },
                            { label: "AMER", pct: 24, val: "$1.0M", w: "38%" },
                          ].map(r => (
                            <div key={r.label} className="flex items-center gap-3">
                              <span className="text-white/35 w-10 shrink-0">{r.label}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-quartz-600 to-quartz-400 transition-all" style={{ width: r.w }} />
                              </div>
                              <span className="text-white/60 w-12 text-right">{r.val}</span>
                              <span className="text-white/25 w-8 text-right">{r.pct}%</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-white/25 anim-fade-in anim-delay-2">
                          Sources: <span className="text-white/40">PostgreSQL</span> · <span className="text-white/40">Salesforce</span>
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="border-y border-white/[0.05] bg-black/30 backdrop-blur-md mt-10">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.05]">
            {STATS.map((s, i) => (
              <div key={s.label} className={`stat-shimmer flex flex-col items-center py-8 px-4 anim-fade-up anim-delay-${i + 1}`}>
                <span className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">{s.value}</span>
                <span className="text-[10px] text-white/25 mt-1.5 tracking-[0.10em] uppercase">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <section id="features" className="max-w-5xl mx-auto px-5 sm:px-6 py-20 sm:py-28 w-full">
          <div className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-[0.20em] text-white/20 mb-4">Why Dedomena</p>
            <h2 className="heading-lg text-3xl sm:text-4xl text-white/90">
              One interface for all your data
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`group relative glass stat-shimmer rounded-2xl p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.07)] anim-fade-up anim-delay-${i + 2}`}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-px h-px w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="mb-5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-[9px] text-white/30 uppercase tracking-[0.12em] font-medium mb-4">
                    {f.tag}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:bg-white/[0.07] transition-colors">
                    <f.icon size={16} className="text-white/50" strokeWidth={1.5} />
                  </div>
                </div>
                <h3 className="text-[14px] font-semibold mb-2.5 text-white/85 tracking-[-0.01em]">{f.title}</h3>
                <p className="text-[13px] text-white/35 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Integrations ────────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-20 sm:pb-28 w-full">
          <p className="text-[10px] text-white/20 text-center uppercase tracking-[0.18em] mb-10">
            Works with everything you already use
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {INTEGRATIONS.map((s) => (
              <span
                key={s.name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[12px] text-white/45 hover:text-white/80 hover:border-white/15 hover:bg-white/[0.06] transition-all cursor-default"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color, opacity: 0.7 }} />
                {s.name}
              </span>
            ))}
            <span className="flex items-center px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.04] text-[12px] text-white/20">
              +480 more
            </span>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <section className="border-t border-white/[0.05] bg-black/40 backdrop-blur-md relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(120,100,255,0.07) 0%, transparent 70%)" }} />
          <div className="relative max-w-2xl mx-auto text-center px-5 sm:px-6 py-20 sm:py-24">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/20 mb-4">Get started</p>
            <h2 className="heading-lg text-3xl sm:text-4xl mb-4">Connect in under 2 minutes.</h2>
            <p className="text-white/30 mb-10 text-sm leading-relaxed">
              No pipelines. No data copies. Just answers.
            </p>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/92 transition-all shadow-[0_0_60px_rgba(255,255,255,0.08)] hover:shadow-[0_0_100px_rgba(255,255,255,0.15)]"
            >
              Launch app <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/[0.04] px-5 sm:px-8 py-5 flex flex-col sm:flex-row items-center gap-1 sm:gap-0 sm:justify-between text-[11px] text-white/15">
          <span>dedomena<span className="brand-sigma ml-0.5">Σ</span></span>
          <span>© 2026 Dedomena. AI-powered data intelligence.</span>
        </footer>

      </div>
    </>
  );
}
