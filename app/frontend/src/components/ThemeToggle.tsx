import { useTheme, type Theme } from "../lib/theme";

const OPTIONS: { key: Theme; icon: string; title: string }[] = [
  { key: "light", icon: "☀️", title: "Light" },
  { key: "dark", icon: "🌙", title: "Dark" },
  { key: "system", icon: "🖥️", title: "Match system" },
];

// Sits on the fixed navy header chrome, so it uses fixed (non-theme-adaptive)
// colors rather than the --surface-* tokens, same as the original header's pill selectors.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center rounded-lg p-0.5" style={{ background: "rgba(0,0,0,.22)" }}>
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          title={o.title}
          onClick={() => setTheme(o.key)}
          className="flex items-center justify-center w-7 h-6 rounded-md text-[12px] leading-none transition-colors"
          style={{
            background: theme === o.key ? "#f0c674" : "transparent",
          }}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
