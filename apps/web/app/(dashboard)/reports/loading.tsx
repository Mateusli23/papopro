import { Skeleton } from '@papopro/ui';

export default function ReportsLoading() {
  return (
    <div
      className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
      role="status"
      aria-busy
      aria-label="Carregando relatórios"
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* KPI cards: 2 cols mobile, 5 cols md+ (per PLAN.md M5p#1) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border bg-card flex flex-col gap-2 rounded-lg border p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Funil + donut */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mx-auto size-48 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>

      {/* Tabela performance por vendedor */}
      <div className="border-border bg-card flex flex-col overflow-hidden rounded-lg border">
        <div className="border-border bg-muted/40 border-b px-4 py-3">
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="divide-border divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="hidden h-4 w-20 sm:block" />
              <Skeleton className="hidden h-4 w-16 md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
