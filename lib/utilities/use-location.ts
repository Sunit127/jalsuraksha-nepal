"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_CITIZEN_LOCATION } from "@/lib/demo/scenario";
import type { LatLng } from "@/types/domain";

/** gps = device location · demo = simulated scenario location · manual = placed on the map by the user */
export type LocationSource = "gps" | "demo" | "manual";
export type LocationError = "denied" | "unavailable" | "timeout" | "unsupported" | null;

export type LocationState = {
  location: LatLng | null;
  accuracyM: number | null;
  source: LocationSource | null;
  label: string | null;
  error: LocationError;
  loading: boolean;
  useGps: () => void;
  useDemo: () => void;
  /** Fallback when GPS is denied/unavailable: the user places themselves on the map. */
  setManual: (point: LatLng) => void;
};

const PREF_KEY = "js:location-mode";

function readPref(): LocationSource | null {
  try {
    const v = localStorage.getItem(PREF_KEY);
    // "manual" is intentionally not persisted: a stale hand-placed pin is dangerous.
    return v === "gps" || v === "demo" ? v : null;
  } catch {
    return null;
  }
}

function writePref(v: Exclude<LocationSource, "manual">) {
  try {
    localStorage.setItem(PREF_KEY, v);
  } catch {
    // Storage unavailable (private mode) — preference just won't persist.
  }
}

export const LOCATION_ERROR_MESSAGE: Record<Exclude<LocationError, null>, string> = {
  denied: "Location permission was denied. Enable it in your browser settings, or set your position on the map.",
  unavailable: "Your location could not be determined. Try again, or set your position on the map.",
  timeout: "Getting your location took too long. Try again, or set your position on the map.",
  unsupported: "This device does not share its location. Set your position on the map.",
};

/**
 * Shared location state. Real GPS is the default; in demo mode users can
 * switch to the simulated riverside location for a reproducible presentation
 * (the choice is remembered).
 */
export function useLocationState(demoMode: boolean): LocationState {
  const [mode, setMode] = useState<LocationSource | null>(null);
  const [gps, setGps] = useState<{ loc: LatLng; acc: number } | null>(null);
  const [error, setError] = useState<LocationError>(null);
  const [manual, setManualPoint] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(false);
  // Bumped by useGps() so "Try again" restarts the watch even when GPS is
  // already the selected mode.
  const [attempt, setAttempt] = useState(0);
  const watchId = useRef<number | null>(null);

  // Resolve the initial mode on the client only (avoids hydration mismatch).
  useEffect(() => {
    // Real GPS by default, so an SOS carries the caller's true position. The
    // simulated location is used only after someone picks it in demo mode,
    // and a leftover "demo" choice never applies once demo mode is off.
    const pref = readPref();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser-only preference after mount
    setMode(pref === "demo" && demoMode ? "demo" : "gps");
  }, [demoMode]);

  useEffect(() => {
    if (mode !== "gps") return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- capability check result
      setError("unsupported");
      return;
    }
    setLoading(true);
    setError(null);
    // The browser's own timeout only starts once the permission prompt is
    // answered. If it is ignored, surface the "set on map" fallback anyway
    // (watching continues, so a late fix still replaces the error).
    let gotFix = false;
    const watchdog = setTimeout(() => {
      if (gotFix) return;
      setLoading(false);
      setError((e) => e ?? "timeout");
    }, 20_000);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        gotFix = true;
        clearTimeout(watchdog);
        setGps({
          loc: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          acc: Math.round(pos.coords.accuracy),
        });
        setError(null);
        setLoading(false);
      },
      (err) => {
        clearTimeout(watchdog);
        setLoading(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "denied"
            : err.code === err.TIMEOUT
              ? "timeout"
              : "unavailable",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
    return () => {
      clearTimeout(watchdog);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, [mode, attempt]);

  const useGps = useCallback(() => {
    writePref("gps");
    setMode("gps");
    setAttempt((n) => n + 1);
  }, []);
  const useDemo = useCallback(() => {
    writePref("demo");
    setMode("demo");
    setError(null);
  }, []);

  const setManual = useCallback((point: LatLng) => {
    setManualPoint(point);
    setMode("manual");
    setError(null);
  }, []);

  return useMemo<LocationState>(() => {
    const actions = { useGps, useDemo, setManual };
    if (mode === "demo") {
      return {
        location: { lat: DEMO_CITIZEN_LOCATION.lat, lng: DEMO_CITIZEN_LOCATION.lng },
        accuracyM: 10,
        source: "demo",
        label: DEMO_CITIZEN_LOCATION.label,
        error: null,
        loading: false,
        ...actions,
      };
    }
    if (mode === "manual" && manual) {
      return {
        location: manual,
        accuracyM: null,
        source: "manual",
        label: "Location set on map (approximate)",
        error: null,
        loading: false,
        ...actions,
      };
    }
    return {
      location: gps?.loc ?? null,
      accuracyM: gps?.acc ?? null,
      source: gps ? "gps" : null,
      label: gps ? "Your GPS location" : null,
      error,
      loading: mode === null || loading,
      ...actions,
    };
  }, [mode, manual, gps, error, loading, useGps, useDemo, setManual]);
}
