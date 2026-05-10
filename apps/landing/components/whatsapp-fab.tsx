import { MessageCircle } from '@papopro/ui/icons';

/**
 * Botão flutuante de WhatsApp. Posição `fixed bottom-6 right-6` por padrão
 * (canto inferior direito) — mesma posição do Toaster, mas o toast tem
 * duração curta e aparece por cima sem conflito visual.
 *
 * **Server Component** porque é só um link estático que depende de uma
 * variável de ambiente lida em build time. Quando
 * `NEXT_PUBLIC_WHATSAPP_NUMBER` não está setada (dev sem .env.local ou
 * preview onde o número ainda não foi definido), o componente retorna
 * `null` — preferimos esconder o FAB a mostrar um botão que não funciona.
 *
 * Mantemos hidden em telas < 360px via `hidden xs:flex` (não temos `xs`
 * breakpoint custom, então a regra fica como `flex` sem condicional —
 * mobile pequeno ainda mostra; se precisar esconder em mobile minúsculo,
 * adicionar breakpoint custom no preset).
 *
 * Acessibilidade:
 *  - `aria-label` em pt-BR explica o que acontece quando clica
 *  - `target="_blank" rel="noopener noreferrer"` pra segurança
 *  - foco visível pelo `:focus-visible` global do `globals.css`
 */
export function WhatsAppFab() {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim();
  if (!phone) return null;

  const text = encodeURIComponent('Oi! Vim da landing do PapoPro e queria tirar uma dúvida.');
  const href = `https://wa.me/${phone}?text=${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a gente no WhatsApp"
      className="bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-ring fixed bottom-6 right-6 z-30 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:size-16"
    >
      <MessageCircle className="size-6 md:size-7" aria-hidden />
    </a>
  );
}
