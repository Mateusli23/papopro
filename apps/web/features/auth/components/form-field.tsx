'use client';

import * as React from 'react';

import { cn, Input, Label, type InputProps } from '@papopro/ui';

interface FormFieldProps extends Omit<InputProps, 'id'> {
  /** Label visível acima do campo. */
  label: string;
  /**
   * Mensagem de erro vinda do `formState.errors.<name>?.message`. Quando
   * presente, vermelha o campo e linka via `aria-describedby`.
   */
  error?: string;
  /** Texto auxiliar abaixo do campo (ex: "Mínimo 8 caracteres"). */
  hint?: string;
  /** Necessário para `htmlFor` + `aria-describedby`. */
  id: string;
}

/**
 * Composição mínima Label + Input + erro/hint para os formulários de auth e
 * onboarding. Mantém a marcação acessível (label clicável, `aria-invalid`,
 * `aria-describedby`) sem trazer toda a maquinaria de `<Form>` do shadcn —
 * para 2 ou 3 campos por tela, este componente economiza repetição sem
 * adicionar abstração desproporcional.
 *
 * Quando o número de formulários crescer (M5 traz inbox, agentes, cadências),
 * vale promover para `@papopro/ui` com integração nativa ao React Hook Form.
 */
export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, hint, id, className, ...inputProps },
  ref,
) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const describedBy = errorId ?? hintId;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="text-caption text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
