import { Skeleton } from "@/components/ui/skeleton";

export default function CitizenLoading() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading">
      <Skeleton className="h-9 rounded-xl" />
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid gap-3">
        <Skeleton className="h-18 rounded-2xl" />
        <Skeleton className="h-18 rounded-2xl" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
