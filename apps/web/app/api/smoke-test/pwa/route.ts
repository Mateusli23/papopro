/**
 * Smoke test de PWA (M13#1).
 *
 * Valida o que é testável sem browser: detecção de plataforma, instruções de
 * instalação, e o shape do `manifest.json`. Service worker + prompt nativo de
 * instalação só dá pra validar manualmente (instalar num device) ou via
 * Lighthouse / E2E (M13#5).
 *
 * Curl: `curl http://localhost:3000/api/smoke-test/pwa` → JSON. HTTP 200 se
 * `failed === 0`, 500 caso contrário.
 */
import { NextResponse } from 'next/server';

import { blockSmokeInProd } from '@/lib/dev/smoke-guard';
import { detectPlatform, getInstallInstructions } from '@/lib/pwa/platform';

import manifest from '../../../../public/manifest.json';

interface CheckResult {
  group: string;
  name: string;
  ok: boolean;
  detail?: string;
}

function run(group: string, results: CheckResult[]) {
  return (name: string, fn: () => boolean | string) => {
    try {
      const r = fn();
      if (r === true) results.push({ group, name, ok: true });
      else
        results.push({
          group,
          name,
          ok: false,
          detail: typeof r === 'string' ? r : 'returned false',
        });
    } catch (err) {
      results.push({ group, name, ok: false, detail: (err as Error).message });
    }
  };
}

export const dynamic = 'force-dynamic';

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  desktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

export function GET() {
  const blocked = blockSmokeInProd();
  if (blocked) return blocked;

  const results: CheckResult[] = [];

  // ── detectPlatform ──────────────────────────────────────────────────────
  let t = run('platform-m13-1', results);
  t('iPhone → ios', () => detectPlatform(UA.iphone) === 'ios');
  t('iPad → ios', () => detectPlatform(UA.ipad) === 'ios');
  t('Android → android', () => detectPlatform(UA.android) === 'android');
  t('Desktop → desktop', () => detectPlatform(UA.desktop) === 'desktop');
  t('UA vazio → desktop (fallback seguro)', () => detectPlatform('') === 'desktop');

  // ── getInstallInstructions ──────────────────────────────────────────────
  t = run('install-instructions-m13-1', results);
  for (const platform of ['ios', 'android', 'desktop'] as const) {
    t(`${platform}: título + passos não-vazios`, () => {
      const info = getInstallInstructions(platform);
      return (
        (info.title.length > 0 &&
          info.steps.length >= 3 &&
          info.steps.every((s) => s.length > 0)) ||
        `title="${info.title}" steps=${info.steps.length}`
      );
    });
  }
  t('ios menciona "Compartilhar" (fluxo do Safari)', () => {
    return getInstallInstructions('ios').steps.some((s) => s.includes('Compartilhar'));
  });

  // ── manifest.json ───────────────────────────────────────────────────────
  t = run('manifest-m13-1', results);
  t('name + short_name presentes', () => {
    return (
      typeof manifest.name === 'string' &&
      manifest.name.length > 0 &&
      typeof manifest.short_name === 'string' &&
      manifest.short_name.length > 0
    );
  });
  t('display === "standalone"', () => manifest.display === 'standalone');
  t('start_url + scope presentes', () => {
    return typeof manifest.start_url === 'string' && typeof manifest.scope === 'string';
  });
  t('theme_color + background_color são hex', () => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    return hex.test(manifest.theme_color) && hex.test(manifest.background_color);
  });
  t('icons não-vazio com entrada maskable', () => {
    return (
      Array.isArray(manifest.icons) &&
      manifest.icons.length > 0 &&
      manifest.icons.some((i) => i.purpose === 'maskable')
    );
  });
  t('lang === "pt-BR"', () => manifest.lang === 'pt-BR');

  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = total - passed;
  return NextResponse.json(
    { summary: { total, passed, failed, allOk: failed === 0 }, results },
    { status: failed === 0 ? 200 : 500 },
  );
}
