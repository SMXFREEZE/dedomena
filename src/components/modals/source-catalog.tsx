"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Connector, CategoryId } from "@/lib/connectors/types";
import { CONNECTORS, CATEGORIES } from "@/lib/connectors/registry";
import { ConnectorIcon } from "@/components/ui/connector-icon";
import { cn } from "@/lib/utils";

interface SourceCatalogProps {
  onSelect: (connector: Connector) => void;
}

export function SourceCatalog({ onSelect }: SourceCatalogProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryId | "all">("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return CONNECTORS.filter(c => {
      const matchCat = activeCategory === "all" || c.category === activeCategory;
      const matchQ = !q ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.tags ?? []).some(t => t.includes(q));
      return matchCat && matchQ;
    }).sort((a, b) => {
      if (a.id === 'local-file') return -1;
      if (b.id === 'local-file') return 1;
      if (a.id === 'desktop-connect') return -1;
      if (b.id === 'desktop-connect') return 1;
      if (a.id === 'desktop-bridge') return -1;
      if (b.id === 'desktop-bridge') return 1;
      if (a.popular && !b.popular) return -1;
      if (!a.popular && b.popular) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [search, activeCategory]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input
          type="text"
          placeholder={`Search ${CONNECTORS.length}+ connectors…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <CategoryPill label="All" active={activeCategory === "all"} onClick={() => setActiveCategory("all")} />
        {CATEGORIES.map(cat => (
          <CategoryPill
            key={cat.id}
            label={cat.label}
            active={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
          />
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1 no-scrollbar">
        {filtered.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-white/30 text-sm">
            No connectors found for &quot;{search}&quot;
          </div>
        ) : (
          filtered.map(connector => (
            <ConnectorCard key={connector.id} connector={connector} onClick={() => onSelect(connector)} />
          ))
        )}
      </div>

      <p className="text-[10px] text-white/20 text-center tracking-widest uppercase">
        {filtered.length} of {CONNECTORS.length} connectors
      </p>
    </div>
  );
}

function CategoryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap",
        active
          ? "bg-white/15 text-white border border-white/20"
          : "bg-white/5 text-white/40 border border-white/5 hover:text-white/70 hover:bg-white/10"
      )}
    >
      {label}
    </button>
  );
}

function ConnectorCard({ connector, onClick }: { connector: Connector; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl text-left group transition-all duration-150",
        // Linear surface-1 at rest
        "bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]",
        // Raycast double-ring on hover: outer ring + subtle background lift
        "hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.12)]",
        "hover:shadow-[0_0_0_1px_rgba(18,20,24,0.9),inset_0_1px_0_0_rgba(255,255,255,0.06)]"
      )}
    >
      {/* Icon */}
      <div
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-150 group-hover:scale-105"
        style={{ backgroundColor: `${connector.color}15` }}
      >
        <ConnectorIcon iconSlug={connector.iconSlug} name={connector.name} color={connector.color} size={17} />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[12px] font-medium text-white/80 group-hover:text-white truncate leading-tight tracking-[-0.01em]">
            {connector.name}
          </span>
          {connector.popular && (
            <span className="shrink-0 text-[8px] text-white/25 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.06)] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
              popular
            </span>
          )}
        </div>
        <p className="text-[10px] text-white/30 leading-snug line-clamp-2">{connector.description}</p>
        <span className="text-[8px] text-white/15 uppercase tracking-widest mt-1 block">
          {connector.executionMode === 'server' ? 'server' : 'instant'}
        </span>
      </div>
    </button>
  );
}
