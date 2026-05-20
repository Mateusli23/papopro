import 'server-only';

/**
 * Template de email genérico de notificação (M13#2).
 *
 * Usado pela camada de envio (`lib/notifications/dispatch.ts`) pro canal
 * `email` de eventos da matriz PRD §3.2 que não têm template dedicado — hoje
 * `whatsapp_connection_down`. O conteúdo (`title`/`body`) vem pronto do
 * dispatcher; este template só dá a moldura visual.
 *
 * Eventos com email + UX própria seguem com template dedicado (ex:
 * `trial-expiring.ts`, `invite.ts`). Este é o fallback transacional.
 *
 * Mesmas restrições de `trial-expiring.ts`: CSS inline, tabelas, web-safe
 * fonts, sem `<style>`/JS, fundo claro fixo (Outlook ignora dark mode).
 */

export interface NotificationEmailParams {
  /** Título — vira o assunto e o `<h1>`. */
  title: string;
  /** Corpo — 1–2 frases. */
  body: string;
  /** URL absoluta do CTA (deep-link da notificação). */
  actionUrl: string;
  /** Texto do botão. Default "Abrir no PapoPro". */
  actionLabel?: string;
}

interface NotificationEmailRendered {
  subject: string;
  html: string;
  text: string;
}

/** Renderiza assunto + HTML + texto plano de uma notificação transacional. */
export function renderNotificationEmail(
  params: NotificationEmailParams,
): NotificationEmailRendered {
  const { title, body, actionUrl } = params;
  const actionLabel = params.actionLabel ?? 'Abrir no PapoPro';

  const subject = `${title} — PapoPro`;

  const text = [
    title,
    '',
    body,
    '',
    `Abra no PapoPro: ${actionUrl}`,
    '',
    'PapoPro — CRM com WhatsApp para times de vendas consultivas.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F1C3E;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F1F5F9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#FFFFFF;border-radius:12px;box-shadow:0 1px 2px rgba(15,28,62,0.06);">
          <tr>
            <td style="padding:32px 32px 16px 32px;">
              <div style="display:inline-block;background-color:#367BEC;color:#FFFFFF;font-weight:600;font-size:14px;padding:6px 12px;border-radius:8px;">PapoPro</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:28px;font-weight:600;color:#0F1C3E;">${escapeHtml(title)}</h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:22px;color:#475569;">
                ${escapeHtml(body)}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#367BEC;border-radius:8px;">
                    <a href="${actionUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
                      ${escapeHtml(actionLabel)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:20px;color:#475569;">
                Ou abra no navegador:<br />
                <a href="${actionUrl}" style="color:#367BEC;word-break:break-all;">${actionUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;border-top:1px solid #E2E8F0;">
              <p style="margin:24px 0 0 0;font-size:13px;line-height:20px;color:#475569;">
                Você pode ajustar quais notificações recebe em Configurações &rarr; Notificações.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0 0;font-size:12px;line-height:18px;color:#94A3B8;text-align:center;">
          PapoPro · CRM com WhatsApp para times de vendas consultivas.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/** Escape de HTML — 5 chars perigosos (OWASP). Duplicado de `trial-expiring.ts`. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
