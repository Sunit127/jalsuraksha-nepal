import { LogoMark } from "@/components/shared/logo";

/** Shown while a workspace layout loads its initial data. */
export default function RootLoading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background" role="status" aria-live="polite">
      <LogoMark className="size-10 animate-pulse" />
      <p className="text-sm text-muted-foreground">Loading JalSuraksha…</p>
    </div>
  );
}
