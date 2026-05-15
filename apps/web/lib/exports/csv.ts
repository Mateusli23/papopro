/**
 * CSV writer puro (M8#7).
 *
 * Implementação RFC 4180 mínima — sem dep externa. Inspirado em
 * `apps/web/features/leads/components/lead-import-sheet.tsx:parseCsvLine`
 * (parser sentido inverso, mesma família).
 *
 * **Decisões:**
 *  - **Separador:** vírgula (`,`) — padrão internacional. Excel PT-BR pode
 *    abrir com "Importar dados externos" se default for ponto-e-vírgula;
 *    mas vírgula garante interop com Zapier/Make/Google Sheets sem ajuste.
 *  - **Encoding:** UTF-8 **com BOM** (U+FEFF prefixado). Sem BOM o Excel PT-BR
 *    lê "Joáo" em vez de "João" porque assume Windows-1252. BOM resolve
 *    sem precisar opção de import.
 *  - **Line ending:** `\r\n` (CRLF) — RFC 4180 e compatível com Windows
 *    Notepad. Editores modernos aceitam ambos.
 *  - **Escape:** se valor contém `,`, `"`, `\r`, `\n`, envolve em aspas e
 *    duplica aspas internas (`he said "hi"` → `"he said ""hi"""`).
 *
 * **Função pura** — não toca IO, recebe rows + header e devolve string.
 * Usado pelo Server Action `exportLeadsAction` e pelo smoke test
 * (escape RFC 4180 é sutil; testar isolado).
 */

export const UTF8_BOM = '\uFEFF';
export const CSV_LINE_ENDING = '\r\n';

/**
 * Escapa um valor pra célula CSV. `null`/`undefined` → string vazia.
 * Números/booleans são convertidos via `String()`.
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  // Envolve em aspas se contém caractere especial.
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializa uma linha (array de células) pra string CSV.
 */
export function serializeCsvRow(cells: readonly unknown[]): string {
  return cells.map(escapeCsvValue).join(',');
}

/**
 * Serializa um dataset completo (header + rows) pra string CSV com BOM.
 *
 * `header` é a primeira linha; cada `row` deve ter o mesmo número de
 * colunas — caller que garante a forma.
 */
export function serializeCsv(
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines: string[] = [];
  lines.push(serializeCsvRow(header));
  for (const row of rows) {
    lines.push(serializeCsvRow(row));
  }
  return UTF8_BOM + lines.join(CSV_LINE_ENDING) + CSV_LINE_ENDING;
}

// =============================================================================
// Schema-specific helper (leads)
// =============================================================================

/**
 * Shape mínimo esperado pelo `serializeLeadsCsv`. Não importa o feature
 * de leads pra manter este módulo puro e testável.
 */
export interface LeadCsvRow {
  name: string;
  email: string | null;
  phone: string;
  company: string | null;
  position: string | null;
  origin: string;
  status: string;
  stageName: string;
  assignedToName: string | null;
  valueCents: number;
  tags: string[];
  notes: string | null;
  lastInteractionAt: Date | null;
  nextActionAt: Date | null;
  createdAt: Date;
}

/**
 * Cabeçalho do CSV exportado. Pt-BR pra alinhar com o resto da UI. Se
 * mudar a ordem ou nome, **mudar também o smoke test** que valida esse
 * contrato.
 */
export const LEAD_CSV_HEADER = [
  'Nome',
  'Email',
  'Telefone',
  'Empresa',
  'Cargo',
  'Origem',
  'Status',
  'Etapa',
  'Vendedor',
  'Valor (R$)',
  'Tags',
  'Notas',
  'Última interação',
  'Próxima ação',
  'Criado em',
] as const;

function formatDate(d: Date | null): string {
  if (!d) return '';
  // ISO date (YYYY-MM-DD HH:mm) — interop universal com Excel/Sheets.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatCents(cents: number): string {
  // Decimal com vírgula pra alinhar com locale BR. Excel PT-BR vai
  // reconhecer como número automaticamente.
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Converte array de `LeadCsvRow` em CSV string pronto pra download.
 * Mantém ordem exata do `LEAD_CSV_HEADER`.
 */
export function serializeLeadsCsv(rows: readonly LeadCsvRow[]): string {
  const body = rows.map(
    (r) =>
      [
        r.name,
        r.email ?? '',
        r.phone,
        r.company ?? '',
        r.position ?? '',
        r.origin,
        r.status,
        r.stageName,
        r.assignedToName ?? '',
        formatCents(r.valueCents),
        r.tags.join('; '),
        r.notes ?? '',
        formatDate(r.lastInteractionAt),
        formatDate(r.nextActionAt),
        formatDate(r.createdAt),
      ] as const,
  );
  return serializeCsv(LEAD_CSV_HEADER, body);
}
