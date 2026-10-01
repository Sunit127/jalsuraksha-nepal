"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, MapPinOff, Pause, Play } from "lucide-react";
import { haversineMeters } from "@/lib/utilities/geo";
import { timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";

const MIN_INTERVAL_MS = 10_000;
const HEARTBEAT_MS = 60_000;
const MIN_MOVE_M = 15;

type ShareState = "starting" | "sharing" | "denied" | "unavailable";

/**
 * Keeps the caller's position current while their SOS is open, so the
 * control centre and the rescue team see where the person is now (water can
 * force people to move). Sends after moving 15 m (at most every 10 s), plus
 * a heartbeat every minute. The caller can pause it.
 */
export function LiveLocationShare({ reference, token }: { reference: string; token: string }) {
  const [state, setState] = useState<ShareState>("starting");
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const last = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (paused) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator) || !window.isSecureContext) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- capability check result
      setState("unavailable");
      return;
    }
    setState("starting");
    const send = (pos: GeolocationPosition) => {
      const now = Date.now();
      const { latitude, longitude, accuracy } = pos.coords;
      const prev = last.current;
      const moved = prev ? haversineMeters({ lat: prev.lat, lng: prev.lng }, { lat: latitude, lng: longitude }) : Infinity;
      const due = !prev || now - prev.at >= HEARTBEAT_MS || (now - prev.at >= MIN_INTERVAL_MS && moved >= MIN_MOVE_M);
      if (!due) return;
      const sent = { at: now, lat: latitude, lng: longitude };
      last.current = sent;
      // A failed send is retried after MIN_INTERVAL_MS, not the full heartbeat.
      const retryNextFix = () => {
        if (last.current === sent) last.current = { ...sent, at: sent.at - HEARTBEAT_MS + MIN_INTERVAL_MS };
      };
      fetch("/api/sos/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: reference, token, latitude, longitude, accuracyM: Math.round(accuracy) }),
      })
        .then((res) => {
          if (res.ok) {
            setState("sharing");
            setSentAt(new Date().toISOString());
          } else retryNextFix();
        })
        .catch(retryNextFix);
    };
    const id = navigator.geolocation.watchPosition(
      send,
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    // Heartbeat: re-read the position even when the watch stays quiet.
    const beat = setInterval(
      () => navigator.geolocation.getCurrentPosition(send, () => undefined, { maximumAge: 30_000, timeout: 20_000 }),
      HEARTBEAT_MS,
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(beat);
    };
  }, [paused, reference, token]);

  const ok = !paused && state === "sharing";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs",
        ok ? "bg-safe-soft text-safe-ink" : paused || state === "starting" ? "bg-muted text-muted-foreground" : "bg-high-soft text-high-ink",
      )}
      role="status"
      data-testid="live-location"
    >
      <span className="flex items-center gap-1.5">
        {ok || state === "starting" ? <MapPin className="size-4" aria-hidden /> : <MapPinOff className="size-4" aria-hidden />}
        {paused
          ? "Live location paused — the control centre sees your last position."
          : state === "sharing"
            ? `Sharing your live location with the control centre${sentAt ? ` · updated ${timeAgo(sentAt)}` : ""}`
            : state === "starting"
              ? "Starting live location…"
              : state === "denied"
                ? "Location permission denied — the control centre sees the position you sent."
                : "Live location unavailable — the control centre sees the position you sent."}
      </span>
      {(state === "sharing" || state === "starting" || paused) && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-semibold hover:bg-black/5"
        >
          {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
          {paused ? "Resume" : "Pause"}
        </button>
      )}
    </div>
  );
}
