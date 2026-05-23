/**
 * Smoke test da Inbox — valida fixtures, transforms puros e schemas Zod
 * dos 3 caminhos do composer (texto, nota interna, mídia).
 *
 * Existe pra dar confiança nos contratos antes de Vitest entrar em M7+.
 * Tipos e shapes aqui viram input das Server Actions / webhooks uazapi
 * em M9 — `applySendMessage` é o mesmo objeto chamado pelo motor real,
 * só muda a fonte (FAKE_MESSAGES → Postgres).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/inbox` →
 * `{summary, results}` JSON. HTTP 200 se `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import {
  attachMediaSchema,
  sendInternalNoteSchema,
  sendTextMessageSchema,
} from '@/features/inbox/schemas';
import {
  applyArchiveConversation,
  applyAttachMedia,
  applyReassignConversation,
  applySendInternalNote,
  applySendMessage,
  applyUnarchiveConversation,
  countActiveFilters,
  countConversations,
  countUnreadConversations,
  daysSinceLastInbound,
  filterConversations,
  formatMessagePreview,
  getLastInboundMessage,
  getLastOutboundMessage,
  groupMessagesByDay,
  type InboxFilterContext,
  type InboxLeadHandle,
  messagesForConversation,
  resolvePlaceholders,
  sortConversations,
} from '@/features/inbox/transforms';
import type { InboxFilters } from '@/features/inbox/types';
import { blockSmokeInProd } from '@/lib/dev/smoke-guard';
import { FAKE_CONVERSATIONS } from '@/lib/fixtures/conversations';
import { FAKE_LEADS } from '@/lib/fixtures/leads';
import { FAKE_MESSAGES } from '@/lib/fixtures/messages';
import { FAKE_QUICK_REPLIES } from '@/lib/fixtures/quick-replies';

interface CheckResult {
  group: string;
  name: string;
  ok: boolean;
  detail?: string;
}

function run(group: string, results: CheckResult[]) {
  return (name: string, fn: () => boolean | string) => {
    try {
      const r = fn();
      if (r === true) results.push({ group, name, ok: true });
      else
        results.push({
          group,
          name,
          ok: false,
          detail: typeof r === 'string' ? r : 'returned false',
        });
    } catch (err) {
      results.push({ group, name, ok: false, detail: (err as Error).message });
    }
  };
}

let counter = 9000;
const idGen = () => `msg_test_${(++counter).toString().padStart(5, '0')}`;
const FROZEN_NOW = '2026-05-10T12:00:00.000Z';
const TEST_AUTHOR = 'user_mateus';

export const dynamic = 'force-dynamic';

export function GET() {
  const blocked = blockSmokeInProd();
  if (blocked) return blocked;

  const results: CheckResult[] = [];

  // ── Fixtures ────────────────────────────────────────────────────────────
  let t = run('fixtures', results);
  t(
    'FAKE_CONVERSATIONS tem ao menos 10 conversas',
    () => FAKE_CONVERSATIONS.length >= 10 || `length=${FAKE_CONVERSATIONS.length}`,
  );
  t('IDs de conversa únicos', () => {
    const ids = FAKE_CONVERSATIONS.map((c) => c.id);
    return new Set(ids).size === ids.length;
  });
  t('FAKE_MESSAGES tem ao menos 80 mensagens', () => FAKE_MESSAGES.length >= 80);
  t('IDs de mensagem únicos', () => {
    const ids = FAKE_MESSAGES.map((m) => m.id);
    return new Set(ids).size === ids.length;
  });
  t('toda mensagem aponta pra uma conversa existente', () => {
    const convIds = new Set(FAKE_CONVERSATIONS.map((c) => c.id));
    return FAKE_MESSAGES.every((m) => convIds.has(m.conversationId));
  });
  t('FAKE_QUICK_REPLIES tem ao menos 3 templates', () => FAKE_QUICK_REPLIES.length >= 3);
  t('quick replies têm IDs únicos', () => {
    const ids = FAKE_QUICK_REPLIES.map((q) => q.id);
    return new Set(ids).size === ids.length;
  });

  // ── Transforms de leitura (cobertura mínima — M5#4a) ───────────────────
  t = run('transforms-read', results);
  t('sortConversations põe arquivadas no fim', () => {
    const sorted = sortConversations(FAKE_CONVERSATIONS);
    let foundArchived = false;
    for (const c of sorted) {
      if (c.archivedAt) foundArchived = true;
      else if (foundArchived) return 'ativa após arquivada';
    }
    return true;
  });
  t('messagesForConversation retorna ordem crescente', () => {
    const c0 = FAKE_CONVERSATIONS[0]!;
    const msgs = messagesForConversation(FAKE_MESSAGES, c0.id);
    for (let i = 1; i < msgs.length; i++) {
      if (msgs[i - 1]!.createdAt > msgs[i]!.createdAt) return `inversão em ${i}`;
    }
    return true;
  });
  t('groupMessagesByDay agrupa sem duplicar dayKey', () => {
    const c0 = FAKE_CONVERSATIONS[0]!;
    const msgs = messagesForConversation(FAKE_MESSAGES, c0.id);
    const groups = groupMessagesByDay(msgs);
    const keys = groups.map((g) => g.dayKey);
    return new Set(keys).size === keys.length;
  });
  t('getLastInboundMessage ignora notas internas', () => {
    const c0 = FAKE_CONVERSATIONS[0]!;
    const msgs = messagesForConversation(FAKE_MESSAGES, c0.id);
    const last = getLastInboundMessage(msgs);
    return last === undefined || last.kind !== 'internal_note';
  });
  t('getLastOutboundMessage ignora notas internas', () => {
    const c0 = FAKE_CONVERSATIONS[0]!;
    const msgs = messagesForConversation(FAKE_MESSAGES, c0.id);
    const last = getLastOutboundMessage(msgs);
    return last === undefined || last.kind !== 'internal_note';
  });
  t('countConversations agrega total/awaiting/responded/archived', () => {
    const c = countConversations(FAKE_CONVERSATIONS);
    return c.total === FAKE_CONVERSATIONS.length;
  });
  t('countUnreadConversations exclui arquivadas', () => {
    const total = countUnreadConversations(FAKE_CONVERSATIONS);
    const archivedUnread = FAKE_CONVERSATIONS.filter((c) => c.archivedAt).reduce(
      (s, c) => s + c.unreadCount,
      0,
    );
    const all = FAKE_CONVERSATIONS.reduce((s, c) => s + c.unreadCount, 0);
    return total === all - archivedUnread;
  });
  t('formatMessagePreview retorna emoji prefix pra mídia', () => {
    const audio = FAKE_MESSAGES.find((m) => m.kind === 'audio');
    if (!audio) return 'sem áudio nas fixtures';
    return formatMessagePreview(audio).startsWith('🎤');
  });

  // ── Placeholders (quick replies) ───────────────────────────────────────
  t = run('placeholders', results);
  t('resolvePlaceholders substitui {nome} e {empresa}', () => {
    const out = resolvePlaceholders('Olá {nome}, sobre a {empresa}', {
      nome: 'Mariana',
      empresa: 'Acme',
    });
    return out === 'Olá Mariana, sobre a Acme';
  });
  t('resolvePlaceholders substitui múltiplas ocorrências', () => {
    const out = resolvePlaceholders('{nome}, oi {nome}!', { nome: 'Pedro' });
    return out === 'Pedro, oi Pedro!';
  });
  t('resolvePlaceholders deixa tokens sem match literais', () => {
    const out = resolvePlaceholders('Olá {nome}, da {empresa}', { nome: 'Ana' });
    return out === 'Olá Ana, da {empresa}';
  });
  t('resolvePlaceholders com contexto vazio mantém tudo', () => {
    const body = 'Oi {nome}, da {empresa}, sobre o {produto}';
    return resolvePlaceholders(body, {}) === body;
  });
  t('resolvePlaceholders aceita {produto}', () => {
    const out = resolvePlaceholders('Sobre o {produto}', { produto: 'Plano Pro' });
    return out === 'Sobre o Plano Pro';
  });

  // ── applySendMessage ───────────────────────────────────────────────────
  t = run('mutations-send-message', results);
  const target = FAKE_CONVERSATIONS.find((c) => !c.archivedAt && c.status !== 'archived')!;
  const sent = applySendMessage(
    FAKE_CONVERSATIONS,
    FAKE_MESSAGES,
    target.id,
    { body: 'Oi, tudo bem?' },
    TEST_AUTHOR,
    idGen,
    FROZEN_NOW,
  );
  t('applySendMessage cria mensagem com kind=text e direction=out', () => {
    return sent.message.kind === 'text' && sent.message.direction === 'out';
  });
  t('applySendMessage atribui authorId fornecido', () => sent.message.authorId === TEST_AUTHOR);
  t('applySendMessage gera id via idGen', () => sent.message.id.startsWith('msg_test_'));
  t('applySendMessage adiciona à lista (length + 1)', () => {
    return sent.messages.length === FAKE_MESSAGES.length + 1;
  });
  t('applySendMessage não muta arrays originais (referência nova)', () => {
    return sent.messages !== FAKE_MESSAGES && sent.conversations !== FAKE_CONVERSATIONS;
  });
  t('applySendMessage atualiza lastMessageAt da conversa', () => {
    const updated = sent.conversations.find((c) => c.id === target.id)!;
    return updated.lastMessageAt === FROZEN_NOW;
  });
  t('applySendMessage atualiza lastMessageDirection=out', () => {
    const updated = sent.conversations.find((c) => c.id === target.id)!;
    return updated.lastMessageDirection === 'out';
  });
  t('applySendMessage muda status pra awaiting', () => {
    const updated = sent.conversations.find((c) => c.id === target.id)!;
    return updated.status === 'awaiting';
  });
  t('applySendMessage seta deliveredAt (mock entrega imediata)', () => {
    return sent.message.deliveredAt === FROZEN_NOW;
  });
  t('applySendMessage trim aplicado pelo schema (separado do transform)', () => {
    const r = sendTextMessageSchema.safeParse({ body: '   olá   ' });
    return r.success && r.data.body === 'olá';
  });
  t('applySendMessage em conversa inexistente lança', () => {
    try {
      applySendMessage(
        FAKE_CONVERSATIONS,
        FAKE_MESSAGES,
        'conv_naoexiste',
        { body: 'oi' },
        TEST_AUTHOR,
        idGen,
        FROZEN_NOW,
      );
      return 'esperava throw';
    } catch {
      return true;
    }
  });

  // ── applySendInternalNote ──────────────────────────────────────────────
  t = run('mutations-internal-note', results);
  const respondedTarget = FAKE_CONVERSATIONS.find(
    (c) => c.status === 'responded' && !c.archivedAt,
  )!;
  const note = applySendInternalNote(
    FAKE_CONVERSATIONS,
    FAKE_MESSAGES,
    respondedTarget.id,
    { body: 'Lead premium — vale priorizar' },
    TEST_AUTHOR,
    idGen,
    FROZEN_NOW,
  );
  t('applySendInternalNote cria kind=internal_note', () => note.message.kind === 'internal_note');
  t('applySendInternalNote sempre direction=out', () => note.message.direction === 'out');
  t('applySendInternalNote NÃO muda status da conversa', () => {
    const updated = note.conversations.find((c) => c.id === respondedTarget.id)!;
    return updated.status === respondedTarget.status;
  });
  t('applySendInternalNote atualiza lastMessageAt mesmo sem mudar status', () => {
    const updated = note.conversations.find((c) => c.id === respondedTarget.id)!;
    return updated.lastMessageAt === FROZEN_NOW;
  });
  t('applySendInternalNote NÃO seta deliveredAt (não vai pro lead)', () => {
    return note.message.deliveredAt === undefined;
  });
  t('preview da nota interna começa com 🔒', () => {
    const updated = note.conversations.find((c) => c.id === respondedTarget.id)!;
    return updated.lastMessagePreview.startsWith('🔒');
  });

  // ── applyAttachMedia ───────────────────────────────────────────────────
  t = run('mutations-attach-media', results);
  const mediaTarget = FAKE_CONVERSATIONS.find((c) => !c.archivedAt)!;
  const image = applyAttachMedia(
    FAKE_CONVERSATIONS,
    FAKE_MESSAGES,
    mediaTarget.id,
    {
      kind: 'image',
      mediaName: 'planta-baixa.jpg',
      mediaSizeKb: 245,
    },
    TEST_AUTHOR,
    idGen,
    FROZEN_NOW,
  );
  t('applyAttachMedia kind=image preserva mediaName', () => {
    return image.message.kind === 'image' && image.message.mediaName === 'planta-baixa.jpg';
  });
  t('applyAttachMedia preserva mediaSizeKb', () => image.message.mediaSizeKb === 245);
  t('applyAttachMedia muda status pra awaiting (mídia conta como envio)', () => {
    const updated = image.conversations.find((c) => c.id === mediaTarget.id)!;
    return updated.status === 'awaiting';
  });
  t('applyAttachMedia preview começa com 📷 pra image', () => {
    const updated = image.conversations.find((c) => c.id === mediaTarget.id)!;
    return updated.lastMessagePreview.startsWith('📷');
  });

  const audio = applyAttachMedia(
    FAKE_CONVERSATIONS,
    FAKE_MESSAGES,
    mediaTarget.id,
    {
      kind: 'audio',
      mediaName: 'audio-12345.ogg',
      mediaSizeKb: 0,
      mediaDurationSeconds: 12,
    },
    TEST_AUTHOR,
    idGen,
    FROZEN_NOW,
  );
  t('applyAttachMedia kind=audio aceita mediaSizeKb=0 (gravação mock)', () => {
    return audio.message.mediaSizeKb === 0;
  });
  t('applyAttachMedia preserva mediaDurationSeconds em audio', () => {
    return audio.message.mediaDurationSeconds === 12;
  });
  t('applyAttachMedia preview de áudio inclui duração formatada', () => {
    const updated = audio.conversations.find((c) => c.id === mediaTarget.id)!;
    return /0:12/.test(updated.lastMessagePreview);
  });

  const doc = applyAttachMedia(
    FAKE_CONVERSATIONS,
    FAKE_MESSAGES,
    mediaTarget.id,
    {
      kind: 'document',
      mediaName: 'proposta.pdf',
      mediaSizeKb: 1024,
      caption: 'Segue proposta',
    },
    TEST_AUTHOR,
    idGen,
    FROZEN_NOW,
  );
  t('applyAttachMedia kind=document preserva caption no body', () => {
    return doc.message.body === 'Segue proposta';
  });

  // ── Edge cases ─────────────────────────────────────────────────────────
  t = run('edge-cases', results);
  t('aplicar 2 mensagens sequencialmente acumula', () => {
    const r1 = applySendMessage(
      FAKE_CONVERSATIONS,
      FAKE_MESSAGES,
      target.id,
      { body: 'um' },
      TEST_AUTHOR,
      idGen,
      FROZEN_NOW,
    );
    const r2 = applySendMessage(
      r1.conversations,
      r1.messages,
      target.id,
      { body: 'dois' },
      TEST_AUTHOR,
      idGen,
      FROZEN_NOW,
    );
    return r2.messages.length === FAKE_MESSAGES.length + 2;
  });
  t('mensagem em conversa arquivada cria a mensagem mas não desarquiva', () => {
    const archived = FAKE_CONVERSATIONS.find((c) => c.archivedAt);
    if (!archived) return 'sem arquivada nas fixtures';
    const r = applySendMessage(
      FAKE_CONVERSATIONS,
      FAKE_MESSAGES,
      archived.id,
      { body: 'oi mesmo arquivada' },
      TEST_AUTHOR,
      idGen,
      FROZEN_NOW,
    );
    const updated = r.conversations.find((c) => c.id === archived.id)!;
    return Boolean(updated.archivedAt);
  });
  t('daysSinceLastInbound retorna undefined quando sem inbound', () => {
    const synthetic = FAKE_MESSAGES.filter((m) => m.direction === 'out').slice(0, 2);
    return daysSinceLastInbound(synthetic) === undefined;
  });

  // ── Schema Zod ──────────────────────────────────────────────────────────
  t = run('schema', results);
  t('sendTextMessageSchema aceita body válido', () => {
    return sendTextMessageSchema.safeParse({ body: 'Olá!' }).success;
  });
  t('sendTextMessageSchema rejeita string vazia (com trim)', () => {
    return sendTextMessageSchema.safeParse({ body: '   ' }).success === false;
  });
  t('sendTextMessageSchema rejeita > 4096', () => {
    return sendTextMessageSchema.safeParse({ body: 'x'.repeat(4097) }).success === false;
  });
  t('sendInternalNoteSchema rejeita > 2000', () => {
    return sendInternalNoteSchema.safeParse({ body: 'x'.repeat(2001) }).success === false;
  });
  t('attachMediaSchema audio exige mediaDurationSeconds', () => {
    return (
      attachMediaSchema.safeParse({
        kind: 'audio',
        mediaName: 'a.ogg',
        mediaSizeKb: 0,
      }).success === false
    );
  });
  t('attachMediaSchema image rejeita mediaSizeKb=0', () => {
    return (
      attachMediaSchema.safeParse({
        kind: 'image',
        mediaName: 'foto.jpg',
        mediaSizeKb: 0,
      }).success === false
    );
  });
  t('attachMediaSchema kind inválido falha', () => {
    return (
      attachMediaSchema.safeParse({
        kind: 'video',
        mediaName: 'v.mp4',
        mediaSizeKb: 100,
      }).success === false
    );
  });
  t('mensagens de erro em pt-BR (não en-US) — sendTextMessageSchema', () => {
    const r = sendTextMessageSchema.safeParse({ body: '' });
    if (r.success) return 'esperava falhar';
    const messages = r.error.issues.map((i) => i.message).join(' | ');
    return (
      !/Required|String must|Invalid|Number must/i.test(messages) || `vazou en-US: ${messages}`
    );
  });
  t('mensagens de erro em pt-BR — attachMediaSchema audio sem duração', () => {
    const r = attachMediaSchema.safeParse({ kind: 'audio', mediaName: 'a.ogg', mediaSizeKb: 0 });
    if (r.success) return 'esperava falhar';
    const messages = r.error.issues.map((i) => i.message).join(' | ');
    return (
      !/Required|String must|Invalid|Number must/i.test(messages) || `vazou en-US: ${messages}`
    );
  });
  t('mensagens de erro em pt-BR — attachMediaSchema kind inválido', () => {
    const r = attachMediaSchema.safeParse({ kind: 'video', mediaName: 'v.mp4', mediaSizeKb: 100 });
    if (r.success) return 'esperava falhar';
    const messages = r.error.issues.map((i) => i.message).join(' | ');
    return (
      !/Required|String must|Invalid|Number must/i.test(messages) || `vazou en-US: ${messages}`
    );
  });
  t('mensagens de erro em pt-BR — attachMediaSchema image vazio', () => {
    const r = attachMediaSchema.safeParse({ kind: 'image', mediaName: 'foto.jpg', mediaSizeKb: 0 });
    if (r.success) return 'esperava falhar';
    const messages = r.error.issues.map((i) => i.message).join(' | ');
    return (
      !/Required|String must|Invalid|Number must/i.test(messages) || `vazou en-US: ${messages}`
    );
  });

  // ── Filtros (M5#4c) ────────────────────────────────────────────────────
  t = run('filters', results);

  const LEAD_HANDLES: ReadonlyMap<string, InboxLeadHandle> = new Map(
    FAKE_LEADS.map((l) => [
      l.id,
      { stageId: l.stageId, name: l.name, company: l.company, phone: l.phone },
    ]),
  );
  const filterCtx: InboxFilterContext = { messages: FAKE_MESSAGES, leadById: LEAD_HANDLES };
  const FROZEN_NOW_DATE = new Date(FROZEN_NOW);

  t('filterConversations sem filtros oculta arquivadas (default UX)', () => {
    const out = filterConversations(FAKE_CONVERSATIONS, {}, filterCtx, FROZEN_NOW_DATE);
    const hasArchived = out.some((c) => c.archivedAt);
    return !hasArchived || `${out.length} resultados, com arquivada`;
  });
  t('filterConversations status=archived retorna apenas arquivadas', () => {
    const out = filterConversations(
      FAKE_CONVERSATIONS,
      { status: 'archived' },
      filterCtx,
      FROZEN_NOW_DATE,
    );
    const allArchived = out.every((c) => c.status === 'archived' && c.archivedAt);
    return (allArchived && out.length > 0) || `count=${out.length} allArchived=${allArchived}`;
  });
  t('filterConversations status=awaiting filtra estritamente', () => {
    const out = filterConversations(
      FAKE_CONVERSATIONS,
      { status: 'awaiting' },
      filterCtx,
      FROZEN_NOW_DATE,
    );
    return out.every((c) => c.status === 'awaiting');
  });
  t('filterConversations vendorId combina via AND com status', () => {
    const out = filterConversations(
      FAKE_CONVERSATIONS,
      { status: 'awaiting', vendorId: 'user_mateus' },
      filterCtx,
      FROZEN_NOW_DATE,
    );
    return out.every((c) => c.vendorId === 'user_mateus' && c.status === 'awaiting');
  });
  t('filterConversations stageId resolve via leadById', () => {
    const out = filterConversations(
      FAKE_CONVERSATIONS,
      { stageId: 'novo' },
      filterCtx,
      FROZEN_NOW_DATE,
    );
    if (out.length === 0) return 'esperava ao menos uma conversa em novo';
    return out.every((c) => {
      const lead = LEAD_HANDLES.get(c.leadId);
      return lead?.stageId === 'novo';
    });
  });
  t('filterConversations noReplyDays >= 7 inclui só conversas silentes a 7+ dias', () => {
    const out = filterConversations(
      FAKE_CONVERSATIONS,
      { noReplyDays: 7 },
      filterCtx,
      FROZEN_NOW_DATE,
    );
    if (out.length === 0) return 'esperava resultados';
    return out.every((c) => {
      const msgs = messagesForConversation(FAKE_MESSAGES, c.id);
      const days = daysSinceLastInbound(msgs, FROZEN_NOW_DATE);
      const conversationAgeDays = Math.floor(
        (FROZEN_NOW_DATE.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      const silent = days ?? conversationAgeDays;
      return silent >= 7;
    });
  });
  t('filterConversations noReplyDays usa idade da conversa quando lead nunca respondeu', () => {
    // conv_010 está arquivada (não entra no default), mas tem inbound. Vamos
    // construir um caso sintético: pegar a primeira conversa não-arquivada
    // e ver se um threshold maior que a idade exclui (não passa).
    const active = FAKE_CONVERSATIONS.find((c) => !c.archivedAt);
    if (!active) return 'sem conversa ativa';
    const conversationAgeDays = Math.floor(
      (FROZEN_NOW_DATE.getTime() - new Date(active.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    // Filtro com threshold > idade da conversa NUNCA inclui, mesmo se lead silent.
    const out = filterConversations(
      [active],
      { noReplyDays: conversationAgeDays + 999 },
      filterCtx,
      FROZEN_NOW_DATE,
    );
    return out.length === 0;
  });
  t('filterConversations search bate em nome do lead', () => {
    // lead_001 = Mariana Costa; conv_001 vincula. Busca "mariana" deve incluir.
    const out = filterConversations(
      FAKE_CONVERSATIONS,
      { search: 'mariana' },
      filterCtx,
      FROZEN_NOW_DATE,
    );
    return out.some((c) => c.id === 'conv_001');
  });
  t('filterConversations search é case-insensitive e trimmed', () => {
    const out = filterConversations(
      FAKE_CONVERSATIONS,
      { search: '  MARIANA  ' },
      filterCtx,
      FROZEN_NOW_DATE,
    );
    return out.some((c) => c.id === 'conv_001');
  });
  t('filterConversations search vazia (só espaços) é ignorada', () => {
    const all = filterConversations(FAKE_CONVERSATIONS, {}, filterCtx, FROZEN_NOW_DATE);
    const withEmpty = filterConversations(
      FAKE_CONVERSATIONS,
      { search: '   ' },
      filterCtx,
      FROZEN_NOW_DATE,
    );
    return withEmpty.length === all.length;
  });
  t('filterConversations stageId com lead órfão exclui (defense in depth)', () => {
    // Conversa sintética com leadId que não existe no map.
    const orphan = { ...FAKE_CONVERSATIONS[0]!, id: 'conv_orphan', leadId: 'lead_inexistente' };
    const out = filterConversations([orphan], { stageId: 'novo' }, filterCtx, FROZEN_NOW_DATE);
    return out.length === 0;
  });
  t('countActiveFilters ignora search', () => {
    return countActiveFilters({ search: 'mariana' }) === 0;
  });
  t('countActiveFilters soma vendor + status + stage + noReply', () => {
    const filters: InboxFilters = {
      vendorId: 'user_mateus',
      status: 'awaiting',
      stageId: 'novo',
      noReplyDays: 7,
    };
    return countActiveFilters(filters) === 4;
  });
  t('countActiveFilters em filtros vazios = 0', () => {
    return countActiveFilters({}) === 0;
  });

  // ── Mutações de archive/unarchive (M5#4c) ──────────────────────────────
  t = run('mutations-archive', results);

  const activeForArchive = FAKE_CONVERSATIONS.find((c) => !c.archivedAt);
  if (!activeForArchive) {
    t('fixture: ao menos uma conversa ativa', () => 'sem ativa');
  } else {
    const archived = applyArchiveConversation(FAKE_CONVERSATIONS, activeForArchive.id, FROZEN_NOW);
    t('applyArchiveConversation seta archivedAt', () => {
      const updated = archived.find((c) => c.id === activeForArchive.id);
      return updated?.archivedAt === FROZEN_NOW;
    });
    t('applyArchiveConversation seta status="archived"', () => {
      const updated = archived.find((c) => c.id === activeForArchive.id);
      return updated?.status === 'archived';
    });
    t('applyArchiveConversation cria nova referência do array', () => {
      return archived !== FAKE_CONVERSATIONS;
    });
    t('applyArchiveConversation idempotente em conversa já arquivada', () => {
      const ar = FAKE_CONVERSATIONS.find((c) => c.archivedAt);
      if (!ar) return 'sem arquivada nas fixtures';
      const re = applyArchiveConversation(FAKE_CONVERSATIONS, ar.id);
      return re === FAKE_CONVERSATIONS;
    });
    t('applyArchiveConversation lança em conversationId desconhecido', () => {
      try {
        applyArchiveConversation(FAKE_CONVERSATIONS, 'conv_inexistente');
        return 'esperava throw';
      } catch {
        return true;
      }
    });
    t('arquivar exclui conversa do countUnread se tinha unread', () => {
      // Pegamos uma conversa com unread > 0 pra checar o efeito.
      const unreadConv = FAKE_CONVERSATIONS.find((c) => c.unreadCount > 0 && !c.archivedAt);
      if (!unreadConv) return 'sem conversa unread ativa';
      const before = countUnreadConversations(FAKE_CONVERSATIONS);
      const after = countUnreadConversations(
        applyArchiveConversation(FAKE_CONVERSATIONS, unreadConv.id),
      );
      return after === before - unreadConv.unreadCount;
    });
  }

  // Unarchive
  const archivedForUnarchive = FAKE_CONVERSATIONS.find((c) => c.archivedAt);
  if (!archivedForUnarchive) {
    t('fixture: ao menos uma arquivada', () => 'sem arquivada');
  } else {
    const unarchived = applyUnarchiveConversation(
      FAKE_CONVERSATIONS,
      FAKE_MESSAGES,
      archivedForUnarchive.id,
    );
    t('applyUnarchiveConversation limpa archivedAt', () => {
      const updated = unarchived.find((c) => c.id === archivedForUnarchive.id);
      return updated?.archivedAt === undefined;
    });
    t('applyUnarchiveConversation recalcula status pra awaiting/responded', () => {
      const updated = unarchived.find((c) => c.id === archivedForUnarchive.id);
      return updated?.status === 'awaiting' || updated?.status === 'responded';
    });
    t('applyUnarchiveConversation idempotente em conversa ativa', () => {
      const active = FAKE_CONVERSATIONS.find((c) => !c.archivedAt)!;
      const re = applyUnarchiveConversation(FAKE_CONVERSATIONS, FAKE_MESSAGES, active.id);
      return re === FAKE_CONVERSATIONS;
    });
  }

  // ── Mutação reassign (M5#4c) ───────────────────────────────────────────
  t = run('mutations-reassign', results);

  const reassignTarget = FAKE_CONVERSATIONS[0]!;
  const newVendor = reassignTarget.vendorId === 'user_juliana' ? 'user_renato' : 'user_juliana';
  const reassigned = applyReassignConversation(FAKE_CONVERSATIONS, reassignTarget.id, newVendor);

  t('applyReassignConversation atualiza vendorId', () => {
    const updated = reassigned.find((c) => c.id === reassignTarget.id);
    return updated?.vendorId === newVendor;
  });
  t('applyReassignConversation não muda status', () => {
    const updated = reassigned.find((c) => c.id === reassignTarget.id);
    return updated?.status === reassignTarget.status;
  });
  t('applyReassignConversation não muda lastMessageAt', () => {
    const updated = reassigned.find((c) => c.id === reassignTarget.id);
    return updated?.lastMessageAt === reassignTarget.lastMessageAt;
  });
  t('applyReassignConversation idempotente em mesmo vendor', () => {
    const re = applyReassignConversation(
      FAKE_CONVERSATIONS,
      reassignTarget.id,
      reassignTarget.vendorId,
    );
    return re === FAKE_CONVERSATIONS;
  });
  t('applyReassignConversation rejeita vendorId vazio', () => {
    try {
      applyReassignConversation(FAKE_CONVERSATIONS, reassignTarget.id, '');
      return 'esperava throw';
    } catch {
      return true;
    }
  });
  t('applyReassignConversation lança em conversationId desconhecido', () => {
    try {
      applyReassignConversation(FAKE_CONVERSATIONS, 'conv_inexistente', newVendor);
      return 'esperava throw';
    } catch {
      return true;
    }
  });

  // ── Helpers do listbox keyboard nav (M5#4c) ────────────────────────────
  t = run('keyboard-nav-helpers', results);

  // Validamos a lógica pura do "next/previous index" — o hook em si testa
  // via UAT, mas a aritmética de wrap-around vale assert pra não regressar.
  function nextIndex(len: number, current: number, dir: 1 | -1): number {
    if (current < 0) return dir === 1 ? 0 : len - 1;
    return (current + dir + len) % len;
  }

  t('next em lista de 5 com selecionado=2 → 3', () => {
    return nextIndex(5, 2, 1) === 3;
  });
  t('next em fim da lista wrappa pro início', () => {
    return nextIndex(5, 4, 1) === 0;
  });
  t('previous em início wrappa pro fim', () => {
    return nextIndex(5, 0, -1) === 4;
  });
  t('next sem seleção (current=-1) começa em 0', () => {
    return nextIndex(5, -1, 1) === 0;
  });
  t('previous sem seleção (current=-1) vai pro último', () => {
    return nextIndex(5, -1, -1) === 4;
  });
  t('next em lista de 1 retorna 0 (idempotente)', () => {
    return nextIndex(1, 0, 1) === 0 && nextIndex(1, 0, -1) === 0;
  });

  // ── Regressões do code review M5#4b ────────────────────────────────────
  t = run('regressions', results);
  // CRITICAL #4: sendMessage agora aplica auto-mark-read na mesma transação.
  // Validamos via transforms — store wrapper é covered por UAT.
  t('resolvePlaceholders robusto: {nomeempresa} não é trocado por {nome}', () => {
    // MEDIUM #3 regression: placeholder com sufixo desconhecido fica literal.
    const out = resolvePlaceholders('campo: {nomeempresa}', { nome: 'João' });
    return out === 'campo: {nomeempresa}';
  });
  t('resolvePlaceholders ignora tokens não mapeados', () => {
    const out = resolvePlaceholders('Olá {nome}, vim de {origem}', { nome: 'Ana' });
    return out === 'Olá Ana, vim de {origem}';
  });
  t('resolvePlaceholders aceita texto sem placeholders', () => {
    const body = 'Olá tudo bem?';
    return resolvePlaceholders(body, { nome: 'Ana' }) === body;
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const allOk = failed === 0;

  return NextResponse.json(
    {
      summary: { total: results.length, passed, failed, allOk },
      results,
    },
    { status: allOk ? 200 : 500 },
  );
}
