import { useMemo, useState } from "react";

export type Column<T> = {
  key: keyof T & string;
  label: string;
  left?: boolean;
  decimals?: number;
  bar?: boolean;
  defaultSort?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
};

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  const defaultCol = columns.find((c) => c.defaultSort)?.key ?? columns[0].key;
  const [sortKey, setSortKey] = useState<string>(defaultCol);
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const maxByCol = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of columns) {
      if (c.bar) m[c.key] = Math.max(1, ...rows.map((r) => Math.abs(Number(r[c.key]) || 0)));
    }
    return m;
  }, [columns, rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" || typeof bv === "string") {
        return String(av ?? "").localeCompare(String(bv ?? "")) * sortDir;
      }
      return ((Number(av) || 0) - (Number(bv) || 0)) * sortDir;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function onSort(key: string) {
    if (key === sortKey) setSortDir((d) => (d === -1 ? 1 : -1));
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  return (
    <div className="rounded-lg border overflow-auto max-h-[560px]" style={{ borderColor: "var(--border)" }}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.left ? "l" : ""} onClick={() => onSort(c.key)}>
                {c.label} {sortKey === c.key ? (sortDir === -1 ? "▾" : "▴") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => {
                const raw = r[c.key];
                const content = c.render
                  ? c.render(raw, r)
                  : typeof raw === "number"
                  ? raw.toLocaleString("en-IN", { maximumFractionDigits: c.decimals ?? 0, minimumFractionDigits: c.decimals ?? 0 })
                  : raw ?? "–";
                if (c.bar) {
                  const pct = Math.min(100, (Math.abs(Number(raw) || 0) / maxByCol[c.key]) * 100);
                  return (
                    <td key={c.key} className={c.left ? "l" : ""} style={{ position: "relative" }}>
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 2,
                          bottom: 2,
                          width: `${pct}%`,
                          background: "color-mix(in srgb, var(--series-1) 16%, transparent)",
                          borderRadius: 2,
                          zIndex: 0,
                        }}
                      />
                      <span style={{ position: "relative", zIndex: 1 }}>{content}</span>
                    </td>
                  );
                }
                return (
                  <td key={c.key} className={c.left ? "l" : ""}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
