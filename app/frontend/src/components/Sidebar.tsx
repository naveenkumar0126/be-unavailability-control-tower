import clsx from "clsx";

export type ViewKey = "availability" | "purchase_manager" | "tags" | "festive";

const VIEWS: { key: ViewKey; label: string; icon: string; enabled: boolean }[] = [
  { key: "availability", label: "Availability", icon: "📊", enabled: true },
  { key: "purchase_manager", label: "Purchase Manager", icon: "🎯", enabled: true },
  { key: "tags", label: "Tags & Reasons", icon: "🏷️", enabled: true },
  { key: "festive", label: "Festive", icon: "🎉", enabled: false },
];

export function Sidebar({
  active,
  onSelect,
  collapsed,
  onToggle,
}: {
  active: ViewKey;
  onSelect: (v: ViewKey) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={clsx(
        "flex flex-col shrink-0 border-r transition-[width] duration-150 sticky top-0 h-screen",
        collapsed ? "w-[56px]" : "w-[220px]"
      )}
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-11 shrink-0 border-b hover:opacity-70"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "»" : "« Views"}
      </button>
      <nav className="flex flex-col gap-1 p-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            disabled={!v.enabled}
            onClick={() => v.enabled && onSelect(v.key)}
            title={v.enabled ? v.label : `${v.label} — coming soon`}
            className={clsx(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] font-medium text-left transition-colors",
              collapsed && "justify-center px-0",
              active === v.key
                ? "font-semibold"
                : v.enabled
                ? "hover:opacity-80"
                : "cursor-not-allowed opacity-40"
            )}
            style={{
              background: active === v.key ? "var(--surface-2)" : "transparent",
              color: active === v.key ? "var(--series-1)" : "var(--text-secondary)",
            }}
          >
            <span className="text-[15px] leading-none">{v.icon}</span>
            {!collapsed && (
              <span className="flex-1 flex items-center justify-between">
                {v.label}
                {!v.enabled && <span className="text-[9px] uppercase tracking-wide opacity-70">soon</span>}
              </span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
}
