"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";

declare global {
  interface Window {
    VANTA: any;
    THREE: any;
  }
}

const INTEGRATIONS = [
  "PostgreSQL", "MongoDB", "MySQL", "Redis", "Snowflake",
  "Databricks", "Salesforce", "AWS S3", "GitHub", "Elasticsearch",
  "Cassandra", "MariaDB", "BigQuery", "DynamoDB", "Stripe",
];

const STATS = [
  { value: "500+", label: "Integrations" },
  { value: "10ms",  label: "Avg query time" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "0",     label: "Data copies made" },
];

const FEATURES = [
  {
    title: "Connect once. Query everything.",
    desc: "One platform to query every database, API, and file — with AI built in. No data duplication, no pipelines.",
  },
  {
    title: "Ask in plain language.",
    desc: "Skip SQL, skip dashboards. Type a question, get an answer. Dedomena translates intent into queries across all your sources.",
  },
  {
    title: "Enterprise-grade security.",
    desc: "Credentials stay local. Queries run server-side. Zero data copies means zero data exposure.",
  },
];

export default function LandingPage() {
  const vantaRef  = useRef<HTMLDivElement>(null);
  const vantaFx   = useRef<any>(null);
  const [threeOk, setThreeOk]  = useState(false);
  const [vantaOk, setVantaOk]  = useState(false);

  useEffect(() => {
    if (!threeOk || !vantaOk || !vantaRef.current) return;
    if (vantaFx.current) vantaFx.current.destroy();
    try {
      vantaFx.current = window.VANTA.FOG({
        el: vantaRef.current,
        THREE: window.THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        highlightColor: 0x0a0f1a,
        midtoneColor:   0x050810,
        lowlightColor:  0x020408,
        baseColor:      0x030507,
        blurFactor:     0.9,
        speed:          1.2,
        zoom:           0.6,
      });
    } catch (_) {}
    return () => { vantaFx.current?.destroy(); };
  }, [threeOk, vantaOk]);

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"
        strategy="afterInteractive"
        onLoad={() => setThreeOk(true)}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"
        strategy="afterInteractive"
        onLoad={() => setVantaOk(true)}
      />

      {/* Vanta canvas */}
      <div ref={vantaRef} className="fixed inset-0 z-0" />

      <div className="relative z-10 flex flex-col min-h-screen text-white">

        {/* ── Nav ─────────────────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-1">
            <span className="text-lg font-semibold tracking-tight">dedomena</span>
            <span className="brand-sigma text-coral-500 text-lg">Σ</span>
          </div>
          <Link
            href="/app"
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium transition-colors"
          >
            Launch app →
          </Link>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
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
              className="px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
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

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        <div className="border-y border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col items-center py-6 px-4">
                <span className="text-2xl font-bold tracking-tight">{s.value}</span>
                <span className="text-xs text-white/40 mt-1">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <section id="features" className="max-w-5xl mx-auto px-6 py-24 w-full">
          <h2 className="heading-lg text-3xl text-center mb-16 text-white/90">
            One interface for all your data
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass rounded-2xl p-6 transition-all hover:border-white/10">
                <h3 className="text-sm font-semibold mb-3">{f.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Integrations ────────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pb-24 w-full">
          <p className="text-xs text-white/30 text-center uppercase tracking-widest mb-8">
            Works with everything you already use
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {INTEGRATIONS.map((name) => (
              <span
                key={name}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/[0.08] text-xs text-white/60"
              >
                {name}
              </span>
            ))}
            <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/[0.08] text-xs text-white/35">
              +480 more
            </span>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <section className="border-t border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto text-center px-6 py-20">
            <h2 className="heading-lg text-3xl mb-4">Ready to start?</h2>
            <p className="text-white/40 mb-8 text-sm">
              Connect your first data source in under 2 minutes.
            </p>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
            >
              Launch app →
            </Link>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/5 px-8 py-6 flex items-center justify-between text-xs text-white/25">
          <span>
            dedomena<span className="brand-sigma ml-0.5">Σ</span>
          </span>
          <span>© 2026 Dedomena. AI-powered data intelligence.</span>
        </footer>

      </div>
    </>
  );
}
