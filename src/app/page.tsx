"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Sunrise } from "lucide-react";
import { VantaBackground } from "@/components/ui/vanta-background";

function isMorning() {
  const h = new Date().getHours();
  return h >= 6 && h < 18;
}

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

export default function LandingPage() {
  const [mode, setMode] = useState<"night" | "morning">("night");

  useEffect(() => {
    setMode(isMorning() ? "morning" : "night");
  }, []);

  const isNight = mode === "night";

  return (
    <>
      <VantaBackground mode={mode} />

      <div className="relative z-10 flex flex-col min-h-screen text-white">

        <nav className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-semibold tracking-tight">dedomena</span>
            <span className="brand-sigma text-coral-500 text-lg">Σ</span>
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

        <section className="flex flex-col items-center justify-center text-center px-5 sm:px-6 pt-14 sm:pt-24 pb-14 sm:pb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-coral-400 animate-pulse" />
            Now in public beta
          </div>

          <h1 className="heading-display text-4xl sm:text-6xl md:text-7xl max-w-3xl mb-5 sm:mb-6">
            Turn every database<br />
            <span className="text-gradient">into intelligence.</span>
          </h1>

          <p className="text-base sm:text-lg text-white/50 max-w-xl mb-8 sm:mb-10 leading-relaxed">
            Ask in plain language. Get answers instantly.<br />
            Dedomena connects to all your data sources — no pipelines required.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Link
              href="/app"
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors shadow-[0_0_40px_rgba(255,255,255,0.08)]"
            >
              Start for free
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-white/10 text-sm font-medium text-white/60 hover:text-white hover:border-white/20 transition-colors"
            >
              See how it works
            </a>
          </div>
        </section>

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

        <section id="features" className="max-w-5xl mx-auto px-5 sm:px-6 py-16 sm:py-24 w-full">
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

        <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-16 sm:pb-24 w-full">
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

        <section className="border-t border-white/[0.05] bg-black/30 backdrop-blur-md">
          <div className="max-w-2xl mx-auto text-center px-5 sm:px-6 py-14 sm:py-20">
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

        <footer className="border-t border-white/[0.05] px-5 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row items-center gap-1 sm:gap-0 sm:justify-between text-[11px] text-white/20">
          <span>dedomena<span className="brand-sigma ml-0.5">Σ</span></span>
          <span>© 2026 Dedomena. AI-powered data intelligence.</span>
        </footer>

      </div>
    </>
  );
}
