'use client';

import * as React from 'react';

import * as AccordionPrimitive from '@radix-ui/react-accordion';

import { ChevronDown } from '../icons';
import { cn } from '../utils/cn';

/**
 * Accordion (Radix). Usado primariamente em FAQ da landing, mas serve para
 * qualquer lista expansível. As keyframes `accordion-down`/`accordion-up`
 * já estão no preset Tailwind (`packages/config/tailwind.preset.ts`),
 * então o componente funciona sem config adicional.
 *
 * Padrão de uso:
 *   <Accordion type="single" collapsible>
 *     <AccordionItem value="item-1">
 *       <AccordionTrigger>Pergunta?</AccordionTrigger>
 *       <AccordionContent>Resposta.</AccordionContent>
 *     </AccordionItem>
 *   </Accordion>
 */
export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(function AccordionItem({ className, ...props }, ref) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn('border-border border-b', className)}
      {...props}
    />
  );
});

export const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(function AccordionTrigger({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'text-foreground text-body-lg flex flex-1 items-center justify-between gap-4 py-4 text-left font-medium',
          'hover:text-primary transition-all',
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          '[&[data-state=open]>svg]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden
          className="text-muted-foreground size-4 shrink-0 transition-transform duration-200"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});

export const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(function AccordionContent({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className={cn(
        'text-muted-foreground text-body overflow-hidden',
        'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
      )}
      {...props}
    >
      <div className={cn('pb-4 pt-0', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
});
