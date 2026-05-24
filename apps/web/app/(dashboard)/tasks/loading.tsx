import { Skeleton } from '@papopro/ui';

export default function TasksLoading() {
  return (
    <div
      className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
      role="status"
      aria-busy
      aria-label="Carregando tarefas"
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Task list */}
      <div className="border-border bg-card flex flex-col overflow-hidden rounded-lg border">
        <div className="divide-border divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="size-5 shrink-0 rounded" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/5" />
                <div className="flex gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="hidden h-4 w-20 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
