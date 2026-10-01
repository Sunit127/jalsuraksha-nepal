"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Large +/− stepper, easy to use with wet or shaking hands. */
export function CounterField({
  id,
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 50,
  invalid,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  invalid?: boolean;
}) {
  const btn =
    "flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border bg-card text-foreground transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-2xl border bg-card p-3", invalid && "border-danger")}>
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-semibold">
          {label}
        </label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btn}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="size-5" aria-hidden />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
          }}
          className="h-12 w-14 rounded-xl border bg-background text-center text-xl font-bold tabular outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
        <button
          type="button"
          className={btn}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
