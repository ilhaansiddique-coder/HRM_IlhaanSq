"use client";

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
import type { VolumeServicePoint } from "@/lib/services/dashboard-analytics.service";

export function VolumeServiceChart({ data }: { data: VolumeServicePoint[] }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-4 md:p-5">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">
          Volume vs Service Level
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Orders placed vs % delivered — last 6 months
        </p>
      </div>

      <div className="mt-4 h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="28%" barGap={4}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="volume"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="service"
              orientation="right"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              unit="%"
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
            />
            <Bar
              yAxisId="volume"
              dataKey="volume"
              name="Volume (orders)"
              fill="#6366F1"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="service"
              dataKey="service"
              name="Service Level (%)"
              fill="#22D3EE"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
