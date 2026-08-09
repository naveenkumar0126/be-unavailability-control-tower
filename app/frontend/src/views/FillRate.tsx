import { useEffect, useRef, useState } from "react";
import { fillRateApi, type FillStatus, type BrandFillRow, type SkuFillRow } from "../lib/api";
import { DataTable, type Column } from "../components/DataTable";
import { SeverityPill } from "../components/Pill";
import { availColor, fmtNum } from "../lib/format";
import { GoogleSheetSync } from "../components/GoogleSheetSync";

type Mode = "brand" | "sku";

function UploadPrompt({ onLoaded }: { onLoaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      await fillRateApi.upload(file);
      onLoaded();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24" style={{ color: "var(--text-muted)" }}>
      <div className="text-[40px]">🚚</div>
      <div className="text-[14px] font-semibold" style={{ color: "var(--text-secondary)" }}>
        No fill rate data loaded yet
      </div>
      <div className="text-[12px] max-w-md text-center">
        Upload the daily PO-level file (warehouse × SKU, quantity ordered vs GRN'd) to compute L1/L2/L15 fill rates.
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-md px-4 py-2 text-[12px] font-semibold border disabled:opacity-50"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        >
          {busy ? "Uploading & computing…" : "Upload fill rate CSV/XLSX"}
        </button>
        <GoogleSheetSync
          syncEndpoint="/api/fillrate/sync-sheet"
          listTabsEndpoint="/api/fillrate/list-sheet-tabs"
          infoEndpoint="/api/data/sheets-info"
          onSynced={onLoaded}
        />
      </div>
      {error && <span style={{ color: "var(--status-critical)" }}>{error}</span>}
    </div>
  );
}

export function FillRate() {
  const [status, setStatus] = useState<FillStatus | null>(null);
  const [mode, setMode] = useState<Mode>("brand");
  const [query, setQuery] = useState("");
  const [brandRows, setBrandRows] = useState<BrandFillRow[] | null>(null);
  const [skuRows, setSkuRows] = useState<SkuFillRow[] | null>(null);

  function refreshStatus() {
    fillRateApi.status().then(setStatus).catch(() => setStatus({ loaded: false }));
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  useEffect(() => {
    if (!status?.loaded) return;
    if (mode === "brand") fillRateApi.brand(query || undefined).then(setBrandRows).catch(() => setBrandRows([]));
    else fillRateApi.sku(query || undefined).then(setSkuRows).catch(() => setSkuRows([]));
  }, [status?.loaded, mode, query]);

  if (!status) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;
  if (!status.loaded) return <UploadPrompt onLoaded={refreshStatus} />;

  const w = status.windows!;

  const fillPillCol = (key: "fill_L1" | "fill_L2" | "fill_L15", label: string): Column<any> => ({
    key,
    label,
    render: (v: number) => <SeverityPill value={v} color={availColor(v)} decimals={1} />,
  });

  const brandColumns: Column<BrandFillRow>[] = [
    { key: "brand", label: "Brand", left: true },
    { key: "ordered_L15", label: "Ordered (L15)", bar: true, defaultSort: true },
    { key: "grn_L15", label: "GRN'd (L15)", bar: true },
    fillPillCol("fill_L1", "Fill % · L1"),
    fillPillCol("fill_L2", "Fill % · L2"),
    fillPillCol("fill_L15", "Fill % · L15"),
    { key: "lines_L15", label: "PO lines (L15)" },
  ];

  const skuColumns: Column<SkuFillRow>[] = [
    { key: "item", label: "Item", left: true },
    { key: "brand", label: "Brand", left: true },
    { key: "ordered_L15", label: "Ordered (L15)", bar: true, defaultSort: true },
    { key: "grn_L15", label: "GRN'd (L15)", bar: true },
    fillPillCol("fill_L1", "Fill % · L1"),
    fillPillCol("fill_L2", "Fill % · L2"),
    fillPillCol("fill_L15", "Fill % · L15"),
    { key: "lines_L15", label: "PO lines (L15)" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border-l-4 px-4 py-3 text-[12px] flex flex-wrap items-center gap-x-6 gap-y-1"
        style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
      >
        <span>
          <b style={{ color: "var(--text-primary)" }}>Fill %</b> = GRN'd qty ÷ ordered qty, order-weighted (not an
          average of per-PO %s). Most recent 5 PO dates dropped as too fresh for GRN to have caught up — cutoff{" "}
          <b style={{ color: "var(--text-primary)" }}>{w.cutoff}</b>.
        </span>
        <span>
          <b style={{ color: "var(--text-primary)" }}>L1</b> {w.L1.start} → {w.L1.end}
        </span>
        <span>
          <b style={{ color: "var(--text-primary)" }}>L2</b> {w.L2.start} → {w.L2.end}
        </span>
        <span>
          <b style={{ color: "var(--text-primary)" }}>L15</b> {w.L15.start} → {w.L15.end}
        </span>
        <span style={{ color: "var(--text-muted)" }}>{fmtNum(status.rows)} PO lines loaded</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["brand", "sku"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ background: mode === m ? "var(--series-1)" : "var(--surface-2)", color: mode === m ? "#fff" : "var(--text-secondary)" }}
          >
            {m === "brand" ? "Brand" : "SKU / Item"}
          </button>
        ))}
        <input
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-md border px-2.5 py-1.5 text-[11.5px] w-[220px] ml-2"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        />
        <label
          className="ml-auto rounded-md px-3 py-1.5 text-[11.5px] font-semibold border cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          Replace data
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                await fillRateApi.upload(f);
                refreshStatus();
              }
              e.target.value = "";
            }}
          />
        </label>
        <GoogleSheetSync
          syncEndpoint="/api/fillrate/sync-sheet"
          listTabsEndpoint="/api/fillrate/list-sheet-tabs"
          infoEndpoint="/api/data/sheets-info"
          onSynced={refreshStatus}
          compact
        />
      </div>

      {mode === "brand" ? (
        brandRows ? (
          <DataTable columns={brandColumns} rows={brandRows} rowKey={(r) => r.brand} />
        ) : (
          <div style={{ color: "var(--text-muted)" }}>Loading…</div>
        )
      ) : skuRows ? (
        <DataTable columns={skuColumns} rows={skuRows} rowKey={(r) => r.item_id} />
      ) : (
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      )}
    </div>
  );
}
