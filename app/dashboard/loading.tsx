import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:p-5" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Skeleton className="h-[420px] rounded-xl lg:h-[640px]" />
        <Skeleton className="h-[420px] rounded-xl lg:h-[640px]" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
