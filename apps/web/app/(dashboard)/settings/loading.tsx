import { Skeleton } from '@papopro/ui';

/**
 * Fallback de loading pra TODAS as sub-rotas de `/settings`. Next 14 aplica
 * o `loading.tsx` do pai quando o filho não tem o seu — economiza 7+
 * arquivos quase idênticos (workspace, team, billing, notifications,
 * connections, integrations, security, app).
 *
 * Shape genérico: header de página + 2 cards de seção. As sub-rotas variam
 * em densidade mas todas começam com esse padrão.
 */
export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy aria-label="Carregando ajustes">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4 sm:p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-72" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4 sm:p-6">
        <Skeleton className="h-5 w-44" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
