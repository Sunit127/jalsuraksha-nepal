"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Timer } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hourlySeries, medianResponseMinutes } from "@/lib/utilities/ops-metrics";
import { useOpsData } from "./ops-data";

/**
 * Priority is ordinal, so it uses one validated single-hue ramp (light = low,
 * dark = critical) rather than four unrelated hues. Legend + tooltip carry the
 * labels; colour is never the only cue.
 */
const PRIORITY_RAMP = {
  low: "#f87171",
  moderate: "#e03b3b",
  high: "#b91c1c",
  critical: "#6b1414",
} as const;

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };

export function AnalyticsPanel() {
  const { sos, assignments, shelters } = useOpsData();
  // Rendered on the client only: the hour buckets depend on "now".
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const hourly = useMemo(() => (now ? hourlySeries(sos, 12, now) : []), [sos, now]);
  const median = medianResponseMinutes(assignments);
  const shelterData = shelters
    .filter((s) => s.is_active)
    .map((s) => ({
      name: s.name.replace(/ (Shelter|Evacuation Centre|Community Hall|Relief Camp)$/, ""),
      occupancy: Math.round((s.current_occupancy / s.capacity) * 100),
      occupied: s.current_occupancy,
      capacity: s.capacity,
    }))
    .sort((a, b) => b.occupancy - a.occupancy);

  const completed = assignments.filter((a) => a.status === "completed").length;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr_0.6fr]">
      <Card>
        <CardHeader>
          <CardTitle>SOS requests per hour</CardTitle>
          <CardDescription>Last 12 hours by effective priority</CardDescription>
        </CardHeader>
        <CardContent className="h-60">
          {now && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap={4}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="hour" tick={AXIS} tickLine={false} axisLine={false} interval={1} />
                <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="square" itemSorter={null} wrapperStyle={{ fontSize: 11 }} />
                {(["low", "moderate", "high", "critical"] as const).map((k, i, arr) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    name={k[0].toUpperCase() + k.slice(1)}
                    stackId="p"
                    fill={PRIORITY_RAMP[k]}
                    stroke="var(--card)"
                    strokeWidth={2}
                    radius={i === arr.length - 1 ? [4, 4, 0, 0] : 0}
                    maxBarSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shelter occupancy</CardTitle>
          <CardDescription>% of capacity used (active shelters)</CardDescription>
        </CardHeader>
        <CardContent className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={shelterData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
              <YAxis type="category" dataKey="name" width={118} tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={(value, _name, item) => {
                  const p = (item as { payload?: { occupied: number; capacity: number } }).payload;
                  return [`${value}% (${p?.occupied}/${p?.capacity})`, "Occupancy"];
                }}
              />
              <Bar dataKey="occupancy" name="Occupancy" fill="#0f2447" radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Card className="justify-center p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Timer className="size-4" aria-hidden /> Median dispatch → arrival
          </p>
          <p className="mt-1 text-3xl font-bold tabular">{median ?? "—"}<span className="text-base font-medium text-muted-foreground"> min</span></p>
          <p className="text-[11px] text-muted-foreground">Missions in the last 24 h</p>
        </Card>
        <Card className="justify-center p-4">
          <p className="text-xs font-medium text-muted-foreground">Missions completed</p>
          <p className="mt-1 text-3xl font-bold tabular">{completed}</p>
          <p className="text-[11px] text-muted-foreground">Last 24 h</p>
        </Card>
      </div>
    </div>
  );
}
