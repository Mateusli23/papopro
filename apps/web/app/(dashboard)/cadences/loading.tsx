import { Skeleton } from '@papopro/ui';

export default function CadencesLoading() {
  return (
    <div
      className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
      role="status"
      aria-busy
      aria-label="Carregando cadências"
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      {/* Lista agrupada por etapa */}
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }).map((_, group) => (
          <div key={group} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((__, i) => (
                <div
                  key={i}
                  className="border-border bg-card flex flex-col gap-2 rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
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
