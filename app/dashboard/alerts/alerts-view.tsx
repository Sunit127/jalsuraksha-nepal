"use client";

import { useState, useTransition } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { publishAlert, setAlertActive } from "@/app/dashboard/actions";
import { AlertCard } from "@/components/alerts/alert-card";
import { useOpsData } from "@/components/dashboard/ops-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_SOURCE_LABEL } from "@/lib/demo/scenario";
import type { AlertInput } from "@/lib/validation/schemas";

const CONTROL_CENTRE_SOURCE = "JalSuraksha Emergency Operations Centre";

/**
 * Citizens never see simulated alerts while live data is on, so in live mode
 * an alert from this control centre defaults to Official.
 */
function emptyAlert(dataMode: "live" | "simulation"): AlertInput {
  return {
    title: "",
    description: "",
    severity: "high",
    district: "Chitwan",
    municipality: "Bharatpur Metropolitan City",
    riverBasin: "Narayani",
    source: dataMode === "live" ? CONTROL_CENTRE_SOURCE : DEMO_SOURCE_LABEL,
    sourceType: dataMode === "live" ? "official" : "simulated",
    expiresInHours: 12,
  };
}

export default function AlertsAdminPage() {
  const { alerts, dataMode } = useOpsData();
  const [form, setForm] = useState<AlertInput>(() => emptyAlert(dataMode));
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof AlertInput>(k: K, v: AlertInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const [now] = useState(() => Date.now());
  const isLive = (a: (typeof alerts)[number]) => a.is_active && (!a.expires_at || new Date(a.expires_at).getTime() > now);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await publishAlert(form);
      if (res.ok) {
        toast.success(res.message);
        setForm(emptyAlert(dataMode));
      } else toast.error(res.error);
    });
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[420px_minmax(0,1fr)] lg:p-5">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="size-4" aria-hidden /> Publish alert</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="a-title">Title</Label>
              <Input id="a-title" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={160} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="a-desc">Message to citizens</Label>
              <Textarea id="a-desc" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => set("severity", v as AlertInput["severity"])}>
                  <SelectTrigger aria-label="Severity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">INFO</SelectItem>
                    <SelectItem value="watch">WATCH</SelectItem>
                    <SelectItem value="high">HIGH</SelectItem>
                    <SelectItem value="danger">DANGER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Expires in</Label>
                <Select value={String(form.expiresInHours)} onValueChange={(v) => set("expiresInHours", Number(v))}>
                  <SelectTrigger aria-label="Expiry"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 6, 12, 24, 48, 72].map((h) => <SelectItem key={h} value={String(h)}>{h} hours</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="a-district">District</Label>
                <Input id="a-district" value={form.district ?? ""} onChange={(e) => set("district", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="a-basin">River basin</Label>
                <Input id="a-basin" value={form.riverBasin ?? ""} onChange={(e) => set("riverBasin", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="a-source">Source</Label>
                <Input id="a-source" value={form.source} onChange={(e) => set("source", e.target.value)} required />
              </div>
              <div className="grid gap-1.5">
                <Label>Source type</Label>
                <Select value={form.sourceType} onValueChange={(v) => set("sourceType", v as AlertInput["sourceType"])}>
                  <SelectTrigger aria-label="Source type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simulated">Simulated (demo)</SelectItem>
                    <SelectItem value="official">Official</SelectItem>
                    <SelectItem value="community">Community</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {dataMode === "live" && form.sourceType === "simulated" ? (
              <p role="alert" className="text-xs font-medium text-danger-ink">
                Live data is on: citizens will NOT see a simulated alert. Choose Official or Community.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Official: issued by this control centre, DHM or a government authority. Every citizen with the app
                gets an alarm that rings until they close it.
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Megaphone />} Publish to citizens
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid content-start gap-3">
        <h1 className="text-xl font-bold tracking-tight">Alerts</h1>
        {alerts.map((a) => (
          <div key={a.id} className="grid gap-2">
            <AlertCard alert={a} />
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>{isLive(a) ? "Visible to citizens" : "Not visible (withdrawn or expired)"}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  startTransition(async () => {
                    const res = await setAlertActive(a.id, !a.is_active);
                    if (res.ok) toast.success(res.message);
                    else toast.error(res.error);
                  })
                }
              >
                {a.is_active ? "Withdraw" : "Re-activate"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
