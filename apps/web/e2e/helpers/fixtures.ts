import { test as base, type Page } from '@playwright/test';

import { clearOutbox } from './outbox';
import { createE2EAdminClient } from './supabase-admin';
import { cleanupTestUser, cleanupTestWorkspace, createTestUser } from './test-users';

/**
 * Fixtures Playwright pros specs E2E (M7#6).
 *
 * **Padrão:** cada fixture é uma função `async ({ ... }, use)` que:
 *  1. Faz setup (cria user, workspace, etc).
 *  2. Chama `use(value)` passando o valor pro test.
 *  3. Faz teardown (cleanup) após o test rodar.
 *
 * **Por que não fixtures globais (`globalSetup`):** os specs do M7#6
 * compartilham banco mas cada um precisa de seu próprio Owner + workspace
 * isolados pra não interferir. Fixture per-test é mais previsível.
 *
 * **Workspaces órfãos:** se um spec crashar antes do teardown, o workspace
 * fica no banco. O helper `cleanupOldTestWorkspaces` (em `01-auth-flow.spec`
 * antes do primeiro spec) varre workspaces com nome começando com
 * `e2e-test-` mais antigos que 1h e deleta. Net: nunca acumula garbage.
 */

/** Random suffix por test pra evitar colisão de email/workspace name. */
function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export interface FreshUser {
  email: string;
  password: string;
  userId: string;
}

export interface LoggedInOwner extends FreshUser {
  workspaceId: string;
  workspaceName: string;
  page: Page;
}

interface E2EFixtures {
  /**
   * `freshUser` — cria user confirmado via admin API antes do test e
   * deleta no teardown. Útil pra specs que fazem login direto pela UI
   * sem precisar passar pelo fluxo de signup + verify-email.
   */
  freshUser: FreshUser;

  /**
   * `loggedInOwner` — vai além: cria user + cria workspace + atribui
   * Owner via admin API, depois loga via UI e entrega `page` já em
   * `/dashboard`. Pro spec 02 (invite flow) e 03 (team management),
   * que precisam de Owner pronto pra usar.
   */
  loggedInOwner: LoggedInOwner;
}

export const test = base.extend<E2EFixtures>({
  // `{}` é o padrão Playwright pra fixtures que não dependem de outras —
  // eslint sugere remover mas a assinatura `({deps}, use)` é exigida pela
  // API do `base.extend`. Suppress local em vez de desligar a regra global.
  // eslint-disable-next-line no-empty-pattern
  freshUser: async ({}, use) => {
    const suffix = uniqueSuffix();
    const email = `e2e-fresh-${suffix}@papopro.test`;
    const password = 'test-password-1234';

    const { userId } = await createTestUser({ email, password, autoConfirm: true });

    await use({ email, password, userId });

    await cleanupTestUser(email);
  },

  loggedInOwner: async ({ page }, use) => {
    const suffix = uniqueSuffix();
    const email = `e2e-owner-${suffix}@papopro.test`;
    const password = 'test-password-1234';
    const workspaceName = `e2e-test-${suffix}`;

    const { userId } = await createTestUser({ email, password, autoConfirm: true });

    // Cria workspace + membership Owner via admin client (atalho — replica
    // o que `createWorkspaceAction` faria sem disparar a action). Mais
    // rápido que driblar a UI de onboarding em todo spec.
    const admin = createE2EAdminClient();

    const { data: workspace, error: wsError } = await admin
      .from('workspaces')
      .insert({ name: workspaceName, slug: `e2e-${suffix}` })
      .select('id')
      .single();

    if (wsError || !workspace) {
      throw new Error(`Fixture loggedInOwner: workspace insert failed — ${wsError?.message}`);
    }

    const workspaceId = workspace.id as string;

    const { error: memberError } = await admin.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: 'Owner',
    });
    if (memberError) {
      throw new Error(`Fixture loggedInOwner: member insert failed — ${memberError.message}`);
    }

    // notification_preferences criado por trigger? Não. Trigger é só pra
    // espelhar auth.users em public.users. Aqui criamos manualmente.
    await admin.from('notification_preferences').insert({
      workspace_id: workspaceId,
      user_id: userId,
    });

    // Login via UI. `loginAction` valida credenciais e seta cookies httpOnly
    // que Playwright preserva na BrowserContext. Não usamos atalho de
    // setar cookie direto porque queremos exercitar middleware + Server
    // Action no fluxo real.
    await page.goto('/login');
    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL('/dashboard', { timeout: 15_000 });

    // Outbox limpo antes do teste — fixture cuida do setup state, não só
    // dos dados. `clearOutbox()` é safe-no-op se arquivo não existe.
    await clearOutbox();

    await use({ email, password, userId, workspaceId, workspaceName, page });

    // Teardown: workspace + cascade (members, invitations, audit_logs,
    // notification_preferences) → user.
    await cleanupTestWorkspace(workspaceId);
    await cleanupTestUser(email);
    await clearOutbox();
  },
});

export { expect } from '@playwright/test';
