import { Skeleton } from '@papopro/ui';

export default function KanbanLoading() {
  return (
    <div
      className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
      role="status"
      aria-busy
      aria-label="Carregando pipeline"
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      {/* Pipeline stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-border bg-card flex flex-col gap-2 rounded-lg border p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Kanban board: 6 colunas horizontais com scroll-x (mantém o shape mobile) */}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border-border bg-muted/40 flex h-[480px] w-[300px] shrink-0 flex-col gap-2 rounded-xl border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <Skeleton className="h-3 w-32" />
            <div className="mt-2 flex flex-col gap-2">
              {Array.from({ length: 3 }).map((__, j) => (
                <div
                  key={j}
                  className="bg-background border-border flex flex-col gap-2 rounded-lg border p-3"
                >
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
