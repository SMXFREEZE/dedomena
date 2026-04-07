"use client";

import { motion } from "framer-motion";

const fade = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0 },
};

const stagger = {
  show: { transition: { staggerChildren: 0.07 } },
};

export function ArchitectureView() {
  return (
    <motion.div
      key="architecture"
      initial="hidden"
      animate="show"
      variants={stagger}
      className="flex-1 overflow-y-auto no-scrollbar"
    >
      <div className="max-w-3xl mx-auto px-8 py-10 space-y-10">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <motion.div variants={fade} className="space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/25 font-semibold">
              Technical Overview
            </span>
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-[10px] text-white/15 font-mono">v1.0</span>
          </div>
          <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-white leading-tight">
            dedomena<span className="text-white/20 ml-2">Σ</span>
          </h1>
          <p className="text-[15px] text-white/45 leading-relaxed max-w-xl">
            An enterprise-grade data intelligence platform that connects any data source to a
            large language model — enabling natural-language queries across your entire
            organisation's data without writing a single line of code.
          </p>
        </motion.div>

        {/* ── What it solves ─────────────────────────────────────────────── */}
        <motion.section variants={fade} className="space-y-4">
          <SectionTitle>The Problem It Solves</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                icon: "🗃",
                title: "Data is scattered",
                body: "Teams store data across dozens of tools — CRM, databases, cloud storage, spreadsheets, SaaS products. No single place to ask a question.",
              },
              {
                icon: "⚙",
                title: "Analysts are bottlenecks",
                body: "Every insight request requires an analyst to locate data, clean it, write queries, and produce a report — days of lag for a simple question.",
              },
              {
                icon: "🔐",
                title: "Data can't leave",
                body: "Sensitive data can't be uploaded to third-party tools. Compliance requirements block cloud-based AI services from touching raw records.",
              },
            ].map(card => (
              <ProblemCard key={card.title} {...card} />
            ))}
          </div>
        </motion.section>

        {/* ── Architecture diagram ───────────────────────────────────────── */}
        <motion.section variants={fade} className="space-y-4">
          <SectionTitle>System Architecture</SectionTitle>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-5">

            {/* Layer 1 — Sources */}
            <Layer
              badge="Layer 1"
              label="Data Sources"
              color="#5e6ad2"
              items={[
                "Local files (CSV, PDF, Excel, JSON…)",
                "Databases (PostgreSQL, MySQL, MongoDB, BigQuery…)",
                "Cloud Storage (Google Drive, OneDrive, S3, Dropbox…)",
                "CRM & SaaS (Salesforce, HubSpot, Notion, Airtable…)",
                "APIs (REST, GraphQL, webhooks)",
                "100+ connectors built-in",
              ]}
            />

            <FlowArrow label="OAuth 2.0 · API credentials · file upload · client-side fetch" />

            {/* Layer 2 — Processing */}
            <Layer
              badge="Layer 2"
              label="Ingestion & Storage Engine"
              color="#a78bfa"
              items={[
                "Client-side parsing — CSV, Excel, PDF, images processed in-browser, zero upload",
                "Server-side connectors — databases & enterprise APIs run through a secure Next.js API route",
                "ContentStorage — data persisted to localStorage, never leaves the user's device unless sent to AI",
                "CredentialStorage — OAuth tokens & API keys stored locally, encrypted at rest",
                "Incremental refresh — each source can be updated individually on demand",
              ]}
            />

            <FlowArrow label="Structured plaintext context · source metadata · character counts" />

            {/* Layer 3 — Intelligence */}
            <Layer
              badge="Layer 3"
              label="Intelligence Engine"
              color="#34d399"
              items={[
                "Claude (Anthropic) — frontier LLM for synthesis, reasoning, and summarisation",
                "Context assembly — relevant source content stitched with query into a structured prompt",
                "Three query modes: Synthesis (cross-source answers), Extract (structured data pull), Summarise (concise digest)",
                "Streaming responses — answers appear token-by-token, no waiting",
                "Query history — every question and its sources logged for auditability",
              ]}
            />

            <FlowArrow label="Natural-language answer · source citations · confidence signals" />

            {/* Layer 4 — Outputs */}
            <Layer
              badge="Layer 4"
              label="Output Surfaces"
              color="#f59e0b"
              items={[
                "Intelligence View — conversational Q&A across all connected sources",
                "Data Engineer View — clean, normalise, and transform raw data",
                "Analyst View — auto-generated charts, pivot tables, and statistical insights",
              ]}
            />
          </div>
        </motion.section>

        {/* ── Key design decisions ───────────────────────────────────────── */}
        <motion.section variants={fade} className="space-y-4">
          <SectionTitle>Key Design Decisions</SectionTitle>
          <div className="space-y-2">
            {[
              {
                title: "Client-first processing",
                body: "Files and desktop data are parsed entirely in the browser. Raw content never touches a server until the user explicitly sends a query — making compliance straightforward for sensitive datasets.",
              },
              {
                title: "Bring-your-own credentials",
                body: "OAuth tokens and API keys are stored in the user's own browser storage. dedomena never proxies or persists third-party credentials on any backend.",
              },
              {
                title: "Connector registry pattern",
                body: "Every integration is a declarative JSON definition (fields, OAuth config, execution mode). Adding a new connector requires no code change to the core engine — only a new entry in the registry.",
              },
              {
                title: "Model-agnostic synthesis layer",
                body: "The synthesis API route accepts any system prompt and query. Swapping the underlying LLM from Claude to another model requires changing one line — no rewrites to the ingestion or connector layers.",
              },
              {
                title: "Zero infrastructure for end-users",
                body: "There is no database to provision, no Docker container to run, and no environment to configure. Users open the app, connect a source, and ask a question. The entire stack is a single Next.js deployment.",
              },
            ].map(item => (
              <DesignCard key={item.title} {...item} />
            ))}
          </div>
        </motion.section>

        {/* ── Tech stack ─────────────────────────────────────────────────── */}
        <motion.section variants={fade} className="space-y-4">
          <SectionTitle>Technology Stack</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {[
              { layer: "Frontend",       tech: "Next.js 16 (App Router) · React 19 · TypeScript" },
              { layer: "Styling",        tech: "Tailwind CSS · Framer Motion · Linear & Raycast design language" },
              { layer: "State",          tech: "Zustand (persist middleware) · localStorage for content & credentials" },
              { layer: "AI / LLM",       tech: "Anthropic Claude — streaming via /api/synthesize route" },
              { layer: "Auth",           tech: "OAuth 2.0 PKCE · implicit grant · bring-your-own client ID" },
              { layer: "Connectors",     tech: "100+ declarative connectors · client + server execution modes" },
              { layer: "Deployment",     tech: "Vercel (Edge-ready) · no external database required" },
              { layer: "Security",       tech: "HTTPS only · credentials never logged · no telemetry" },
            ].map(row => (
              <StackRow key={row.layer} {...row} />
            ))}
          </div>
        </motion.section>

        {/* ── Data flow narrative ─────────────────────────────────────────── */}
        <motion.section variants={fade} className="space-y-4">
          <SectionTitle>End-to-End Data Flow</SectionTitle>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-0">
            {[
              { n: "01", title: "User connects a source", body: "They click Add Source, select a connector (e.g. Google Drive), and complete the OAuth flow. An access token is saved locally in their browser." },
              { n: "02", title: "Data is fetched and indexed", body: "The connector's fetcher runs — either client-side (files, Drive) or through a server route (databases). The content is normalised to plaintext and stored in ContentStorage." },
              { n: "03", title: "User asks a question", body: "They type a natural-language query in the Intelligence View and hit Enter. dedomena assembles the relevant source content into a structured prompt." },
              { n: "04", title: "Claude synthesises an answer", body: "The prompt is sent to Anthropic's API. Claude reads the source content, reasons across it, and streams back a cited answer — often in under two seconds." },
              { n: "05", title: "Answer is displayed", body: "The response renders in real time with source attributions. The query and its sources are recorded in the history log for future reference." },
            ].map((step, i, arr) => (
              <FlowStep key={step.n} {...step} last={i === arr.length - 1} />
            ))}
          </div>
        </motion.section>

        {/* ── Security & compliance ──────────────────────────────────────── */}
        <motion.section variants={fade} className="space-y-4">
          <SectionTitle>Security & Compliance Posture</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: "🔒", label: "No raw data stored server-side", sub: "All source content lives in the user's browser only" },
              { icon: "🔑", label: "Credentials never leave the client", sub: "OAuth tokens and API keys stay in localStorage" },
              { icon: "📡", label: "Minimal API surface", sub: "Only /api/synthesize, /api/connector/db, and OAuth callback routes" },
              { icon: "🌐", label: "HTTPS enforced", sub: "All traffic encrypted in transit; no HTTP fallback" },
              { icon: "🚫", label: "No telemetry or analytics", sub: "dedomena does not collect usage data or track users" },
              { icon: "📋", label: "Auditable query log", sub: "Every question and its source list is stored locally for review" },
            ].map(item => (
              <SecurityBadge key={item.label} {...item} />
            ))}
          </div>
        </motion.section>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <motion.div variants={fade} className="pt-4 pb-8 border-t border-white/[0.05] flex items-center justify-between">
          <span className="text-[10px] text-white/15 uppercase tracking-wider">dedomena Σ — Technical Architecture</span>
          <span className="text-[10px] text-white/15 font-mono">{new Date().getFullYear()}</span>
        </motion.div>

      </div>
    </motion.div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-[0.15em] text-white/30 font-semibold flex items-center gap-3">
      {children}
      <div className="h-px flex-1 bg-white/[0.05]" />
    </h2>
  );
}

function ProblemCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
      <div className="text-xl leading-none">{icon}</div>
      <p className="text-[12px] font-semibold text-white/75 tracking-[-0.01em]">{title}</p>
      <p className="text-[11px] text-white/35 leading-relaxed">{body}</p>
    </div>
  );
}

function Layer({ badge, label, color, items }: { badge: string; label: string; color: string; items: string[] }) {
  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: `${color}22`, backgroundColor: `${color}08` }}>
      <div className="flex items-center gap-2">
        <span
          className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
          style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
        >
          {badge}
        </span>
        <span className="text-[13px] font-semibold text-white/80 tracking-[-0.01em]">{label}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item} className="flex items-start gap-2 text-[11px] text-white/45 leading-snug">
            <span className="mt-[3px] w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: `${color}70` }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <div className="w-px h-3 bg-white/10" />
      <span className="text-[9px] text-white/20 uppercase tracking-widest px-3 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.02]">
        {label}
      </span>
      <div className="w-px h-3 bg-white/10" />
      <div className="text-white/15 text-xs leading-none">▼</div>
    </div>
  );
}

function DesignCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="w-1 shrink-0 rounded-full bg-[#5e6ad2]/40 self-stretch" />
      <div className="space-y-0.5">
        <p className="text-[12px] font-semibold text-white/75 tracking-[-0.01em]">{title}</p>
        <p className="text-[11px] text-white/35 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function StackRow({ layer, tech }: { layer: string; tech: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 items-center">
      <span className="text-[10px] text-white/30 uppercase tracking-widest w-20 shrink-0">{layer}</span>
      <span className="text-[11px] text-white/55 leading-snug">{tech}</span>
    </div>
  );
}

function FlowStep({ n, title, body, last }: { n: string; title: string; body: string; last: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center shrink-0">
          <span className="text-[9px] font-mono text-white/30">{n}</span>
        </div>
        {!last && <div className="w-px flex-1 bg-white/[0.05] my-1" />}
      </div>
      <div className={`pb-5 space-y-0.5 ${last ? "" : ""}`}>
        <p className="text-[12px] font-semibold text-white/70 tracking-[-0.01em]">{title}</p>
        <p className="text-[11px] text-white/35 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function SecurityBadge({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <span className="text-base leading-tight mt-0.5">{icon}</span>
      <div className="space-y-0.5">
        <p className="text-[11px] font-semibold text-white/65">{label}</p>
        <p className="text-[10px] text-white/30">{sub}</p>
      </div>
    </div>
  );
}
