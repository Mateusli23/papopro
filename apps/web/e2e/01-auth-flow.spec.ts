import { test, expect } from './helpers/fixtures';
import { createE2EAdminClient } from './helpers/supabase-admin';
import { cleanupTestUser, cleanupTestWorkspace, confirmTestUser } from './helpers/test-users';

/**
 * Spec 01 — Auth flow ponta-a-ponta (M7#6 frente A).
 *
 * Cobre o fluxo crítico do produto: signup → verificação de email →
 * login → onboarding → dashboard. Substitui os smoke tests
 * `/api/smoke-test/supabase` que validavam apenas helpers puros — aqui
 * a validação é via browser, com middleware + Server Actions + RLS reais.
 *
 * **Não usa fixture `loggedInOwner`** porque o ponto é exercitar TODO o
 * caminho (signup pela UI, criar workspace pela UI). Fixture seria
 * shortcut pro estado pós-onboarding, que é o que esse spec valida que
 * funciona.
 *
 * **Confirmação de email via admin API:** Playwright não tem inbox.
 * O fluxo real é o usuário clicar no link no email Supabase Auth manda.
 * Atalho: depois do signup, chamamos `admin.auth.admin.updateUserById`
 * com `email_confirm: true` pra forçar `email_confirmed_at`. O middleware
 * a partir daí libera as rotas protegidas.
 */

const TEST_EMAIL = 'e2e-auth-flow@papopro.test';
const TEST_PASSWORD = 'test-password-1234';
const TEST_NAME = 'Maria E2E';
const TEST_WORKSPACE = 'Workspace E2E Auth';

test.describe('Auth flow ponta-a-ponta', () => {
  test.afterEach(async () => {
    // Cleanup defensivo — spec pode crashar antes do happy path. Idempotent.
    await cleanupTestUser(TEST_EMAIL);
    // Workspace de auth-flow é criado sem id conhecido pelo spec (UI gera).
    // Como o nome é único por spec, varremos por nome e deletamos.
    const admin = createE2EAdminClient();
    const { data: ws } = await admin
      .from('workspaces')
      .select('id')
      .eq('name', TEST_WORKSPACE)
      .maybeSingle();
    if (ws?.id) await cleanupTestWorkspace(ws.id as string);
  });

  test('signup → confirm email → login → onboarding → dashboard', async ({ page }) => {
    // ─── Signup ──────────────────────────────────────────────────────────────
    await page.goto('/signup');
    await expect(page.locator('h1')).toContainText('Criar sua conta');

    await page.getByTestId('signup-name').fill(TEST_NAME);
    await page.getByTestId('signup-email').fill(TEST_EMAIL);
    await page.getByTestId('signup-password').fill(TEST_PASSWORD);
    // Checkbox de termos (não tem testid — usar label clicável).
    await page.getByLabel(/termos de uso/i).click();
    await page.getByTestId('signup-submit').click();

    // Pós-signup redireciona pra /verify-email (middleware do M7#3).
    await expect(page).toHaveURL('/verify-email', { timeout: 15_000 });
    await expect(page.locator('h1')).toContainText('Confirme seu email');

    // ─── Confirmação de email (admin API atalho) ─────────────────────────────
    await confirmTestUser(TEST_EMAIL);

    // ─── Login ───────────────────────────────────────────────────────────────
    // Não usamos auth do Supabase via admin client — login é via UI pra
    // exercitar o middleware + loginAction. Workflow real do usuário.
    await page.goto('/login');
    await page.getByTestId('login-email').fill(TEST_EMAIL);
    await page.getByTestId('login-password').fill(TEST_PASSWORD);
    await page.getByTestId('login-submit').click();

    // User confirmado mas sem workspace → middleware manda pra /onboarding.
    await expect(page).toHaveURL('/onboarding', { timeout: 15_000 });
    await expect(page.locator('h1')).toContainText('Como vamos chamar seu workspace');

    // ─── Onboarding ──────────────────────────────────────────────────────────
    await page.getByTestId('onboarding-name').fill(TEST_WORKSPACE);
    await page.getByTestId('onboarding-submit').click();

    // Pós-criação redireciona pra /dashboard com cookie de workspace ativo.
    await expect(page).toHaveURL('/dashboard', { timeout: 15_000 });

    // Sidebar mostra o nome do workspace (workspace switcher real do M7#4 Onda 3).
    await expect(page.getByText(TEST_WORKSPACE).first()).toBeVisible({ timeout: 10_000 });

    // ─── Asserções de audit (DB direto) ──────────────────────────────────────
    const admin = createE2EAdminClient();

    // Workspace foi criado com a tupla correta (slug derivado do nome).
    const { data: workspace } = await admin
      .from('workspaces')
      .select('id, name')
      .eq('name', TEST_WORKSPACE)
      .single();
    expect(workspace).toBeTruthy();
    expect(workspace!.name).toBe(TEST_WORKSPACE);

    // workspace_members tem o user como Owner.
    const { data: members } = await admin
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', workspace!.id);
    expect(members).toHaveLength(1);
    const ownerMember = members![0]!;
    expect(ownerMember.role).toBe('Owner');

    // audit_logs tem user_logged_in com workspaceId resolvido via firstMembership
    // (cobre HIGH #1 do M7#5 — workspaceId NÃO vem do cookie stale de outra
    // sessão, vem da membership do user que acabou de logar).
    const { data: loginLog } = await admin
      .from('audit_logs')
      .select('workspace_id, user_id, action')
      .eq('workspace_id', workspace!.id)
      .eq('action', 'user_logged_in')
      .maybeSingle();
    expect(loginLog).toBeTruthy();
    expect(loginLog!.user_id).toBe(ownerMember.user_id);

    // workspace_created também (Server Action createWorkspaceAction grava).
    const { data: createLog } = await admin
      .from('audit_logs')
      .select('action')
      .eq('workspace_id', workspace!.id)
      .eq('action', 'workspace_created')
      .maybeSingle();
    expect(createLog).toBeTruthy();
  });
});
