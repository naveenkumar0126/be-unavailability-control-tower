import { useState } from "react";
import clsx from "clsx";
import type { DataStatus } from "./lib/api";
import { MultiSelect } from "./components/MultiSelect";
import { InboundUtilization } from "./views/pm/InboundUtilization";
import { FestiveRequirements } from "./views/pm/FestiveRequirements";
import { FocusItems } from "./views/pm/FocusItems";
import { DeliveriesToday } from "./views/pm/DeliveriesToday";
import { Overview } from "./views/pm/Overview";

const TABS = [
  { key: "overview", label: "⚡ Overview" },
  { key: "deliveries", label: "🚛 Today's Deliveries" },
  { key: "focus", label: "🎯 Focus Items" },
  { key: "inbound", label: "📥 Inbound Utilization" },
  { key: "festive", label: "🎉 Festive Requirements" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function PurchaseManagerWorkspace({ status }: { status: DataStatus }) {
  const [wh, setWh] = useState<string[]>([]);
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          My warehouse(s):
        </span>
        <MultiSelect label="Warehouse" options={status.facets?.warehouses ?? []} selected={wh} onChange={setWh} />
        {wh.length === 0 && (
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            No warehouse selected — showing all. Pick yours to focus the view.
          </span>
        )}
      </div>

      <div className="p-4">
        <div id="pm-tab-strip" className="flex gap-1 flex-wrap border-b mb-4" style={{ borderColor: "var(--border)" }}>
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

        {tab === "overview" && <Overview wh={wh} onNavigate={setTab} />}
        {tab === "deliveries" && <DeliveriesToday wh={wh} />}
        {tab === "focus" && <FocusItems wh={wh} />}
        {tab === "inbound" && <InboundUtilization wh={wh} />}
        {tab === "festive" && <FestiveRequirements wh={wh} />}
      </div>
    </div>
  );
}
