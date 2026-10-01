"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { Layers, Navigation, ThumbsUp, Route as RouteIcon } from "lucide-react";
import {
  DemoBadge,
  HazardSeverityBadge,
  PriorityBadge,
  RiskBadge,
  SosStatusBadge,
  TeamStatusBadge,
} from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import type { ScoredZone } from "@/lib/risk-engine/zones";
import { formatDistance, haversineMeters, parsePolygon } from "@/lib/utilities/geo";
import { HAZARD_TYPE_LABEL, timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";
import type {
  HazardReport,
  Hospital,
  LatLng,
  PriorityLevel,
  RescueTeam,
  RiskZone,
  Shelter,
  SosStatus,
} from "@/types/domain";
import { MAP_COLORS, ZONE_FILL, markerIcon, userLocationIcon } from "./markers";
import type { MarkerIconKey } from "./marker-icon-paths";

export type MapSos = {
  id: string;
  reference_code: string;
  latitude: number;
  longitude: number;
  effective_priority: PriorityLevel | null;
  status: SosStatus;
  people_count: number;
  location_name: string | null;
  created_at: string;
  assigned_team_id: string | null;
};

export type MapRoute = {
  id: string;
  path: LatLng[];
  /** "direct" = straight line for orientation only (not a road route). */
  variant: "safe" | "blocked" | "alternative" | "direct";
  label?: string;
};

export type LayerKey = "zones" | "shelters" | "hospitals" | "hazards" | "sos" | "teams";

export type LiveMapProps = {
  center: LatLng;
  zoom?: number;
  className?: string;
  zones?: ScoredZone<RiskZone>[];
  shelters?: Shelter[];
  hospitals?: Hospital[];
  hazards?: HazardReport[];
  sos?: MapSos[];
  /** liveUpdatedAt: the position is the team's shared GPS (else its base). */
  teams?: (RescueTeam & { liveUpdatedAt?: string | null })[];
  userLocation?: LatLng | null;
  /** Label for the user-location marker (e.g. "Your SOS location"). */
  userLabel?: string;
  routes?: MapRoute[];
  /** Points to fit in view (e.g. route endpoints). Re-fits when the key changes. */
  fitBounds?: { key: string; points: LatLng[] };
  selectedSosId?: string | null;
  showLegend?: boolean;
  compact?: boolean;
  interactive?: boolean;
  demo?: boolean;
  onShelterNavigate?: (shelter: Shelter) => void;
  onHazardAvoid?: (hazard: HazardReport) => void;
  onHazardConfirm?: (hazard: HazardReport) => void;
  onSosSelect?: (sos: MapSos) => void;
  /** Enables "tap to place" (manual location fallback). */
  onMapClick?: (point: LatLng) => void;
  /** A point the user placed manually, shown as a draggable-looking pin. */
  pickedPoint?: LatLng | null;
};

const HAZARD_COLOR: Record<HazardReport["severity"], string> = {
  low: MAP_COLORS.info,
  medium: MAP_COLORS.watch,
  high: MAP_COLORS.high,
  critical: MAP_COLORS.danger,
};

const PRIORITY_COLOR: Record<PriorityLevel, string> = {
  critical: MAP_COLORS.danger,
  high: MAP_COLORS.high,
  moderate: "#ca8a04",
  low: MAP_COLORS.info,
};

const TEAM_COLOR: Record<RescueTeam["status"], string> = {
  available: MAP_COLORS.safe,
  assigned: "#ca8a04",
  busy: MAP_COLORS.high,
  offline: MAP_COLORS.muted,
};

const ROUTE_STYLE: Record<MapRoute["variant"], L.PolylineOptions> = {
  safe: { color: "#16a34a", weight: 6, opacity: 0.9 },
  alternative: { color: "#16a34a", weight: 6, opacity: 0.9 },
  blocked: { color: "#dc2626", weight: 5, opacity: 0.7, dashArray: "8 10" },
  direct: { color: "#2563eb", weight: 3, opacity: 0.8, dashArray: "2 8", lineCap: "round" },
};

function FitBounds({ fit }: { fit?: LiveMapProps["fitBounds"] }) {
  const map = useMap();
  const key = fit?.key;
  useEffect(() => {
    if (!fit || fit.points.length === 0) return;
    const apply = () => {
      map.invalidateSize();
      if (fit.points.length === 1) {
        map.setView([fit.points[0].lat, fit.points[0].lng], Math.max(map.getZoom(), 15));
        return;
      }
      map.fitBounds(L.latLngBounds(fit.points.map((p) => [p.lat, p.lng] as [number, number])), {
        paddingTopLeft: [40, 70],
        paddingBottomRight: [40, 40],
        maxZoom: 16,
      });
    };
    // Wait a frame so the container has its final size, and re-fit if the
    // container is resized afterwards (e.g. a details panel grows).
    let t = setTimeout(apply, 60);
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(apply, 80);
    });
    ro.observe(map.getContainer());
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
    // Only refit when the caller changes the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FlyToSelected({ sos }: { sos?: MapSos | null }) {
  const map = useMap();
  const id = sos?.id;
  const lat = sos?.latitude;
  const lng = sos?.longitude;
  // Only when the selection changes — realtime updates to the same incident
  // must not yank the operator's view back.
  useEffect(() => {
    if (id && lat !== undefined && lng !== undefined) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, map]);
  return null;
}

/** Re-measures the map when its container is resized (sheets, tabs, panels). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function LiveMap(props: LiveMapProps) {
  const {
    center,
    zoom = 14,
    className,
    zones = [],
    shelters = [],
    hospitals = [],
    hazards = [],
    sos = [],
    teams = [],
    userLocation,
    routes = [],
    fitBounds,
    selectedSosId,
    showLegend = true,
    compact = false,
    interactive = true,
    demo = true,
  } = props;

  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    zones: true,
    shelters: true,
    hospitals: true,
    hazards: true,
    sos: true,
    teams: true,
  });
  const [legendOpen, setLegendOpen] = useState(!compact);
  // Detect when base-map tiles can't load (offline, blocked network) so the
  // grey background is explained instead of looking broken.
  const [tiles, setTiles] = useState({ loaded: 0, failed: 0 });
  const tilesUnavailable = tiles.failed >= 3 && tiles.loaded === 0;

  const available: { key: LayerKey; label: string; count: number; swatch: React.ReactNode }[] = useMemo(
    () =>
      [
        { key: "zones" as const, label: "Flood-risk areas", count: zones.length, swatch: <span className="size-3 rounded-sm border border-danger bg-danger/30" /> },
        { key: "shelters" as const, label: "Shelters", count: shelters.length, swatch: <span className="size-3 rounded-[3px] bg-[#059669]" /> },
        { key: "hospitals" as const, label: "Hospitals", count: hospitals.length, swatch: <span className="size-3 rounded-[3px] bg-[#2563eb]" /> },
        { key: "hazards" as const, label: "Hazards & reports", count: hazards.length, swatch: <span className="size-3 rounded-full bg-high" /> },
        { key: "sos" as const, label: "SOS incidents", count: sos.length, swatch: <span className="size-3 rounded-full bg-danger" /> },
        { key: "teams" as const, label: "Rescue teams", count: teams.length, swatch: <span className="size-3 rounded-full bg-safe" /> },
      ].filter((l) => l.count > 0),
    [zones.length, shelters.length, hospitals.length, hazards.length, sos.length, teams.length],
  );

  const selectedSos = sos.find((s) => s.id === selectedSosId) ?? null;
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  return (
    <div className={cn("relative isolate overflow-hidden rounded-xl border bg-muted", className)}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive && !compact}
        attributionControl
        className="h-full w-full"
        aria-label="Live flood map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          eventHandlers={{
            tileload: () => setTiles((t) => (t.loaded > 0 ? t : { ...t, loaded: 1 })),
            tileerror: () => setTiles((t) => (t.failed >= 3 ? t : { ...t, failed: t.failed + 1 })),
          }}
        />
        <AutoResize />
        <FitBounds fit={fitBounds} />
        <FlyToSelected sos={selectedSos} />
        {props.onMapClick && <ClickHandler onClick={props.onMapClick} />}
        {props.pickedPoint && (
          <Marker position={[props.pickedPoint.lat, props.pickedPoint.lng]} icon={userLocationIcon()} zIndexOffset={3000} title="Selected location" />
        )}

        {layers.zones &&
          zones.map((z) => {
            const polygon = parsePolygon(z.polygon);
            if (polygon.length < 3) return null;
            const color = ZONE_FILL[z.risk.category];
            return (
              <Polygon
                key={z.id}
                positions={polygon}
                pathOptions={{ color, weight: 1.5, fillColor: color, fillOpacity: z.risk.category === "danger" ? 0.28 : 0.18 }}
              >
                <Popup>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-tight">{z.name}</p>
                      <RiskBadge category={z.risk.category} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Risk score <span className="font-semibold text-foreground tabular">{z.risk.score}</span>/100 · rule-based
                    </p>
                    <ul className="grid gap-0.5 text-xs">
                      {z.risk.factors
                        .filter((f) => f.contribution > 0)
                        .sort((a, b) => b.contribution - a.contribution)
                        .map((f) => (
                          <li key={f.key} className="flex justify-between gap-3">
                            <span>{f.label}</span>
                            <span className="font-semibold tabular">+{f.contribution}</span>
                          </li>
                        ))}
                    </ul>
                    {z.source_type === "simulated" && <DemoBadge />}
                  </div>
                </Popup>
              </Polygon>
            );
          })}

        {layers.shelters &&
          shelters.map((s) => {
            const full = s.remaining_capacity !== null && s.remaining_capacity <= 0;
            return (
              <Marker
                key={s.id}
                position={[s.latitude, s.longitude]}
                icon={markerIcon("shelter", full ? MAP_COLORS.muted : MAP_COLORS.shelter, { shape: "square", size: 28 })}
                keyboard
                title={`Shelter: ${s.name}`}
              >
                <Popup>
                  <div className="grid gap-2 text-sm">
                    <p className="label-caps text-[#059669]">Shelter</p>
                    <p className="font-semibold leading-tight">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.address}</p>
                    <p className="text-sm">
                      <span className={cn("font-semibold tabular", full ? "text-danger-ink" : "text-safe-ink")}>
                        {full ? "FULL" : `${s.remaining_capacity} spaces`}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        · {s.current_occupancy}/{s.capacity} occupied
                      </span>
                    </p>
                    {userLocation && (
                      <p className="text-xs text-muted-foreground">
                        {formatDistance(haversineMeters(userLocation, { lat: s.latitude, lng: s.longitude }))} away (straight line)
                      </p>
                    )}
                    {props.onShelterNavigate && !full && (
                      <Button size="sm" onClick={() => props.onShelterNavigate?.(s)}>
                        <Navigation /> Navigate
                      </Button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {layers.hospitals &&
          hospitals.map((h) => (
            <Marker
              key={h.id}
              position={[h.latitude, h.longitude]}
              icon={markerIcon("hospital", MAP_COLORS.hospital, { shape: "square", size: 26 })}
              title={`Hospital: ${h.name}`}
            >
              <Popup>
                <p className="label-caps text-[#2563eb]">Hospital</p>
                <p className="font-semibold">{h.name}</p>
                {h.phone && <p className="text-xs text-muted-foreground">Tel. {h.phone}</p>}
              </Popup>
            </Marker>
          ))}

        {layers.hazards &&
          hazards
            .filter((h) => h.status !== "resolved" && h.status !== "rejected")
            .map((h) => (
              <Marker
                key={h.id}
                position={[h.latitude, h.longitude]}
                icon={markerIcon(h.type as MarkerIconKey, HAZARD_COLOR[h.severity], {
                  size: h.duplicate_of ? 22 : 28,
                  badge: h.confirmation_count > 1 && !h.duplicate_of ? String(h.confirmation_count) : undefined,
                })}
                title={`${HAZARD_TYPE_LABEL[h.type]} — ${h.severity}`}
              >
                <Popup>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="label-caps">{HAZARD_TYPE_LABEL[h.type].toUpperCase()}</p>
                      <HazardSeverityBadge severity={h.severity} />
                    </div>
                    {h.location_name && <p className="font-semibold leading-tight">{h.location_name}</p>}
                    {h.description && <p className="text-xs text-muted-foreground">{h.description}</p>}
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <dt className="text-muted-foreground">Reported</dt>
                      <dd>{timeAgo(h.created_at)}</dd>
                      <dt className="text-muted-foreground">Confirmations</dt>
                      <dd className="tabular">{h.confirmation_count}</dd>
                      <dt className="text-muted-foreground">Status</dt>
                      <dd className="capitalize">{h.status}</dd>
                    </dl>
                    {h.duplicate_of && (
                      <p className="text-xs text-muted-foreground">Grouped with an earlier nearby report.</p>
                    )}
                    {h.source_type === "simulated" && <DemoBadge />}
                    {(props.onHazardAvoid || props.onHazardConfirm) && (
                      <div className="flex gap-2">
                        {props.onHazardConfirm && (
                          <Button size="sm" variant="outline" onClick={() => props.onHazardConfirm?.(h)}>
                            <ThumbsUp /> Confirm
                          </Button>
                        )}
                        {props.onHazardAvoid && (
                          <Button size="sm" onClick={() => props.onHazardAvoid?.(h)}>
                            <RouteIcon /> Avoid route
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

        {layers.teams &&
          teams.map((t) => (
            <Marker
              key={t.id}
              position={[t.latitude, t.longitude]}
              icon={markerIcon("team", TEAM_COLOR[t.status], { size: 26, badge: t.call_sign })}
              title={`Rescue team ${t.call_sign}`}
            >
              <Popup>
                <div className="grid gap-1.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">Team {t.call_sign}</p>
                    <TeamStatusBadge status={t.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{t.name}</p>
                  <p className="text-xs">
                    {t.personnel_count} personnel · {t.equipment.join(", ")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.liveUpdatedAt ? `Live position · updated ${timeAgo(t.liveUpdatedAt)}` : "Base location (live position not shared)"}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

        {layers.sos &&
          sos.map((s) => {
            const level = s.effective_priority ?? "low";
            const team = s.assigned_team_id ? teamById.get(s.assigned_team_id) : undefined;
            return (
              <Marker
                key={s.id}
                position={[s.latitude, s.longitude]}
                icon={markerIcon("sos", PRIORITY_COLOR[level], {
                  size: s.id === selectedSosId ? 38 : 32,
                  pulse: level === "critical" || s.status === "received",
                })}
                zIndexOffset={1000}
                title={`SOS ${s.reference_code}`}
                eventHandlers={{ click: () => props.onSosSelect?.(s) }}
              >
                <Tooltip direction="top" offset={[0, -14]}>
                  {s.reference_code} · {level.toUpperCase()}
                </Tooltip>
                <Popup>
                  <div className="grid gap-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold tabular">{s.reference_code}</p>
                      <PriorityBadge level={level} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.location_name ?? "GPS location"} · {timeAgo(s.created_at)}
                    </p>
                    <p className="text-xs">{s.people_count} people</p>
                    <SosStatusBadge status={s.status} />
                    {team && <p className="text-xs">Team {team.call_sign}</p>}
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {routes.map((r) => (
          <Polyline
            key={r.id}
            positions={r.path.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={ROUTE_STYLE[r.variant]}
          >
            {r.label && <Tooltip sticky>{r.label}</Tooltip>}
          </Polyline>
        ))}

        {userLocation && (
          <>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={40}
              pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.08 }}
            />
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon()} zIndexOffset={2000} title={props.userLabel ?? "Your location"}>
              <Popup>{props.userLabel ?? "Your location"}</Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {tilesUnavailable && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-6 left-2 z-[500] max-w-[55%] rounded-lg bg-slate-900/85 px-3 py-1.5 text-[11px] font-medium text-white"
          data-testid="tiles-unavailable"
        >
          Street map unavailable (offline or blocked network) — risk areas, markers and routes are still accurate.
        </div>
      )}
      {demo && (
        <div className="pointer-events-none absolute top-2 left-2 z-[500]">
          <DemoBadge className="bg-card/95 shadow-sm" />
        </div>
      )}

      {showLegend && available.length > 0 && (
        <div className="absolute right-2 bottom-6 z-[500] max-w-[220px]">
          {legendOpen ? (
            <div className="rounded-xl border bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-semibold">Map layers</p>
                <button
                  type="button"
                  onClick={() => setLegendOpen(false)}
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                  aria-label="Hide legend"
                >
                  Hide
                </button>
              </div>
              <ul className="grid gap-1.5">
                {available.map((l) => (
                  <li key={l.key}>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-slate-800"
                        checked={layers[l.key]}
                        onChange={(e) => setLayers((s) => ({ ...s, [l.key]: e.target.checked }))}
                      />
                      {l.swatch}
                      <span className="flex-1">{l.label}</span>
                      <span className="tabular text-muted-foreground">{l.count}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {layers.zones && zones.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 border-t pt-2">
                  {(["safe", "watch", "high", "danger"] as const).map((c) => (
                    <span key={c} className="flex items-center gap-1">
                      <span className="size-2.5 rounded-sm" style={{ background: ZONE_FILL[c] }} />
                      {c.toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
              {routes.length > 0 && (
                <div className="mt-2 grid gap-1 border-t pt-2">
                  {routes.some((r) => r.variant === "safe" || r.variant === "alternative") && (
                    <span className="flex items-center gap-2"><span className="h-1 w-5 rounded bg-[#16a34a]" /> Safe route</span>
                  )}
                  {routes.some((r) => r.variant === "direct") && (
                    <span className="flex items-center gap-2"><span className="h-0 w-5 border-t-2 border-dotted border-[#2563eb]" /> Direct line (not a road)</span>
                  )}
                  {routes.some((r) => r.variant === "blocked") && (
                    <span className="flex items-center gap-2"><span className="h-0 w-5 border-t-2 border-dashed border-[#dc2626]" /> Blocked route</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Button size="sm" variant="outline" className="bg-card/95 shadow" onClick={() => setLegendOpen(true)}>
              <Layers /> Legend
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
