-- =============================================================================
-- PapoPro — M7#2 — Migration init_auth_and_multi_tenant
-- =============================================================================
-- Projeto alvo: `iffmjydjeukozopxxitb` ("papo pro", sa-east-1, criado 2026-05-11).
-- Aplicar via MCP `apply_migration` (recomendado, server-side) ou via Dashboard:
-- https://supabase.com/dashboard/project/iffmjydjeukozopxxitb/sql/new
-- Refs anteriores (deletados): `celuvzodbmobkigdoetm`, `ulmswswmriweyxkwelim`.
--
-- Idempotente: roda múltiplas vezes sem erro graças a IF NOT EXISTS / CREATE OR REPLACE.
-- Apenas blocos DO $$ ... $$ envolvem CREATE TYPE/POLICY (que não aceitam IF NOT EXISTS).
--
-- Pós-aplicação validar:
--   SELECT count(*) FROM information_schema.tables WHERE table_schema='public';  -- = 7
--   SELECT count(*) FROM pg_policies WHERE schemaname='public';                  -- ~20
--   SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal;                      -- ≥ 6
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Extensões (idempotente — já habilitadas em M7#1, mas garantia)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext   WITH SCHEMA extensions;
-- Se a extension já existir em `public` (versão antiga deste SQL), move pra extensions.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON e.extnamespace=n.oid WHERE extname='pg_trgm' AND n.nspname='public') THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON e.extnamespace=n.oid WHERE extname='citext' AND n.nspname='public') THEN
    ALTER EXTENSION citext SET SCHEMA extensions;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.role AS ENUM ('Owner','Admin','Manager','Vendedor','Viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','expired','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM (
    'workspace_created','workspace_updated',
    'member_invited','member_joined','member_role_changed','member_removed',
    'invitation_revoked',
    'user_logged_in','user_logged_out',
    'export_started','data_deleted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 3. Tabelas
-- -----------------------------------------------------------------------------

-- 3.1 workspaces — tenant isolado
CREATE TABLE IF NOT EXISTS public.workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(60)  NOT NULL,
  slug        varchar(80)  NOT NULL UNIQUE,
  logo_url    text,
  segment     varchar(32),
  plan        varchar(32)  NOT NULL DEFAULT 'Pro',
  timezone    varchar(64)  NOT NULL DEFAULT 'America/Sao_Paulo',
  locale      varchar(8)   NOT NULL DEFAULT 'pt-BR',
  settings    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz  NOT NULL DEFAULT NOW(),
  updated_at  timestamptz  NOT NULL DEFAULT NOW(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS workspaces_deleted_at_idx ON public.workspaces (deleted_at);

-- 3.2 users — espelho de auth.users (populado por trigger)
CREATE TABLE IF NOT EXISTS public.users (
  id                  uuid PRIMARY KEY,
  email               citext       NOT NULL UNIQUE,
  name                varchar(120),
  avatar_url          text,
  email_verified_at   timestamptz,
  created_at          timestamptz  NOT NULL DEFAULT NOW(),
  updated_at          timestamptz  NOT NULL DEFAULT NOW()
);

-- 3.3 workspace_members — RBAC
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.users(id)      ON DELETE RESTRICT,
  role          public.role NOT NULL,
  invited_at    timestamptz,
  joined_at     timestamptz,
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_members_workspace_user_key UNIQUE (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS workspace_members_workspace_id_idx ON public.workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx      ON public.workspace_members (user_id);

-- 3.4 invitations — convite por magic link
CREATE TABLE IF NOT EXISTS public.invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid                     NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email           citext                   NOT NULL,
  role            public.role              NOT NULL,
  token           uuid                     NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at      timestamptz              NOT NULL,
  status          public.invitation_status NOT NULL DEFAULT 'pending',
  created_by_id   uuid                     NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  accepted_at     timestamptz,
  created_at      timestamptz              NOT NULL DEFAULT NOW(),
  CONSTRAINT invitations_workspace_email_key UNIQUE (workspace_id, email)
);
CREATE INDEX IF NOT EXISTS invitations_workspace_id_idx ON public.invitations (workspace_id);
CREATE INDEX IF NOT EXISTS invitations_token_idx        ON public.invitations (token);

-- 3.5 audit_logs — LGPD append-only
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid                NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid                         REFERENCES public.users(id)      ON DELETE SET NULL,
  action        public.audit_action NOT NULL,
  entity_type   varchar(64),
  entity_id     varchar(64),
  changes       jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz         NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_workspace_id_created_at_idx ON public.audit_logs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_workspace_id_user_id_idx    ON public.audit_logs (workspace_id, user_id);

-- 3.6 notification_preferences — JSONB wide
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  prefs         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_preferences_workspace_user_key UNIQUE (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS notification_preferences_user_id_idx ON public.notification_preferences (user_id);

-- 3.7 webhook_events — idempotência append-only
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid          NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source            varchar(32)   NOT NULL,
  external_id       varchar(128)  NOT NULL,
  payload           jsonb         NOT NULL,
  signature_valid   boolean       NOT NULL DEFAULT false,
  processed_at      timestamptz,
  error             text,
  created_at        timestamptz   NOT NULL DEFAULT NOW(),
  CONSTRAINT webhook_events_source_external_id_key UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS webhook_events_workspace_source_created_at_idx
  ON public.webhook_events (workspace_id, source, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Trigger utilitário — touch updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_updated_at ON public.workspaces;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.users;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.workspace_members;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON public.notification_preferences;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Trigger auth.users → public.users (padrão Supabase oficial)
-- -----------------------------------------------------------------------------

-- 5.1 Cria linha em public.users no INSERT de auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, email_verified_at, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email_confirmed_at,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 5.2 Sincroniza email_verified_at quando user confirma email
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS DISTINCT FROM OLD.email_confirmed_at THEN
    UPDATE public.users
       SET email_verified_at = NEW.email_confirmed_at,
           updated_at        = NOW()
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_email_confirmed();

-- -----------------------------------------------------------------------------
-- 6. Helper SQL — current_workspace_id()
-- -----------------------------------------------------------------------------
-- Centraliza a leitura do setting de transação aplicado por withWorkspace().
-- Tolera setting vazio (retorna NULL) e faz cast UUID seguro.
CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid;
$$;

COMMENT ON FUNCTION public.current_workspace_id() IS
  'Lê app.workspace_id setado por withWorkspace(). Retorna NULL se vazio. Cast pra UUID seguro.';

-- -----------------------------------------------------------------------------
-- 7. Enable RLS em todas as tabelas
-- -----------------------------------------------------------------------------
ALTER TABLE public.workspaces                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events             ENABLE ROW LEVEL SECURITY;

-- Service role bypassa RLS por padrão no Supabase — confiamos nisso para
-- admin clients (CLAUDE.md §7.1). Sem FORCE ROW LEVEL SECURITY.

-- -----------------------------------------------------------------------------
-- 8. Policies
-- -----------------------------------------------------------------------------
-- Padrão: workspace_id = public.current_workspace_id() — lê o setting de transação.
-- RBAC (Owner/Admin checa role) é responsabilidade do app (requireRole), não da RLS.

-- 8.1 workspaces — usuário só vê workspaces onde é membro
DROP POLICY IF EXISTS workspaces_select ON public.workspaces;
CREATE POLICY workspaces_select ON public.workspaces FOR SELECT
USING (
  id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

-- INSERT/UPDATE/DELETE de workspaces vai sempre via service role (criação no signup,
-- soft delete em settings). Sem policy = PostgREST nega para anon/authenticated.

-- 8.2 users — usuário lê a si mesmo + outros membros dos workspaces dele
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users FOR SELECT
USING (
  id = auth.uid()
  OR id IN (
    SELECT wm.user_id FROM public.workspace_members wm
     WHERE wm.workspace_id IN (
       SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
     )
  )
);

DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users FOR UPDATE
USING      (id = auth.uid())
WITH CHECK (id = auth.uid());

-- INSERT vai via trigger handle_new_auth_user (SECURITY DEFINER, bypassa RLS).
-- DELETE vai via service role apenas (exclusão de conta — LGPD).

-- 8.3 workspace_members — filtro por workspace_id setado pela transação
DROP POLICY IF EXISTS workspace_members_select ON public.workspace_members;
CREATE POLICY workspace_members_select ON public.workspace_members FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS workspace_members_insert ON public.workspace_members;
CREATE POLICY workspace_members_insert ON public.workspace_members FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS workspace_members_update ON public.workspace_members;
CREATE POLICY workspace_members_update ON public.workspace_members FOR UPDATE
USING      (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS workspace_members_delete ON public.workspace_members;
CREATE POLICY workspace_members_delete ON public.workspace_members FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- 8.4 invitations
DROP POLICY IF EXISTS invitations_select ON public.invitations;
CREATE POLICY invitations_select ON public.invitations FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS invitations_insert ON public.invitations;
CREATE POLICY invitations_insert ON public.invitations FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS invitations_update ON public.invitations;
CREATE POLICY invitations_update ON public.invitations FOR UPDATE
USING      (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS invitations_delete ON public.invitations;
CREATE POLICY invitations_delete ON public.invitations FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- 8.5 audit_logs — append-only (sem UPDATE/DELETE policies)
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

-- 8.6 notification_preferences
DROP POLICY IF EXISTS notification_preferences_select ON public.notification_preferences;
CREATE POLICY notification_preferences_select ON public.notification_preferences FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS notification_preferences_insert ON public.notification_preferences;
CREATE POLICY notification_preferences_insert ON public.notification_preferences FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS notification_preferences_update ON public.notification_preferences;
CREATE POLICY notification_preferences_update ON public.notification_preferences FOR UPDATE
USING      (workspace_id = public.current_workspace_id())
WITH CHECK (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS notification_preferences_delete ON public.notification_preferences;
CREATE POLICY notification_preferences_delete ON public.notification_preferences FOR DELETE
USING (workspace_id = public.current_workspace_id());

-- 8.7 webhook_events — append-only (sem UPDATE/DELETE policies)
DROP POLICY IF EXISTS webhook_events_select ON public.webhook_events;
CREATE POLICY webhook_events_select ON public.webhook_events FOR SELECT
USING (workspace_id = public.current_workspace_id());

DROP POLICY IF EXISTS webhook_events_insert ON public.webhook_events;
CREATE POLICY webhook_events_insert ON public.webhook_events FOR INSERT
WITH CHECK (workspace_id = public.current_workspace_id());

-- -----------------------------------------------------------------------------
-- 8.8 Hardening — SECURITY DEFINER não-públicas
-- -----------------------------------------------------------------------------
-- Triggers em auth.users são disparados pelo Postgres internamente; PostgREST
-- não deve expor essas funções como RPC. Sem REVOKE, qualquer anon poderia
-- chamar /rest/v1/rpc/handle_new_auth_user — crashava por falta de NEW, mas é
-- superfície desnecessária. supabase_auth_admin continua funcionando porque
-- SECURITY DEFINER roda como o owner (postgres), não como o role chamador.
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_email_confirmed() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. Comments — auditabilidade no banco
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.workspaces                IS 'Tenant isolado. Toda tabela de domínio FK aqui.';
COMMENT ON TABLE public.users                     IS 'Espelha auth.users via trigger on_auth_user_created. NÃO inserir diretamente.';
COMMENT ON TABLE public.workspace_members         IS 'Relação user ↔ workspace com papel RBAC (Owner/Admin/Manager/Vendedor/Viewer).';
COMMENT ON TABLE public.invitations               IS 'Convite por email + magic link. Token UUID único. TTL controlado no app.';
COMMENT ON TABLE public.audit_logs                IS 'Log LGPD append-only. Cleanup via pg_cron (12m Pro / 24m Enterprise).';
COMMENT ON TABLE public.notification_preferences  IS 'Preferências por (workspace,user). JSONB wide. Eventos admin não são desligáveis (lógica no app).';
COMMENT ON TABLE public.webhook_events            IS 'Idempotência de webhooks por (source, external_id). Append-only.';

COMMIT;
