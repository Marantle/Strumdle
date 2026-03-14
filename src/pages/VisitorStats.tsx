import { useEffect, useState } from "react";

interface DailyEntry {
  date: string;
  plays: number;
  solves: number;
}

interface HourlyEntry {
  hour: number;
  plays: number;
  solves: number;
}

interface StatsData {
  daily: DailyEntry[];
  hourly: HourlyEntry[];
}

// Simple SVG bar chart
function BarChart({
  data,
  labelKey,
  valueKey,
  color = "#22c55e",
  height = 160,
  formatLabel,
}: {
  data: Record<string, number | string>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  height?: number;
  formatLabel?: (v: string | number) => string;
}) {
  const values = data.map((d) => Number(d[valueKey]));
  const max = Math.max(...values, 1);
  const barW = Math.max(4, Math.floor(560 / data.length) - 2);
  const gap = Math.max(1, Math.floor(560 / data.length) - barW);
  const totalW = data.length * (barW + gap);

  const [tooltip, setTooltip] = useState<{ x: number; label: string; value: number } | null>(null);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${totalW} ${height + 24}`}
        className="w-full"
        style={{ overflow: "visible" }}
        onMouseLeave={() => setTooltip(null)}
      >
        {data.map((d, i) => {
          const v = Number(d[valueKey]);
          const barH = Math.max(2, (v / max) * height);
          const x = i * (barW + gap);
          const y = height - barH;
          const label = String(d[labelKey]);
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill={color}
                opacity={0.85}
                rx={2}
                className="cursor-pointer hover:opacity-100 transition-opacity"
                onMouseEnter={() =>
                  setTooltip({ x: x + barW / 2, label: formatLabel ? formatLabel(label) : label, value: v })
                }
              />
              {/* show label every N bars to avoid crowding */}
              {data.length <= 31 && i % Math.ceil(data.length / 10) === 0 && (
                <text
                  x={x + barW / 2}
                  y={height + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#71717a"
                >
                  {formatLabel ? formatLabel(label) : label}
                </text>
              )}
              {data.length > 31 && i % 4 === 0 && (
                <text
                  x={x + barW / 2}
                  y={height + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#71717a"
                >
                  {formatLabel ? formatLabel(label) : label}
                </text>
              )}
            </g>
          );
        })}
        {/* zero line */}
        <line x1={0} y1={height} x2={totalW} y2={height} stroke="#3f3f46" strokeWidth={1} />

        {/* tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x - 30, totalW - 70)}
              y={0}
              width={65}
              height={32}
              rx={4}
              fill="#18181b"
              stroke="#3f3f46"
            />
            <text
              x={Math.min(tooltip.x - 30, totalW - 70) + 32}
              y={13}
              textAnchor="middle"
              fontSize={10}
              fill="#a1a1aa"
            >
              {tooltip.label}
            </text>
            <text
              x={Math.min(tooltip.x - 30, totalW - 70) + 32}
              y={26}
              textAnchor="middle"
              fontSize={11}
              fontWeight="bold"
              fill="#f4f4f5"
            >
              {tooltip.value.toLocaleString()}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-zinc-100">{value}</span>
    </div>
  );
}

export default function VisitorStats() {
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/visitorstats")
      .then((r) => r.json() as Promise<StatsData>)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  const totalPlays = data.daily.reduce((s, d) => s + d.plays, 0);
  const totalSolves = data.daily.reduce((s, d) => s + d.solves, 0);
  const avgPerDay = data.daily.length > 0 ? Math.round(totalPlays / data.daily.length) : 0;
  const solveRate = totalPlays > 0 ? ((totalSolves / totalPlays) * 100).toFixed(1) : "—";
  const peakDay = data.daily.reduce<DailyEntry | null>(
    (best, d) => (!best || d.plays > best.plays ? d : best),
    null,
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-100 mb-1">Strumdle Stats</h1>
      <p className="text-xs text-zinc-500 mb-6">Last 30 days</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total plays" value={totalPlays.toLocaleString()} />
        <StatCard label="Avg / day" value={avgPerDay.toLocaleString()} />
        <StatCard label="Solve rate" value={`${solveRate}%`} />
        <StatCard label="Peak day" value={peakDay ? peakDay.date.slice(5) : "—"} />
      </div>

      {/* Daily plays chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Daily plays (last 30 days)</h2>
        <BarChart
          data={data.daily as unknown as Record<string, number | string>[]}
          labelKey="date"
          valueKey="plays"
          color="#22c55e"
          formatLabel={(v) => String(v).slice(5)} // MM-DD
        />
      </div>

      {/* Solve rate overlay */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Daily solves (last 30 days)</h2>
        <BarChart
          data={data.daily as unknown as Record<string, number | string>[]}
          labelKey="date"
          valueKey="solves"
          color="#3b82f6"
          formatLabel={(v) => String(v).slice(5)}
        />
      </div>

      {/* Hourly distribution */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-zinc-300 mb-1">Plays by hour of day (last 7 days, UTC)</h2>
        <p className="text-xs text-zinc-600 mb-3">Aggregated across all days</p>
        <BarChart
          data={data.hourly as unknown as Record<string, number | string>[]}
          labelKey="hour"
          valueKey="plays"
          color="#a855f7"
          height={120}
          formatLabel={(v) => `${String(v).padStart(2, "0")}h`}
        />
      </div>
    </div>
  );
}
