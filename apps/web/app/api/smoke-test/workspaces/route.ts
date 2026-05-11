/**
 * Smoke test do feature `workspace` (M7#4 Onda 3).
 *
 * Cobre as **funções puras** (slugify, ensureUniqueSlug, workspaceInitials),
 * o **schema Zod** (workspaceCreateSchema com casos válidos e inválidos), e
 * a **transformação de presentation** (toSwitcherItem). Não toca no banco
 * (a Server Action `createWorkspaceAction` exige sessão Supabase real;
 * cobertura desse caminho fica pra Playwright em M7#6).
 *
 * Padrão herdado de M4 (`/api/smoke-test/leads`) e mantido por consistência.
 * Curl em `/api/smoke-test/workspaces` devolve `{passed, failed, results}`.
 */
import { NextResponse } from 'next/server';

import { toSwitcherItem, workspaceInitials } from '@/features/workspace/presentation';
import { workspaceCreateSchema } from '@/features/workspace/schemas';
import type { MembershipSummary } from '@/lib/auth/get-user';
import { ensureUniqueSlug, slugify } from '@/lib/workspace/slugify';

interface CheckResult {
  group: string;
  name: string;
  ok: boolean;
  detail?: string;
}

function assert(
  results: CheckResult[],
  group: string,
  name: string,
  predicate: boolean | (() => boolean),
  detail?: string,
): void {
  let ok: boolean;
  try {
    ok = typeof predicate === 'function' ? predicate() : predicate;
  } catch (err) {
    ok = false;
    detail = `threw: ${err instanceof Error ? err.message : String(err)}`;
  }
  results.push({ group, name, ok, detail: ok ? undefined : detail });
}

export async function GET(): Promise<NextResponse> {
  const results: CheckResult[] = [];

  // ===========================================================================
  // 1) slugify — normalização Unicode + colapso de hífens
  // ===========================================================================
  assert(results, 'slugify', 'simple', slugify('Acme') === 'acme');
  assert(
    results,
    'slugify',
    'spaces → hyphens',
    slugify('Imóvel Pro Vendas') === 'imovel-pro-vendas',
  );
  assert(results, 'slugify', 'remove diacritics', slugify('Açaí Café') === 'acai-cafe');
  assert(
    results,
    'slugify',
    'collapses multiple hyphens',
    slugify('Acme   ---   B2B') === 'acme-b2b',
  );
  assert(results, 'slugify', 'trims border hyphens', slugify('--Acme--') === 'acme');
  assert(results, 'slugify', 'lowercase', slugify('UPPERCASE') === 'uppercase');
  assert(
    results,
    'slugify',
    'non-ASCII only returns empty',
    slugify('日本語') === '',
    `got ${JSON.stringify(slugify('日本語'))}`,
  );
  assert(results, 'slugify', 'numbers preserved', slugify('Equipe 360 B2B') === 'equipe-360-b2b');
  assert(
    results,
    'slugify',
    'truncates at 64',
    slugify('a'.repeat(100)).length === 64,
    `length ${slugify('a'.repeat(100)).length}`,
  );
  assert(results, 'slugify', 'non-string returns empty', slugify(null as unknown as string) === '');

  // ===========================================================================
  // 2) ensureUniqueSlug — iteração com sufixo e fallback
  // ===========================================================================
  await (async () => {
    const reserved = new Set(['acme']);
    const slug = await ensureUniqueSlug('acme', async (c) => reserved.has(c));
    assert(results, 'ensureUniqueSlug', 'appends -2 when base taken', slug === 'acme-2');
  })();

  await (async () => {
    const reserved = new Set(['acme', 'acme-2', 'acme-3']);
    const slug = await ensureUniqueSlug('acme', async (c) => reserved.has(c));
    assert(results, 'ensureUniqueSlug', 'iterates to first free', slug === 'acme-4');
  })();

  await (async () => {
    const slug = await ensureUniqueSlug('acme', async () => false);
    assert(results, 'ensureUniqueSlug', 'returns base when free', slug === 'acme');
  })();

  await (async () => {
    const slug = await ensureUniqueSlug('', async (c) => c === 'workspace');
    assert(
      results,
      'ensureUniqueSlug',
      'fallback `workspace` when base empty + taken',
      slug === 'workspace-2',
    );
  })();

  await (async () => {
    try {
      await ensureUniqueSlug('acme', async () => true);
      assert(results, 'ensureUniqueSlug', 'throws after 50 attempts', false, 'did not throw');
    } catch (err) {
      assert(
        results,
        'ensureUniqueSlug',
        'throws after 50 attempts',
        err instanceof Error && err.message.includes('esgotado'),
      );
    }
  })();

  // ===========================================================================
  // 3) workspaceCreateSchema — validação Zod (pt-BR + control chars)
  // ===========================================================================
  const validParse = workspaceCreateSchema.safeParse({ name: 'Acme Vendas' });
  assert(results, 'schema', 'accepts valid name', validParse.success);

  const tooShortParse = workspaceCreateSchema.safeParse({ name: 'A' });
  assert(
    results,
    'schema',
    'rejects name < 2 chars',
    !tooShortParse.success &&
      Boolean(tooShortParse.error.issues.find((i) => /curto/i.test(i.message))),
  );

  const tooLongParse = workspaceCreateSchema.safeParse({ name: 'A'.repeat(61) });
  assert(
    results,
    'schema',
    'rejects name > 60 chars',
    !tooLongParse.success &&
      Boolean(tooLongParse.error.issues.find((i) => /longo/i.test(i.message))),
  );

  // Control char (BEL = 0x07) injetado no nome.
  const controlCharParse = workspaceCreateSchema.safeParse({
    name: `Acme${String.fromCharCode(7)}Co`,
  });
  assert(
    results,
    'schema',
    'rejects control chars',
    !controlCharParse.success &&
      Boolean(controlCharParse.error.issues.find((i) => /inválidos/i.test(i.message))),
  );

  // Emoji/acento aceitos.
  const emojiParse = workspaceCreateSchema.safeParse({ name: '✨ Café & Cia' });
  assert(results, 'schema', 'accepts emoji + accent', emojiParse.success);

  // ===========================================================================
  // 4) workspaceInitials — derivação cosmética
  // ===========================================================================
  assert(results, 'initials', '2 words', workspaceInitials('Imóvel Pro') === 'IP');
  assert(results, 'initials', '1 word', workspaceInitials('Acme') === 'AC');
  assert(results, 'initials', '1 char', workspaceInitials('x') === 'X');
  assert(results, 'initials', 'empty', workspaceInitials('') === '?');
  assert(
    results,
    'initials',
    'collapses multi-spaces',
    workspaceInitials('  Acme   B2B  ') === 'AB',
  );
  assert(results, 'initials', 'uppercases', workspaceInitials('acme b2b') === 'AB');

  // ===========================================================================
  // 5) toSwitcherItem — adaptador membership → switcher item
  // ===========================================================================
  const sampleMembership: MembershipSummary = {
    workspaceId: '11111111-1111-1111-1111-111111111111',
    role: 'Owner',
    joinedAt: '2026-05-11T12:00:00Z',
    workspace: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Acme Vendas',
      slug: 'acme-vendas',
      plan: 'Pro IA',
      segment: 'imobiliario',
    },
  };
  const item0 = toSwitcherItem(sampleMembership, 0);
  assert(
    results,
    'switcher-item',
    'workspaceId propagated',
    item0.workspaceId === sampleMembership.workspaceId,
  );
  assert(results, 'switcher-item', 'name propagated', item0.name === 'Acme Vendas');
  assert(results, 'switcher-item', 'role propagated', item0.role === 'Owner');
  assert(results, 'switcher-item', 'plan propagated', item0.plan === 'Pro IA');
  assert(results, 'switcher-item', 'initials generated', item0.initials === 'AV');
  assert(results, 'switcher-item', 'accent by index 0', item0.accent === 'primary');

  const item3 = toSwitcherItem(sampleMembership, 3);
  assert(results, 'switcher-item', 'accent by index 3', item3.accent === 'warning');

  const item5 = toSwitcherItem(sampleMembership, 5);
  assert(results, 'switcher-item', 'accent wraps mod 4', item5.accent === 'success');

  // ===========================================================================
  // Resultado
  // ===========================================================================
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return NextResponse.json(
    { total: results.length, passed, failed, results },
    { status: failed === 0 ? 200 : 500 },
  );
}
