"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

declare global {
  interface Window { VANTA: any; THREE: any; }
}

/* ── helpers ──────────────────────────────────────────────────────────────── */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });
}

const THREE_CDN  = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js";
const FOG_CDN    = "https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js";
const CLOUDS_CDN = "https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.clouds.min.js";

/* 6 am – 6 pm = morning, else night */
function isMorning() {
  const h = new Date().getHours();
  return h >= 6 && h < 18;
}

/* ── Vanta configs ────────────────────────────────────────────────────────── */
const FOG_CONFIG = {
  mouseControls: true, touchControls: true, gyroControls: false,
  minHeight: 200, minWidth: 200,
  /* pitch-black base, barely-there indigo highlight — premium midnight */
  baseColor:      0x020308,
  lowlightColor:  0x04060f,
  midtoneColor:   0x080d1c,
  highlightColor: 0x111830,
  blurFactor: 0.92,
  speed:      0.65,
  zoom:       0.45,
};

const CLOUDS_CONFIG = {
  mouseControls: true, touchControls: true, gyroControls: false,
  minHeight: 200, minWidth: 200,
  /* pre-dawn sky: deep navy → dark purple clouds, ember sun at horizon */
  skyColor:         0x04060f,
  cloudColor:       0x131028,
  cloudShadowColor: 0x020308,
  sunColor:         0x3b1200,
  sunlightColor:    0x150800,
  sunGlareColor:    0x1e0c00,
  speed: 0.55,
};

/* ── static data ──────────────────────────────────────────────────────────── */
const INTEGRATIONS = [
  "PostgreSQL","MongoDB","MySQL","Redis","Snowflake","Databricks",
  "Salesforce","AWS S3","GitHub","Elasticsearch","Cassandra","MariaDB",
  "BigQuery","DynamoDB","Stripe",
];
const STATS = [
  { value: "500+",  label: "Integrations" },
  { value: "10ms",  label: "Avg query time" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "0",     label: "Data copies made" },
];
const FEATURES = [
  {
    title: "Connect once. Query everything.",
    desc:  "One platform to query every database, API, and file — with AI built in. No data duplication, no pipelines.",
  },
  {
    title: "Ask in plain language.",
    desc:  "Skip SQL, skip dashboards. Type a question, get an answer. Dedomena translates intent into queries across all your sources.",
  },
  {
    title: "Enterprise-grade security.",
    desc:  "Credentials stay local. Queries run server-side. Zero data copies means zero data exposure.",
  },
];

/* ── component ────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const vantaRef  = useRef<HTMLDivElement>(null);
  const vantaFx   = useRef<any>(null);
  const [mode, setMode] = useState<"night" | "morning">("night");

  /* initialise on mount with time-based default */
  useEffect(() => {
    setMode(isMorning() ? "morning" : "night");
  }, []);

  /* re-init whenever mode changes */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        /* destroy previous effect first */
        vantaFx.current?.destroy();
        vantaFx.current = null;

        await loadScript(THREE_CDN);

        if (mode === "night") {
          await loadScript(FOG_CDN);
          if (cancelled || !vantaRef.current || !window.VANTA?.FOG) return;
          vantaFx.current = window.VANTA.FOG({
            el: vantaRef.current,
            THREE: window.THREE,
            ...FOG_CONFIG,
          });
        } else {
          await loadScript(CLOUDS_CDN);
          if (cancelled || !vantaRef.current || !window.VANTA?.CLOUDS) return;
          vantaFx.current = window.VANTA.CLOUDS({
            el: vantaRef.current,
            THREE: window.THREE,
            ...CLOUDS_CONFIG,
          });
        }
      } catch (_) {}
    })();

    return () => { cancelled = true; };
  }, [mode]);

  /* cleanup on unmount */
  useEffect(() => () => { vantaFx.current?.destroy(); }, []);

  const isNight = mode === "night";

  return (
    <>
      {/* ── Vanta canvas ──────────────────────────────────────────────────── */}
      <div ref={vantaRef} className="fixed inset-0 z-0" />

      <div className="relative z-10 flex flex-col min-h-screen text-white">

        {/* ── Nav ───────────────────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-semibold tracking-tight">dedomena</span>
            <span className="brand-sigma text-coral-500 text-lg">Σ</span>
          </div>

          <div className="flex items-center gap-3">
            {/* day / night toggle */}
            <button
              type="button"
              onClick={() => setMode(m => m === "night" ? "morning" : "night")}
              title={isNight ? "Switch to morning" : "Switch to night"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-xs text-white/50 hover:text-white/80 transition-all"
            >
              <span>{isNight ? "🌙" : "🌅"}</span>
              <span>{isNight ? "Night" : "Morning"}</span>
            </button>

            <Link
              href="/app"
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium transition-colors"
            >
              Launch app →
            </Link>
          </div>
        </nav>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Now in public beta
          </div>

          <h1 className="heading-display text-5xl sm:text-6xl md:text-7xl max-w-3xl mb-6">
            Turn every database<br />
            <span className="text-gradient">into intelligence.</span>
          </h1>

          <p className="text-lg text-white/50 max-w-xl mb-10 leading-relaxed">
            Ask in plain language. Get answers instantly.<br />
            Dedomena connects to all your data sources — no pipelines required.
          </p>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link
              href="/app"
              className="px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors shadow-[0_0_40px_rgba(255,255,255,0.08)]"
            >
              Start for free
            </Link>
            <a
              href="#features"
              className="px-6 py-3 rounded-xl border border-white/10 text-sm font-medium text-white/60 hover:text-white hover:border-white/20 transition-colors"
            >
              See how it works
            </a>
          </div>
        </section>

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        <div className="border-y border-white/[0.06] bg-black/30 backdrop-blur-md">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.06]">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col items-center py-7 px-4">
                <span className="text-2xl font-bold tracking-tight">{s.value}</span>
                <span className="text-xs text-white/35 mt-1 tracking-wide">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <section id="features" className="max-w-5xl mx-auto px-6 py-24 w-full">
          <h2 className="heading-lg text-3xl text-center mb-3 text-white/90">
            One interface for all your data
          </h2>
          <p className="text-sm text-white/35 text-center mb-14">
            Stop context-switching between tools. Query everything from one place.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="glass rounded-2xl p-7 transition-all duration-300 hover:bg-white/[0.04] hover:shadow-[0_0_40px_rgba(255,255,255,0.03)]"
              >
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center mb-5">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-br from-quartz-500 to-coral-500" />
                </div>
                <h3 className="text-[13px] font-semibold mb-2.5 text-white/90">{f.title}</h3>
                <p className="text-[13px] text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Integrations ──────────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pb-24 w-full">
          <p className="text-[11px] text-white/25 text-center uppercase tracking-[0.15em] mb-8">
            Works with everything you already use
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {INTEGRATIONS.map((name) => (
              <span
                key={name}
                className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-[12px] text-white/55 hover:text-white/80 hover:border-white/15 transition-colors cursor-default"
              >
                {name}
              </span>
            ))}
            <span className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[12px] text-white/30">
              +480 more
            </span>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="border-t border-white/[0.05] bg-black/30 backdrop-blur-md">
          <div className="max-w-2xl mx-auto text-center px-6 py-20">
            <h2 className="heading-lg text-3xl mb-3">Ready to start?</h2>
            <p className="text-white/35 mb-9 text-sm">
              Connect your first data source in under 2 minutes.
            </p>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/92 transition-colors shadow-[0_0_60px_rgba(255,255,255,0.07)]"
            >
              Launch app →
            </Link>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/[0.05] px-8 py-5 flex items-center justify-between text-[11px] text-white/20">
          <span>dedomena<span className="brand-sigma ml-0.5">Σ</span></span>
          <span>© 2026 Dedomena. AI-powered data intelligence.</span>
        </footer>

      </div>
    </>
  );
}
