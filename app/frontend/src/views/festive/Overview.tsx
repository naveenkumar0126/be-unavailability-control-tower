import { useEffect, useState } from "react";
import { pmApi, type FestiveOverview } from "../../lib/api";
import { fmtNum, fmtPct, severityColor } from "../../lib/format";

type TabKey = "overview" | "ptype" | "brand" | "region" | "warehouse" | "detail";

function Tile({ value, label, sub, accent }: { value: string; label: string; sub?: string; accent: string }) {
  return (
    <div className="card relative overflow-hidden px-4 py-3">
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />
      <div className="text-[21px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      {sub && (
        <div className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function Overview({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const [data, setData] = useState<FestiveOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pmApi
      .festiveOverview()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={{ color: "var(--status-critical)" }}>{error}</div>;
  if (!data) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border-l-4 px-4 py-3 text-[12px]"
        style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
      >
        Sawan festive stock-readiness across <b style={{ color: "var(--text-primary)" }}>{data.ptype_count} product types</b>{" "}
        ({data.ptypes.join(", ")}), {fmtNum(data.warehouse_count)} warehouses, {fmtNum(data.brand_count)} brands.
        "Achievement" = how much of the projected festive need is covered — by inventory alone (BE), or inventory + open
        PO (BE+PO). Both are demand-weighted, so a big-need warehouse counts for more than a rounding error elsewhere.
      </div>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <Tile
          value={fmtNum(data.total_requirement)}
          label="Still Required"
          sub="units outstanding across all ptypes"
          accent="var(--status-critical)"
        />
        <Tile
          value={fmtPct(data.ach_be_pct)}
          label="Achievement · Inventory Only"
          sub="need-weighted, BE stock alone"
          accent={severityColor(100 - data.ach_be_pct)}
        />
        <Tile
          value={fmtPct(data.ach_po_pct)}
          label="Achievement · + Open PO"
          sub="need-weighted, incl. incoming"
          accent={severityColor(100 - data.ach_po_pct)}
        />
        <Tile
          value={fmtNum(data.at_risk_count)}
          label="At-Risk Combos"
          sub={`< 50% covered even with PO · ${fmtNum(data.at_risk_requirement)} units`}
          accent="var(--status-critical)"
        />
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {[
          { key: "ptype" as const, icon: "🎉", title: "By Product Type", desc: "Compare Khoya / Rasmalai / Sabudana Tikki readiness" },
          { key: "brand" as const, icon: "🏷️", title: "By Brand", desc: "Which brand is driving the shortfall" },
          { key: "region" as const, icon: "🗺️", title: "By Region", desc: "Geographic readiness for procurement/logistics" },
          { key: "warehouse" as const, icon: "🏭", title: "By Warehouse", desc: "Warehouse-level requirement and coverage" },
          { key: "detail" as const, icon: "📋", title: "Requirement Detail", desc: "Every WH × brand × SKU line, with remarks" },
        ].map((c) => (
          <button
            key={c.key}
            onClick={() => onNavigate(c.key)}
            className="card px-4 py-3 text-left transition-transform hover:-translate-y-0.5"
          >
            <div className="text-[19px] mb-1">{c.icon}</div>
            <div className="text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {c.title}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {c.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
