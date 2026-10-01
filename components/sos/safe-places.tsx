import Link from "next/link";
import { Building2, Hospital as HospitalIcon, Navigation, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/utilities/geo";
import type { SafeHospital, SafeShelter } from "./rescue-team-map";

/**
 * Nearest open shelters (with free space) and hospitals to the person's SOS
 * location, with honest guidance: move only if it is safe.
 */
export function SafePlaces({ shelters, hospitals }: { shelters: SafeShelter[]; hospitals: SafeHospital[] }) {
  if (shelters.length === 0 && hospitals.length === 0) return null;
  return (
    <section className="rounded-2xl border bg-card p-4" data-testid="safe-places">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="size-4 text-safe" aria-hidden /> Safe places near you
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Only move if the way is safe. If water is rising around you, stay at the highest point and wait for the rescue team.
      </p>

      {shelters.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {shelters.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                  <Building2 className="size-4 text-safe" aria-hidden /> {s.name}
                  {i === 0 && <span className="rounded bg-safe-soft px-1.5 py-0.5 text-[10px] font-bold text-safe-ink">NEAREST</span>}
                  {s.is_demo ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">DEMO</span>
                  ) : (
                    s.verification === "verified" && <span className="rounded bg-safe-soft px-1.5 py-0.5 text-[10px] font-bold text-safe-ink">VERIFIED</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistance(s.distanceM)} away (straight line) · {s.remaining_capacity} spaces free · {s.address}
                </p>
              </div>
              <div className="flex gap-2">
                {s.contact_phone && (
                  <Button asChild size="icon-sm" variant="outline" aria-label={`Call ${s.name}`}>
                    <a href={`tel:${s.contact_phone}`}>
                      <Phone />
                    </a>
                  </Button>
                )}
                <Button asChild size="sm" variant="safe">
                  <Link href={`/citizen/route?shelter=${s.id}`}>
                    <Navigation /> Safe route
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hospitals.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {hospitals.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <HospitalIcon className="size-4 shrink-0 text-info" aria-hidden />
                <span className="truncate">{h.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">· {formatDistance(h.distanceM)}</span>
              </span>
              {h.phone && (
                <a href={`tel:${h.phone}`} className="shrink-0 text-xs font-semibold text-primary">
                  Call
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
