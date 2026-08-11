import { useEffect, useState } from "react";
import { tagsApi, type TagsOverview } from "../../lib/api";
import { fmtNum, fmtPct, severityColor } from "../../lib/format";

type TabKey = "overview" | "trend" | "brand" | "warehouse" | "chronic" | "detail";

function Delta({ current, prev, goodDirection }: { current: number; prev: number | null; goodDirection: "up" | "down" }) {
  if (prev == null) return null;
  const diff = current - prev;
  if (Math.abs(diff) < 0.05) return <span style={{ color: "var(--text-muted)" }}> · flat vs last week</span>;
  const improved = goodDirection === "up" ? diff > 0 : diff < 0;
  const arrow = diff > 0 ? "▲" : "▼";
  return (
    <span style={{ color: improved ? "var(--status-good)" : "var(--status-critical)" }}>
      {" "}
      {arrow} {Math.abs(diff).toFixed(1)}pp vs last week
    </span>
  );
}

function Tile({ value, label, sub, accent }: { value: string; label: string; sub?: React.ReactNode; accent: string }) {
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
  const [data, setData] = useState<TagsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tagsApi
      .overview()
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
        Week of <b style={{ color: "var(--text-primary)" }}>{data.latest_week_label}</b> — {data.weeks_available} weeks of
        tagging history loaded. Each row is a warehouse × brand issue a Purchase Manager reviewed and tagged with a root
        cause.
      </div>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <Tile
          value={fmtPct(data.coverage_pct)}
          label="Tagging Coverage"
          sub={<>of {fmtNum(data.total_rows)} rows tagged<Delta current={data.coverage_pct} prev={data.prev_coverage_pct} goodDirection="up" /></>}
          accent={data.coverage_pct >= 90 ? "var(--status-good)" : severityColor(100 - data.coverage_pct)}
        />
        <Tile
          value={fmtNum(data.top_tag_count)}
          label="Top Root Cause"
          sub={
            <>
              {data.top_tag}
              {data.top_tag_prev_count != null && (
                <Delta current={data.top_tag_count} prev={data.top_tag_prev_count} goodDirection="down" />
              )}
            </>
          }
          accent="var(--status-critical)"
        />
        <Tile
          value={fmtPct(data.good_pct)}
          label="No Issues"
          sub={<>of this week's rows<Delta current={data.good_pct} prev={data.prev_good_pct} goodDirection="up" /></>}
          accent="var(--status-good)"
        />
        <Tile
          value={fmtNum(data.at_risk_cpd)}
          label="At-Risk CPD"
          sub="demand behind tagged issues this week"
          accent="var(--series-4)"
        />
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {[
          { key: "trend" as const, icon: "📈", title: "Trend Over Time", desc: "Weekly tag counts and at-risk CPD, week over week" },
          { key: "brand" as const, icon: "🏷️", title: "By Brand", desc: "Which brands drive each root cause" },
          { key: "warehouse" as const, icon: "🏭", title: "By Warehouse", desc: "Which warehouses drive each root cause" },
          { key: "chronic" as const, icon: "⚠️", title: "Chronic Issues", desc: "Stuck on the same problem 3+ weeks running" },
          { key: "detail" as const, icon: "📋", title: "Detail", desc: "Every tagged row with PM remarks, filterable" },
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
