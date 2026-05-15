'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'react-hot-toast';

import {
  Badge,
  Button,
  Checkbox,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@papopro/ui';
import { CheckCircle2, FileText, Upload } from '@papopro/ui/icons';

import { importLeadsAction, previewImportAction } from '../actions';
import {
  CSV_FIELDS,
  CSV_IMPORT_MAX_ROWS,
  csvRowSchema,
  type CsvFieldKey,
  type LeadImportRowInput,
} from '../schemas';

/**
 * "Importar CSV" (M8#5) — fluxo em 3 estados na mesma sheet:
 *  1. **Upload**: drop/select de arquivo `.csv`. Parse simples (sem PapaParse).
 *  2. **Mapeamento + preview**: usuário escolhe qual coluna do CSV vira qual campo
 *     do lead. Auto-mapeia por similaridade de header.
 *  3. **Confirmação LGPD**: checkbox obrigatório + summary "X criar / Y skip".
 *     Ao confirmar, chama `importLeadsAction` real (Server Action) que persiste
 *     no DB com round-robin de assignee e activity `lead_created` por linha.
 *
 * **Limite hard:** {@link CSV_IMPORT_MAX_ROWS} linhas. Volumes maiores ficam
 * pra Edge Function em pós-MVP (antivírus quebra dev local Windows).
 */

interface LeadImportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function LeadImportSheet({ open, onOpenChange }: LeadImportSheetProps) {
  const router = useRouter();
  const [parsed, setParsed] = React.useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = React.useState<Record<CsvFieldKey, string>>({
    name: '',
    phone: '',
    email: '',
    company: '',
    origin: '',
  });
  const [consentConfirmed, setConsentConfirmed] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [serverPreview, setServerPreview] = React.useState<{
    duplicates: number;
  } | null>(null);

  React.useEffect(() => {
    if (!open) {
      setParsed(null);
      setMapping({ name: '', phone: '', email: '', company: '', origin: '' });
      setConsentConfirmed(false);
      setSubmitting(false);
      setServerPreview(null);
    }
  }, [open]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) {
        toast.error('CSV vazio — confira o arquivo.');
        return;
      }
      if (lines.length - 1 > CSV_IMPORT_MAX_ROWS) {
        toast.error(`Máximo de ${CSV_IMPORT_MAX_ROWS} linhas por importação — divida o arquivo.`);
        return;
      }
      const headers = parseCsvLine(lines[0] ?? '');
      const rows = lines.slice(1, CSV_IMPORT_MAX_ROWS + 1).map(parseCsvLine);
      setParsed({ headers, rows });
      setMapping(autoMap(headers));
      setServerPreview(null);
    };
    reader.onerror = () => toast.error('Não consegui ler o arquivo.');
    reader.readAsText(file);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Importar leads via CSV</SheetTitle>
          <SheetDescription>
            Suba um arquivo `.csv` com até {CSV_IMPORT_MAX_ROWS} linhas. Volumes maiores são
            divididos em arquivos menores (background import chega em uma onda futura).
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 py-6">
          {!parsed ? (
            <UploadStep onFile={handleFile} />
          ) : (
            <>
              <MappingPreviewStep
                parsed={parsed}
                mapping={mapping}
                onMappingChange={setMapping}
                onReset={() => setParsed(null)}
                serverPreview={serverPreview}
              />

              <ConsentCheckbox
                checked={consentConfirmed}
                onChange={setConsentConfirmed}
                disabled={submitting}
              />
            </>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          {parsed && (
            <ImportConfirmButton
              parsed={parsed}
              mapping={mapping}
              consentConfirmed={consentConfirmed}
              submitting={submitting}
              onPreviewUpdate={setServerPreview}
              onSubmit={async (rows) => {
                setSubmitting(true);
                try {
                  const result = await importLeadsAction({ rows, consentConfirmed: true });
                  if (result.ok) {
                    const { summary } = result;
                    toast.success(
                      `${summary.created} lead(s) importado(s). ${summary.skipped} duplicata(s) ignorada(s).`,
                    );
                    router.refresh();
                    onOpenChange(false);
                  } else {
                    toast.error(result.error);
                  }
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function UploadStep({ onFile }: { onFile: (f: File) => void }) {
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={cn(
        'border-border bg-muted/20 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center',
        drag && 'border-primary bg-primary/5',
      )}
    >
      <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Upload className="size-6" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-body text-foreground font-medium">
          Arraste o CSV aqui ou clique para escolher
        </p>
        <p className="text-caption text-muted-foreground">
          Cabeçalho na primeira linha. Separador: vírgula. UTF-8.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        Escolher arquivo
      </Button>
    </div>
  );
}

interface MappingProps {
  parsed: ParsedCsv;
  mapping: Record<CsvFieldKey, string>;
  onMappingChange: (m: Record<CsvFieldKey, string>) => void;
  onReset: () => void;
  serverPreview: { duplicates: number } | null;
}

function MappingPreviewStep({
  parsed,
  mapping,
  onMappingChange,
  onReset,
  serverPreview,
}: MappingProps) {
  const summary = React.useMemo(() => buildSummary(parsed, mapping), [parsed, mapping]);

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <div className="flex items-center gap-2">
          <FileText className="text-primary size-4" />
          <span className="text-body text-foreground font-medium">
            {parsed.rows.length} linhas detectadas
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Trocar arquivo
        </Button>
      </div>

      <div>
        <p className="text-body text-foreground mb-2 font-medium">Mapeamento de colunas</p>
        <p className="text-caption text-muted-foreground mb-3">
          Escolha qual coluna do seu CSV corresponde a cada campo do lead. Campos com * são
          obrigatórios.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CSV_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <span className="text-caption text-muted-foreground font-medium">
                {f.label}
                {f.required && '*'}
              </span>
              <Select
                value={mapping[f.key]}
                onValueChange={(v) => onMappingChange({ ...mapping, [f.key]: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Não mapear —</SelectItem>
                  {parsed.headers.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-body text-foreground font-medium">Pré-visualização</p>
          <div className="flex items-center gap-2">
            <Badge variant="success">{summary.valid} válidos</Badge>
            {summary.invalid > 0 && <Badge variant="destructive">{summary.invalid} com erro</Badge>}
            {serverPreview && serverPreview.duplicates > 0 && (
              <Badge variant="warning">{serverPreview.duplicates} já cadastrados</Badge>
            )}
          </div>
        </div>
        <p className="text-caption text-muted-foreground mb-2">
          Primeiras 10 linhas — confira antes de importar.
        </p>
        <div className="border-border bg-card max-h-72 overflow-auto rounded-md border">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/40 text-caption text-muted-foreground border-border border-b">
                {CSV_FIELDS.map((f) => (
                  <th key={f.key} className="px-3 py-2 font-medium">
                    {f.label}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.preview.slice(0, 10).map((row, idx) => (
                <tr key={idx} className="border-border text-caption border-b last:border-0">
                  {CSV_FIELDS.map((f) => (
                    <td key={f.key} className="text-foreground truncate px-3 py-1.5">
                      {row.values[f.key] ?? <span className="text-muted-foreground">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-1.5">
                    {row.error ? (
                      <span className="text-destructive">{row.error}</span>
                    ) : (
                      <span className="text-success inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConsentCheckbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="border-warning/40 bg-warning/5 flex cursor-pointer items-start gap-3 rounded-md border p-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={disabled}
        className="mt-0.5"
        aria-label="Consentimento LGPD"
      />
      <span className="text-caption text-foreground">
        <strong>Confirmo que todos esses contatos consentiram</strong> em receber contato comercial
        conforme a LGPD. Sem essa confirmação a importação fica bloqueada.
      </span>
    </label>
  );
}

interface SummaryRow {
  values: Partial<Record<CsvFieldKey, string>>;
  error?: string;
}
interface ImportSummary {
  valid: number;
  invalid: number;
  preview: SummaryRow[];
  validRows: SummaryRow[];
}

function buildSummary(parsed: ParsedCsv, mapping: Record<CsvFieldKey, string>): ImportSummary {
  let valid = 0;
  let invalid = 0;
  const preview: SummaryRow[] = [];
  const validRows: SummaryRow[] = [];

  for (const row of parsed.rows) {
    const values: Partial<Record<CsvFieldKey, string>> = {};
    for (const field of CSV_FIELDS) {
      const colName = mapping[field.key];
      if (!colName || colName === '__none__') continue;
      const idx = parsed.headers.indexOf(colName);
      values[field.key] = idx === -1 ? undefined : row[idx]?.trim();
    }

    const result = csvRowSchema.safeParse(values);
    if (result.success) {
      valid += 1;
      validRows.push({ values });
      preview.push({ values });
    } else {
      invalid += 1;
      preview.push({ values, error: result.error.issues[0]?.message ?? 'Inválido' });
    }
  }

  return { valid, invalid, preview, validRows };
}

interface ImportConfirmProps {
  parsed: ParsedCsv;
  mapping: Record<CsvFieldKey, string>;
  consentConfirmed: boolean;
  submitting: boolean;
  onPreviewUpdate: (preview: { duplicates: number } | null) => void;
  onSubmit: (rows: LeadImportRowInput[]) => Promise<void>;
}

function ImportConfirmButton({
  parsed,
  mapping,
  consentConfirmed,
  submitting,
  onPreviewUpdate,
  onSubmit,
}: ImportConfirmProps) {
  const summary = React.useMemo(() => buildSummary(parsed, mapping), [parsed, mapping]);
  const [previewing, setPreviewing] = React.useState(false);

  const validImportRows = React.useMemo<LeadImportRowInput[]>(
    () =>
      summary.validRows.map((r, idx) => ({
        line: idx + 2, // header é linha 1
        name: r.values.name ?? '',
        phone: r.values.phone ?? '',
        email: r.values.email,
        company: r.values.company,
      })),
    [summary.validRows],
  );

  const disabled = summary.valid === 0 || !consentConfirmed || submitting || previewing;

  async function previewThenSubmit() {
    setPreviewing(true);
    try {
      const preview = await previewImportAction({ rows: validImportRows });
      if (!preview.ok) {
        toast.error(preview.error);
        onPreviewUpdate(null);
        return;
      }
      onPreviewUpdate({ duplicates: preview.summary.willSkip });
    } finally {
      setPreviewing(false);
    }
    await onSubmit(validImportRows);
  }

  return (
    <Button onClick={previewThenSubmit} disabled={disabled}>
      {submitting ? 'Importando…' : `Importar${summary.valid > 0 ? ` (${summary.valid})` : ''}`}
    </Button>
  );
}

// ─── CSV parsing helpers (mínimo viável, sem dep externa) ──────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (ch === ',' && !inQuote) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

function autoMap(headers: string[]): Record<CsvFieldKey, string> {
  const norm = (s: string) => s.toLowerCase().trim();
  const find = (...candidates: string[]) => headers.find((h) => candidates.includes(norm(h))) ?? '';

  return {
    name: find('nome', 'name', 'contato'),
    phone: find('telefone', 'phone', 'celular', 'whatsapp'),
    email: find('email', 'e-mail'),
    company: find('empresa', 'company', 'organização', 'organizacao'),
    origin: find('origem', 'origin', 'source'),
  };
}
