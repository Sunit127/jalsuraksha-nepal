"use client";

import dynamic from "next/dynamic";
import { MapPinned } from "lucide-react";
import { Component, type ReactNode } from "react";
import type { LiveMapProps } from "./live-map";

export type { LiveMapProps, MapRoute, MapSos, LayerKey } from "./live-map";

function MapSkeleton() {
  return (
    <div className="flex h-full w-full animate-pulse items-center justify-center rounded-xl border bg-muted text-muted-foreground">
      <MapPinned className="size-6" aria-hidden />
      <span className="sr-only">Loading map…</span>
    </div>
  );
}

/** Leaflet touches `window`, so the map is client-only and lazy-loaded. */
const LazyLiveMap = dynamic(() => import("./live-map"), { ssr: false, loading: MapSkeleton });

class MapErrorBoundary extends Component<{ children: ReactNode; className?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[map] failed to render", error);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-muted p-4 text-center text-sm text-muted-foreground">
          <MapPinned className="size-6" aria-hidden />
          <p className="font-medium text-foreground">Map unavailable</p>
          <p>Lists below still show alerts, shelters and hazards.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function LiveMap(props: LiveMapProps) {
  return (
    <MapErrorBoundary>
      <LazyLiveMap {...props} />
    </MapErrorBoundary>
  );
}
