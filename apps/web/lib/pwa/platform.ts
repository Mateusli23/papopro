/**
 * Detecção de plataforma + instruções de instalação do PWA (M13#1).
 *
 * Puro — sem `'server-only'`, sem browser API nas funções de detecção/copy.
 * `detectPlatform` recebe o UA como string (testável em smoke sem `window`);
 * o componente client passa `navigator.userAgent`. `isStandalone` é o único
 * helper que toca `window`.
 */

export type Platform = 'ios' | 'android' | 'desktop';

/**
 * `detectPlatform` — classifica o user agent pra escolher as instruções de
 * instalação. iPadOS 13+ se reporta como Mac no UA; sem touch-points não dá
 * pra distinguir, então um iPad moderno cai em `desktop` — aceitável, o fluxo
 * de install do Safari (Compartilhar → Adicionar) é equivalente.
 */
export function detectPlatform(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export interface InstallInstructions {
  /** Título da seção de instruções. */
  title: string;
  /** Passos ordenados de instalação manual. */
  steps: string[];
}

/**
 * `getInstallInstructions` — passo-a-passo manual por plataforma. Usado quando
 * o prompt nativo não está disponível: sempre no iOS (Safari não dispara
 * `beforeinstallprompt`), e no Android/desktop como referência.
 */
export function getInstallInstructions(platform: Platform): InstallInstructions {
  switch (platform) {
    case 'ios':
      return {
        title: 'Instalar no iPhone ou iPad',
        steps: [
          'Abra o PapoPro no Safari — no iOS a instalação só funciona por ele.',
          'Toque no botão Compartilhar (o quadrado com a seta pra cima).',
          'Role a lista e toque em "Adicionar à Tela de Início".',
          'Confirme em "Adicionar" — o PapoPro vira um app na sua tela inicial.',
        ],
      };
    case 'android':
      return {
        title: 'Instalar no Android',
        steps: [
          'Abra o PapoPro no Chrome.',
          'Toque no menu (⋮) no canto superior direito.',
          'Toque em "Instalar app" (ou "Adicionar à tela inicial").',
          'Confirme — o PapoPro abre em tela cheia, como um app.',
        ],
      };
    default:
      return {
        title: 'Instalar no computador',
        steps: [
          'Abra o PapoPro no Chrome, Edge ou outro navegador compatível.',
          'Clique no ícone de instalar na barra de endereço (um monitor com uma seta).',
          'Confirme em "Instalar" — o PapoPro abre numa janela própria.',
        ],
      };
  }
}

/**
 * `isStandalone` — `true` quando o app já roda instalado (display-mode
 * `standalone`, ou `navigator.standalone` no iOS). Client-only: retorna
 * `false` no servidor.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneDisplay || iosStandalone;
}
