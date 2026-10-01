"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Health = { ok: boolean; ready?: boolean; checks?: Record<string, { ok: boolean; detail: string }> };

const LABEL: Record<string, string> = {
  env: "Environment variables",
  database: "Database",
  seedData: "Demo data",
  demoTeam: "Rescue Team R-03",
  demoAccounts: "Demo accounts",
};

/** Pre-demo readiness checklist backed by /api/health. */
export function SystemCheck() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setHealth((await res.json()) as Health);
    } catch {
      setHealth({ ok: false, checks: { network: { ok: false, detail: "Could not reach the server" } } });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void run(), 0);
    return () => clearTimeout(t);
  }, [run]);

  return (
    <div className="grid gap-2 rounded-xl border bg-card p-4" data-testid="system-check">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">System check</p>
        <Button size="icon-sm" variant="ghost" onClick={run} disabled={loading} aria-label="Run system check again">
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
        </Button>
      </div>
      {!health ? (
        <p className="text-xs text-muted-foreground">Checking…</p>
      ) : (
        <ul className="grid gap-1.5 text-xs">
          {Object.entries(health.checks ?? {}).map(([key, c]) => (
            <li key={key} className="flex gap-2">
              {c.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-safe" aria-label="OK" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" aria-label="Problem" />}
              <span>
                <span className="font-semibold">{LABEL[key] ?? key}</span>
                <span className="block text-muted-foreground">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {health && (
        <p className={health.ready ? "text-xs font-semibold text-safe-ink" : "text-xs font-semibold text-danger-ink"}>
          {health.ready ? "Ready to present" : health.ok ? "Working — fix the items above before presenting" : "Service problem — fix the items above"}
        </p>
      )}
    </div>
  );
}
