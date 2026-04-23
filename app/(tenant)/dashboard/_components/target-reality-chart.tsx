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
import { CheckCircle2, Target } from "lucide-react";
import type { TargetRealityPoint } from "@/lib/services/dashboard-analytics.service";
import { useCurrency } from "../../_components/providers";

export function TargetRealityChart({ data }: { data: TargetRealityPoint[] }) {
  const { formatAmount } = useCurrency();

  const lastRow = data[data.length - 1] ?? { reality: 0, target: 0, month: "" };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Target vs Reality
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            6-month comparison
          </p>
        </div>
      </div>

      <div className="mt-4 h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="30%" barGap={4}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
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
              dataKey="reality"
              name="Reality Sales"
              fill="#34D399"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="target"
              name="Target Sales"
              fill="#FBBF24"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Reality Sales</div>
            <div className="text-sm font-semibold">
              {formatAmount(lastRow.reality)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Target Sales</div>
            <div className="text-sm font-semibold">
              {formatAmount(lastRow.target)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
