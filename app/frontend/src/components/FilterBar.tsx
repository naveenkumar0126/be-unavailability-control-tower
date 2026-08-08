import { MultiSelect } from "./MultiSelect";
import type { Filters, DataStatus } from "../lib/api";

export function FilterBar({
  facets,
  filters,
  onChange,
}: {
  facets: DataStatus["facets"];
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const activeChips: { label: string; onRemove: () => void }[] = [];
  filters.region?.forEach((r) =>
    activeChips.push({ label: `Region: ${r}`, onRemove: () => onChange({ ...filters, region: filters.region!.filter((x) => x !== r) }) })
  );
  filters.wh?.forEach((r) =>
    activeChips.push({ label: `WH: ${r}`, onRemove: () => onChange({ ...filters, wh: filters.wh!.filter((x) => x !== r) }) })
  );
  filters.brand?.forEach((r) =>
    activeChips.push({ label: `Brand: ${r}`, onRemove: () => onChange({ ...filters, brand: filters.brand!.filter((x) => x !== r) }) })
  );
  filters.category?.forEach((r) =>
    activeChips.push({ label: `Category: ${r}`, onRemove: () => onChange({ ...filters, category: filters.category!.filter((x) => x !== r) }) })
  );
  if (filters.min_cpd) activeChips.push({ label: `Min CPD: ${filters.min_cpd}`, onRemove: () => onChange({ ...filters, min_cpd: undefined }) });

  return (
    <div className="flex flex-col gap-2 px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <MultiSelect label="Region" options={facets?.regions ?? []} selected={filters.region ?? []} onChange={(v) => onChange({ ...filters, region: v })} />
        <MultiSelect label="Warehouse" options={facets?.warehouses ?? []} selected={filters.wh ?? []} onChange={(v) => onChange({ ...filters, wh: v })} />
        <MultiSelect label="Brand" options={facets?.brands ?? []} selected={filters.brand ?? []} onChange={(v) => onChange({ ...filters, brand: v })} />
        <MultiSelect label="Category" options={facets?.categories ?? []} selected={filters.category ?? []} onChange={(v) => onChange({ ...filters, category: v })} />
        <input
          type="number"
          placeholder="Min CPD"
          value={filters.min_cpd ?? ""}
          onChange={(e) => onChange({ ...filters, min_cpd: e.target.value ? Number(e.target.value) : undefined })}
          className="rounded-md border px-2.5 py-1.5 text-[11.5px] w-[90px]"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        />
        {activeChips.length > 0 && (
          <button
            onClick={() => onChange({})}
            className="text-[11px] font-bold uppercase tracking-wide ml-1"
            style={{ color: "var(--status-critical)" }}
          >
            Clear all
          </button>
        )}
      </div>
      {activeChips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeChips.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px]"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              {c.label}
              <span onClick={c.onRemove} className="cursor-pointer font-bold" style={{ color: "var(--text-muted)" }}>
                ×
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
