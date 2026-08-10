export function SeverityPill({
  value,
  color,
  decimals = 0,
  suffix = "%",
}: {
  value: number;
  color: string;
  decimals?: number;
  suffix?: string;
}) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white min-w-[46px] text-center"
      style={{ background: color }}
    >
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
