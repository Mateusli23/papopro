/**
 * Usuário "logado" mockado — alimenta o avatar do topbar e o menu de perfil.
 * Substituído em M7 pelo `auth.getUser()` do Supabase.
 */

export interface FakeUser {
  id: string;
  name: string;
  email: string;
  /** Sigla 2-letras pra avatar fallback. */
  initials: string;
}

export const FAKE_USER: FakeUser = {
  id: 'user_mateus',
  name: 'Mateus Lima',
  email: 'mateus@papopro.com.br',
  initials: 'ML',
};
