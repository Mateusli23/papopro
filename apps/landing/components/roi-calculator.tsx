'use client';

import * as React from 'react';

import { Card, CardContent, Label } from '@papopro/ui';
import { Calculator, TrendingUp } from '@papopro/ui/icons';

import { formatBRL } from '@/lib/format';
import { estimateRecoveredRevenue, RECOVERY_RATE } from '@/lib/roi';

/**
 * Calculadora de ROI. Dois inputs (leads/mês e ticket médio) e um output
 * derivado em tempo real: receita estimada recuperada/mês = leads × ticket
 * × 0.15 (constante `RECOVERY_RATE` validada pelo PO).
 *
 * Decisões de UX:
 *  - Inputs numéricos crus (sem máscara) — máscaras de moeda em landing
 *    geralmente atrapalham na primeira digitação. Adicionamos sufixo visual
 *    ("R$" antes do ticket) pra dar contexto sem bloquear o input.
 *  - Defaults plausíveis pra que o output já mostre algo no primeiro render
 *    (50 leads × R$ 5.000 = R$ 37.500 recuperados/mês). Vendedor experiente
 *    olha e pensa "esse número faz sentido pro meu nicho".
 *  - Output em Card com cor primary + ícone trending — visualmente "à
 *    frente" dos inputs, deixando claro qual é a saída.
 *  - Sub-copy honesta: "cálculo conservador, depende da configuração" —
 *    importante pra não soar de marketeiro inflado.
 *
 * `'use client'` porque o componente reage à digitação. Server Component não
 * conseguiria atualizar o output sem ida ao servidor.
 */

const DEFAULT_LEADS = 50;
const DEFAULT_TICKET = 5000;
/** Trava o ticket em 1 milhão pra evitar números absurdos no display. */
const MAX_TICKET = 1_000_000;

export function RoiCalculator() {
  const [leadsMes, setLeadsMes] = React.useState(DEFAULT_LEADS);
  const [ticketMedio, setTicketMedio] = React.useState(DEFAULT_TICKET);

  const recovered = estimateRecoveredRevenue(leadsMes, ticketMedio);
  const recoveredYear = recovered * 12;

  return (
    <section id="roi" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="bg-primary/10 text-primary mx-auto inline-flex size-12 items-center justify-center rounded-full">
            <Calculator className="size-6" />
          </div>
          <h2 className="text-foreground mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Quanto você <span className="text-primary">deixa de faturar</span> sem cadência
            automática?
          </h2>
          <p className="text-muted-foreground text-body-lg mt-4">
            Use a calculadora abaixo. A estimativa multiplica seus leads pelo ticket médio e assume
            que o PapoPro recupera ~{Math.round(RECOVERY_RATE * 100)}% dos leads que hoje esfriam
            sem follow-up.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col gap-6 p-6 md:p-8">
              <div className="flex flex-col gap-2">
                <Label htmlFor="roi-leads" className="text-foreground text-body font-semibold">
                  Leads novos por mês
                </Label>
                <input
                  id="roi-leads"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={Number.isFinite(leadsMes) ? leadsMes : ''}
                  onChange={(e) => setLeadsMes(parseInt(e.target.value || '0', 10))}
                  className="border-input bg-background text-foreground focus-visible:ring-ring h-12 w-full rounded-md border px-4 text-2xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                />
                <p className="text-muted-foreground text-caption">
                  Inclua todos os contatos comerciais — Meta Ads, indicação, site, eventos.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="roi-ticket" className="text-foreground text-body font-semibold">
                  Ticket médio por venda
                </Label>
                <div className="relative">
                  <span className="text-muted-foreground text-body-lg pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-medium">
                    R$
                  </span>
                  <input
                    id="roi-ticket"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_TICKET}
                    step={100}
                    value={Number.isFinite(ticketMedio) ? ticketMedio : ''}
                    onChange={(e) =>
                      setTicketMedio(Math.min(MAX_TICKET, parseInt(e.target.value || '0', 10)))
                    }
                    className="border-input bg-background text-foreground focus-visible:ring-ring h-12 w-full rounded-md border pl-12 pr-4 text-2xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  />
                </div>
                <p className="text-muted-foreground text-caption">
                  Valor médio de cada negócio fechado. Use o valor real, não o teto.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Output em Card primário pra ficar visualmente "à frente" dos inputs. */}
          <Card className="bg-primary text-primary-foreground border-primary relative overflow-hidden">
            <CardContent className="flex h-full flex-col justify-between gap-6 p-6 md:p-8">
              <div className="flex items-center gap-2">
                <div className="bg-primary-foreground/15 text-primary-foreground rounded-full p-2">
                  <TrendingUp className="size-5" />
                </div>
                <span className="text-primary-foreground/90 text-body font-medium">
                  Receita estimada recuperada
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-primary-foreground/80 text-caption font-medium uppercase tracking-wide">
                  Por mês
                </p>
                <p className="text-4xl font-bold tracking-tight md:text-5xl">
                  {formatBRL(recovered)}
                </p>
                <p className="text-primary-foreground/70 text-caption">
                  Equivalente a {formatBRL(recoveredYear)} ao ano.
                </p>
              </div>

              <p className="text-primary-foreground/80 border-primary-foreground/20 text-caption border-t pt-4 leading-relaxed">
                Cálculo conservador (~{Math.round(RECOVERY_RATE * 100)}% de recuperação). Resultado
                real depende da configuração da cadência, do nicho e do engajamento do time.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
