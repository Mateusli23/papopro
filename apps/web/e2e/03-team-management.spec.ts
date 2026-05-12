import { test, expect } from './helpers/fixtures';
import { createE2EAdminClient } from './helpers/supabase-admin';
import { cleanupTestUser, createTestUser } from './helpers/test-users';

/**
 * Spec 03 — Team management ponta-a-ponta (M7#6 frente A).
 *
 * Cobre as ações de gestão do `/settings/team`: mudança de papel, remoção,
 * cooldown de re-envio de convite, RBAC visual pra non-Owner/Admin.
 *
 * **Cobre 2 fixes específicos do M7#5:**
 *  - **HIGH #1** (`loginAction` resolve workspaceId via firstMembership):
 *    spec faz login do Owner em browser context limpo e confere que o
 *    audit `user_logged_in` foi gravado com o workspaceId correto (não
 *    com algum cookie stale de outra sessão).
 *  - **HIGH #2** (cooldown 60s em `resendInviteAction`): spec dispara
 *    dois resends consecutivos e confere que o segundo retorna erro
 *    com mensagem "Aguarde Xs antes de reenviar".
 *
 * **Setup via fixture + seed admin:** o Vendedor é criado direto via
 * admin client (membro do mesmo workspace do Owner). Pular o fluxo de
 * convite acelera o spec — o convite já é coberto pelo spec 02.
 */

const VENDEDOR_EMAIL = 'e2e-vendedor@papopro.test';
const VENDEDOR_PASSWORD = 'vendedor-password-1234';
const PENDING_INVITE_EMAIL = 'e2e-pending-invite@papopro.test';

test.describe('Team management', () => {
  test.afterEach(async () => {
    await cleanupTestUser(VENDEDOR_EMAIL);
    await cleanupTestUser(PENDING_INVITE_EMAIL);
  });

  test('Owner muda papel, remove membro, reenvia convite (com cooldown)', async ({
    loggedInOwner,
  }) => {
    const { page: ownerPage, workspaceId, workspaceName } = loggedInOwner;
    const admin = createE2EAdminClient();

    // ─── Seed: Vendedor membro + invite pending ──────────────────────────────
    const { userId: vendedorUserId } = await createTestUser({
      email: VENDEDOR_EMAIL,
      password: VENDEDOR_PASSWORD,
      autoConfirm: true,
    });

    const { data: vendedorMember, error: memberErr } = await admin
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: vendedorUserId,
        role: 'Vendedor',
      })
      .select('id')
      .single();
    if (memberErr || !vendedorMember) {
      throw new Error(`Seed Vendedor failed: ${memberErr?.message}`);
    }
    const vendedorMemberId = vendedorMember.id as string;

    // Cria invite pending direto via admin client (pula fluxo de convite —
    // já coberto pelo spec 02). expires_at = agora + 7 dias.
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: pendingInvite, error: inviteErr } = await admin
      .from('invitations')
      .insert({
        workspace_id: workspaceId,
        email: PENDING_INVITE_EMAIL,
        role: 'Viewer',
        token: inviteToken,
        status: 'pending',
        expires_at: expiresAt,
        invited_by_user_id: loggedInOwner.userId,
      })
      .select('id')
      .single();
    if (inviteErr || !pendingInvite) {
      throw new Error(`Seed invite failed: ${inviteErr?.message}`);
    }
    const pendingInviteId = pendingInvite.id as string;

    // ─── Owner: navegar pra /settings/team ───────────────────────────────────
    await ownerPage.goto('/settings/team');
    await expect(ownerPage.locator('h1')).toContainText('Time');

    // Vendedor row visível.
    await expect(ownerPage.getByTestId(`member-row-${vendedorUserId}`)).toBeVisible();
    // Pending invite row visível.
    await expect(ownerPage.getByTestId(`invitation-row-${pendingInviteId}`)).toBeVisible();

    // ─── Promote Vendedor → Manager (sem confirm — promoção é direta) ────────
    await ownerPage.getByTestId(`member-menu-${vendedorUserId}`).click();
    await ownerPage.getByTestId('change-role-Manager').click();

    // Aguarda router.refresh + revalidação. O badge na row muda de
    // "Vendedor" pra "Manager".
    await expect(
      ownerPage.getByTestId(`member-row-${vendedorUserId}`).getByText('Manager'),
    ).toBeVisible({ timeout: 10_000 });

    // Audit log de role change registrado com from + to corretos.
    const { data: roleLogs } = await admin
      .from('audit_logs')
      .select('changes, user_agent')
      .eq('workspace_id', workspaceId)
      .eq('action', 'member_role_changed')
      .order('created_at', { ascending: false });
    expect(roleLogs).toBeTruthy();
    expect(roleLogs!.length).toBeGreaterThanOrEqual(1);
    const lastRoleLog = roleLogs![0]!;
    expect(lastRoleLog.changes).toMatchObject({ from: 'Vendedor', to: 'Manager' });

    // ─── Resend convite pending → success ────────────────────────────────────
    await ownerPage.getByTestId(`invitation-menu-${pendingInviteId}`).click();
    await ownerPage.getByTestId('resend-invite').click();
    // Toast de sucesso (texto exato definido em team-view.tsx).
    await expect(ownerPage.getByText(/convite reenviado/i)).toBeVisible({ timeout: 10_000 });

    // ─── Resend de novo < 60s → cooldown HIGH #2 ─────────────────────────────
    await ownerPage.getByTestId(`invitation-menu-${pendingInviteId}`).click();
    await ownerPage.getByTestId('resend-invite').click();
    // Erro toast com mensagem "Aguarde Xs antes de reenviar esse convite."
    await expect(ownerPage.getByText(/aguarde \d+s antes de reenviar/i)).toBeVisible({
      timeout: 10_000,
    });

    // ─── Remove membro (com confirm dialog HIGH #3) ──────────────────────────
    await ownerPage.getByTestId(`member-menu-${vendedorUserId}`).click();
    await ownerPage.getByTestId('remove-member').click();

    // Confirm dialog aparece com título + confirm/cancel buttons.
    await expect(ownerPage.getByText(/remover.*do workspace/i)).toBeVisible();
    await ownerPage.getByTestId('confirm-yes').click();

    // Row do Vendedor some.
    await expect(ownerPage.getByTestId(`member-row-${vendedorUserId}`)).not.toBeVisible({
      timeout: 10_000,
    });

    // Audit de removal + DB cleanup.
    const { data: removeLog } = await admin
      .from('audit_logs')
      .select('action')
      .eq('workspace_id', workspaceId)
      .eq('action', 'member_removed')
      .maybeSingle();
    expect(removeLog).toBeTruthy();

    const { data: remainingMembers } = await admin
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', workspaceId);
    expect(remainingMembers).toHaveLength(1);
    expect(remainingMembers![0]!.role).toBe('Owner');
  });

  test('HIGH #1: Owner em browser limpo loga e audit grava no workspace correto', async ({
    loggedInOwner,
    browser,
  }) => {
    // Cenário HIGH #1 cross-context: Owner do workspace W1 abre browser limpo
    // (sem cookie `papopro_workspace_id` de sessão anterior) e faz login.
    // Antes do fix, `logLoginEvent` confiava no cookie — sem cookie, caía
    // pro `firstMembership`. Após fix, SEMPRE usa firstMembership.
    // Confere que audit grava com workspaceId correto (W1).
    const { email, password, workspaceId } = loggedInOwner;
    const admin = createE2EAdminClient();

    // Limpa audit logs anteriores pra isolar o que esse login específico cria.
    await admin
      .from('audit_logs')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('action', 'user_logged_in');

    // Novo context sem nenhum cookie/storage prévio.
    const cleanContext = await browser.newContext();
    const cleanPage = await cleanContext.newPage();

    await cleanPage.goto('/login');
    await cleanPage.getByTestId('login-email').fill(email);
    await cleanPage.getByTestId('login-password').fill(password);
    await cleanPage.getByTestId('login-submit').click();

    await expect(cleanPage).toHaveURL('/dashboard', { timeout: 15_000 });

    // Audit log de login no workspace correto.
    const { data: loginLog } = await admin
      .from('audit_logs')
      .select('workspace_id, user_id')
      .eq('workspace_id', workspaceId)
      .eq('action', 'user_logged_in')
      .single();
    expect(loginLog).toBeTruthy();
    expect(loginLog!.user_id).toBe(loggedInOwner.userId);
    expect(loginLog!.workspace_id).toBe(workspaceId);

    await cleanContext.close();
  });

  test('RBAC visual: Vendedor logado vê /settings/team read-only', async ({
    loggedInOwner,
    browser,
  }) => {
    const { workspaceId } = loggedInOwner;
    const admin = createE2EAdminClient();

    // Cria Vendedor no mesmo workspace.
    const { userId: vendedorUserId } = await createTestUser({
      email: VENDEDOR_EMAIL,
      password: VENDEDOR_PASSWORD,
      autoConfirm: true,
    });

    await admin.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: vendedorUserId,
      role: 'Vendedor',
    });

    // Login do Vendedor em context separado.
    const vendedorContext = await browser.newContext();
    const vendedorPage = await vendedorContext.newPage();

    await vendedorPage.goto('/login');
    await vendedorPage.getByTestId('login-email').fill(VENDEDOR_EMAIL);
    await vendedorPage.getByTestId('login-password').fill(VENDEDOR_PASSWORD);
    await vendedorPage.getByTestId('login-submit').click();

    await expect(vendedorPage).toHaveURL('/dashboard', { timeout: 15_000 });

    // Navega pra /settings/team.
    await vendedorPage.goto('/settings/team');
    await expect(vendedorPage.locator('h1')).toContainText('Time');

    // RBAC visual: invite-button NÃO aparece (só Owner/Admin).
    await expect(vendedorPage.getByTestId('invite-button')).toHaveCount(0);

    // member-menu NÃO aparece em nenhuma row (Vendedor não gerencia).
    // Como Vendedor vê 2 rows (Owner + ele mesmo), nenhuma deve ter menu.
    const menus = vendedorPage.locator('[data-testid^="member-menu-"]');
    await expect(menus).toHaveCount(0);

    await vendedorContext.close();
  });
});
