"use client";

import { useEffect, useMemo, useState } from "react";
import type { SalesByDistrictPoint } from "@/lib/services/dashboard-analytics.service";
import { useCurrency } from "../../_components/providers";

// ─── GeoJSON types (minimal subset we consume) ──────────────

type Ring = Array<[number, number]>;

type Feature = {
  type: "Feature";
  properties: { ADM2_EN: string; ADM1_EN: string };
  geometry:
    | { type: "Polygon"; coordinates: Ring[] }
    | { type: "MultiPolygon"; coordinates: Ring[][] };
};

type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

// ─── Projection helpers ─────────────────────────────────────
// Simple linear projection is accurate enough for Bangladesh's ~4.7°
// longitude span. For extra realism we multiply y by a cosine factor
// (Web Mercator-esque) so the country doesn't appear squashed.

const VB_WIDTH = 380;
const VB_HEIGHT = 540;
const PADDING = 6;

type Bounds = { minLng: number; maxLng: number; minLat: number; maxLat: number };

function computeBounds(fc: FeatureCollection): Bounds {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  const walk = (rings: Ring[]) => {
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  };
  for (const f of fc.features) {
    if (f.geometry.type === "Polygon") walk(f.geometry.coordinates);
    else for (const poly of f.geometry.coordinates) walk(poly);
  }
  return { minLng, maxLng, minLat, maxLat };
}

function makeProjector(bounds: Bounds) {
  const lngSpan = bounds.maxLng - bounds.minLng;
  const latSpan = bounds.maxLat - bounds.minLat;
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  // Adjust longitude span by the cosine of mid-latitude so shapes
  // don't look stretched horizontally.
  const effLngSpan = lngSpan * Math.cos((midLat * Math.PI) / 180);

  const scaleX = (VB_WIDTH - PADDING * 2) / effLngSpan;
  const scaleY = (VB_HEIGHT - PADDING * 2) / latSpan;
  const scale = Math.min(scaleX, scaleY);

  const offsetX =
    (VB_WIDTH - effLngSpan * scale) / 2 - bounds.minLng * Math.cos((midLat * Math.PI) / 180) * scale;
  const offsetY = (VB_HEIGHT - latSpan * scale) / 2 + bounds.maxLat * scale;

  return (lng: number, lat: number): [number, number] => {
    const x = lng * Math.cos((midLat * Math.PI) / 180) * scale + offsetX;
    const y = offsetY - lat * scale;
    return [x, y];
  };
}

function ringToPath(ring: Ring, project: (lng: number, lat: number) => [number, number]) {
  let d = "";
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = project(ring[i][0], ring[i][1]);
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " ";
  }
  return d + "Z";
}

function featureToPath(
  f: Feature,
  project: (lng: number, lat: number) => [number, number]
) {
  if (f.geometry.type === "Polygon") {
    return f.geometry.coordinates.map((r) => ringToPath(r, project)).join(" ");
  }
  return f.geometry.coordinates
    .map((poly) => poly.map((r) => ringToPath(r, project)).join(" "))
    .join(" ");
}

// Centroid of a flat list of points, weighted equally — good enough for
// label placement on irregular district shapes.
function featureCentroid(
  f: Feature,
  project: (lng: number, lat: number) => [number, number]
): [number, number] {
  const rings =
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates[0]]
      : f.geometry.coordinates.map((p) => p[0]);
  let sumX = 0;
  let sumY = 0;
  let n = 0;
  for (const r of rings) {
    for (const [lng, lat] of r) {
      const [x, y] = project(lng, lat);
      sumX += x;
      sumY += y;
      n += 1;
    }
  }
  return [sumX / n, sumY / n];
}

// ─── Color scale (viridis) ──────────────────────────────────
// Perceptually-uniform, colorblind-safe, and legible on both light and
// dark backgrounds. Stops are the canonical viridis palette at deciles.
const VIRIDIS_STOPS: Array<[number, number, number]> = [
  [68, 1, 84],    // #440154
  [72, 40, 120],  // #482878
  [62, 74, 137],  // #3e4a89
  [49, 104, 142], // #31688e
  [38, 130, 142], // #26828e
  [31, 158, 137], // #1f9e89
  [53, 183, 121], // #35b779
  [109, 205, 89], // #6dcd59
  [180, 222, 44], // #b4de2c
  [253, 231, 37], // #fde725
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function viridis(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (VIRIDIS_STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), VIRIDIS_STOPS.length - 2);
  const f = scaled - i;
  const [r1, g1, b1] = VIRIDIS_STOPS[i];
  const [r2, g2, b2] = VIRIDIS_STOPS[i + 1];
  const r = Math.round(lerp(r1, r2, f));
  const g = Math.round(lerp(g1, g2, f));
  const b = Math.round(lerp(b1, b2, f));
  return `rgb(${r}, ${g}, ${b})`;
}

function fillForPercent(p: number): string {
  // Map 0–100 % directly onto the viridis ramp.
  return viridis(p / 100);
}

// ─── Component ──────────────────────────────────────────────

export function SalesMapChart({ data }: { data: SalesByDistrictPoint[] }) {
  const { formatAmount } = useCurrency();
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/bd-districts.geojson")
      .then((r) => r.json())
      .then((j: FeatureCollection) => {
        if (!cancelled) setGeo(j);
      })
      .catch(() => {
        /* ignore — show placeholder */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byDistrict = useMemo(() => {
    const m = new Map<string, SalesByDistrictPoint>();
    for (const d of data) m.set(d.district, d);
    return m;
  }, [data]);

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const leader = data.reduce<SalesByDistrictPoint | null>(
    (best, d) => (!best || d.revenue > best.revenue ? d : best),
    null
  );

  const { paths, centroids } = useMemo(() => {
    if (!geo) return { paths: [], centroids: new Map<string, [number, number]>() };
    const bounds = computeBounds(geo);
    const project = makeProjector(bounds);
    const paths = geo.features.map((f) => ({
      key: f.properties.ADM2_EN,
      division: f.properties.ADM1_EN,
      d: featureToPath(f, project),
    }));
    const centroids = new Map<string, [number, number]>();
    for (const f of geo.features) {
      centroids.set(f.properties.ADM2_EN, featureCentroid(f, project));
    }
    return { paths, centroids };
  }, [geo]);

  const hoveredData = hovered ? byDistrict.get(hovered) : null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Sales Mapping by Location
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Bangladesh · 64 districts
          </p>
        </div>
        {leader && leader.revenue > 0 && (
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">Top district</div>
            <div className="text-xs font-semibold">{leader.district}</div>
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
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          className="mx-auto block h-[360px] w-auto"
          role="img"
          aria-label="Bangladesh sales map by district"
        >
          {paths.length === 0 ? (
            <text
              x={VB_WIDTH / 2}
              y={VB_HEIGHT / 2}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 12 }}
            >
              Loading map…
            </text>
          ) : (
            <>
              <g>
                {paths.map((p) => {
                  const info = byDistrict.get(p.key);
                  const pct = info?.percent ?? 0;
                  const isHovered = hovered === p.key;
                  return (
                    <path
                      key={p.key}
                      d={p.d}
                      fill={fillForPercent(pct)}
                      stroke={isHovered ? "#f9f9f9" : "rgba(15, 23, 42, 0.55)"}
                      strokeWidth={isHovered ? 1.6 : 0.5}
                      className="cursor-pointer transition-[stroke-width,stroke]"
                      onMouseEnter={() => setHovered(p.key)}
                      onMouseLeave={() => setHovered(null)}
                    />
                  );
                })}
              </g>
              {/* Labels only for the hovered district to avoid clutter */}
              {hovered && centroids.get(hovered) && (
                <g pointerEvents="none">
                  <text
                    x={centroids.get(hovered)![0]}
                    y={centroids.get(hovered)![1]}
                    textAnchor="middle"
                    className="fill-foreground"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      paintOrder: "stroke",
                      stroke: "hsl(var(--card))",
                      strokeWidth: 3,
                    }}
                  >
                    {hovered}
                  </text>
                </g>
              )}
            </>
          )}
        </svg>

        {hoveredData && mousePos && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-border/80 bg-card px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.min(mousePos.x + 12, 260),
              top: Math.max(mousePos.y - 40, 0),
            }}
          >
            <div className="font-semibold">{hoveredData.district}</div>
            <div className="text-[10px] text-muted-foreground">
              {hoveredData.division} Division
            </div>
            <div className="mt-1">
              {formatAmount(hoveredData.revenue)} · {hoveredData.orders} order
              {hoveredData.orders !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      {/* Color scale legend — smooth viridis gradient */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-[10px] text-muted-foreground">
          {formatAmount(0)}
        </span>
        <div
          className="h-2 w-44 rounded-full"
          style={{
            background: `linear-gradient(to right, ${Array.from(
              { length: 11 },
              (_, i) => viridis(i / 10)
            ).join(", ")})`,
          }}
        />
        <span className="text-[10px] text-muted-foreground">
          {leader && leader.revenue > 0 ? formatAmount(leader.revenue) : "High"}
        </span>
      </div>

      {totalRevenue === 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          No location-tagged sales yet
        </p>
      )}
    </div>
  );
}
