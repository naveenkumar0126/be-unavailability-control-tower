import { useEffect, useState } from "react";
import { pmApi, type DeliveryRow } from "../../lib/api";
import { DataTable, type Column } from "../../components/DataTable";
import { shortWh, fmtNum } from "../../lib/format";

export function DeliveriesToday({ wh }: { wh: string[] }) {
  const [date, setDate] = useState<string | null>(null);
  const [rows, setRows] = useState<DeliveryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pmApi
      .deliveriesToday(wh)
      .then((res) => {
        setDate(res.date);
        setRows(res.rows);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [JSON.stringify(wh)]);

  const columns: Column<DeliveryRow>[] = [
    { key: "wh", label: "Warehouse", left: true, render: (v) => shortWh(v) },
    { key: "brand", label: "Brand", left: true },
    { key: "item", label: "Item", left: true },
    { key: "ordered", label: "Ordered Qty", bar: true, defaultSort: true },
    { key: "po_lines", label: "PO Lines" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border-l-4 px-4 py-3 text-[12px]" style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}>
        POs whose <b style={{ color: "var(--text-primary)" }}>expected delivery date is today</b>
        {date && (
          <>
            {" "}
            (<b style={{ color: "var(--text-primary)" }}>{date}</b>)
          </>
        )}
        , from the Fill Rate PO data — so the warehouse knows what's actually landing and can plan receiving/dock
        capacity around it.
      </div>

      {error && <div style={{ color: "var(--status-critical)" }}>{error}</div>}
      {!error && !rows && <div style={{ color: "var(--text-muted)" }}>Loading…</div>}
      {rows && rows.length === 0 && (
        <div style={{ color: "var(--text-muted)" }} className="py-10 text-center">
          Nothing scheduled for delivery today for this selection.
        </div>
      )}
      {rows && rows.length > 0 && (
        <>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {fmtNum(rows.length)} PO lines · {fmtNum(rows.reduce((s, r) => s + r.ordered, 0))} total units expected
          </div>
          <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.wh}|${r.item_id}`} />
        </>
      )}
    </div>
  );
}
