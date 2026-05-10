'use client';

import * as React from 'react';

import { isEditableTarget } from '@/lib/utils/is-editable-target';

import type { Conversation } from '../types';

/**
 * Navegação por teclado da lista de conversas (M5#4c).
 *
 *  - `↑` / `↓` movem a seleção um item — wrap-around (último → primeiro).
 *  - `Home` / `End` saltam pra primeira/última.
 *  - `Enter` / `Space` confirmam a seleção (idêntico a click).
 *  - Eventos só são capturados quando o foco está **dentro do `<ul>`** —
 *    fora disso o usuário pode usar ↑↓ pra scrollar a página normalmente.
 *  - Reusa `isEditableTarget` pra ignorar quando algum input tem foco
 *    (cola visual: alguém clicar no `aria-activedescendant` dum item, abrir
 *    inputs no popover de filtros e voltar pra lista — não dá pra navegar
 *    com inputs ativos).
 *
 * **Auto-scroll**: o item selecionado entra em view via `scrollIntoView`
 * com `block: 'nearest'` — só rola se o item já não estiver visível, evita
 * jumping desnecessário ao trocar entre vizinhos próximos.
 *
 * **Por que não global?** Cada rota teria que registrar/desregistrar via
 * `useGlobalShortcuts`, e ↑↓ é semântica de listbox — pertence ao próprio
 * componente. Hook escopado mantém a inversão certa.
 */
interface UseConversationListKeyboardNavOptions {
  /** Ref do `<ul role="listbox">`. */
  listRef: React.RefObject<HTMLUListElement | null>;
  /** Lista atual (já filtrada, na ordem que o usuário vê). */
  items: Conversation[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function useConversationListKeyboardNav({
  listRef,
  items,
  selectedId,
  onSelect,
}: UseConversationListKeyboardNavOptions) {
  // Refs estáveis pra leitura dentro do listener — evita reattach do
  // addEventListener a cada render (que perderia a posição do scroll
  // intermitentemente em listas grandes).
  const itemsRef = React.useRef(items);
  const selectedIdRef = React.useRef(selectedId);
  const onSelectRef = React.useRef(onSelect);

  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  React.useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  React.useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Track rAF pendente pra cancelar antes de agendar o próximo. Sem isso,
  // teclas ↑↓ rápidas empilham rAFs que executam em ordem — cada um faz
  // `querySelector` com seu `nextItem` capturado, gerando jitter visual ou
  // scrollando pra item errado se a lista re-renderizou no meio. (Fix HIGH
  // do code review M5#4c.)
  const pendingRafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    function handleKeyDown(event: KeyboardEvent) {
      const list = listRef.current;
      if (!list) return;

      // Foco precisa estar **dentro** do listbox — fora, deixa o scroll natural.
      if (!list.contains(document.activeElement) && document.activeElement !== list) {
        return;
      }
      // Não captura quando algum input/select tem foco real (ex: aberto via
      // popover sobre a lista). O `<ul>` em si NÃO é editable target, então
      // este check só dispara quando o foco está num input/textarea/select
      // dentro/sobre a lista — devolve o evento pro componente focado.
      if (isEditableTarget(event.target)) return;

      const items = itemsRef.current;
      if (items.length === 0) return;

      const currentIndex = items.findIndex((c) => c.id === selectedIdRef.current);

      let nextIndex: number | undefined;
      if (event.key === 'ArrowDown') {
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      } else if (event.key === 'ArrowUp') {
        nextIndex =
          currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = items.length - 1;
      } else if (event.key === 'Enter' || event.key === ' ') {
        // Enter/Space ativam o item já marcado como `aria-activedescendant`
        // — comportamento esperado de listbox. Sem item selecionado, no-op.
        if (currentIndex >= 0) {
          event.preventDefault();
          // No-op se a seleção já é a atual; ainda assim chamamos pra
          // suportar "abrir thread" mesmo na conversa já aberta (mobile flow).
          const current = items[currentIndex];
          if (current) onSelectRef.current(current.id);
        }
        return;
      } else {
        return;
      }

      if (nextIndex === undefined) return;
      const nextItem = items[nextIndex];
      if (!nextItem) return;
      if (nextItem.id === selectedIdRef.current) return;

      event.preventDefault();
      onSelectRef.current(nextItem.id);

      // Scroll-into-view do novo item — `block: 'nearest'` evita jumping
      // quando o item já está visível. `requestAnimationFrame` garante que
      // o `aria-activedescendant` já mudou no DOM antes do scroll.
      // Cancelamos rAF pendente: em ↑↓ rápidos, só o último item realmente
      // importa pro scroll final.
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
      }
      pendingRafRef.current = requestAnimationFrame(() => {
        pendingRafRef.current = null;
        const el = list.querySelector<HTMLElement>(`#conv-${nextItem.id}`);
        if (el) {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    }

    list.addEventListener('keydown', handleKeyDown);
    return () => {
      list.removeEventListener('keydown', handleKeyDown);
      // Limpa rAF agendado se desmontar antes de executar — evita
      // `querySelector` num node detached.
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
    };
    // `listRef` é o único dep: refs têm identidade estável, mas declarar
    // explicitamente satisfaz `react-hooks/exhaustive-deps` sem disable.
    // **Atenção**: se algum dia o `<ConversationList>` mudar pra remontar
    // o `<ul>` via render condicional (em vez de toggle CSS `hidden`/`flex`),
    // este hook precisa virar callback ref — o listener fica em node antigo.
    // Hoje (M5#4c) o toggle é CSS-only, então `listRef` resolve.
  }, [listRef]);
}
