import { test, expect } from './helpers/fixtures';
import { extractInviteToken, readOutbox, waitForEmailTo } from './helpers/outbox';
import { createE2EAdminClient } from './helpers/supabase-admin';
import { cleanupTestUser, confirmTestUser } from './helpers/test-users';

/**
 * Spec 02 — Invite flow ponta-a-ponta (M7#6 frente A).
 *
 * Cobre o fluxo completo de convite: Owner convida via UI → email cai
 * no outbox local (RESEND_MODE=outbox) → segundo browser context abre o
 * magic link → signup do convidado → confirma email → aceita convite →
 * cai em `/dashboard` do workspace do Owner.
 *
 * **Por que dois browser contexts:** o convidado começa logged out. Em
 * vez de manipular cookies/auth do mesmo `page`, abrimos `context2` com
 * estado limpo — simula fielmente "Owner manda link via WhatsApp, convidado
 * abre no celular dele".
 *
 * **Atalhos vs UI real:**
 * - Setup de Owner+workspace: via fixture `loggedInOwner` (admin client,
 *   pula UI de onboarding). Foco do spec é o fluxo de convite, não
 *   criação de workspace.
 * - Confirmação de email do convidado: `confirmTestUser` via admin
 *   (Playwright não tem inbox).
 * - Tudo o mais (invite form, magic link, accept, redirects): via UI real.
 */

const INVITEE_EMAIL = 'e2e-invitee@papopro.test';
const INVITEE_PASSWORD = 'invitee-password-1234';
const INVITEE_NAME = 'João Convidado';

test.describe('Invite flow', () => {
  test.afterEach(async () => {
    // Cleanup defensivo do convidado — Owner+workspace o fixture cuida no
    // teardown automaticamente.
    await cleanupTestUser(INVITEE_EMAIL);
  });

  test('Owner convida → email cai no outbox → convidado aceita → entra no workspace', async ({
    loggedInOwner,
    browser,
  }) => {
    const { page: ownerPage, workspaceId, workspaceName } = loggedInOwner;

    // ─── Owner: enviar convite via UI ────────────────────────────────────────
    await ownerPage.goto('/settings/team');
    await expect(ownerPage.locator('h1')).toContainText('Time');
    await ownerPage.getByTestId('invite-button').click();

    // Dialog de convite aparece.
    await ownerPage.getByTestId('invite-email').fill(INVITEE_EMAIL);

    // Select Radix — trigger + item clicáveis.
    await ownerPage.getByTestId('invite-role-trigger').click();
    await ownerPage.getByTestId('invite-role-Vendedor').click();

    await ownerPage.getByTestId('invite-submit').click();

    // Toast de sucesso + dialog fecha. Aguardamos o invitations row aparecer
    // na lista de convites pendentes pra confirmar o submit completou.
    await expect(ownerPage.getByText(INVITEE_EMAIL).first()).toBeVisible({ timeout: 10_000 });

    // ─── Outbox: extrair magic link ──────────────────────────────────────────
    const email = await waitForEmailTo(INVITEE_EMAIL, { timeoutMs: 10_000 });
    expect(email.subject).toMatch(/convite/i);
    const token = extractInviteToken(email.html);
    expect(token).toHaveLength(36); // UUID v4

    // ─── Convidado (context limpo): abrir magic link ─────────────────────────
    const context2 = await browser.newContext();
    const inviteePage = await context2.newPage();

    await inviteePage.goto(`/invite/accept?token=${token}`);

    // Variante (2): Token válido + user não logado → CTA "Criar conta e aceitar"
    await expect(inviteePage.locator('h1')).toContainText(workspaceName);
    await expect(inviteePage.getByText(INVITEE_EMAIL)).toBeVisible();

    // Click no CTA leva pra /signup com email pré-fillado + `?next=` apontando
    // de volta pro convite.
    await inviteePage.getByRole('link', { name: /criar conta e aceitar/i }).click();
    await expect(inviteePage).toHaveURL(/\/signup\?next=.*&email=/);

    // ─── Convidado: signup ───────────────────────────────────────────────────
    // Email já pré-preenchido (readOnly via prefilledEmail prop do signup-form).
    await expect(inviteePage.getByTestId('signup-email')).toHaveValue(INVITEE_EMAIL);

    await inviteePage.getByTestId('signup-name').fill(INVITEE_NAME);
    await inviteePage.getByTestId('signup-password').fill(INVITEE_PASSWORD);
    await inviteePage.getByLabel(/termos de uso/i).click();
    await inviteePage.getByTestId('signup-submit').click();

    // Redireciona pra /verify-email (signup criou conta, falta confirmar).
    await expect(inviteePage).toHaveURL('/verify-email', { timeout: 15_000 });

    // ─── Atalho: confirmar email via admin ───────────────────────────────────
    await confirmTestUser(INVITEE_EMAIL);

    // ─── Convidado: re-abrir magic link (agora logado + confirmado) ──────────
    // Em produção o user clica no link de confirmação de email do Supabase,
    // que redireciona pro `?next=` (o /invite/accept). Aqui simulamos abrindo
    // direto — o cookie de sessão já foi setado pelo signup; só faltava o
    // email_confirmed_at.
    await inviteePage.goto(`/invite/accept?token=${token}`);

    // Variante (4): logado + email bate → AcceptInvitationForm renderiza.
    await expect(inviteePage.locator('h1')).toContainText(workspaceName);
    await inviteePage.getByTestId('accept-submit').click();

    // Pós-aceite redireciona pra /dashboard do workspace.
    await expect(inviteePage).toHaveURL('/dashboard', { timeout: 15_000 });
    await expect(inviteePage.getByText(workspaceName).first()).toBeVisible({ timeout: 10_000 });

    // ─── Asserções de DB ─────────────────────────────────────────────────────
    const admin = createE2EAdminClient();

    // workspace_members agora tem 2 rows (Owner + Vendedor aceito).
    const { data: members } = await admin
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', workspaceId);
    expect(members).toHaveLength(2);
    const newMember = members!.find((m) => m.role === 'Vendedor');
    expect(newMember).toBeTruthy();

    // Invitation passou pra status `accepted`.
    const { data: invite } = await admin
      .from('invitations')
      .select('status, email')
      .eq('workspace_id', workspaceId)
      .eq('email', INVITEE_EMAIL)
      .single();
    expect(invite!.status).toBe('accepted');

    // Audit log de `member_joined` registrado com workspaceId + userId corretos
    // + ipAddress + userAgent preenchidos via getRequestAuditContext.
    const { data: joinLog } = await admin
      .from('audit_logs')
      .select('user_id, action, user_agent')
      .eq('workspace_id', workspaceId)
      .eq('action', 'member_joined')
      .maybeSingle();
    expect(joinLog).toBeTruthy();
    expect(joinLog!.user_id).toBe(newMember!.user_id);
    // userAgent pode ser null em dev sem proxy — só asserta se preenchido.
    if (joinLog!.user_agent) {
      expect(joinLog!.user_agent).toMatch(/chrome|webkit/i);
    }

    // Outbox só teve 1 email (o convite original — sem disparos extras).
    const allEmails = await readOutbox();
    expect(allEmails).toHaveLength(1);

    await context2.close();
  });
});
