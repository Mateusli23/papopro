import { Skeleton } from '@papopro/ui';

export default function InboxLoading() {
  return (
    <div
      className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[320px_1fr_360px]"
      role="status"
      aria-busy
      aria-label="Carregando caixa de mensagens"
    >
      {/* Painel 1: lista de conversas */}
      <div className="border-border flex flex-col gap-2 border-r p-3">
        <Skeleton className="h-9 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-16" />
        </div>
        <div className="mt-2 flex flex-col gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-2">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Painel 2: thread */}
      <div className="hidden flex-col lg:flex">
        <div className="border-border flex items-center justify-between gap-3 border-b p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
          <Skeleton className="h-12 w-2/3 self-start rounded-lg" />
          <Skeleton className="h-16 w-2/3 self-end rounded-lg" />
          <Skeleton className="h-10 w-1/2 self-start rounded-lg" />
          <Skeleton className="h-20 w-2/3 self-end rounded-lg" />
        </div>
        <div className="border-border border-t p-3">
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Painel 3: ficha do lead — desktop only */}
      <div className="border-border hidden flex-col gap-3 border-l p-4 lg:flex">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-40" />
        <div className="mt-2 flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}
