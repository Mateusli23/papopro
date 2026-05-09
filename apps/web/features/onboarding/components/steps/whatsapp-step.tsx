'use client';

import * as React from 'react';

import { Badge, Button, Skeleton, StatusDot } from '@papopro/ui';
import { CheckCircle2, Smartphone } from '@papopro/ui/icons';

interface WhatsappStepProps {
  connected: boolean;
  onChange: (connected: boolean) => void;
}

/**
 * Passo 2 — conecta o WhatsApp por QR Code.
 *
 * Em M3 (mock): renderiza um placeholder visual de QR (SVG estático com
 * pattern de "código"), simula 1.4s de "carregando" no primeiro render e
 * oferece um botão "Já está conectado" que marca `connected: true` para
 * fins do wizard. Não chama nenhuma API.
 *
 * Em M9 isso vira: `generateQR()` do uazapi adapter → polling de status
 * via Realtime; quando status === 'connected', avança automaticamente.
 *
 * Decisão de UI: usar `Skeleton` durante o "loading" não faz sentido — ali
 * já mostramos o QR. O loading é só pra dar a sensação de "carregando" da
 * primeira vez. Em M9 esse delay vira polling real.
 */
export function WhatsappStep({ connected, onChange }: WhatsappStepProps) {
  const [generating, setGenerating] = React.useState(true);

  // Simula latência de geração do QR só uma vez no mount.
  React.useEffect(() => {
    const id = window.setTimeout(() => setGenerating(false), 1400);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex flex-col gap-3 md:w-1/2">
        <h3 className="text-foreground text-title font-semibold">Conecte seu WhatsApp Business</h3>
        <ol className="text-muted-foreground text-body flex flex-col gap-2">
          <li className="flex gap-2">
            <span className="bg-primary/10 text-primary text-caption flex size-6 shrink-0 items-center justify-center rounded-full font-bold">
              1
            </span>
            Abra o WhatsApp no celular
          </li>
          <li className="flex gap-2">
            <span className="bg-primary/10 text-primary text-caption flex size-6 shrink-0 items-center justify-center rounded-full font-bold">
              2
            </span>
            Toque em <strong>Aparelhos conectados</strong> em Configurações
          </li>
          <li className="flex gap-2">
            <span className="bg-primary/10 text-primary text-caption flex size-6 shrink-0 items-center justify-center rounded-full font-bold">
              3
            </span>
            Aponte a câmera para o código ao lado
          </li>
        </ol>
        {connected ? (
          <div className="bg-success/10 text-success flex items-center gap-2 rounded-md p-3">
            <CheckCircle2 className="size-4" />
            <span className="text-body font-medium">Conectado · pronto pra continuar.</span>
          </div>
        ) : (
          <div className="border-border bg-muted/30 flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2">
              <StatusDot tone={generating ? 'idle' : 'neutral'} pulse={generating} />
              <span className="text-muted-foreground text-body">
                {generating ? 'Gerando QR Code…' : 'Aguardando leitura'}
              </span>
            </div>
            <Badge variant="secondary">
              <Smartphone className="size-3" />
              Mock M3
            </Badge>
          </div>
        )}
        <Button
          variant={connected ? 'outline' : 'default'}
          size="sm"
          onClick={() => onChange(!connected)}
          className="self-start"
        >
          {connected ? 'Desconectar (mock)' : 'Já está conectado'}
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center">
        {generating ? (
          <Skeleton className="aspect-square w-56 rounded-lg" />
        ) : (
          <FakeQrCode connected={connected} />
        )}
      </div>
    </div>
  );
}

/**
 * QR placeholder em SVG. Usa `currentColor` pra herdar do tema; em dark mode
 * vira branco-ish, em light fica navy.
 *
 * Quando `connected=true`, renderiza um overlay com check verde sobre o QR
 * — sinal visual que casa com a mensagem de sucesso da coluna esquerda.
 */
function FakeQrCode({ connected }: { connected: boolean }) {
  // Padrão fixo (não-aleatório) pra evitar hydration mismatch entre SSR e
  // client. O wizard é client-only, mas mantemos determinístico mesmo assim.
  const cells = [
    [1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0],
    [1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0],
    [0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1],
    [1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0],
    [0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 1, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 0],
    [1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1],
  ];

  return (
    <div className="border-border bg-background relative aspect-square w-56 rounded-lg border p-3 shadow-sm">
      <svg
        viewBox="0 0 17 17"
        className="text-foreground size-full"
        aria-label="QR Code de exemplo"
        role="img"
      >
        {cells.map((row, y) =>
          row.map((cell, x) =>
            cell ? (
              <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
            ) : null,
          ),
        )}
      </svg>
      {connected && (
        <div
          aria-hidden
          className="bg-background/85 absolute inset-0 flex items-center justify-center rounded-lg backdrop-blur-sm"
        >
          <span className="bg-success text-success-foreground flex size-12 items-center justify-center rounded-full">
            <CheckCircle2 className="size-6" />
          </span>
        </div>
      )}
    </div>
  );
}
