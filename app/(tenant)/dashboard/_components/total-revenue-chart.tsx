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
import type { RevenueSplitPoint } from "@/lib/services/dashboard-analytics.service";
import { useCurrency } from "../../_components/providers";

export function TotalRevenueChart({ data }: { data: RevenueSplitPoint[] }) {
  const { formatAmount } = useCurrency();

  const total = data.reduce((s, d) => s + d.online + d.offline, 0);
  const online = data.reduce((s, d) => s + d.online, 0);
  const offline = data.reduce((s, d) => s + d.offline, 0);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Total Revenue</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">Last 7 days</p>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <div>
            Online:{" "}
            <span className="font-medium text-foreground">
              {formatAmount(online)}
            </span>
          </div>
          <div>
            Offline:{" "}
            <span className="font-medium text-foreground">
              {formatAmount(offline)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="28%" barGap={6}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number) => formatAmount(v)}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
            />
            <Bar
              dataKey="online"
              name="Online Sales"
              fill="#6366F1"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="offline"
              name="Offline Sales"
              fill="#22D3EE"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {total === 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          No sales in the last 7 days
        </p>
      )}
    </div>
  );
}
