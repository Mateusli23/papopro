/**
 * Shim de retrocompat — `AutoResizeTextarea` foi promovido pra `@papopro/ui`
 * em M5#5 quando ganhou um segundo consumer (chat de simulação do editor de
 * Agentes IA). Imports antigos do composer continuam funcionando via este
 * re-export. Em uma limpeza futura podemos remover este arquivo + atualizar
 * o composer pra importar direto de `@papopro/ui`.
 */
export { AutoResizeTextarea, type AutoResizeTextareaProps } from '@papopro/ui';
