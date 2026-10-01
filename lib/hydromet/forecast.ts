/**
 * Rain forecast early warning from Open-Meteo (free, no key; ECMWF/GFS and
 * other models blended). Live DHM gauges say what the rivers are doing now;
 * the forecast says how much rain is coming in the next 24–48 h, so people
 * can be warned before the rivers rise.
 *
 * Bands are the 24-hour rainfall categories used by DHM Nepal and IMD.
 */
export type RainLevel = "none" | "light" | "moderate" | "heavy" | "very_heavy" | "extreme";

export type ZoneRainForecast = {
  zoneId: string;
  zoneName: string;
  next24Mm: number;
  next48Mm: number;
  peakMmPerHour: number;
  /** Local time (Asia/Kathmandu, ISO without offset) of the wettest hour. */
  peakAt: string | null;
  level: RainLevel;
};

export type RainForecast = {
  at: string;
  ok: boolean;
  source: string;
  zones: ZoneRainForecast[];
  error?: string;
};

export const FORECAST_SOURCE = "Open-Meteo weather forecast (ECMWF, GFS and other models)";
export const FORECAST_MAX_AGE_MS = 60 * 60_000;
const API = "https://api.open-meteo.com/v1/forecast";

export const RAIN_LEVEL_LABEL: Record<RainLevel, string> = {
  none: "No rain expected",
  light: "Light rain",
  moderate: "Moderate rain",
  heavy: "Heavy rain",
  very_heavy: "Very heavy rain",
  extreme: "Extremely heavy rain",
};

/** 24-hour total → category (DHM/IMD bands, mm). */
export function rainLevel(mm24: number): RainLevel {
  if (mm24 >= 204.5) return "extreme";
  if (mm24 >= 115.6) return "very_heavy";
  if (mm24 >= 64.5) return "heavy";
  if (mm24 >= 15.6) return "moderate";
  if (mm24 >= 2.5) return "light";
  return "none";
}

const ORDER: RainLevel[] = ["none", "light", "moderate", "heavy", "very_heavy", "extreme"];

/** The more severe of two levels. */
export function maxLevel(a: RainLevel, b: RainLevel): RainLevel {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

/** Heavy rain or worse in 24 h — or a 48-h total that heavy — is an early warning. */
export function isEarlyWarning(z: Pick<ZoneRainForecast, "level" | "next48Mm">): boolean {
  return ORDER.indexOf(z.level) >= ORDER.indexOf("heavy") || z.next48Mm >= 115.6;
}

/**
 * Sums an hourly series that starts at the current hour. The 24-h category
 * uses the wettest of the two days so rain arriving tomorrow still counts.
 */
export function summarizeHourly(times: string[], mm: (number | null)[]): Omit<ZoneRainForecast, "zoneId" | "zoneName"> {
  const v = mm.map((x) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, x) : 0));
  const sum = (from: number, to: number) => v.slice(from, to).reduce((a, b) => a + b, 0);
  const next24 = sum(0, 24);
  const day2 = sum(24, 48);
  let peak = 0;
  let peakAt: string | null = null;
  v.slice(0, 48).forEach((x, i) => {
    if (x > peak) {
      peak = x;
      peakAt = times[i] ?? null;
    }
  });
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    next24Mm: round(next24),
    next48Mm: round(next24 + day2),
    peakMmPerHour: round(peak),
    peakAt,
    level: rainLevel(Math.max(next24, day2)),
  };
}

type OpenMeteoLocation = { hourly?: { time?: string[]; precipitation?: (number | null)[] } };

/** One request for all zone centres; throws on failure. */
export async function fetchRainForecast(
  zones: { id: string; name: string; center_latitude: number; center_longitude: number }[],
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<RainForecast> {
  if (zones.length === 0) return { at: now.toISOString(), ok: true, source: FORECAST_SOURCE, zones: [] };
  const params = new URLSearchParams({
    latitude: zones.map((z) => z.center_latitude.toFixed(4)).join(","),
    longitude: zones.map((z) => z.center_longitude.toFixed(4)).join(","),
    hourly: "precipitation",
    forecast_hours: "48",
    timezone: "Asia/Kathmandu",
  });
  const res = await fetchImpl(`${API}?${params}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const body = (await res.json()) as OpenMeteoLocation | OpenMeteoLocation[];
  const locations = Array.isArray(body) ? body : [body];
  return {
    at: now.toISOString(),
    ok: true,
    source: FORECAST_SOURCE,
    zones: zones.map((z, i) => ({
      zoneId: z.id,
      zoneName: z.name,
      ...summarizeHourly(locations[i]?.hourly?.time ?? [], locations[i]?.hourly?.precipitation ?? []),
    })),
  };
}
