import { useEffect, useState } from "react";
import { pmApi, type FocusItemRow } from "../../lib/api";
import { DataTable, type Column } from "../../components/DataTable";
import { severityColor } from "../../lib/format";
import { SeverityPill } from "../../components/Pill";
import { WhItemDrillPanel } from "../../components/WhItemDrillPanel";

export function FocusItems({ wh }: { wh: string[] }) {
  const [doiMax, setDoiMax] = useState(3);
  const [rows, setRows] = useState<FocusItemRow[] | null>(null);
  const [selected, setSelected] = useState<{ wh: string; item: string } | null>(null);

  useEffect(() => {
    pmApi.focusItems(wh, doiMax, 30).then(setRows).catch(() => setRows([]));
  }, [JSON.stringify(wh), doiMax]);

  const columns: Column<FocusItemRow>[] = [
    { key: "wh", label: "Warehouse", left: true },
    { key: "brand", label: "Brand", left: true },
    { key: "item", label: "Item", left: true },
    { key: "region", label: "Region", left: true },
    { key: "cpd", label: "CPD (demand)", bar: true, defaultSort: true },
    { key: "inventory", label: "Inventory" },
    { key: "doi", label: "DOI", decimals: 1, render: (v: number) => <SeverityPill value={v < doiMax ? 100 : 0} color={severityColor(v < doiMax ? 100 : 0)} decimals={0} /> },
    { key: "open_po", label: "Open PO" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border-l-4 px-4 py-3 text-[12px]" style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}>
        Highest-demand SKUs at the selected warehouse(s) that are currently under{" "}
        <b style={{ color: "var(--text-primary)" }}>{doiMax} days</b> of cover — the items where a stockout would hurt
        the most, ranked by how much demand (CPD) they carry. Click a row for the full drill-down.
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          DOI below:
        </span>
        {[2, 3, 5].map((d) => (
          <button
            key={d}
            onClick={() => setDoiMax(d)}
            className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ background: doiMax === d ? "var(--series-1)" : "var(--surface-2)", color: doiMax === d ? "#fff" : "var(--text-secondary)" }}
          >
            {d} days
          </button>
        ))}
      </div>

      {!rows ? (
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: "var(--text-muted)" }} className="py-10 text-center">
          Nothing under {doiMax} days DOI for this selection.
        </div>
      ) : (
        <div
          className="rounded-lg border overflow-auto max-h-[560px]"
          style={{ borderColor: "var(--border)" }}
          onClick={(e) => {
            const tr = (e.target as HTMLElement).closest("tr");
            if (!tr || !tr.parentElement || tr.parentElement.tagName !== "TBODY") return;
            const idx = Array.from(tr.parentElement.children).indexOf(tr);
            const row = rows[idx];
            if (row) setSelected({ wh: row.wh, item: row.item });
          }}
        >
          <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.wh}|${r.item}`} />
        </div>
      )}

      {selected && <WhItemDrillPanel wh={selected.wh} item={selected.item} onClose={() => setSelected(null)} />}
    </div>
  );
}
