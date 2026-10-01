"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { House, Loader2, LogOut, Phone, Save, ShieldCheck, Siren } from "lucide-react";
import { toast } from "sonner";
import { setSafetyStatus, updateProfile } from "@/app/citizen/actions";
import { signOut } from "@/app/auth/actions";
import { MySosList } from "@/components/sos/my-sos-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMERGENCY_CONTACTS, SAFETY_INSTRUCTIONS } from "@/lib/demo/scenario";
import { ROLE_LABEL, homeForRole } from "@/lib/auth/roles";
import { formatPhone, timeAgo } from "@/lib/utilities/format";
import { cn } from "@/lib/utils";
import { profileSchema, type ProfileInput } from "@/lib/validation/schemas";
import type { Profile, SafetyStatus } from "@/types/domain";

const STATUSES: { key: SafetyStatus; label: string; desc: string; icon: typeof ShieldCheck; on: string }[] = [
  { key: "safe", label: "SAFE", desc: "We are safe at home or with family", icon: ShieldCheck, on: "border-safe-strong bg-safe-strong text-white" },
  { key: "evacuated", label: "EVACUATED", desc: "We moved to a shelter or safe place", icon: House, on: "border-info-ink bg-info-ink text-white" },
  { key: "need_help", label: "NEED HELP", desc: "We need assistance", icon: Siren, on: "border-danger bg-danger text-white" },
];

export function ProfileView({ profile, email }: { profile: Profile | null; email: string | null }) {
  const [status, setStatus] = useState<SafetyStatus>(profile?.safety_status ?? "unknown");
  const [pending, startTransition] = useTransition();

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name ?? "",
      district: profile?.district ?? "",
      municipality: profile?.municipality ?? "",
      ward: profile?.ward ?? undefined,
      emergencyContact: profile?.emergency_contact?.replace(/^\+977/, "") ?? "",
    },
  });
  const errors = form.formState.errors;

  function chooseStatus(next: SafetyStatus) {
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      const res = await setSafetyStatus(next);
      if (res.ok) toast.success(`Status set to ${next.replace("_", " ").toUpperCase()}`);
      else {
        setStatus(prev);
        toast.error(res.error);
      }
    });
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await updateProfile(values);
    if (res.ok) toast.success(res.message);
    else toast.error(res.error);
  });

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
          {(profile?.full_name ?? "U").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{profile?.full_name ?? "Your profile"}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {formatPhone(profile?.phone) !== "—" ? formatPhone(profile?.phone) : email} · {ROLE_LABEL[profile?.role ?? "citizen"]}
          </p>
        </div>
      </div>

      {profile && profile.role !== "citizen" && (
        <Button asChild variant="outline"><Link href={homeForRole(profile.role)}>Open my {ROLE_LABEL[profile.role]} workspace</Link></Button>
      )}

      <section aria-labelledby="safety-title" className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <h2 id="safety-title" className="text-sm font-semibold">Family safety status</h2>
          {profile?.safety_updated_at && <span className="text-xs text-muted-foreground">Updated {timeAgo(profile.safety_updated_at)}</span>}
        </div>
        <div className="grid gap-2" role="radiogroup" aria-label="Family safety status">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={status === s.key}
              disabled={pending}
              onClick={() => chooseStatus(s.key)}
              className={cn(
                "flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-card px-4 text-left transition",
                status === s.key ? s.on : "hover:bg-accent",
              )}
            >
              <s.icon className="size-6 shrink-0" aria-hidden />
              <span>
                <span className="block text-base font-extrabold tracking-wide">{s.label}</span>
                <span className={cn("block text-xs", status === s.key ? "text-white" : "text-muted-foreground")}>{s.desc}</span>
              </span>
            </button>
          ))}
        </div>
        {status === "need_help" && (
          <Button asChild variant="destructive" size="lg"><Link href="/citizen/sos"><Siren /> Send an SOS now</Link></Button>
        )}
      </section>

      <MySosList />

      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border bg-card p-4" noValidate>
        <h2 className="text-sm font-semibold">Personal details</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="p-name">Full name</Label>
          <Input id="p-name" autoComplete="name" aria-invalid={Boolean(errors.fullName)} {...form.register("fullName")} />
          {errors.fullName && <p className="text-xs text-danger-ink">{errors.fullName.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="p-district">District</Label>
            <Input id="p-district" {...form.register("district")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-ward">Ward</Label>
            <Input id="p-ward" type="number" inputMode="numeric" min={1} max={40} {...form.register("ward", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-muni">Municipality</Label>
          <Input id="p-muni" {...form.register("municipality")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-contact">Emergency contact (family member)</Label>
          <Input id="p-contact" type="tel" inputMode="tel" placeholder="98XXXXXXXX" aria-invalid={Boolean(errors.emergencyContact)} {...form.register("emergencyContact")} />
          {errors.emergencyContact && <p className="text-xs text-danger-ink">{errors.emergencyContact.message}</p>}
        </div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />} Save details
        </Button>
      </form>

      <section className="grid gap-2 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Emergency numbers (available offline)</h2>
        <div className="grid grid-cols-3 gap-2">
          {EMERGENCY_CONTACTS.map((c) => (
            <Button key={c.number} asChild variant="outline" className="h-auto flex-col py-2">
              <a href={`tel:${c.number}`}>
                <span className="flex items-center gap-1 font-bold"><Phone className="size-3.5" aria-hidden />{c.number}</span>
                <span className="text-[11px] font-normal text-muted-foreground">{c.name}</span>
              </a>
            </Button>
          ))}
        </div>
        <h3 className="mt-2 text-sm font-semibold">Flood safety</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/85">
          {SAFETY_INSTRUCTIONS.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </section>

      <form action={signOut}>
        <Button type="submit" variant="ghost" className="w-full"><LogOut /> Sign out</Button>
      </form>
    </div>
  );
}
