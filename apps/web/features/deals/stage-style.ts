/**
 * Mapa central de estilos por etapa do funil — usado pelo header da
 * coluna (stripe + tom de fundo) e pelo card (stripe lateral).
 *
 * Princípio (CLAUDE.md §8): cada etapa ganha uma identidade visual
 * cromática consistente, mas todas dentro do design system — nada de hex
 * solto. As cores usam tons sutis (`/15`, `/20`) pra não sobrecarregar a
 * tela de cards.
 *
 * Mapeamento intencional:
 *  - Novo → info (azul claro): "fresco, ainda esfriando"
 *  - Em contato → primary (azul marca): "ativo, em conversa"
 *  - Proposta → accent (amarelo decorativo): "documento na mesa"
 *  - Negociação → warning (mostarda): "atenção, momento crítico"
 *  - Ganho → success (verde): "fechado"
 *  - Perdido → destructive (vermelho): "encerrado"
 */
export interface StageStyle {
  /** Stripe sólida no topo da coluna (4px). */
  stripe: string;
  /** Background sutil do header da coluna. */
  headerBg: string;
  /** Cor do texto/ícone no header. */
  headerText: string;
  /** Stripe lateral do card (3px). */
  cardStripe: string;
  /** Tinge sutil do fundo da coluna inteira (terminais usam /5). */
  columnTint?: string;
}

export const STAGE_STYLE: Record<string, StageStyle> = {
  novo: {
    stripe: 'bg-info',
    headerBg: 'bg-info/5',
    headerText: 'text-info',
    cardStripe: 'bg-info',
  },
  em_contato: {
    stripe: 'bg-primary',
    headerBg: 'bg-primary/5',
    headerText: 'text-primary',
    cardStripe: 'bg-primary',
  },
  proposta: {
    stripe: 'bg-accent',
    headerBg: 'bg-accent/10',
    headerText: 'text-foreground',
    cardStripe: 'bg-accent',
  },
  negociacao: {
    stripe: 'bg-warning',
    headerBg: 'bg-warning/10',
    headerText: 'text-warning',
    cardStripe: 'bg-warning',
  },
  ganho: {
    stripe: 'bg-success',
    headerBg: 'bg-success/10',
    headerText: 'text-success',
    cardStripe: 'bg-success',
    columnTint: 'bg-success/5',
  },
  perdido: {
    stripe: 'bg-destructive',
    headerBg: 'bg-destructive/10',
    headerText: 'text-destructive',
    cardStripe: 'bg-destructive',
    columnTint: 'bg-destructive/5',
  },
};

export function getStageStyle(stageId: string): StageStyle {
  return (
    STAGE_STYLE[stageId] ?? {
      stripe: 'bg-muted-foreground',
      headerBg: 'bg-muted',
      headerText: 'text-foreground',
      cardStripe: 'bg-muted-foreground',
    }
  );
}
