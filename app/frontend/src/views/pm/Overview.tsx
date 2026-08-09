import { useEffect, useState } from "react";
import { pmApi, type PmOverview } from "../../lib/api";
import { fmtNum, fmtPct, shortWh } from "../../lib/format";

type TabKey = "deliveries" | "focus" | "inbound" | "festive";

function Widget({
  icon,
  value,
  label,
  sub,
  accent,
  disabled,
  emptyHint,
  totalCount,
  onNavigate,
  children,
}: {
  icon: string;
  value: string;
  label: string;
  sub: string;
  accent: string;
  disabled?: boolean;
  emptyHint: string;
  totalCount?: number;
  onNavigate: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="card relative overflow-hidden px-4 py-3.5 flex flex-col"
      style={{ borderStyle: disabled ? "dashed" : "solid", opacity: disabled ? 0.6 : 1 }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: accent }} />

      <div className="flex items-start justify-between">
        <div className="text-[19px]">{icon}</div>
      </div>
      <div className="text-[22px] font-bold tracking-tight mt-1" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-[11.5px] mt-1" style={{ color: "var(--text-secondary)" }}>
        {sub}
      </div>

      {disabled ? (
        <div className="flex-1 flex items-center justify-center py-6 text-[11.5px] text-center" style={{ color: "var(--text-muted)" }}>
          {emptyHint}
        </div>
      ) : (
        <>
          <div className="flex flex-col mt-2.5 border-t pt-2 gap-1" style={{ borderColor: "var(--border)" }}>
            {children}
          </div>
          <button
            onClick={onNavigate}
            className="mt-2.5 self-start text-[11px] font-semibold"
            style={{ color: "var(--series-1)" }}
          >
            See all {totalCount != null ? fmtNum(totalCount) : ""} →
          </button>
        </>
      )}
    </div>
  );
}

function Row({ primary, secondary, metric }: { primary: string; secondary?: string; metric: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11.5px] py-0.5">
      <div className="min-w-0 flex-1">
        <div className="truncate" style={{ color: "var(--text-primary)" }}>
          {primary}
        </div>
        {secondary && (
          <div className="truncate text-[10.5px]" style={{ color: "var(--text-muted)" }}>
            {secondary}
          </div>
        )}
      </div>
      <div className="shrink-0 font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {metric}
      </div>
    </div>
  );
}

export function Overview({ wh, onNavigate }: { wh: string[]; onNavigate: (tab: TabKey) => void }) {
  const [data, setData] = useState<PmOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    pmApi
      .overview(wh)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [JSON.stringify(wh)]);

  if (error) return <div style={{ color: "var(--status-critical)" }}>{error}</div>;
  if (!data) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const inboundLow = data.inbound ? data.inbound.avg_utilization < 85 : false;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border-l-4 px-4 py-3 text-[12px]"
        style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
      >
        At a glance{wh.length > 0 ? ` for ${wh.length === 1 ? wh[0] : `${wh.length} selected warehouses`}` : " — all warehouses"}.
        Top items shown below each card — click "See all" to open the full page.
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <Widget
          icon="🎯"
          value={data.focus_items ? `${fmtNum(data.focus_items.count)} SKUs` : "–"}
          label="Focus Items"
          sub={data.focus_items ? `Under 3 days cover · ${fmtNum(data.focus_items.at_risk_cpd)} CPD at risk` : ""}
          accent="var(--status-critical)"
          disabled={!data.focus_items}
          emptyHint="Needs the main Availability dataset loaded"
          totalCount={data.focus_items?.count}
          onNavigate={() => onNavigate("focus")}
        >
          {data.focus_items?.top.map((r, i) => (
            <Row key={i} primary={r.item} secondary={`${shortWh(r.wh)} · ${r.brand}`} metric={`${fmtNum(r.cpd)} CPD · ${r.doi.toFixed(1)}d`} />
          ))}
          {data.focus_items && data.focus_items.top.length === 0 && (
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Nothing under 3 days cover.</div>
          )}
        </Widget>

        <Widget
          icon="📥"
          value={data.inbound ? fmtPct(data.inbound.avg_utilization) : "–"}
          label="Inbound Utilization"
          sub={data.inbound ? `7-day avg · ${fmtNum(data.inbound.low_wh_count)} of ${fmtNum(data.inbound.wh_count)} WH below 85%` : ""}
          accent={inboundLow ? "var(--status-critical)" : "var(--status-good)"}
          disabled={!data.inbound}
          emptyHint="No inbound data loaded"
          totalCount={data.inbound?.wh_count}
          onNavigate={() => onNavigate("inbound")}
        >
          {data.inbound?.top.map((r, i) => (
            <Row key={i} primary={shortWh(r.wh)} secondary={r.zone} metric={fmtPct(r.avg_utilization)} />
          ))}
        </Widget>

        <Widget
          icon="🎉"
          value={data.festive ? fmtNum(data.festive.total_requirement) : "–"}
          label="Festive Requirement"
          sub={data.festive ? `Outstanding qty · ${fmtNum(data.festive.ptype_count)} ptypes · ${fmtNum(data.festive.row_count)} lines` : ""}
          accent="var(--series-4)"
          disabled={!data.festive}
          emptyHint="No festive data loaded"
          totalCount={data.festive?.row_count}
          onNavigate={() => onNavigate("festive")}
        >
          {data.festive?.top.map((r, i) => (
            <Row key={i} primary={r.item} secondary={`${shortWh(r.wh)} · ${r.ptype}`} metric={fmtNum(r.requirement)} />
          ))}
          {data.festive && data.festive.top.length === 0 && (
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>No outstanding requirement.</div>
          )}
        </Widget>

        <Widget
          icon="🚛"
          value={data.deliveries ? fmtNum(data.deliveries.total_units) : "–"}
          label="Expected Today"
          sub={data.deliveries ? `Units on PO for today · ${fmtNum(data.deliveries.po_lines)} PO lines` : ""}
          accent="var(--series-1)"
          disabled={!data.deliveries}
          emptyHint="Needs Fill Rate data loaded"
          totalCount={data.deliveries?.row_count}
          onNavigate={() => onNavigate("deliveries")}
        >
          {data.deliveries?.top.map((r, i) => (
            <Row key={i} primary={r.item} secondary={`${shortWh(r.wh)} · ${r.brand}`} metric={fmtNum(r.ordered)} />
          ))}
          {data.deliveries && data.deliveries.top.length === 0 && (
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Nothing scheduled for today.</div>
          )}
        </Widget>
      </div>
    </div>
  );
}
