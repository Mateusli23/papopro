import { redirect } from 'next/navigation';

/**
 * `/settings` é placeholder — o conteúdo real vive nas 6 sub-rotas.
 * Vendedor que cair aqui via deeplink ou atalho `g+s` é levado pra primeira
 * aba (Workspace). Em M7+ podemos rotear pra última aba visitada (cookie/LS).
 */
export default function SettingsIndexPage() {
  redirect('/settings/workspace');
}
