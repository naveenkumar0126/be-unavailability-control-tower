import { useEffect, useRef, useState } from "react";

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

  function toggle(o: string) {
    onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium min-w-[120px] justify-between"
        style={{
          borderColor: selected.length ? "var(--series-1)" : "var(--border)",
          background: "var(--surface-1)",
          color: selected.length ? "var(--series-1)" : "var(--text-secondary)",
        }}
      >
        <span>
          {label}
          {selected.length > 0 && <span className="font-bold"> ({selected.length})</span>}
        </span>
        <span style={{ opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-56 rounded-lg border shadow-lg overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
        >
          <div className="flex items-center gap-2 px-2 py-1.5 border-b" style={{ borderColor: "var(--border)" }}>
            <span className="text-[10.5px] font-bold" style={{ color: "var(--series-1)" }}>
              {selected.length} selected
            </span>
            <div className="flex-1" />
            <button
              className="text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
              onClick={() => onChange(filtered)}
            >
              All
            </button>
            <button
              className="text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
              onClick={() => onChange([])}
            >
              None
            </button>
          </div>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full border-b px-2.5 py-1.5 text-[11.5px] outline-none"
            style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
          />
          <div className="max-h-[220px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
                No matches
              </div>
            )}
            {filtered.map((o) => (
              <label
                key={o}
                className="flex items-center gap-2 px-2.5 py-1.5 text-[11.5px] cursor-pointer hover:opacity-80"
                style={{
                  background: selected.includes(o) ? "var(--surface-2)" : "transparent",
                  color: "var(--text-primary)",
                }}
              >
                <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} />
                <span className="truncate">{o}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
