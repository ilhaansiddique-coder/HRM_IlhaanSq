"use client";

import { useState } from "react";
import type {
  BdDivision,
  SalesByRegionPoint,
} from "@/lib/services/dashboard-analytics.service";
import { useCurrency } from "../../_components/providers";

// Stylized SVG outline of Bangladesh — 8 administrative divisions.
// Paths are hand-simplified polygons; they're geographically approximate
// but visually recognizable at dashboard scale.
const DIVISION_PATHS: Record<BdDivision, string> = {
  rangpur:
    "M 60 20 L 155 28 L 170 115 L 80 135 L 30 95 L 40 35 Z",
  mymensingh:
    "M 155 28 L 250 45 L 240 160 L 170 170 L 170 115 Z",
  sylhet:
    "M 250 45 L 370 75 L 370 175 L 310 220 L 260 195 L 240 160 Z",
  rajshahi:
    "M 20 95 L 80 135 L 170 170 L 180 275 L 95 290 L 40 265 L 5 195 L 5 130 Z",
  dhaka:
    "M 170 170 L 240 160 L 260 195 L 265 280 L 200 305 L 180 275 Z",
  khulna:
    "M 40 265 L 95 290 L 130 340 L 125 435 L 85 490 L 30 470 L 10 390 L 10 310 Z",
  barishal:
    "M 130 340 L 180 275 L 200 305 L 245 375 L 230 455 L 175 490 L 130 475 L 115 425 Z",
  chattogram:
    "M 265 280 L 310 220 L 370 175 L 375 285 L 340 365 L 325 445 L 295 520 L 250 500 L 240 425 L 230 370 Z",
};

// Centroid for label placement (manually picked per division).
const DIVISION_LABEL_POS: Record<BdDivision, { x: number; y: number }> = {
  rangpur: { x: 95, y: 80 },
  mymensingh: { x: 205, y: 115 },
  sylhet: { x: 315, y: 135 },
  rajshahi: { x: 85, y: 210 },
  dhaka: { x: 215, y: 240 },
  khulna: { x: 70, y: 380 },
  barishal: { x: 180, y: 400 },
  chattogram: { x: 305, y: 380 },
};

// Given a percent (0-100), return a fill color on the indigo choropleth
// scale: near-transparent at 0, primary-saturated at 100.
function fillForPercent(p: number): string {
  // Use a fixed RGB anchor (indigo-500 #6366F1) and vary alpha between
  // 0.10 (low) and 0.95 (high). Works on both light and dark themes.
  const alpha = 0.1 + (p / 100) * 0.85;
  return `rgba(99, 102, 241, ${alpha.toFixed(3)})`;
}

export function SalesMapChart({ data }: { data: SalesByRegionPoint[] }) {
  const { formatAmount } = useCurrency();
  const [hovered, setHovered] = useState<BdDivision | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null
  );

  const byDiv = new Map(data.map((d) => [d.division, d]));
  const hoveredData = hovered ? byDiv.get(hovered) : null;

  const total = data.reduce((s, d) => s + d.revenue, 0);
  const leader = data.reduce<SalesByRegionPoint | null>(
    (best, d) => (!best || d.revenue > best.revenue ? d : best),
    null
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Sales Mapping by Location
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Bangladesh · 8 divisions
          </p>
        </div>
        {leader && leader.revenue > 0 && (
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">Top region</div>
            <div className="text-xs font-semibold">{leader.label}</div>
          </div>
        )}
      </div>

      <div
        className="relative mt-4"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }}
      >
        <svg
          viewBox="0 0 380 540"
          className="mx-auto block h-[320px] w-auto"
          role="img"
          aria-label="Bangladesh sales map by division"
        >
          <g>
            {(Object.keys(DIVISION_PATHS) as BdDivision[]).map((div) => {
              const info = byDiv.get(div);
              const pct = info?.percent ?? 0;
              const isHovered = hovered === div;
              return (
                <path
                  key={div}
                  d={DIVISION_PATHS[div]}
                  fill={fillForPercent(pct)}
                  stroke="hsl(var(--border))"
                  strokeWidth={isHovered ? 2 : 1}
                  className="cursor-pointer transition-all"
                  style={{
                    filter: isHovered
                      ? "brightness(1.08) drop-shadow(0 2px 6px rgba(99,102,241,0.25))"
                      : undefined,
                  }}
                  onMouseEnter={() => setHovered(div)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
          </g>
          <g>
            {(Object.keys(DIVISION_LABEL_POS) as BdDivision[]).map((div) => {
              const pos = DIVISION_LABEL_POS[div];
              const info = byDiv.get(div);
              return (
                <text
                  key={`label-${div}`}
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  className="pointer-events-none select-none fill-foreground"
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  {info?.label ?? div}
                </text>
              );
            })}
          </g>
        </svg>

        {hoveredData && mousePos && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-border/80 bg-card px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.min(mousePos.x + 12, 260),
              top: Math.max(mousePos.y - 40, 0),
            }}
          >
            <div className="font-semibold">{hoveredData.label}</div>
            <div className="text-muted-foreground">
              {formatAmount(hoveredData.revenue)} · {hoveredData.orders} order
              {hoveredData.orders !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      {/* Color scale legend */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <span className="text-[10px] text-muted-foreground">Low</span>
        <div className="flex h-2 w-40 overflow-hidden rounded-full">
          {[10, 25, 45, 65, 85, 95].map((p) => (
            <div
              key={p}
              className="h-full flex-1"
              style={{ background: fillForPercent(p) }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">High</span>
      </div>

      {total === 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          No location-tagged sales yet
        </p>
      )}
    </div>
  );
}
