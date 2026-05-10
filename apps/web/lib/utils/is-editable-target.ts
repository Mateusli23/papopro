/**
 * Decide se um `EventTarget` é "editável" — campo de texto, contenteditable,
 * select nativo, ou qualquer container marcado com `[data-shortcut-ignore]`.
 *
 * Quando isso retorna `true`, atalhos globais (ex: `n`, `↑↓`, `g + x`) NÃO
 * devem capturar o evento — caso contrário a tecla viraria texto no campo
 * ou colidiria com a navegação interna do componente (Radix Select etc).
 *
 * Reusado pelo `useGlobalShortcuts` e por hooks de teclado escopados como
 * `useConversationListKeyboardNav`. Centralizado aqui pra que qualquer
 * mudança de regra (ex: opt-in para `<button>` específico) entre num lugar só.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.closest('[data-shortcut-ignore]')) return true;
  return false;
}
