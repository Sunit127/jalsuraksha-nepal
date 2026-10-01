import L from "leaflet";
import { MARKER_ICON_PATHS, type MarkerIconKey } from "./marker-icon-paths";

export const MAP_COLORS = {
  safe: "var(--safe)",
  watch: "var(--watch)",
  high: "var(--high)",
  danger: "var(--danger)",
  info: "var(--info)",
  navy: "var(--navy)",
  muted: "#64748b",
  shelter: "#059669",
  hospital: "#2563eb",
} as const;

/** Hex values for Leaflet vector layers (SVG attributes cannot use CSS vars reliably). */
export const ZONE_FILL = {
  safe: "#16a34a",
  watch: "#eab308",
  high: "#f97316",
  danger: "#dc2626",
} as const;

const cache = new Map<string, L.DivIcon>();

/**
 * Circular marker with a Lucide glyph. `shape: "square"` is used for fixed
 * facilities (shelters, hospitals) so they differ from incidents by shape as
 * well as colour.
 */
export function markerIcon(
  kind: MarkerIconKey,
  color: string,
  opts: { size?: number; pulse?: boolean; shape?: "circle" | "square"; badge?: string } = {},
): L.DivIcon {
  const { size = 30, pulse = false, shape = "circle", badge } = opts;
  const key = `${kind}|${color}|${size}|${pulse}|${shape}|${badge ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const glyph = Math.round(size * 0.55);
  const radius = shape === "circle" ? "9999px" : "8px";
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;color:${color}">
      ${pulse ? `<span class="js-pulse" style="position:absolute;inset:0;border-radius:9999px;"></span>` : ""}
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${radius};background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgb(15 23 42 / .35)">
        <svg xmlns="http://www.w3.org/2000/svg" width="${glyph}" height="${glyph}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MARKER_ICON_PATHS[kind]}</svg>
      </div>
      ${badge ? `<span style="position:absolute;top:-6px;right:-8px;background:#0f172a;color:#fff;font:600 9px/1 system-ui;padding:2px 4px;border-radius:6px;border:1px solid #fff">${badge}</span>` : ""}
    </div>`;

  const icon = L.divIcon({
    html,
    className: "js-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
  cache.set(key, icon);
  return icon;
}

export function userLocationIcon(): L.DivIcon {
  const key = "user";
  const hit = cache.get(key);
  if (hit) return hit;
  const icon = L.divIcon({
    className: "js-marker",
    html: `<div style="position:relative;width:22px;height:22px;color:#2563eb">
      <span class="js-pulse" style="position:absolute;inset:0;border-radius:9999px"></span>
      <div style="position:relative;width:22px;height:22px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px rgb(37 99 235 / .35)"></div>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
  cache.set(key, icon);
  return icon;
}
