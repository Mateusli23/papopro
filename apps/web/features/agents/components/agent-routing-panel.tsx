'use client';

import * as React from 'react';

import { toast } from 'react-hot-toast';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@papopro/ui';
import { Plus, X } from '@papopro/ui/icons';

import { ACTIVE_STAGES } from '@/lib/fixtures/pipelines';

import { routeCreateSchema } from '../schemas';
import { addRoute } from '../store';
import { ROUTE_KIND_OPTIONS } from '../transforms';
import type { Agent, RouteKind } from '../types';

import { AgentRouteRow } from './agent-route-row';

/**
 * Painel de roteamento — lista de regras combináveis + form inline pra
 * adicionar nova regra.
 *
 * Decisão de UX:
 *  - "Adicionar regra" abre form inline (não dialog) — é fluxo rápido,
 *    abrir modal pra 2 campos é fricção desnecessária.
 *  - Form usa native `<input>`/`<select>` controlados — sem RHF aqui,
 *    overhead não vale pra 2 campos.
 *  - Match-first explícito num badge no topo: vendedor entende que ordem
 *    importa.
 *  - Pra `kind === 'stage'`, mostra Select com etapas ativas. Pros outros
 *    kinds usa Input livre (tag/keyword/whatsapp_number — strings curtas).
 */

interface AgentRoutingPanelProps {
  agent: Agent;
}

export function AgentRoutingPanel({ agent }: AgentRoutingPanelProps) {
  const [adding, setAdding] = React.useState(false);
  const [kind, setKind] = React.useState<RouteKind>('stage');
  const [value, setValue] = React.useState('');

  function reset() {
    setAdding(false);
    setKind('stage');
    setValue('');
  }

  function handleAdd() {
    const parsed = routeCreateSchema.safeParse({ kind, value });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Valor inválido', { duration: 3000 });
      return;
    }
    addRoute(agent.id, parsed.data);
    toast.success('Regra adicionada — primeiro hit decide o agente.', { duration: 3000 });
    reset();
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-body font-semibold">Quando atender</h3>
          <p className="text-caption text-muted-foreground/80">
            Regras combináveis. <strong>Primeiro hit decide</strong> o agente — ordene de cima pra
            baixo.
          </p>
        </div>
        {agent.routes.length > 0 && (
          <Badge variant="outline" className="text-caption">
            {agent.routes.length} {agent.routes.length === 1 ? 'regra' : 'regras'}
          </Badge>
        )}
      </div>

      {agent.routes.length === 0 ? (
        <p className="text-caption text-muted-foreground italic">
          Nenhuma regra cadastrada. Sem regras o agente não atende ninguém — adicione pelo menos
          uma.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {agent.routes.map((route, idx) => (
            <AgentRouteRow key={route.id} agentId={agent.id} route={route} index={idx} />
          ))}
        </ol>
      )}

      {adding ? (
        <div className="border-border bg-muted/30 flex flex-col gap-3 rounded-md border border-dashed p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
            <div className="flex flex-col gap-1">
              <Label className="text-caption text-muted-foreground font-medium">
                Tipo de regra
              </Label>
              <Select value={kind} onValueChange={(v) => setKind(v as RouteKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUTE_KIND_OPTIONS.map((opt) => (
                    <SelectItem key={opt.kind} value={opt.kind}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-caption text-muted-foreground font-medium">Valor</Label>
              {kind === 'stage' ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVE_STAGES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={
                    kind === 'tag'
                      ? 'ex: imovel-rj'
                      : kind === 'whatsapp_number'
                        ? 'ex: principal'
                        : 'ex: gerente'
                  }
                  autoFocus
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
              <X className="size-3" /> Cancelar
            </Button>
            <Button size="sm" onClick={handleAdd}>
              Adicionar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-fit gap-1">
          <Plus className="size-4" />
          Adicionar regra
        </Button>
      )}
    </Card>
  );
}
