"use client";

import { ShelterCard } from "@/components/shelter/shelter-card";
import { useCitizenData } from "@/components/shared/citizen-data";
import { LocationChip } from "@/components/shared/location-chip";

export default function SheltersPage() {
  const { nearestShelters } = useCitizenData();
  return (
    <div className="grid gap-3">
      <div>
        <h1 className="text-xl font-bold">Evacuation shelters</h1>
        <p className="text-sm text-muted-foreground">Sorted by distance. Capacity updates live.</p>
      </div>
      <LocationChip />
      {nearestShelters.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No shelters are open right now.
        </p>
      ) : (
        nearestShelters.map((s) => <ShelterCard key={s.id} shelter={s} distanceM={s.distanceM} />)
      )}
    </div>
  );
}
