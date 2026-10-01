"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, MapPinOff, Pause, Play } from "lucide-react";
import { shareTeamLocation } from "@/app/rescue/actions";
import { haversineMeters } from "@/lib/utilities/geo";
import { timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";

const MIN_INTERVAL_MS = 15_000;
const HEARTBEAT_MS = 60_000;
const MIN_MOVE_M = 25;

type ShareState = "starting" | "sharing" | "paused" | "denied" | "unavailable";

/**
 * Shares the team's GPS position during an active mission so the person in
 * need and the control centre can see the team approaching. Sends after
 * moving 25 m (at most every 15 s), plus a heartbeat every minute so the
 * position never looks stale while the team is stationary.
 */
export function LocationShare({ active }: { active: boolean }) {
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
    if (!active || paused) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator) || !window.isSecureContext) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- capability check result
      setState("unavailable");
      return;
    }
    setState("starting");
    const send = (pos: GeolocationPosition) => {
      const now = Date.now();
      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
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
      shareTeamLocation({ latitude, longitude, accuracyM: accuracy, headingDeg: heading, speedMps: speed })
        .then((res) => {
          if (res.ok) {
            setState("sharing");
            setSentAt(new Date().toISOString());
          } else retryNextFix();
        })
        .catch(retryNextFix);
    };
    const id = navigator.geolocation.watchPosition(send, (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"), {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 30_000,
    });
    // Heartbeat: re-read the position even when the watch stays quiet.
    const beat = setInterval(() => navigator.geolocation.getCurrentPosition(send, () => undefined, { maximumAge: 30_000, timeout: 20_000 }), HEARTBEAT_MS);
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(beat);
    };
  }, [active, paused]);

  if (!active) return null;
  const shownState: ShareState = paused ? "paused" : state;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs",
        shownState === "sharing" ? "bg-safe-soft text-safe-ink" : shownState === "starting" ? "bg-muted text-muted-foreground" : "bg-high-soft text-high-ink",
      )}
      role="status"
    >
      <span className="flex items-center gap-1.5">
        {shownState === "sharing" || shownState === "starting" ? <MapPin className="size-3.5" aria-hidden /> : <MapPinOff className="size-3.5" aria-hidden />}
        {shownState === "sharing" && <>Sharing live location with the person in need and the control centre{sentAt ? ` · sent ${timeAgo(sentAt)}` : ""}</>}
        {shownState === "starting" && "Getting your GPS position to share with the person in need…"}
        {shownState === "paused" && "Location sharing paused — the person in need can't see you approaching."}
        {shownState === "denied" && "Location permission denied — allow it so the person in need can see you approaching."}
        {shownState === "unavailable" && "Location sharing unavailable on this device/connection (needs GPS and https)."}
      </span>
      {(shownState === "sharing" || shownState === "paused" || shownState === "starting") && (
        <button type="button" onClick={() => setPaused((p) => !p)} className="flex cursor-pointer items-center gap-1 font-semibold underline">
          {paused ? <Play className="size-3" aria-hidden /> : <Pause className="size-3" aria-hidden />} {paused ? "Resume" : "Pause"}
        </button>
      )}
    </div>
  );
}
