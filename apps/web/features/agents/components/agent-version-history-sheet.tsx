'use client';

import * as React from 'react';

import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  cn,
} from '@papopro/ui';
import { History, RotateCcw } from '@papopro/ui/icons';

import { showUndoableToast } from '@/lib/utils/show-undoable-toast';

import { restoreAgentVersionAction } from '../actions';
import type { Agent, AgentVersion } from '../types';

/**
 * Sheet lateral com timeline de versões do agente.
 *
 * Visual: lista vertical do mais novo (atual) pro mais antigo. Cada item
 * mostra `v{n}`, autor, timestamp relativo + absoluto BRT (tooltip via title),
 * preview do prompt em 1 linha, e botão "Restaurar" se não for a atual.
 *
 * Restaurar substitui o draft pelo trio da versão escolhida e mostra toast
 * com Desfazer 5s. **NÃO cria versão nova ao restaurar** — paridade com
 * decisão do plano (evita explosão).
 *
 * Hidratação: `formatDistanceToNow` é client-only — usamos `useEffect` pra
 * setar a string só no cliente, evitando hydration mismatch (mesma
 * estratégia da timeline de Cadências, lição da review M5#3).
 */

interface AgentVersionHistorySheetProps {
  agent: Agent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentVersionHistorySheet({
  agent,
  open,
  onOpenChange,
}: AgentVersionHistorySheetProps) {
  // Rastreia toasts de undo emitidos por esse agente — descarta no unmount
  // (review HIGH M5#5: usuário podia restaurar v2, navegar pra outro agente
  // antes dos 5s e clicar Desfazer afetando o agente errado pelo closure
  // capturado).
  const undoToastIdsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    return () => {
      for (const id of undoToastIdsRef.current) {
        toast.dismiss(id);
      }
      undoToastIdsRef.current = [];
    };
    // Re-monta quando muda o agente — agent.id é a fonte de "qual contexto"
    // o toast pertence. Trocar de /agents/A pra /agents/B remonta o
    // componente (Next route segment), executando este cleanup primeiro.
  }, [agent.id]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:!max-w-md sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="size-5" />
            Histórico de versões
          </SheetTitle>
          <SheetDescription>
            {agent.versions.length === 1
              ? 'Esta é a primeira versão. Edite o prompt e clique em "Salvar versão" pra começar o histórico.'
              : `${agent.versions.length} versões registradas. Restaurar substitui o prompt e a persona pelos valores da versão escolhida.`}
          </SheetDescription>
        </SheetHeader>

        <ol className="flex flex-col gap-3 overflow-y-auto pr-1">
          {agent.versions.map((version, idx) => (
            <VersionItem
              key={version.id}
              version={version}
              isCurrent={version.id === agent.currentVersionId}
              isLatest={idx === 0}
              onRestore={async () => {
                // Capturamos a versão que estava ativa **antes** do restore
                // pra que o undo volte exatamente pra ela. Sem essa captura,
                // se o user clicar 2 restores rápidos, o undo do segundo
                // poderia voltar pro primeiro restaurado em vez do original.
                const previousVersionId = agent.currentVersionId;
                const agentId = agent.id;
                const result = await restoreAgentVersionAction(agentId, version.id);
                if (!result.ok) return;
                onOpenChange(false);
                const id = showUndoableToast(
                  <span>
                    Versão <strong>v{version.versionNumber}</strong> restaurada
                  </span>,
                  () => {
                    void restoreAgentVersionAction(agentId, previousVersionId);
                  },
                );
                undoToastIdsRef.current.push(id);
              }}
            />
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}

interface VersionItemProps {
  version: AgentVersion;
  isCurrent: boolean;
  isLatest: boolean;
  onRestore: () => void;
}

function VersionItem({ version, isCurrent, isLatest, onRestore }: VersionItemProps) {
  // Timestamps relativos só no cliente — evita hydration mismatch.
  const [relativeTime, setRelativeTime] = React.useState<string>('');

  React.useEffect(() => {
    setRelativeTime(
      formatDistanceToNow(parseISO(version.createdAt), { addSuffix: true, locale: ptBR }),
    );
  }, [version.createdAt]);

  const absoluteTime = format(parseISO(version.createdAt), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  return (
    <li
      className={cn(
        'border-border bg-card flex flex-col gap-2 rounded-md border p-3',
        isCurrent && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-body font-semibold tabular-nums">
            v{version.versionNumber}
          </span>
          {isCurrent && (
            <Badge variant="success" className="text-caption">
              Atual
            </Badge>
          )}
          {isLatest && !isCurrent && (
            <Badge variant="outline" className="text-caption">
              Mais recente
            </Badge>
          )}
        </div>

        {!isCurrent && (
          <Button variant="outline" size="sm" onClick={onRestore} className="text-caption gap-1">
            <RotateCcw className="size-3" />
            Restaurar
          </Button>
        )}
      </div>

      <div className="text-caption text-muted-foreground/80 flex flex-wrap items-center gap-x-2">
        <span>por {version.createdBy}</span>
        <span aria-hidden>·</span>
        <time dateTime={version.createdAt} title={absoluteTime}>
          {relativeTime || absoluteTime}
        </time>
      </div>

      {version.notes && <p className="text-caption text-foreground italic">{version.notes}</p>}

      <p className="text-caption text-muted-foreground line-clamp-2">{version.prompt}</p>
    </li>
  );
}
