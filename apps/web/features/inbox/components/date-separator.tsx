import { cn } from '@papopro/ui';

/**
 * Divisor de dia na thread — chip centralizado com label "Hoje"/"Ontem"/data.
 * Análogo ao WhatsApp/Telegram, dá referência temporal sem mostrar timestamp
 * em cada mensagem.
 */
interface DateSeparatorProps {
  label: string;
  className?: string;
}

export function DateSeparator({ label, className }: DateSeparatorProps) {
  return (
    <div className={cn('flex items-center justify-center py-2', className)}>
      <span className="bg-muted text-caption text-muted-foreground rounded-full px-3 py-1 font-medium">
        {label}
      </span>
    </div>
  );
}
