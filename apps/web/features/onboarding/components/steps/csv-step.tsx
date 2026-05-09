'use client';

import * as React from 'react';

import { Badge, Button, cn } from '@papopro/ui';
import { CheckCircle2, FileText, Loader2, Upload } from '@papopro/ui/icons';

interface CsvStepProps {
  imported: boolean;
  onChange: (imported: boolean) => void;
}

/**
 * Passo 4 — importar CSV (mock visual).
 *
 * Comportamento:
 *  - Caixa drag-and-drop visual (sem D&D real, só estilo).
 *  - `<input type="file" accept=".csv">` escondido; o botão dispara click().
 *  - Selecionar arquivo → 600ms de "processando" → preview de 3 linhas
 *    hardcoded mostrando a inferência de colunas (nome, telefone, email).
 *  - Em M4/M8 isso vira parser real (`papaparse` ou similar) + Server Action
 *    que cria leads com round-robin de atribuição.
 *
 * Nota sobre nome do arquivo: guardamos só o nome (não o conteúdo) — o
 * objetivo é dar feedback visual de que "deu certo", não persistir nada.
 */
export function CsvStep({ imported, onChange }: CsvStepProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [filename, setFilename] = React.useState<string | null>(null);

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setProcessing(true);
    window.setTimeout(() => {
      setProcessing(false);
      onChange(true);
    }, 600);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-foreground text-title font-semibold">Importe seus leads</h3>
        <p className="text-muted-foreground text-body">
          Tem uma planilha de leads em CSV? Envie aqui pra começar com seu funil cheio. Você pode
          fazer isso depois também — em <strong>Leads → Importar CSV</strong>.
        </p>
      </div>

      {!imported ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className={cn(
            'border-border bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 transition-colors',
            'hover:border-primary/50 hover:bg-primary/5',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
            processing && 'pointer-events-none opacity-70',
          )}
        >
          {processing ? (
            <>
              <Loader2 className="text-primary size-6 animate-spin" />
              <span className="text-foreground text-body font-medium">Processando {filename}…</span>
              <span className="text-muted-foreground text-caption">
                Identificando colunas e validando linhas
              </span>
            </>
          ) : (
            <>
              <Upload className="text-muted-foreground size-6" />
              <span className="text-foreground text-body font-medium">
                Arraste seu CSV aqui ou clique pra selecionar
              </span>
              <span className="text-muted-foreground text-caption">
                Aceitamos .csv até 10 MB · até 1.000 linhas no plano Pro
              </span>
            </>
          )}
        </button>
      ) : (
        <PreviewTable filename={filename} onReset={() => onChange(false)} />
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleFileSelected}
      />
    </div>
  );
}

/**
 * Tabela de preview com 3 linhas fixas. Em M8 a importação real mostra
 * preview do próprio CSV (até 5 primeiras linhas) + mapeamento de colunas.
 */
function PreviewTable({ filename, onReset }: { filename: string | null; onReset: () => void }) {
  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-success/15 text-success flex size-8 items-center justify-center rounded-full">
            <CheckCircle2 className="size-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-foreground text-body font-medium">{filename ?? 'leads.csv'}</span>
            <span className="text-muted-foreground text-caption flex items-center gap-1">
              <FileText className="size-3" />
              42 linhas · 3 colunas detectadas
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Trocar arquivo
        </Button>
      </div>

      <div className="border-border overflow-hidden rounded-md border">
        <table className="w-full text-left">
          <thead className="bg-muted/40 text-muted-foreground text-caption">
            <tr>
              <th className="px-3 py-2 font-semibold uppercase tracking-wide">Nome</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wide">Telefone</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wide">Email</th>
            </tr>
          </thead>
          <tbody className="divide-border text-body text-foreground divide-y">
            <tr>
              <td className="px-3 py-2">Mariana Costa</td>
              <td className="px-3 py-2">+55 11 9 9876-5432</td>
              <td className="px-3 py-2">mariana@empresa.com</td>
            </tr>
            <tr>
              <td className="px-3 py-2">João Silva</td>
              <td className="px-3 py-2">+55 21 9 1234-5678</td>
              <td className="px-3 py-2">joao.silva@b2b.com</td>
            </tr>
            <tr>
              <td className="px-3 py-2">Luiza Mendes</td>
              <td className="px-3 py-2">+55 31 9 8765-4321</td>
              <td className="px-3 py-2">luiza@imovelpro.com.br</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Badge variant="secondary" className="self-start">
        Mock M3 · importação real em M8
      </Badge>
    </div>
  );
}
