import { Skeleton } from "@/components/ui/skeleton";

export default function RescueLoading() {
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4" role="status" aria-label="Loading">
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
