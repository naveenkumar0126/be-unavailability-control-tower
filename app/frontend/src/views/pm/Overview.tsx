import { useEffect, useState } from "react";
import { pmApi, type PmOverview } from "../../lib/api";
import { fmtNum, fmtPct } from "../../lib/format";

type TabKey = "deliveries" | "focus" | "inbound" | "festive";

function Tile({
  icon,
  value,
  label,
  sub,
  accent,
  disabled,
  onClick,
}: {
  icon: string;
  value: string;
  label: string;
  sub: string;
  accent: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="card relative overflow-hidden px-5 py-4 text-left transition-transform"
      style={{
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        borderStyle: disabled ? "dashed" : "solid",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <div className="text-[22px]">{icon}</div>
        {!disabled && (
          <span className="text-[10.5px] font-semibold" style={{ color: "var(--series-1)" }}>
            View →
          </span>
        )}
      </div>
      <div className="text-[26px] font-bold tracking-tight mt-2" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
      <div className="text-[11.5px] font-semibold uppercase tracking-wide mt-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-[12px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
        {sub}
      </div>
    </button>
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
        Click any card to dive into the detail.
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {data.focus_items ? (
          <Tile
            icon="🎯"
            value={`${fmtNum(data.focus_items.count)} SKUs`}
            label="Focus Items"
            sub={`High demand, under 3 days cover · ${fmtNum(data.focus_items.at_risk_cpd)} CPD at risk`}
            accent="var(--status-critical)"
            onClick={() => onNavigate("focus")}
          />
        ) : (
          <Tile icon="🎯" value="–" label="Focus Items" sub="Needs the main Availability dataset loaded" accent="var(--text-muted)" disabled onClick={() => {}} />
        )}

        {data.inbound ? (
          <Tile
            icon="📥"
            value={fmtPct(data.inbound.avg_utilization)}
            label="Inbound Utilization"
            sub={`7-day avg · ${fmtNum(data.inbound.low_wh_count)} of ${fmtNum(data.inbound.wh_count)} WH below 85%`}
            accent={inboundLow ? "var(--status-critical)" : "var(--status-good)"}
            onClick={() => onNavigate("inbound")}
          />
        ) : (
          <Tile icon="📥" value="–" label="Inbound Utilization" sub="No inbound data loaded" accent="var(--text-muted)" disabled onClick={() => {}} />
        )}

        {data.festive ? (
          <Tile
            icon="🎉"
            value={fmtNum(data.festive.total_requirement)}
            label="Festive Requirement"
            sub={`Outstanding qty · ${fmtNum(data.festive.ptype_count)} ptypes · ${fmtNum(data.festive.row_count)} SKU/WH lines`}
            accent="var(--series-4)"
            onClick={() => onNavigate("festive")}
          />
        ) : (
          <Tile icon="🎉" value="–" label="Festive Requirement" sub="No festive data loaded" accent="var(--text-muted)" disabled onClick={() => {}} />
        )}

        {data.deliveries ? (
          <Tile
            icon="🚛"
            value={fmtNum(data.deliveries.total_units)}
            label="Expected Today"
            sub={`Units on PO for today · ${fmtNum(data.deliveries.po_lines)} PO lines`}
            accent="var(--series-1)"
            onClick={() => onNavigate("deliveries")}
          />
        ) : (
          <Tile icon="🚛" value="–" label="Expected Today" sub="Needs Fill Rate data loaded" accent="var(--text-muted)" disabled onClick={() => {}} />
        )}
      </div>
    </div>
  );
}
