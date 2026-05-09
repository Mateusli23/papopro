import { redirect } from 'next/navigation';

/**
 * Rota raiz — placeholder de M2. Redireciona pro dashboard até M3 entregar o
 * middleware de auth (redireciona pra /login se não autenticado, /dashboard
 * se sim).
 */
export default function HomePage() {
  redirect('/dashboard');
}
