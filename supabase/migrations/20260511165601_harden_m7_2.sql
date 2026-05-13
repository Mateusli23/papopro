-- Hardening pós-M7#2: resolve 8 advisors WARN (search_path, extension_in_public, sec_definer_executable).

-- 1. Fixar search_path em funções não-SECURITY DEFINER.
--    (handle_new_auth_user e handle_auth_user_email_confirmed já têm `SET search_path = public`.)
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

CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid;
$$;

-- 2. Mover extensions de `public` para `extensions` (schema padrão Supabase).
--    OID dos tipos/funções não muda — colunas `email citext` em users/invitations
--    continuam válidas. `extensions` já está no search_path das roles.
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION citext SET SCHEMA extensions;

-- 3. Revogar EXECUTE das SECURITY DEFINER de PUBLIC/anon/authenticated.
--    O trigger em auth.users continua funcionando porque SECURITY DEFINER faz
--    a função rodar como o owner dela (postgres), e o INSERT em auth.users é
--    feito por supabase_auth_admin que tem privilégios próprios.
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_email_confirmed() FROM PUBLIC, anon, authenticated;
