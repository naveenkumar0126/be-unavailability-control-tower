import { useEffect, useState } from "react";
import { Sidebar, type ViewKey } from "./components/Sidebar";
import { UploadPanel } from "./components/UploadPanel";
import { ThemeToggle } from "./components/ThemeToggle";
import { AvailabilityWorkspace } from "./AvailabilityWorkspace";
import { PurchaseManagerWorkspace } from "./PurchaseManagerWorkspace";
import { TagsWorkspace } from "./TagsWorkspace";
import { FestiveWorkspace } from "./FestiveWorkspace";
import { api, type DataStatus } from "./lib/api";

export default function App() {
  const [view, setView] = useState<ViewKey>("availability");
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  function refreshStatus() {
    api
      .status()
      .then((s) => {
        setStatus(s);
        setDataVersion((v) => v + 1);
      })
      .catch(() => setStatus({ loaded: false }));
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--page)" }}>
      <Sidebar active={view} onSelect={setView} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="flex items-center gap-3 px-4 h-12 shrink-0"
          style={{ background: "linear-gradient(115deg, #1f3a5f, #2c5f8a 60%, #31708e)", boxShadow: "0 2px 12px rgba(20,35,60,.18)" }}
        >
          <span className="text-[14.5px] font-bold tracking-tight text-white">
            BE Unavailability <span style={{ color: "#f0c674" }}>Control Tower</span>
          </span>
          <div className="flex-1" />
          <ThemeToggle />
        </header>

        <UploadPanel status={status} onLoaded={refreshStatus} />

        <main className="flex-1 min-w-0">
          {view === "availability" &&
            (status?.loaded ? (
              <AvailabilityWorkspace status={status} dataVersion={dataVersion} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-24" style={{ color: "var(--text-muted)" }}>
                <div className="text-[40px]">📂</div>
                <div className="text-[14px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  No data loaded yet
                </div>
                <div className="text-[12px]">Upload a CSV or Excel file above to get started.</div>
              </div>
            ))}
          {view === "purchase_manager" &&
            (status?.loaded ? (
              <PurchaseManagerWorkspace status={status} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-24" style={{ color: "var(--text-muted)" }}>
                <div className="text-[40px]">📂</div>
                <div className="text-[14px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  No data loaded yet
                </div>
                <div className="text-[12px]">Upload the main Availability file above first — this workspace uses its warehouse list.</div>
              </div>
            ))}
          {view === "tags" && <TagsWorkspace />}
          {view === "festive" && <FestiveWorkspace />}
        </main>
      </div>
    </div>
  );
}
