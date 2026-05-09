import * as React from 'react';

import { cn } from '../utils/cn';

/**
 * Label primitivo. Reaproveita o `<label>` nativo (associação com `htmlFor` é
 * responsabilidade do consumidor) com estilos coesos para formulários.
 *
 * Sem dependência de Radix `react-label` propositalmente — para acessibilidade
 * de form básico o `<label>` nativo já é suficiente, e cada Radix novo é mais
 * uma dep para manter alinhada com o resto do design system.
 */
export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn(
        'text-body text-foreground font-medium leading-none',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
});
