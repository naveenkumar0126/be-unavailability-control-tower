import { useEffect, useState } from "react";
import clsx from "clsx";
import { pmApi, type FestiveStatus } from "./lib/api";
import { Overview } from "./views/festive/Overview";
import { ByPtype } from "./views/festive/ByPtype";
import { ByDimension } from "./views/festive/ByDimension";
import { Detail } from "./views/festive/Detail";

const TABS = [
  { key: "overview", label: "⚡ Overview" },
  { key: "ptype", label: "🎉 By Product Type" },
  { key: "brand", label: "🏷️ By Brand" },
  { key: "region", label: "🗺️ By Region" },
  { key: "warehouse", label: "🏭 By Warehouse" },
  { key: "detail", label: "📋 Requirement Detail" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function FestiveWorkspace() {
  const [status, setStatus] = useState<FestiveStatus | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  useEffect(() => {
    pmApi.festiveStatus().then(setStatus).catch(() => setStatus({ loaded: false, ptypes: [] }));
  }, []);

  if (!status) return <div className="p-4" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  if (!status.loaded) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20" style={{ color: "var(--text-muted)" }}>
        <div className="text-[40px]">🎉</div>
        <div className="text-[14px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          No festive stock-readiness data loaded yet
        </div>
        <div className="text-[12px] max-w-md text-center">
          Upload the per-ptype projection files from Purchase Manager → Festive Requirements first — this dashboard
          reads the same data, just with more views.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b flex-wrap" style={{ borderColor: "var(--border)" }}>
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          {status.ptypes.map((p) => `${p.ptype} (${p.rows})`).join(" · ")}
        </span>
      </div>

      <div className="p-4">
        <div id="festive-tab-strip" className="flex gap-1 flex-wrap border-b mb-4" style={{ borderColor: "var(--border)" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx("px-3.5 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors")}
              style={{
                borderColor: tab === t.key ? "var(--series-1)" : "transparent",
                color: tab === t.key ? "var(--series-1)" : "var(--text-secondary)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <Overview onNavigate={setTab} />}
        {tab === "ptype" && <ByPtype />}
        {tab === "brand" && <ByDimension dim="brand" />}
        {tab === "region" && <ByDimension dim="region" />}
        {tab === "warehouse" && <ByDimension dim="wh" />}
        {tab === "detail" && <Detail />}
      </div>
    </div>
  );
}
