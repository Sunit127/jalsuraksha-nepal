"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LiveMap } from "@/components/map";
import { useCitizenData } from "@/components/shared/citizen-data";
import { LocationChip } from "@/components/shared/location-chip";
import { DEMO_REGION } from "@/lib/demo/scenario";
import { confirmHazard } from "@/app/citizen/actions";

function CitizenMap() {
  const router = useRouter();
  const params = useSearchParams();
  const data = useCitizenData();
  const focusHazardId = params.get("hazard");
  const focus = data.hazards.find((h) => h.id === focusHazardId);

  const fit = useMemo(
    () =>
      focus
        ? { key: `hazard:${focus.id}`, points: [{ lat: focus.latitude, lng: focus.longitude }] }
        : undefined,
    [focus],
  );

  return (
    <div className="relative h-[calc(100dvh-7.5rem)]">
      <LiveMap
        className="h-full rounded-none border-0"
        center={data.location.location ?? DEMO_REGION.center}
        zoom={14}
        zones={data.zones}
        shelters={data.shelters}
        hospitals={data.hospitals}
        hazards={data.hazards}
        userLocation={data.location.location}
        fitBounds={fit}
        onShelterNavigate={(s) => router.push(`/citizen/route?shelter=${s.id}`)}
        onHazardAvoid={(h) => router.push(`/citizen/route?avoid=${h.id}`)}
        onHazardConfirm={async (h) => {
          const res = await confirmHazard(h.id);
          if (res.ok) toast.success(res.message);
          else toast.error(res.error);
        }}
      />
      <div className="absolute top-2 right-2 left-28 z-[500]">
        <LocationChip className="shadow-md" />
      </div>
    </div>
  );
}

export default function CitizenMapPage() {
  return (
    <Suspense>
      <CitizenMap />
    </Suspense>
  );
}
