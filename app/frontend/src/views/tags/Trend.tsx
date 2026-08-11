import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { tagsApi, type TagCoverageRow, type TagTrendRow } from "../../lib/api";
import { fmtNum, fmtPct } from "../../lib/format";
import { seriesHex, palette } from "../../lib/chartColors";
import { useTheme } from "../../lib/theme";

const MAX_SERIES = 8;

export function Trend() {
  const { isDark } = useTheme();
  const pal = palette(isDark);
  const [trend, setTrend] = useState<TagTrendRow[] | null>(null);
  const [coverage, setCoverage] = useState<TagCoverageRow[] | null>(null);
  const [metric, setMetric] = useState<"count" | "at_risk_cpd">("count");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tagsApi
      .trend()
      .then((d) => {
        setTrend(d.trend);
        setCoverage(d.coverage);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={{ color: "var(--status-critical)" }}>{error}</div>;
  if (!trend || !coverage) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const weeks = [...new Set(trend.map((r) => r.week))].sort();
  const weekLabels = weeks.map((w) => trend.find((r) => r.week === w)?.week_label ?? w);

  const totalsByTag: Record<string, number> = {};
  for (const r of trend) totalsByTag[r.tag] = (totalsByTag[r.tag] ?? 0) + r[metric];
  const topTags = Object.entries(totalsByTag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SERIES - 1)
    .map(([t]) => t);
  const hasOther = Object.keys(totalsByTag).length > topTags.length;
  const tagLabels = hasOther ? [...topTags, "Other"] : topTags;

  const series = tagLabels.map((tag, i) => ({
    name: tag,
    type: "bar" as const,
    stack: "tags",
    barMaxWidth: 60,
    itemStyle: { color: tag === "No issues" ? pal.good : seriesHex(isDark, i) },
    data: weeks.map((w) => {
      if (tag === "Other") {
        return trend.filter((r) => r.week === w && !topTags.includes(r.tag)).reduce((s, r) => s + r[metric], 0);
      }
      const row = trend.find((r) => r.week === w && r.tag === tag);
      return row ? Math.round(row[metric] * 100) / 100 : 0;
    }),
  }));

  const coverageSeries = {
    name: "Coverage %",
    type: "line" as const,
    yAxisIndex: 1,
    data: weeks.map((w) => {
      const row = coverage.find((c) => c.week === w);
      return row ? +row.coverage_pct.toFixed(1) : null;
    }),
    symbol: "circle",
    symbolSize: 6,
    lineStyle: { width: 2.5, color: seriesHex(isDark, 7) },
    itemStyle: { color: seriesHex(isDark, 7) },
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border-l-4 px-4 py-3 text-[12px]"
        style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
      >
        Stacked bars = tag mix each week (see whether root causes are shrinking or growing). Line = tagging coverage %
        (right axis) — a gap here means PMs haven't reviewed everything yet, not that there's no issue.
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          Weight by:
        </span>
        {(["count", "at_risk_cpd"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ background: metric === m ? "var(--series-1)" : "var(--surface-2)", color: metric === m ? "#fff" : "var(--text-secondary)" }}
          >
            {m === "count" ? "Row count" : "At-risk CPD"}
          </button>
        ))}
      </div>

      <div className="card p-3">
        <ReactECharts
          style={{ height: 380 }}
          option={{
            grid: { left: 55, right: 55, top: 40, bottom: 40 },
            legend: { top: 0, textStyle: { color: pal.muted, fontSize: 10 } },
            xAxis: { type: "category", data: weekLabels, axisLabel: { color: pal.muted, fontSize: 11 }, axisLine: { lineStyle: { color: pal.gridline } } },
            yAxis: [
              {
                type: "value",
                name: metric === "count" ? "Rows" : "At-risk CPD",
                nameTextStyle: { color: pal.muted, fontSize: 10 },
                axisLabel: { color: pal.muted, fontSize: 10 },
                splitLine: { lineStyle: { color: pal.gridline } },
              },
              {
                type: "value",
                name: "Coverage %",
                max: 100,
                nameTextStyle: { color: pal.muted, fontSize: 10 },
                axisLabel: { color: pal.muted, fontSize: 10 },
                splitLine: { show: false },
              },
            ],
            tooltip: { trigger: "axis" },
            series: [...series, coverageSeries],
          }}
        />
      </div>

      <div className="rounded-lg border overflow-auto" style={{ borderColor: "var(--border)" }}>
        <table>
          <thead>
            <tr>
              <th className="l">Tag</th>
              {weekLabels.map((w) => (
                <th key={w}>{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tagLabels.map((tag) => (
              <tr key={tag}>
                <td className="l">{tag}</td>
                {weeks.map((w) => {
                  const v =
                    tag === "Other"
                      ? trend.filter((r) => r.week === w && !topTags.includes(r.tag)).reduce((s, r) => s + r[metric], 0)
                      : trend.find((r) => r.week === w && r.tag === tag)?.[metric] ?? 0;
                  return <td key={w}>{metric === "count" ? fmtNum(v) : fmtNum(v)}</td>;
                })}
              </tr>
            ))}
            <tr>
              <td className="l" style={{ fontWeight: 700 }}>
                Coverage %
              </td>
              {weeks.map((w) => (
                <td key={w} style={{ fontWeight: 700 }}>
                  {fmtPct(coverage.find((c) => c.week === w)?.coverage_pct ?? 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
