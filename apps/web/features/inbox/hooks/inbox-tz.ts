/**
 * Helpers de fuso horário pra Inbox.
 *
 * Por que existe: `Date.toLocaleTimeString('pt-BR')` e
 * `format(d, 'yyyy-MM-dd')` (date-fns) usam o **fuso do runtime** —
 * Vercel roda em UTC, browser roda em BRT (`America/Sao_Paulo`). Isso
 * causa hydration mismatch real (SSR mostra `17:32` / CSR mostra `14:32`)
 * e bug visual de "Hoje" virar "Ontem" 3h por dia (entre 21h–24h UTC).
 *
 * Solução: `Intl.DateTimeFormat` com `timeZone` explícito é nativo do
 * Node.js + browser e produz output **determinístico** em qualquer
 * runtime. Não adiciona dependência (já vem com a engine).
 *
 * Em M9 a TZ do workspace passa a ser configurável (default
 * `America/Sao_Paulo`); por enquanto fixamos o default aqui.
 */

const WORKSPACE_TZ = 'America/Sao_Paulo';

const TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: WORKSPACE_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DAY_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: WORKSPACE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: WORKSPACE_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/**
 * Hora local da workspace formatada como `HH:mm` (ex: "14:32").
 * Mesmo output em SSR (Node UTC) e CSR (browser BRT).
 */
export function formatTimeBrt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return TIME_FORMATTER.format(d);
}

/**
 * Chave estável `yyyy-MM-dd` no fuso da workspace. Usada como `key` em
 * agrupamento por dia (mais seguro que `format(d, 'yyyy-MM-dd')` que
 * usaria a TZ do runtime).
 */
export function dayKeyBrt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return DAY_KEY_FORMATTER.format(d);
}

/**
 * Label humano do divisor de dia: "Hoje" / "Ontem" / "qua, 7 mai".
 * Compara `dayKey` no fuso da workspace contra o "agora" do mesmo fuso.
 */
export function dayLabelBrt(iso: string, now: Date = new Date()): string {
  const targetKey = dayKeyBrt(iso);
  const todayKey = DAY_KEY_FORMATTER.format(now);
  if (targetKey === todayKey) return 'Hoje';
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (targetKey === DAY_KEY_FORMATTER.format(yesterday)) return 'Ontem';
  // Capitalizar inicial e remover ponto final (formato pt-BR retorna "qua., 7 de mai.")
  const raw = DAY_LABEL_FORMATTER.format(new Date(iso));
  return raw.replace(/\./g, '');
}
