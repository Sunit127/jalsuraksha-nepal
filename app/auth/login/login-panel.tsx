"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, Loader2, Phone, ShieldCheck, UserRound } from "lucide-react";
import { demoSignIn, staffSignIn, type AuthFormState } from "@/app/auth/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/auth/roles";
import { otpErrorMessage } from "@/lib/auth/otp-errors";
import { firstIssue, nepalPhoneSchema, otpSchema } from "@/lib/validation/schemas";

type DemoAccount = { key: string; label: string; description: string };
/** How login codes are delivered right now (decided on the server). */
export type SmsMode = "twilio" | "dev-log" | "none";

export function LoginPanel({
  next,
  demoAccounts,
  demoMode,
  smsMode,
}: {
  next?: string;
  demoAccounts: DemoAccount[];
  demoMode: boolean;
  smsMode: SmsMode;
}) {
  return (
    <Card className="overflow-hidden shadow-2xl">
      <CardHeader className="pb-1">
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>
          Citizens use their mobile number. Emergency staff use their work account.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-3">
        <Tabs defaultValue="citizen">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="citizen">
              <Phone aria-hidden /> Citizen
            </TabsTrigger>
            <TabsTrigger value="staff">
              <Building2 aria-hidden /> Staff
            </TabsTrigger>
          </TabsList>
          <TabsContent value="citizen">
            <PhoneOtpForm next={next} demoMode={demoMode} smsMode={smsMode} />
          </TabsContent>
          <TabsContent value="staff">
            <StaffForm next={next} />
          </TabsContent>
        </Tabs>

        {demoAccounts.length > 0 && <DemoAccounts accounts={demoAccounts} next={next} />}
      </CardContent>
    </Card>
  );
}

const RESEND_SECONDS = 60;

function PhoneOtpForm({ next, demoMode, smsMode }: { next?: string; demoMode: boolean; smsMode: SmsMode }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [normalized, setNormalized] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function requestCode(target: string) {
    startTransition(async () => {
      try {
        const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({ phone: target });
        if (error) {
          console.error("[auth] OTP send failed", error.code, error.message);
          setError(otpErrorMessage(error, "send", demoMode));
          return;
        }
        setNormalized(target);
        setCooldown(RESEND_SECONDS);
      } catch (err) {
        console.error("[auth] OTP send failed", err);
        setError(otpErrorMessage({ status: 0, message: "network" }, "send", demoMode));
      }
    });
  }

  function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = nepalPhoneSchema.safeParse(phone);
    if (!parsed.success) return setError(firstIssue(parsed.error));
    requestCode(parsed.data);
  }

  function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) return setError(firstIssue(parsed.error));
    if (!normalized) return setError("Request a new code first.");
    startTransition(async () => {
      try {
        const { error } = await getSupabaseBrowserClient().auth.verifyOtp({
          phone: normalized,
          token: parsed.data,
          type: "sms",
        });
        if (error) {
          setError(otpErrorMessage(error, "verify", demoMode));
          return;
        }
        router.replace(safeRedirectPath(next, "/citizen"));
        router.refresh();
      } catch {
        setError(otpErrorMessage({ status: 0, message: "network" }, "verify", demoMode));
      }
    });
  }

  if (normalized) {
    return (
      <form onSubmit={verifyOtp} className="mt-4 grid gap-4" noValidate>
        <p className="text-sm text-muted-foreground">
          {smsMode === "dev-log" ? (
            <>
              Development mode: no SMS was sent. The 6-digit code for{" "}
              <span className="font-semibold text-foreground">{normalized}</span> is printed in the terminal running{" "}
              <code>npm run dev</code>.
            </>
          ) : (
            <>
              We sent a 6-digit code to <span className="font-semibold text-foreground">{normalized}</span>.
            </>
          )}
        </p>
        <div className="grid gap-2">
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-12 text-center text-2xl tracking-[0.5em] tabular"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "otp-error" : undefined}
            autoFocus
          />
        </div>
        {error && <FormError id="otp-error" message={error} />}
        <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
          {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          Verify and continue
        </Button>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setNormalized(null);
              setCode("");
              setError(null);
            }}
          >
            Use a different number
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending || cooldown > 0}
            onClick={() => {
              setError(null);
              requestCode(normalized);
            }}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendOtp} className="mt-4 grid gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="phone">Mobile number</Label>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm font-medium text-muted-foreground">
            +977
          </span>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="98XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-l-none text-base"
            aria-invalid={Boolean(error)}
            aria-describedby="phone-help"
          />
        </div>
        <p id="phone-help" className="text-xs text-muted-foreground">
          {phoneHelp(smsMode, demoMode)}
        </p>
      </div>
      {error && <FormError message={error} />}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Phone />}
        Send OTP
      </Button>
    </form>
  );
}

function StaffForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(staffSignIn, undefined);
  return (
    <form action={action} className="mt-4 grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="grid gap-2">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <FormError message={state.error} />}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        Sign in
      </Button>
    </form>
  );
}

function DemoAccounts({ accounts, next }: { accounts: DemoAccount[]; next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(demoSignIn, undefined);
  return (
    <div className="mt-6 border-t pt-5">
      <p className="label-caps text-muted-foreground">Hackathon demo accounts</p>
      <form action={action} className="mt-3 grid grid-cols-2 gap-2">
        <input type="hidden" name="next" value={next ?? ""} />
        {accounts.map((a) => (
          <Button
            key={a.key}
            type="submit"
            name="account"
            value={a.key}
            variant="outline"
            disabled={pending}
            className="h-auto flex-col items-start gap-0.5 px-3 py-2.5 text-left"
          >
            <span className="flex items-center gap-1.5 text-sm">
              <UserRound className="size-3.5" aria-hidden />
              {a.label}
            </span>
            <span className="text-[11px] font-normal text-muted-foreground">{a.description}</span>
          </Button>
        ))}
      </form>
      {state?.error && <FormError message={state.error} className="mt-3" />}
    </div>
  );
}

function FormError({ message, className, id }: { message: string; className?: string; id?: string }) {
  return (
    <Alert variant="destructive" className={className} id={id}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function phoneHelp(smsMode: SmsMode, demoMode: boolean): string {
  const demo = demoMode ? " Demo: test number 9800000001 with code 123456 also works." : "";
  if (smsMode === "twilio") return `We will send a one-time code by SMS.${demo}`;
  if (smsMode === "dev-log") {
    return `Development mode: any number works — no SMS is sent, the code is printed in the terminal running "npm run dev".${demo}`;
  }
  return demoMode
    ? "SMS sign-in needs an SMS provider (Twilio) to be configured. Demo: test number 9800000001 with code 123456 (no SMS is sent)."
    : "We will send a one-time code by SMS.";
}
