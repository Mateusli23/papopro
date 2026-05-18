/**
 * Extração de texto de arquivos do Cérebro (M11#4).
 *
 * **Server-only** — `pdf-parse` é Node-only (`fs` interno). `'server-only'`
 * faz o Next bundler quebrar se algum Client Component importar.
 *
 * **Tipos suportados em M11#4:**
 *  - `pdf` → texto extraído via `pdf-parse` (pure JS, sem nativo)
 *  - `txt` → leitura direta como UTF-8
 *  - `md` → leitura direta como UTF-8 (markdown vira texto bruto; estrutura
 *    via `\n\n` ajuda o chunking a respeitar seções)
 *
 * **Não suportados ainda (retornam erro propositivo):**
 *  - `doc` (Word 97-2003 binário) — lib `mammoth` complementa em sub-PR
 *  - `docx` (Word 2007+ ZIP+XML) — idem
 *  - Schema M11#1 enum `knowledge_doc_kind` aceita os 5, mas processing
 *    bate em `failed` aqui pra doc/docx até a lib entrar.
 *
 * **Imports lazy.** `pdf-parse` (~250KB) só carrega quando upload de PDF
 * acontece. TXT/MD não pagam o overhead.
 */
import 'server-only';

import type { KnowledgeDocKind } from '@papopro/db';

export interface ExtractInput {
  /** Bytes do arquivo (já baixado do Storage ou recebido via FormData). */
  buffer: Buffer;
  /** Tipo do arquivo — vem de `knowledge_documents.kind`. */
  kind: KnowledgeDocKind;
}

export interface ExtractOutput {
  /** Texto puro extraído. Pode ter quebras de linha; chunking faz o resto. */
  text: string;
  /** Páginas (PDF) ou linhas (texto). Opcional, só pra UI mostrar "X páginas". */
  pageCount?: number;
}

/**
 * Extrai texto de um arquivo de Cérebro. Throws com mensagem propositiva
 * se o tipo não é suportado — caller (`uploadKnowledgeDocumentAction`)
 * captura e marca `status='failed'` + `error_detail`.
 */
export async function extractText(input: ExtractInput): Promise<ExtractOutput> {
  switch (input.kind) {
    case 'pdf':
      return extractPdf(input.buffer);
    case 'txt':
    case 'md':
      return extractPlainText(input.buffer);
    case 'doc':
    case 'docx':
      throw new Error(
        `Arquivos ${input.kind.toUpperCase()} ainda não são suportados pra extração — converta pra PDF, TXT ou MD por enquanto.`,
      );
    default:
      // TS exhaustive — tipos novos no enum vão dar erro aqui.
      throw new Error(`Tipo de arquivo desconhecido: ${(input as { kind: string }).kind}`);
  }
}

/**
 * Extrai texto de PDF via `pdf-parse@^2.4`. Lazy import — só carrega
 * quando realmente chamamos (caller só chama pra `kind='pdf'`).
 *
 * **API v2:** `pdf-parse@2.x` mudou pra class-based (`new PDFParse({data})`
 * → `.getText() → TextResult`) em vez do default function da v1. Mantemos
 * `await parser.destroy()` no finally pra liberar recursos do pdfjs worker.
 *
 * **Limitação conhecida:** PDFs scanneados (imagem sem camada de texto)
 * retornam texto vazio ou só metadados. OCR fica pra V2.
 */
async function extractPdf(buffer: Buffer): Promise<ExtractOutput> {
  // Lazy import — só paga overhead quando precisa.
  const { PDFParse } = await import('pdf-parse');
  // `data` aceita Buffer (v2 converte pra Uint8Array internamente).
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return {
      text: result.text,
      pageCount: result.total,
    };
  } finally {
    await parser.destroy().catch(() => {
      // Falha em destroy é non-fatal — recurso vai ser GC eventualmente.
    });
  }
}

/**
 * Lê texto plano (TXT/MD) como UTF-8. Markdown vira texto bruto; o chunking
 * respeita `\n\n` então cabeçalhos `# H1` ficam isolados em chunks distintos
 * naturalmente.
 */
function extractPlainText(buffer: Buffer): ExtractOutput {
  const text = buffer.toString('utf8');
  // pageCount = aproximação (1 página = 50 linhas) só pra UI mostrar
  // algo. Não usado em business logic.
  const lineCount = text.split('\n').length;
  return {
    text,
    pageCount: Math.max(1, Math.ceil(lineCount / 50)),
  };
}
