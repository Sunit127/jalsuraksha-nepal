"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Camera,
  CircleHelp,
  FlaskConical,
  HeartPulse,
  House,
  Loader2,
  Lock,
  Phone,
  ShieldCheck,
  Siren,
  TrendingUp,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useCitizenData } from "@/components/shared/citizen-data";
import { LocationChip } from "@/components/shared/location-chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_SOS_INPUT, EMERGENCY_CONTACTS } from "@/lib/demo/scenario";
import { SITUATION_LABEL, type SosSituationKey } from "@/lib/risk-engine/sos-priority";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { readSavedPhone, rememberSos, savePhone, tokenForRef } from "@/lib/utilities/my-sos";
import { RequestTimeoutError, fetchWithTimeout } from "@/lib/utilities/fetch-timeout";
import { LocationPicker } from "@/components/map/location-picker";
import { cn } from "@/lib/utils";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  sosDetailsSchema,
  type SosDetailsInput,
  type SosDetailsValues,
} from "@/lib/validation/schemas";
import { CounterField } from "./counter-field";

const SITUATIONS: { key: SosSituationKey; icon: typeof Siren; hint: string }[] = [
  { key: "water_rising", icon: TrendingUp, hint: "Level going up fast" },
  { key: "trapped", icon: Lock, hint: "Cannot leave safely" },
  { key: "medical", icon: HeartPulse, hint: "Someone needs medical help" },
  { key: "water_entering", icon: House, hint: "Water coming inside" },
  { key: "safe_temporarily", icon: ShieldCheck, hint: "Safe for now, need evacuation" },
  { key: "other", icon: CircleHelp, hint: "Describe below" },
];

type ApiResult =
  | { ok: true; duplicate: false; reference: string; trackingToken: string }
  | { ok: true; duplicate: true; reference: string; trackingToken: string | null }
  | { error: string };

export function SosForm() {
  const router = useRouter();
  const { location, online, demoMode, session } = useCitizenData();
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateRef, setDuplicateRef] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<SosDetailsInput, unknown, SosDetailsValues>({
    resolver: zodResolver(sosDetailsSchema),
    defaultValues: {
      phone: "",
      peopleCount: 1,
      childrenCount: 0,
      elderlyCount: 0,
      injured: undefined as unknown as boolean,
      situation: undefined,
      description: "",
    },
    mode: "onSubmit",
  });
  const { control, register, handleSubmit, setValue, formState, reset } = form;
  const errors = formState.errors;

  // Prefill: signed-in citizen's verified phone, else the last number used here.
  useEffect(() => {
    const fromProfile = session.phone?.replace(/^\+?977/, "") ?? "";
    const saved = fromProfile || readSavedPhone();
    if (saved) setValue("phone", saved);
  }, [setValue, session.phone]);

  function fillDemo() {
    reset({
      phone: DEMO_SOS_INPUT.phone,
      peopleCount: DEMO_SOS_INPUT.peopleCount,
      childrenCount: DEMO_SOS_INPUT.childrenCount,
      elderlyCount: DEMO_SOS_INPUT.elderlyCount,
      injured: DEMO_SOS_INPUT.injured,
      situation: DEMO_SOS_INPUT.situation,
      description: DEMO_SOS_INPUT.description,
    });
    toast.info("Demo scenario filled: 5 people, 2 children, 1 elderly, injured, water rising.");
  }

  function onPhotoChange(file: File | undefined) {
    setPhotoError(null);
    if (!file) return setPhoto(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      setPhotoError("Use a JPEG, PNG or WebP photo.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setPhotoError("Photo must be smaller than 5 MB.");
      return;
    }
    setPhoto(file);
  }

  async function onSubmit(values: SosDetailsValues) {
    setSubmitError(null);
    setDuplicateRef(null);
    if (!location.location) {
      setSubmitError("We need your location to send rescuers. Allow location access or place yourself on the map, then try again.");
      return;
    }
    if (!online) {
      setSubmitError("You are offline. Call 100 (Police) or 102 (Ambulance) now.");
      return;
    }

    setSending(true);
    try {
      // Silent anonymous session so this device can receive live status
      // updates. Never let it delay the SOS: give up after 5 s and rely on
      // the tracking token + polling instead.
      try {
        const supabase = getSupabaseBrowserClient();
        await Promise.race([
          (async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) await supabase.auth.signInAnonymously();
          })(),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
      } catch {
        // Anonymous sign-in disabled/unavailable: the tracking token still works.
      }

      let photoPath: string | undefined;
      if (photo) {
        const body = new FormData();
        body.set("kind", "sos");
        body.set("file", photo);
        const res = await fetchWithTimeout("/api/uploads", { method: "POST", body }, 15_000).catch(() => null);
        const json = res ? await res.json().catch(() => null) : null;
        if (res?.ok && json?.path) photoPath = json.path;
        else toast.warning("Photo could not be uploaded — sending your SOS without it.");
      }

      const res = await fetchWithTimeout("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          phone: values.phone,
          latitude: location.location.lat,
          longitude: location.location.lng,
          // Network-based fixes can report accuracy beyond the API's limit.
          locationAccuracyM: location.accuracyM === null ? undefined : Math.min(location.accuracyM, 100_000),
          locationName:
            location.source === "demo"
              ? "Riverside Tole, Bharatpur-1"
              : location.source === "manual"
                ? "Placed on map by caller (approximate)"
                : undefined,
          photoPath,
        }),
      }, 20_000);
      const json = (await res.json().catch(() => ({ error: "Unexpected response" }))) as ApiResult;

      if (!res.ok || "error" in json) {
        setSubmitError("error" in json ? json.error : "Could not send SOS. Please try again.");
        return;
      }

      savePhone(values.phone.replace(/^\+977/, ""));
      // A guest's repeat SOS comes back without a token; this device may
      // still hold it from the first send (e.g. the reply was lost).
      const token = json.trackingToken ?? tokenForRef(json.reference);
      if (!token) {
        setDuplicateRef(json.reference);
        return;
      }
      rememberSos({ ref: json.reference, token, createdAt: new Date().toISOString() });
      if ("vibrate" in navigator) navigator.vibrate?.([80, 60, 80]);
      router.push(`/citizen/sos/${json.reference}?t=${token}`);
    } catch (err) {
      setSubmitError(
        err instanceof RequestTimeoutError
          ? "The connection is too slow — we could not confirm your SOS. Try again, and call 100 / 102 if you are in immediate danger."
          : "Network error — your SOS may not have been sent. Try again or call 100 / 102.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5" noValidate aria-label="Emergency SOS">
      <div className="rounded-2xl bg-danger p-4 text-white">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <Siren className="size-7" aria-hidden /> EMERGENCY SOS
            </h1>
            <p className="mt-1 text-sm text-white">
              No account needed. Your location and details go straight to the control centre.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {EMERGENCY_CONTACTS.slice(0, 3).map((c) => (
            <a
              key={c.number}
              href={`tel:${c.number}`}
              className="flex flex-1 flex-col items-center rounded-xl bg-black/25 px-2 py-1.5 text-center text-xs font-semibold hover:bg-black/35"
            >
              <span className="flex items-center gap-1 text-base"><Phone className="size-3.5" aria-hidden />{c.number}</span>
              <span className="font-normal text-white">{c.name}</span>
            </a>
          ))}
        </div>
      </div>

      {demoMode && (
        <Button type="button" variant="outline" onClick={fillDemo} className="border-dashed">
          <FlaskConical /> Fill demo scenario (presentation)
        </Button>
      )}

      <section className="grid gap-2">
        <h2 className="text-sm font-semibold">1. Your location</h2>
        <LocationChip />
        {!location.location && !location.loading && (
          <LocationPicker
            initial={null}
            onPick={location.setManual}
            trigger={
              <Button type="button" variant="outline" size="lg" className="border-danger/40 text-danger-ink">
                Place my location on the map
              </Button>
            }
          />
        )}
      </section>

      <section className="grid gap-2">
        <Label htmlFor="sos-phone" className="text-sm font-semibold">2. Phone number</Label>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm font-medium text-muted-foreground">
            +977
          </span>
          <Input
            id="sos-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="98XXXXXXXX"
            className="h-12 rounded-l-none text-base"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby="sos-phone-err"
            {...register("phone")}
          />
        </div>
        {errors.phone && <p id="sos-phone-err" className="text-xs text-danger-ink">{errors.phone.message}</p>}
      </section>

      <section className="grid gap-2">
        <h2 className="text-sm font-semibold">3. Who needs help?</h2>
        <Controller
          control={control}
          name="peopleCount"
          render={({ field }) => (
            <CounterField id="people" label="People in total" value={field.value} onChange={field.onChange} min={1} max={200} invalid={Boolean(errors.peopleCount)} />
          )}
        />
        <Controller
          control={control}
          name="childrenCount"
          render={({ field }) => (
            <CounterField id="children" label="Children" hint="Under 14" value={field.value} onChange={field.onChange} max={200} />
          )}
        />
        <Controller
          control={control}
          name="elderlyCount"
          render={({ field }) => (
            <CounterField id="elderly" label="Elderly people" hint="Over 65 or limited mobility" value={field.value} onChange={field.onChange} max={200} />
          )}
        />
        {errors.peopleCount && <p className="text-xs text-danger-ink">{errors.peopleCount.message}</p>}

        <Controller
          control={control}
          name="injured"
          render={({ field }) => (
            <fieldset className={cn("rounded-2xl border bg-card p-3", errors.injured && "border-danger")}>
              <legend className="sr-only">Is anyone injured?</legend>
              <p className="text-sm font-semibold" aria-hidden>Is anyone injured?</p>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Is anyone injured?">
                {[
                  { v: true, label: "Yes, injured" },
                  { v: false, label: "No injuries" },
                ].map((o) => (
                  <button
                    key={String(o.v)}
                    type="button"
                    role="radio"
                    aria-checked={field.value === o.v}
                    onClick={() => field.onChange(o.v)}
                    className={cn(
                      "h-12 cursor-pointer rounded-xl border text-sm font-semibold transition",
                      field.value === o.v
                        ? o.v
                          ? "border-danger bg-danger text-white"
                          : "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-accent",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {errors.injured && <p className="mt-1 text-xs text-danger-ink">Tell us if anyone is injured</p>}
            </fieldset>
          )}
        />
      </section>

      <Controller
        control={control}
        name="situation"
        render={({ field }) => (
          <section className="grid gap-2">
            <h2 id="situation-label" className="text-sm font-semibold">4. What is happening?</h2>
            <div role="radiogroup" aria-labelledby="situation-label" className="grid grid-cols-2 gap-2">
              {SITUATIONS.map((s) => {
                const selected = field.value === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => field.onChange(s.key)}
                    className={cn(
                      "flex min-h-20 cursor-pointer flex-col items-start gap-1 rounded-2xl border p-3 text-left transition",
                      selected ? "border-danger bg-danger-soft ring-2 ring-danger" : "bg-card hover:bg-accent",
                    )}
                  >
                    <s.icon className={cn("size-5", selected ? "text-danger" : "text-muted-foreground")} aria-hidden />
                    <span className="text-sm font-semibold leading-tight">{SITUATION_LABEL[s.key]}</span>
                    <span className="text-[11px] text-muted-foreground">{s.hint}</span>
                  </button>
                );
              })}
            </div>
            {errors.situation && <p className="text-xs text-danger-ink">{errors.situation.message}</p>}
          </section>
        )}
      />

      <section className="grid gap-2">
        <Label htmlFor="sos-desc" className="text-sm font-semibold">
          5. Details <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="sos-desc"
          rows={3}
          placeholder="e.g. On the roof of a two-storey house, blue gate, near the school"
          {...register("description")}
        />
        {errors.description && <p className="text-xs text-danger-ink">{errors.description.message}</p>}

        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          capture="environment"
          className="sr-only"
          id="sos-photo"
          aria-label="Attach a photo"
          onChange={(e) => onPhotoChange(e.target.files?.[0])}
        />
        {photo ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
            <span className="truncate">📷 {photo.name}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove photo" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}>
              <X />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <Camera /> Add a photo (optional)
          </Button>
        )}
        {photoError && <p className="text-xs text-danger-ink">{photoError}</p>}
      </section>

      {!online && (
        <Alert variant="warning">
          <WifiOff />
          <AlertTitle>You are offline</AlertTitle>
          <AlertDescription>
            The SOS cannot be sent without a connection. Call 100 (Police) or 102 (Ambulance).
          </AlertDescription>
        </Alert>
      )}

      {duplicateRef && (
        <Alert variant="warning">
          <AlertTitle>SOS already submitted</AlertTitle>
          <AlertDescription>
            An active SOS from this number already exists ({duplicateRef}). The control centre has it —
            you do not need to send another. If the situation got worse, call 100 or 102.
          </AlertDescription>
        </Alert>
      )}

      {submitError && (
        <Alert variant="destructive">
          <AlertTitle>SOS not sent</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-20 z-10 -mx-1 bg-gradient-to-t from-background via-background to-transparent px-1 pt-3">
        <Button
          type="submit"
          variant="destructive"
          size="xl"
          className="w-full text-xl font-extrabold tracking-wide shadow-xl shadow-red-900/30"
          disabled={sending}
        >
          {sending ? <Loader2 className="size-6 animate-spin" /> : <Siren className="size-6" />}
          {sending ? "SENDING SOS…" : "SEND SOS NOW"}
        </Button>
      </div>
    </form>
  );
}
