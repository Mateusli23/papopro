import 'server-only';

/**
 * Template de email "trial expirando" (M12#2).
 *
 * Disparado pelo job diário `/api/cron/trial-warnings` em D-2 e D-1 antes do
 * trial de 7 dias acabar. A matriz do PRD §3.2 lista "trial expirando" como
 * evento de email transacional (Resend).
 *
 * Segue as mesmas restrições de `invite.ts`: CSS inline, tabelas (não
 * flex/grid), web-safe fonts, sem `<style>`/JS/`<link>`, fundo branco fixo
 * (sem dark mode — Outlook não respeita `prefers-color-scheme`).
 */

export interface TrialExpiringEmailParams {
  /** Nome do workspace (`Workspace.name`). */
  workspaceName: string;
  /** Dias inteiros restantes — 2 (D-2) ou 1 (D-1). */
  daysLeft: number;
  /** URL absoluta pra `/settings/billing`. */
  billingUrl: string;
}

interface TrialExpiringEmailRendered {
  subject: string;
  html: string;
  text: string;
}

/**
 * Renderiza assunto + HTML + texto plano do aviso de trial expirando.
 *
 * `daysLeft === 1` vira "termina amanhã"; `> 1` vira "faltam N dias".
 */
export function renderTrialExpiringEmail(
  params: TrialExpiringEmailParams,
): TrialExpiringEmailRendered {
  const { workspaceName, daysLeft, billingUrl } = params;

  const whenPhrase = daysLeft === 1 ? 'termina amanhã' : `termina em ${daysLeft} dias`;
  const whenShort = daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`;

  const subject =
    daysLeft === 1
      ? 'Seu teste grátis do PapoPro termina amanhã'
      : `Faltam ${daysLeft} dias do seu teste grátis do PapoPro`;

  const safeWorkspace = escapeHtml(workspaceName);

  const text = [
    `Olá!`,
    ``,
    `Seu teste grátis do PapoPro no workspace "${workspaceName}" ${whenPhrase}.`,
    ``,
    `Quando o teste acabar, o workspace volta pro plano Free: leads e membros`,
    `ficam limitados e o motor de cadência, o Inbox WhatsApp e os agentes IA`,
    `param de rodar.`,
    ``,
    `Assine o Pro pra manter tudo funcionando — R$ 197/mês, cancele quando quiser:`,
    billingUrl,
    ``,
    `PapoPro — CRM com WhatsApp para times de vendas consultivas.`,
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
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:28px;font-weight:600;color:#0F1C3E;">Seu teste grátis ${whenShort}</h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#0F1C3E;">
                O teste grátis do PapoPro no workspace <strong>${safeWorkspace}</strong> ${whenPhrase}.
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:22px;color:#475569;">
                Quando o teste acabar, o workspace volta pro plano Free — leads e membros
                ficam limitados e o motor de cadência, o Inbox WhatsApp e os agentes IA
                param de rodar. Assine o Pro pra manter tudo funcionando.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#367BEC;border-radius:8px;">
                    <a href="${billingUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
                      Assinar Pro
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:20px;color:#475569;">
                R$ 197/mês, cancele quando quiser. Ou abra no navegador:<br />
                <a href="${billingUrl}" style="color:#367BEC;word-break:break-all;">${billingUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;border-top:1px solid #E2E8F0;">
              <p style="margin:24px 0 0 0;font-size:13px;line-height:20px;color:#475569;">
                Você recebeu este email porque é o responsável por este workspace no PapoPro.
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

/**
 * Escape de HTML — 5 chars que podem virar tag/atributo (OWASP HTML escape).
 * Duplicado de `invite.ts` de propósito: 2 templates ainda não justificam um
 * módulo compartilhado (ver comentário de `invite.ts` sobre React Email).
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
