/**
 * Chunking de texto pro Cérebro da Empresa (M11#4).
 *
 * **Função pura** — sem side effects, sem deps externas. Testável no smoke
 * sem hit em API ou DB.
 *
 * **Estratégia (3 níveis de fallback):**
 *  1. Split por parágrafo (`\n\n`). Junta parágrafos até bater `MAX_CHARS`.
 *  2. Se parágrafo único > `MAX_CHARS`, split por sentence (`. ` / `! ` / `? `).
 *  3. Se sentence > `MAX_CHARS`, split por char (último recurso — preserva
 *     conteúdo mesmo em texto monolítico tipo log/JSON).
 *
 * **Overlap entre chunks** (~10% do `MAX_CHARS`): re-inclui as últimas N
 * chars do chunk anterior no início do próximo. Preserva contexto pra
 * que a busca semântica encontre conceitos que cruzam fronteira de chunk.
 *
 * **Token estimate** = `chars / 4` (heurística OpenAI: 1 token ≈ 4 chars
 * em texto natural em inglês; pt-BR é ligeiramente maior, ~3.5 chars/token,
 * mas a margem de erro não afeta cost_micros — pricing é por 1M tokens
 * batch, drift de ±10% é irrelevante).
 *
 * **Limites:** 8000 chars max por chunk (CHECK constraint do schema M11#1
 * em `knowledge_chunks.content`). Em chars/token estimate isso é ~2000
 * tokens — bem abaixo do limite OpenAI 8192 tokens/input.
 */

/** Target ~700 tokens = 2800 chars. Cabe folgado em 1 input OpenAI. */
const TARGET_CHARS = 2800;
/** Hard cap pra respeitar CHECK constraint `knowledge_chunks_content_length`. */
const MAX_CHARS = 8000;
/** ~100 tokens = 400 chars. Overlap suficiente pra preservar contexto. */
const OVERLAP_CHARS = 400;

export interface ChunkOutput {
  /** Posição do chunk dentro do source (0-based). */
  chunkIndex: number;
  /** Texto do chunk. Vai pro `knowledge_chunks.content`. */
  content: string;
  /** Estimativa de tokens (chars/4). Vai pro `knowledge_chunks.tokens`. */
  tokens: number;
}

export interface ChunkOptions {
  /** Override do `TARGET_CHARS`. Útil pra testes. */
  targetChars?: number;
  /** Override do `MAX_CHARS`. NÃO recomendado em prod (CHECK constraint do DB). */
  maxChars?: number;
  /** Override do `OVERLAP_CHARS`. 0 = sem overlap (útil pra campos curtos). */
  overlapChars?: number;
}

/**
 * Chunkeia texto em pedaços de tamanho controlado. Retorna `[]` se input
 * vazio (caller decide se persiste ou skipa).
 */
export function chunkText(text: string, opts: ChunkOptions = {}): ChunkOutput[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const target = opts.targetChars ?? TARGET_CHARS;
  const max = opts.maxChars ?? MAX_CHARS;
  const overlap = opts.overlapChars ?? OVERLAP_CHARS;

  // 1. Tenta agrupar parágrafos.
  const paragraphs = trimmed
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    // Parágrafo único maior que MAX: split interno.
    if (para.length > max) {
      // Fecha chunk atual.
      if (current) {
        chunks.push(current);
        current = '';
      }
      // Split por sentence; fallback char.
      chunks.push(...splitLargeParagraph(para, target, max));
      continue;
    }
    // Se adicionar este parágrafo passar do target, fecha o atual.
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > target && current) {
      chunks.push(current);
      current = para;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  // 2. Adiciona overlap entre chunks consecutivos (re-inclui últimas N chars
  // do chunk anterior no INÍCIO do próximo).
  if (overlap > 0 && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const curr = chunks[i];
      if (!prev || !curr) continue;
      const tail = prev.slice(Math.max(0, prev.length - overlap));
      // Evita duplicar se o chunk atual já começa igual.
      if (!curr.startsWith(tail)) {
        chunks[i] = `${tail}\n\n${curr}`;
      }
    }
  }

  // 3. Truncate hard pra respeitar CHECK constraint (paranoia — splitLargeParagraph
  // já respeita, mas defense-in-depth).
  return chunks.map((content, index) => {
    const truncated = content.length > max ? content.slice(0, max) : content;
    return {
      chunkIndex: index,
      content: truncated,
      tokens: estimateTokens(truncated),
    };
  });
}

/**
 * Split de parágrafo único grande. Tenta sentence first, fallback char.
 * Exportado pra ser testável e reutilizável.
 */
export function splitLargeParagraph(
  paragraph: string,
  targetChars: number,
  maxChars: number,
): string[] {
  // Sentence splitter conservador — pt-BR friendly. Match terminator + espaço
  // pra não quebrar "Sr. João" ou "U.S.A." (heurística — caso raro em texto
  // de Cérebro de empresa).
  const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ])/);
  const out: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    // Sentence única ainda maior que MAX → char split.
    if (sentence.length > maxChars) {
      if (current) {
        out.push(current);
        current = '';
      }
      for (let i = 0; i < sentence.length; i += targetChars) {
        out.push(sentence.slice(i, i + targetChars));
      }
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > targetChars && current) {
      out.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Estimativa de tokens via heurística OpenAI (`chars / 4`). Usada pra
 * preencher `knowledge_chunks.tokens` — pricing real é cobrado por tokens
 * reais reportados pela API; este número é só pra dashboard.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
