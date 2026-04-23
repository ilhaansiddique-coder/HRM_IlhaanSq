"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RevenueTrendPoint } from "@/lib/services/dashboard-analytics.service";
import { useCurrency } from "../../_components/providers";

export function RevenueTrendChart({ data }: { data: RevenueTrendPoint[] }) {
  const { formatAmount } = useCurrency();

  const thisMonthTotal = data.reduce((s, p) => s + p.thisMonth, 0);
  const lastMonthTotal = data.reduce((s, p) => s + p.lastMonth, 0);
  const pct =
    lastMonthTotal > 0
      ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 1000) /
        10
      : thisMonthTotal > 0
        ? 100
        : 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Revenue Trend</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            This month vs last month
          </p>
        </div>
        <div
          className={`text-xs font-semibold ${
            pct >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {pct >= 0 ? "+" : ""}
          {pct}%
        </div>
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">
        {formatAmount(thisMonthTotal)}
      </div>

      <div className="mt-3 h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
          >
            <defs>
              <linearGradient id="trendThis" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34D399" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trendLast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C7D2FE" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#C7D2FE" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              labelFormatter={(l) => `Day ${l}`}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
            />
            <Area
              type="monotone"
              dataKey="lastMonth"
              name="Last Month"
              stroke="#A5B4FC"
              strokeWidth={2}
              fill="url(#trendLast)"
            />
            <Area
              type="monotone"
              dataKey="thisMonth"
              name="This Month"
              stroke="#10B981"
              strokeWidth={2.5}
              fill="url(#trendThis)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
