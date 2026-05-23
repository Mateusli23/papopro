/**
 * Smoke test de Configurações — valida transforms puras, fixtures, schemas Zod
 * e cálculo de health score.
 *
 * Existe pra dar confiança nos contratos do domínio antes de Vitest entrar em
 * M7+, e pra fixar shapes que viram Server Actions em M7–M13 (`updateWorkspace`,
 * `inviteMember`, `togglePref`, `connectWhatsApp`, `regenerateWebhookToken`).
 * Tipos permanecem; muda só a fonte (fixture → Postgres / Stripe / uazapi).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/settings` →
 * `{summary, results}` JSON. HTTP 200 se `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import {
  changeRoleSchema,
  inviteMemberSchema,
  notificationPrefSchema,
  toggleIntegrationSchema,
  transferOwnershipSchema,
  workspaceUpdateSchema,
} from '@/features/settings/schemas';
import {
  applyChangeRole,
  applyConnect,
  applyDisconnect,
  applyInviteMember,
  applyRegenerateWebhookToken,
  applyRemoveMember,
  applyResendInvite,
  applyToggleIntegration,
  applyTogglePref,
  applyTransferOwnership,
  applyUpdateWorkspace,
  computeHealthScore,
  computeUsageRatios,
  countMembers,
  generateWebhookToken,
} from '@/features/settings/transforms';
import { blockSmokeInProd } from '@/lib/dev/smoke-guard';
import { FAKE_MEMBERS } from '@/lib/fixtures/members';
import { FAKE_NOTIFICATION_PREFS, NOTIFICATION_EVENTS } from '@/lib/fixtures/notification-prefs';
import {
  FAKE_WHATSAPP_CONNECTION,
  FAKE_WHATSAPP_DISCONNECTED,
  FAKE_WHATSAPP_YELLOW,
} from '@/lib/fixtures/whatsapp-connection';
import {
  FAKE_INTEGRATIONS,
  FAKE_SUBSCRIPTION,
  FAKE_WEBHOOK,
  FAKE_WORKSPACE,
} from '@/lib/fixtures/workspace-settings';

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

// ID generators determinísticos pra não colidir com fixtures (`mb_NNNNN`,
// `out_NNNNN`).
let memberCounter = 9000;
const memberIdGen = () => `mb_test_${(++memberCounter).toString().padStart(5, '0')}`;
let outageCounter = 9000;
const outageIdGen = () => `out_test_${(++outageCounter).toString().padStart(5, '0')}`;

export const dynamic = 'force-dynamic';

export function GET() {
  const blocked = blockSmokeInProd();
  if (blocked) return blocked;

  const results: CheckResult[] = [];

  // ── Fixtures ────────────────────────────────────────────────────────────
  let t = run('fixtures', results);
  t('FAKE_WORKSPACE tem nome não-vazio', () => FAKE_WORKSPACE.name.length > 0);
  t('FAKE_WORKSPACE tem timezone IANA', () => FAKE_WORKSPACE.timezone.includes('/'));
  t('FAKE_WORKSPACE.locale é pt-BR', () => FAKE_WORKSPACE.locale === 'pt-BR');
  t(
    'FAKE_MEMBERS tem 7 entradas',
    () => FAKE_MEMBERS.length === 7 || `length=${FAKE_MEMBERS.length}`,
  );
  t('FAKE_MEMBERS cobre 5 papéis', () => new Set(FAKE_MEMBERS.map((m) => m.role)).size === 5);
  t(
    'exatamente 1 Owner em FAKE_MEMBERS',
    () =>
      FAKE_MEMBERS.filter((m) => m.role === 'owner').length === 1 || 'múltiplos owners ou nenhum',
  );
  t('≥ 1 membro com status invited', () => FAKE_MEMBERS.some((m) => m.status === 'invited'));
  t('invitedAt presente em todos os invites', () =>
    FAKE_MEMBERS.filter((m) => m.status === 'invited').every((m) => !!m.invitedAt),
  );
  t('IDs de membro únicos', () => {
    const ids = FAKE_MEMBERS.map((m) => m.id);
    return new Set(ids).size === ids.length;
  });
  t(
    'NOTIFICATION_EVENTS tem 10 eventos (matriz PRD §3.2)',
    () => NOTIFICATION_EVENTS.length === 10 || `length=${NOTIFICATION_EVENTS.length}`,
  );
  t('keys de eventos únicas', () => {
    const keys = NOTIFICATION_EVENTS.map((e) => e.key);
    return new Set(keys).size === keys.length;
  });
  t('todo evento tem ≥ 1 canal', () => NOTIFICATION_EVENTS.every((e) => e.channels.length >= 1));
  t('eventos administrativos (invite + payment_failed)', () => {
    const admins = NOTIFICATION_EVENTS.filter((e) => e.isAdministrative).map((e) => e.key);
    return (
      admins.length === 2 &&
      admins.includes('workspace_invite_received') &&
      admins.includes('payment_failed')
    );
  });
  t('FAKE_NOTIFICATION_PREFS cobre todos os eventos', () =>
    NOTIFICATION_EVENTS.every((e) => e.key in FAKE_NOTIFICATION_PREFS),
  );
  t('default = todos os canais permitidos ON', () => {
    for (const e of NOTIFICATION_EVENTS) {
      const prefs = FAKE_NOTIFICATION_PREFS[e.key];
      for (const c of e.channels) {
        if (prefs?.[c] !== true) return `${e.key}/${c} não está ON`;
      }
    }
    return true;
  });
  t(
    'FAKE_WHATSAPP_CONNECTION tem 5 quedas',
    () =>
      FAKE_WHATSAPP_CONNECTION.outages.length === 5 ||
      `outages=${FAKE_WHATSAPP_CONNECTION.outages.length}`,
  );
  t('outages cobrem 4 motivos distintos', () => {
    const reasons = new Set(FAKE_WHATSAPP_CONNECTION.outages.map((o) => o.reason));
    return reasons.size >= 4 || `reasons=${reasons.size}`;
  });
  t(
    'deliveryRate em [0,1]',
    () => FAKE_WHATSAPP_CONNECTION.deliveryRate >= 0 && FAKE_WHATSAPP_CONNECTION.deliveryRate <= 1,
  );
  t('FAKE_SUBSCRIPTION tem ≥ 1 fatura', () => FAKE_SUBSCRIPTION.invoices.length >= 1);
  t('limites do plano > 0', () => {
    const l = FAKE_SUBSCRIPTION.limits;
    return l.users > 0 && l.leads > 0 && l.outboundMonth > 0 && l.agents > 0;
  });
  t('FAKE_INTEGRATIONS tem 6 entradas', () => FAKE_INTEGRATIONS.length === 6);
  t(
    'webhook_leads + google_calendar começam conectadas',
    () =>
      FAKE_INTEGRATIONS.find((i) => i.key === 'webhook_leads')?.status === 'connected' &&
      FAKE_INTEGRATIONS.find((i) => i.key === 'google_calendar')?.status === 'connected',
  );
  t(
    'FAKE_WEBHOOK.token tem 32 chars hex',
    () => /^[a-f0-9]{32}$/.test(FAKE_WEBHOOK.token) || `token=${FAKE_WEBHOOK.token.slice(0, 8)}…`,
  );

  // ── Schemas ─────────────────────────────────────────────────────────────
  t = run('schemas', results);
  t('workspaceUpdateSchema aceita input válido', () => {
    const r = workspaceUpdateSchema.safeParse({
      name: 'Empresa X',
      segment: 'b2b',
      timezone: 'America/Sao_Paulo',
    });
    return r.success;
  });
  t('workspaceUpdateSchema rejeita nome curto', () => {
    const r = workspaceUpdateSchema.safeParse({
      name: 'A',
      segment: 'b2b',
      timezone: 'America/Sao_Paulo',
    });
    return !r.success;
  });
  t('workspaceUpdateSchema rejeita segmento inválido', () => {
    const r = workspaceUpdateSchema.safeParse({
      name: 'Empresa X',
      segment: 'industrial' as never,
      timezone: 'America/Sao_Paulo',
    });
    return !r.success;
  });
  t('inviteMemberSchema aceita email válido', () => {
    const r = inviteMemberSchema.safeParse({ email: 'a@b.com', role: 'vendedor' });
    return r.success;
  });
  t('inviteMemberSchema rejeita email mal-formado', () => {
    const r = inviteMemberSchema.safeParse({ email: 'nao-eh-email', role: 'vendedor' });
    return !r.success;
  });
  t('inviteMemberSchema rejeita role owner (precisa de transferência)', () => {
    const r = inviteMemberSchema.safeParse({ email: 'a@b.com', role: 'owner' as never });
    return !r.success;
  });
  t('changeRoleSchema aceita roles válidos', () => {
    const r = changeRoleSchema.safeParse({ memberId: 'mb_1', role: 'admin' });
    return r.success;
  });
  t('transferOwnershipSchema exige newOwnerId', () => {
    const r = transferOwnershipSchema.safeParse({ newOwnerId: '' });
    return !r.success;
  });
  t('notificationPrefSchema aceita canal válido', () => {
    const r = notificationPrefSchema.safeParse({
      event: 'lead_cooling',
      channel: 'push',
      enabled: false,
    });
    return r.success;
  });
  t('notificationPrefSchema rejeita canal inválido', () => {
    const r = notificationPrefSchema.safeParse({
      event: 'lead_cooling',
      channel: 'sms' as never,
      enabled: true,
    });
    return !r.success;
  });
  t('toggleIntegrationSchema valida key + connect', () => {
    const r = toggleIntegrationSchema.safeParse({ key: 'google_calendar', connect: true });
    return r.success;
  });

  // ── Transforms: workspace ──────────────────────────────────────────────
  t = run('transforms-workspace', results);
  t('applyUpdateWorkspace muda nome', () => {
    const next = applyUpdateWorkspace(FAKE_WORKSPACE, {
      name: 'Outro Nome',
      segment: 'imobiliario',
      timezone: 'America/Sao_Paulo',
    });
    return next.name === 'Outro Nome';
  });
  t('applyUpdateWorkspace preserva campos não-editados', () => {
    // Já não faz early-return (review M5#6: protege futuras props como `logo`).
    // Garantia: campos não passados no patch sobrevivem (ex: `logo`, `createdAt`).
    const next = applyUpdateWorkspace(FAKE_WORKSPACE, {
      name: FAKE_WORKSPACE.name,
      segment: FAKE_WORKSPACE.segment,
      timezone: FAKE_WORKSPACE.timezone,
    });
    return (
      next !== FAKE_WORKSPACE &&
      next.logo === FAKE_WORKSPACE.logo &&
      next.createdAt === FAKE_WORKSPACE.createdAt &&
      next.locale === FAKE_WORKSPACE.locale
    );
  });
  t('applyTransferOwnership rebaixa Owner anterior', () => {
    const target = FAKE_MEMBERS.find((m) => m.id === 'mb_00002')!;
    const r = applyTransferOwnership(FAKE_MEMBERS, { newOwnerId: target.id });
    if (!r.ok) return r.reason ?? 'falhou inesperado';
    const newOwners = r.members.filter((m) => m.role === 'owner');
    const oldOwner = r.members.find((m) => m.id === 'mb_00001');
    return newOwners.length === 1 && newOwners[0]?.id === target.id && oldOwner?.role === 'admin';
  });
  t('applyTransferOwnership rejeita transferir pra Owner atual', () => {
    const r = applyTransferOwnership(FAKE_MEMBERS, { newOwnerId: 'mb_00001' });
    return !r.ok;
  });
  t('applyTransferOwnership rejeita destinatário inválido', () => {
    const r = applyTransferOwnership(FAKE_MEMBERS, { newOwnerId: 'mb_inexistente' });
    return !r.ok;
  });
  t('applyTransferOwnership rejeita destinatário só convidado', () => {
    const r = applyTransferOwnership(FAKE_MEMBERS, { newOwnerId: 'mb_00007' });
    return !r.ok;
  });

  // ── Transforms: members ────────────────────────────────────────────────
  t = run('transforms-members', results);
  t('applyInviteMember adiciona invite pendente', () => {
    const r = applyInviteMember(
      FAKE_MEMBERS,
      { email: 'novo@empresa.com.br', role: 'vendedor' },
      memberIdGen,
    );
    return (
      !!r.created && r.created.status === 'invited' && r.members.length === FAKE_MEMBERS.length + 1
    );
  });
  t('applyInviteMember normaliza email pra lowercase', () => {
    const r = applyInviteMember(
      FAKE_MEMBERS,
      { email: 'OUTRO@Empresa.com', role: 'manager' },
      memberIdGen,
    );
    return r.created?.email === 'outro@empresa.com';
  });
  t('applyInviteMember detecta duplicado', () => {
    const r = applyInviteMember(
      FAKE_MEMBERS,
      { email: 'beatriz@vistamar.com.br', role: 'vendedor' },
      memberIdGen,
    );
    return !!r.existing && !r.created;
  });
  t('applyChangeRole muda papel de Vendedor pra Admin', () => {
    const r = applyChangeRole(FAKE_MEMBERS, { memberId: 'mb_00004', role: 'admin' });
    if (!r.ok) return r.reason ?? 'falhou';
    return r.members.find((m) => m.id === 'mb_00004')?.role === 'admin';
  });
  t('applyChangeRole rejeita promover pra owner direto', () => {
    const r = applyChangeRole(FAKE_MEMBERS, { memberId: 'mb_00004', role: 'owner' });
    return !r.ok;
  });
  t('applyChangeRole rejeita rebaixar Owner', () => {
    const r = applyChangeRole(FAKE_MEMBERS, { memberId: 'mb_00001', role: 'admin' });
    return !r.ok;
  });
  t('applyResendInvite atualiza invitedAt', () => {
    const r = applyResendInvite(FAKE_MEMBERS, 'mb_00007', '2030-01-01T00:00:00Z');
    if (!r.ok) return 'falhou';
    return r.members.find((m) => m.id === 'mb_00007')?.invitedAt === '2030-01-01T00:00:00Z';
  });
  t('applyResendInvite ignora membro ativo', () => {
    const r = applyResendInvite(FAKE_MEMBERS, 'mb_00002');
    return !r.ok;
  });
  t('applyRemoveMember remove vendedor', () => {
    const r = applyRemoveMember(FAKE_MEMBERS, 'mb_00005');
    return r.ok && r.members.length === FAKE_MEMBERS.length - 1;
  });
  t('applyRemoveMember rejeita Owner', () => {
    const r = applyRemoveMember(FAKE_MEMBERS, 'mb_00001');
    return !r.ok;
  });
  t('countMembers agrega corretamente', () => {
    const c = countMembers(FAKE_MEMBERS);
    return (
      c.total === 7 &&
      c.active === 6 &&
      c.invited === 1 &&
      c.byRole.owner === 1 &&
      c.byRole.admin === 1 &&
      c.byRole.vendedor === 3 // 2 ativos + 1 convite
    );
  });

  // ── Transforms: notifications ──────────────────────────────────────────
  t = run('transforms-notifications', results);
  t('applyTogglePref desliga canal não-administrativo', () => {
    const r = applyTogglePref(FAKE_NOTIFICATION_PREFS, NOTIFICATION_EVENTS, {
      event: 'lead_cooling',
      channel: 'push',
      enabled: false,
    });
    return r.ok && r.prefs.lead_cooling.push === false;
  });
  t('applyTogglePref BLOQUEIA desligar evento administrativo', () => {
    const r = applyTogglePref(FAKE_NOTIFICATION_PREFS, NOTIFICATION_EVENTS, {
      event: 'workspace_invite_received',
      channel: 'email',
      enabled: false,
    });
    return !r.ok && !!r.reason;
  });
  t('applyTogglePref BLOQUEIA desligar payment_failed', () => {
    const r = applyTogglePref(FAKE_NOTIFICATION_PREFS, NOTIFICATION_EVENTS, {
      event: 'payment_failed',
      channel: 'email',
      enabled: false,
    });
    return !r.ok;
  });
  t('applyTogglePref rejeita canal inexistente pro evento', () => {
    const r = applyTogglePref(FAKE_NOTIFICATION_PREFS, NOTIFICATION_EVENTS, {
      event: 'bulk_send_finished',
      channel: 'email',
      enabled: true,
    });
    return !r.ok;
  });
  t('applyTogglePref rejeita evento desconhecido', () => {
    const r = applyTogglePref(FAKE_NOTIFICATION_PREFS, NOTIFICATION_EVENTS, {
      event: 'nao_existe',
      channel: 'push',
      enabled: false,
    });
    return !r.ok;
  });
  t('applyTogglePref no-op preserva referência do snapshot', () => {
    const r = applyTogglePref(FAKE_NOTIFICATION_PREFS, NOTIFICATION_EVENTS, {
      event: 'lead_cooling',
      channel: 'push',
      enabled: true, // já estava ON no default
    });
    return r.ok && r.prefs === FAKE_NOTIFICATION_PREFS;
  });

  // ── Transforms: connections ────────────────────────────────────────────
  t = run('transforms-connections', results);
  t('computeHealthScore = green em conexão saudável', () => {
    return computeHealthScore(FAKE_WHATSAPP_CONNECTION) === 'green';
  });
  t('computeHealthScore = red em desconectado', () => {
    return computeHealthScore(FAKE_WHATSAPP_DISCONNECTED) === 'red';
  });
  t('computeHealthScore = yellow em delivery degradado', () => {
    return computeHealthScore(FAKE_WHATSAPP_YELLOW) === 'yellow';
  });
  t('computeHealthScore = red com muitas quedas', () => {
    const downCheio = {
      ...FAKE_WHATSAPP_CONNECTION,
      deliveryRate: 0.5,
      outages: [
        ...FAKE_WHATSAPP_CONNECTION.outages,
        {
          id: 'out_red_1',
          startedAt: new Date().toISOString(),
          durationMin: 200,
          reason: 'rede' as const,
          action: '',
        },
      ],
    };
    return computeHealthScore(downCheio) === 'red';
  });
  t('applyConnect transiciona disconnected → connected', () => {
    const next = applyConnect(FAKE_WHATSAPP_DISCONNECTED);
    return next.status === 'connected' && !!next.connectedAt;
  });
  t('applyConnect é idempotente em conn já conectada', () => {
    const next = applyConnect(FAKE_WHATSAPP_CONNECTION);
    return next === FAKE_WHATSAPP_CONNECTION;
  });
  t('applyDisconnect adiciona outage no topo', () => {
    const next = applyDisconnect(FAKE_WHATSAPP_CONNECTION, 'manual', outageIdGen);
    return (
      next.status === 'disconnected' &&
      next.outages.length === FAKE_WHATSAPP_CONNECTION.outages.length + 1 &&
      next.outages[0]?.reason === 'manual'
    );
  });
  t('applyDisconnect é idempotente em conn já desconectada', () => {
    const next = applyDisconnect(FAKE_WHATSAPP_DISCONNECTED, 'rede', outageIdGen);
    return next === FAKE_WHATSAPP_DISCONNECTED;
  });
  t('applyDisconnect deixa durationMin undefined (queda em andamento)', () => {
    const next = applyDisconnect(FAKE_WHATSAPP_CONNECTION, 'manual', outageIdGen);
    return next.outages[0]?.durationMin === undefined;
  });
  t('applyTransferOwnership rejeita workspace sem Owner', () => {
    const semOwner = FAKE_MEMBERS.filter((m) => m.role !== 'owner');
    const r = applyTransferOwnership(semOwner, { newOwnerId: 'mb_00002' });
    return !r.ok;
  });

  // ── Transforms: integrations / billing ─────────────────────────────────
  t = run('transforms-integrations', results);
  t('applyToggleIntegration conecta', () => {
    const start = FAKE_INTEGRATIONS.map((i) =>
      i.key === 'meta_ads' ? { ...i, status: 'disconnected' as const } : i,
    );
    const r = applyToggleIntegration(start, { key: 'meta_ads', connect: true });
    if (!r.ok) return r.reason ?? 'falhou';
    return r.integrations.find((i) => i.key === 'meta_ads')?.status === 'connected';
  });
  t('applyToggleIntegration rejeita integração soon', () => {
    const r = applyToggleIntegration(FAKE_INTEGRATIONS, { key: 'meta_ads', connect: true });
    return !r.ok;
  });
  t('applyToggleIntegration rejeita key desconhecida', () => {
    const r = applyToggleIntegration(FAKE_INTEGRATIONS, {
      key: 'nao_existe',
      connect: true,
    });
    return !r.ok;
  });
  t('generateWebhookToken produz 32 chars hex', () => {
    const token = generateWebhookToken();
    return /^[a-f0-9]{32}$/.test(token) || `token=${token}`;
  });
  t('applyRegenerateWebhookToken muda token', () => {
    const next = applyRegenerateWebhookToken(FAKE_WEBHOOK);
    return next.token !== FAKE_WEBHOOK.token && /^[a-f0-9]{32}$/.test(next.token);
  });
  t('computeUsageRatios calcula proporções', () => {
    const r = computeUsageRatios(FAKE_SUBSCRIPTION);
    return (
      Math.abs(r.users - 0.8) < 0.001 &&
      Math.abs(r.agents - 2 / 3) < 0.001 &&
      r.leads > 0 &&
      r.leads < 1
    );
  });

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    groups: Array.from(new Set(results.map((r) => r.group))).map((g) => ({
      group: g,
      passed: results.filter((r) => r.group === g && r.ok).length,
      failed: results.filter((r) => r.group === g && !r.ok).length,
    })),
  };

  return NextResponse.json({ summary, results }, { status: summary.failed === 0 ? 200 : 500 });
}
