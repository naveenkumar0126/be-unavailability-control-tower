import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, type DataStatus, type Filters, type Kpis } from "./lib/api";
import { FilterBar } from "./components/FilterBar";
import { KpiTiles } from "./components/KpiTiles";
import { PriorityQueue } from "./views/PriorityQueue";
import { Overview } from "./views/Overview";
import { PanIndia } from "./views/PanIndia";
import { Rollup } from "./views/Rollup";
import { Matrix } from "./views/Matrix";
import { WhItem } from "./views/WhItem";
import { Detail } from "./views/Detail";
import { FillRate } from "./views/FillRate";

const TABS = [
  { key: "action", label: "⚡ Action Board" },
  { key: "overview", label: "Overview" },
  { key: "pan", label: "🇮🇳 PAN India" },
  { key: "brand", label: "Brand" },
  { key: "matrix", label: "Brand × WH" },
  { key: "whitem", label: "Warehouse × Item" },
  { key: "fillrate", label: "🚚 Fill Rate" },
  { key: "wh", label: "Warehouse" },
  { key: "region", label: "Region" },
  { key: "detail", label: "Detail" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AvailabilityWorkspace({ status, dataVersion }: { status: DataStatus; dataVersion: number }) {
  const [filters, setFilters] = useState<Filters>({});
  const [tab, setTab] = useState<TabKey>("action");
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    api.kpis(filters).then(setKpis).catch(() => setKpis(null));
  }, [JSON.stringify(filters), dataVersion]);

  return (
    <div className="flex flex-col">
      <FilterBar facets={status.facets} filters={filters} onChange={setFilters} />
      <div className="p-4">
        {kpis && <KpiTiles kpis={kpis} />}

        <div id="tab-strip" className="flex gap-1 flex-wrap border-b mb-4" style={{ borderColor: "var(--border)" }}>
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

        {tab === "action" && <PriorityQueue filters={filters} dataVersion={dataVersion} />}
        {tab === "overview" && <Overview filters={filters} dataVersion={dataVersion} />}
        {tab === "pan" && <PanIndia filters={filters} dataVersion={dataVersion} />}
        {tab === "brand" && <Rollup filters={filters} by="brand" dataVersion={dataVersion} />}
        {tab === "matrix" && <Matrix filters={filters} dataVersion={dataVersion} />}
        {tab === "whitem" && <WhItem filters={filters} brands={status.facets?.brands ?? []} dataVersion={dataVersion} />}
        {tab === "fillrate" && <FillRate />}
        {tab === "wh" && <Rollup filters={filters} by="wh" dataVersion={dataVersion} />}
        {tab === "region" && <Rollup filters={filters} by="region" dataVersion={dataVersion} />}
        {tab === "detail" && <Detail filters={filters} dataVersion={dataVersion} />}
      </div>
    </div>
  );
}
