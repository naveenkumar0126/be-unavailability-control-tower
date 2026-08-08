import type { Kpis } from "../lib/api";
import { fmtNum, fmtPct, severityColor } from "../lib/format";

function Tile({ value, label, sub, accent }: { value: string; label: string; sub?: string; accent?: string }) {
  return (
    <div className="card relative overflow-hidden px-4 py-3">
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent ?? "var(--series-1)" }} />
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

export function KpiTiles({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
      <Tile
        value={fmtPct(kpis.unavail_weighted)}
        label="Unavailability · weighted"
        sub={kpis.is_filtered ? "within selection" : "PAN India"}
        accent={severityColor(kpis.unavail_weighted)}
      />
      <Tile value={fmtPct(kpis.avail_weighted)} label="Availability · weighted" accent="var(--status-good)" />
      <Tile
        value={fmtPct(kpis.unavail_normal)}
        label="Unavailability · normal"
        sub="by SKU count"
        accent={severityColor(kpis.unavail_normal)}
      />
      <Tile value={fmtPct(kpis.avail_normal)} label="Availability · normal" accent="var(--status-good)" />
      <Tile
        value={fmtNum(kpis.unavail_cpd)}
        label="Unavailable CPD"
        sub={`of ${fmtNum(kpis.total_cpd)}${kpis.pct_of_pan != null ? ` · ${fmtPct(kpis.pct_of_pan)} of PAN` : ""}`}
        accent="var(--status-critical)"
      />
      <Tile
        value={fmtNum(kpis.active_skus)}
        label="Active SKUs"
        sub={`${kpis.warehouses} WHs · ${kpis.brands} brands`}
        accent="var(--series-7)"
      />
    </div>
  );
}
