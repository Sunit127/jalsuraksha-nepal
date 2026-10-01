"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  CircleAlert,
  Construction,
  Droplets,
  Loader2,
  Mountain,
  Send,
  Users,
  WavesHorizontal,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { submitHazardReport } from "@/app/citizen/actions";
import { useCitizenData } from "@/components/shared/citizen-data";
import { LocationChip } from "@/components/shared/location-chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HAZARD_TYPE_LABEL } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validation/schemas";
import type { HazardSeverity, HazardType } from "@/types/domain";

const TYPES: { key: HazardType; icon: typeof Zap }[] = [
  { key: "flooded_road", icon: WavesHorizontal },
  { key: "landslide", icon: Mountain },
  { key: "blocked_bridge", icon: Construction },
  { key: "waterlogging", icon: Droplets },
  { key: "damaged_infrastructure", icon: Zap },
  { key: "stranded_people", icon: Users },
  { key: "other", icon: CircleAlert },
];

const SEVERITIES: { key: HazardSeverity; label: string; tone: string }[] = [
  { key: "low", label: "Low", tone: "data-[on=true]:bg-info data-[on=true]:text-white" },
  { key: "medium", label: "Medium", tone: "data-[on=true]:bg-watch data-[on=true]:text-slate-900" },
  { key: "high", label: "High", tone: "data-[on=true]:bg-high data-[on=true]:text-white" },
  { key: "critical", label: "Critical", tone: "data-[on=true]:bg-danger data-[on=true]:text-white" },
];

export function HazardReportForm() {
  const router = useRouter();
  const { location } = useCitizenData();
  const [type, setType] = useState<HazardType | null>(null);
  const [severity, setSeverity] = useState<HazardSeverity>("medium");
  const [locationName, setLocationName] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; grouped: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function pickPhoto(file?: File) {
    setError(null);
    if (!file) return setPhoto(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) return setError("Use a JPEG, PNG or WebP photo.");
    if (file.size > MAX_UPLOAD_BYTES) return setError("Photo must be smaller than 5 MB.");
    setPhoto(file);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!type) return setError("Choose what kind of hazard you see.");
    if (!location.location) return setError("We need your location to place the report on the map.");

    startTransition(async () => {
      let photoUrl: string | undefined;
      if (photo) {
        const body = new FormData();
        body.set("kind", "hazard");
        body.set("file", photo);
        const res = await fetch("/api/uploads", { method: "POST", body }).catch(() => null);
        const json = res ? await res.json().catch(() => null) : null;
        if (res?.ok && json?.url) photoUrl = json.url;
        else toast.warning(json?.error ?? "Image upload failed — sending the report without a photo.");
      }
      const res = await submitHazardReport({
        type,
        severity,
        latitude: location.location!.lat,
        longitude: location.location!.lng,
        locationName: locationName || (location.source === "demo" ? "Riverside Tole, Bharatpur-1" : undefined),
        description: description || undefined,
        photoUrl,
      });
      if (!res.ok) return setError(res.error);
      setDone({ message: res.message ?? "Reported.", grouped: Boolean(res.data?.groupedWith) });
      toast.success("Hazard reported");
    });
  }

  if (done) {
    return (
      <div className="grid gap-4 py-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-safe" aria-hidden />
        <div>
          <h2 className="text-xl font-bold">Thank you</h2>
          <p className="mt-1 text-sm text-muted-foreground">{done.message}</p>
        </div>
        <div className="grid gap-2">
          <Button onClick={() => router.push("/citizen/map")}>View on map</Button>
          <Button variant="outline" onClick={() => { setDone(null); setType(null); setDescription(""); setLocationName(""); setPhoto(null); }}>
            Report another hazard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-xl font-bold">Report a hazard</h1>
        <p className="text-sm text-muted-foreground">
          Your report helps neighbours avoid danger and updates evacuation routes. Reports near an existing one are grouped.
        </p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">What do you see?</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hazard type">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={type === t.key}
              onClick={() => setType(t.key)}
              className={cn(
                "flex min-h-16 cursor-pointer items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition",
                type === t.key ? "border-primary bg-accent ring-2 ring-primary" : "bg-card hover:bg-accent",
                t.key === "other" && "col-span-2",
              )}
            >
              <t.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              {HAZARD_TYPE_LABEL[t.key]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">How severe?</legend>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Severity">
          {SEVERITIES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={severity === s.key}
              data-on={severity === s.key}
              onClick={() => setSeverity(s.key)}
              className={cn("h-10 cursor-pointer rounded-lg text-sm font-semibold transition", s.tone)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <section className="grid gap-2">
        <p className="text-sm font-semibold">Location</p>
        <LocationChip />
        <Label htmlFor="hz-place" className="sr-only">Place name</Label>
        <Input id="hz-place" placeholder="Place name or landmark (optional)" value={locationName} maxLength={120} onChange={(e) => setLocationName(e.target.value)} />
      </section>

      <section className="grid gap-2">
        <Label htmlFor="hz-desc" className="text-sm font-semibold">Details <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id="hz-desc" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Water knee-deep and rising across the road" />
        <input ref={fileRef} id="hz-photo" aria-label="Attach a photo" type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} capture="environment" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
        {photo ? (
          <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm">
            <span className="truncate">📷 {photo.name}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove photo" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}>
              <X />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Camera /> Add a photo</Button>
        )}
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Report not sent</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Send />} Submit report
      </Button>
      <p className="text-center text-xs text-muted-foreground">Never put yourself at risk to take a photo.</p>
    </form>
  );
}
