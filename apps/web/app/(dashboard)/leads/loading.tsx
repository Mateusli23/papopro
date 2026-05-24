import { Skeleton } from '@papopro/ui';

export default function LeadsLoading() {
  return (
    <div
      className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
      role="status"
      aria-busy
      aria-label="Carregando leads"
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-full sm:max-w-md" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Desktop table */}
      <div className="border-border bg-card hidden flex-col overflow-hidden rounded-lg border md:flex">
        <div className="border-border bg-muted/40 border-b px-4 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-border divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-20 lg:block" />
              <Skeleton className="hidden h-4 w-24 lg:block" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border bg-card flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
