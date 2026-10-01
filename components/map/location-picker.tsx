"use client";

import { useState } from "react";
import { Check, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DEMO_REGION } from "@/lib/demo/scenario";
import type { LatLng } from "@/types/domain";
import { LiveMap } from "./index";

/**
 * Fallback when GPS is denied or unavailable: the person taps where they are.
 * The resulting location is labelled approximate everywhere it is shown.
 */
export function LocationPicker({
  initial,
  onPick,
  trigger,
}: {
  initial: LatLng | null;
  onPick: (point: LatLng) => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setPoint(null);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <MapPinned /> Set on map
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-3 p-4">
        <DialogHeader>
          <DialogTitle>Where are you?</DialogTitle>
          <DialogDescription>
            Tap your position on the map. Zoom in to be as precise as you can — responders will treat it as approximate and call to confirm.
          </DialogDescription>
        </DialogHeader>
        <LiveMap
          className="h-[55dvh] min-h-72"
          center={initial ?? DEMO_REGION.center}
          zoom={initial ? 16 : 13}
          showLegend={false}
          demo={false}
          onMapClick={setPoint}
          pickedPoint={point}
        />
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {point ? `Selected: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "No position selected yet."}
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!point}
            onClick={() => {
              if (point) onPick(point);
              setOpen(false);
            }}
          >
            <Check /> Use this location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
