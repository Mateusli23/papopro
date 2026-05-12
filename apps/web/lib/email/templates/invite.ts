import 'server-only';

/**
 * Template de email de convite (M7#4 Onda 2).
 *
 * **Por que string-template e não React Email:** com 1 template a gente
 * economiza a dep `@react-email/components` (~3 MB de tarball). Quando a
 * gente passar de 3 templates (M9 vai precisar de "WhatsApp caiu", M12 vai
 * precisar de "trial expirando" e "pagamento falhou"), migramos. Por ora,
 * HTML inline + tokens do design system embutidos é mais simples de auditar
 * visualmente no Gmail/Outlook.
 *
 * **Renderização:** clientes de email são extremamente conservadores —
 * usamos só CSS inline (`style="..."`), tabelas em vez de flexbox/grid,
 * fontes web-safe com fallback. Sem `<style>` block (alguns clientes
 * removem). Sem JS, sem `<link>`.
 *
 * **Dark mode:** Outlook não respeita prefers-color-scheme; Apple Mail e
 * Gmail tem suporte parcial. Decidimos NÃO entregar dark mode em email —
 * fundo branco fixo, foreground navy. Identidade visível em qualquer cliente.
 *
 * **Anti-phishing:** o nome do workspace e o nome do convidador aparecem
 * literalmente no corpo do email — usuário verifica visualmente que o
 * convite é do lugar certo. Token expira em 7 dias; texto deixa isso claro.
 */

export interface InviteEmailParams {
  /** Nome humano do workspace (ex: "Imóvel Pro Vendas"). */
  workspaceName: string;
  /** Nome de quem convidou (vem do `users.name` do convidador). Cai pra email se vazio. */
  inviterName: string;
  /** Papel atribuído (Owner / Admin / Manager / Vendedor / Viewer). */
  role: string;
  /** URL completa pra aceitar (com `?token=`). */
  acceptUrl: string;
  /** Quantos dias até o convite expirar (default 7 — mas mantemos parametrizável pra testes). */
  expiresInDays?: number;
}

interface InviteEmailRendered {
  subject: string;
  html: string;
  text: string;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  Owner: 'dono',
  Admin: 'administrador',
  Manager: 'gestor',
  Vendedor: 'vendedor',
  Viewer: 'leitor',
};

/**
 * Renderiza assunto + HTML + texto plano do convite.
 *
 * O texto plano não é decorativo: clientes anti-spam (Hotmail, corporate)
 * pontuam negativamente emails só-HTML. Manter a versão `text` aumenta
 * deliverability sem custo significativo.
 */
export function renderInviteEmail(params: InviteEmailParams): InviteEmailRendered {
  const { workspaceName, inviterName, role, acceptUrl, expiresInDays = 7 } = params;
  const roleLabel = ROLE_DESCRIPTIONS[role] ?? role.toLowerCase();

  // **Fix do review M7#4 CRÍTICO #4 — sanitização do subject:** Resend repassa
  // o subject como header MIME, então `\r\n` no `inviterName` permitiria header
  // injection (adicionar `Bcc:` arbitrário). Strip control chars antes de
  // interpolar. `signupSchema` já bloqueia control chars no nome (M7#4
  // hardening), mas duplicamos aqui — `workspaceName` vinha de `Workspace.name`
  // que tem o mesmo guard, mas o template não deve depender disso.
  const subjectInviter = stripControlChars(inviterName);
  const subjectWorkspace = stripControlChars(workspaceName);

  // Encoding de entidades HTML — defense-in-depth contra nome com `<script>`,
  // emoji exótico ou caractere RTL que possa confundir parser de cliente de
  // email.
  const safeWorkspace = escapeHtml(workspaceName);
  const safeInviter = escapeHtml(inviterName);
  const safeRole = escapeHtml(role);

  const subject = `${subjectInviter} convidou você para o workspace ${subjectWorkspace} no PapoPro`;

  const text = [
    `Olá!`,
    ``,
    `${inviterName} convidou você para fazer parte do workspace "${workspaceName}" no PapoPro como ${roleLabel}.`,
    ``,
    `Aceite o convite acessando o link abaixo:`,
    acceptUrl,
    ``,
    `O convite expira em ${expiresInDays} dias.`,
    ``,
    `Se você não esperava esse email, pode ignorar — nada vai acontecer.`,
    ``,
    `PapoPro — CRM com WhatsApp para times de vendas consultivas.`,
  ].join('\n');

  // Tabelas em vez de flexbox — Outlook 2007–2019 não suporta box layout
  // moderno. Largura 600 é convenção de email (cabe na maioria dos clientes).
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
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:28px;font-weight:600;color:#0F1C3E;">Você foi convidado para o ${safeWorkspace}</h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#0F1C3E;">
                <strong>${safeInviter}</strong> convidou você para fazer parte do workspace
                <strong>${safeWorkspace}</strong> no PapoPro como <strong>${safeRole}</strong>.
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:22px;color:#475569;">
                Aceite pra começar a acompanhar leads, conversas no WhatsApp e cadências do time.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#367BEC;border-radius:8px;">
                    <a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
                      Aceitar convite
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:20px;color:#475569;">
                Ou copie o link no navegador:<br />
                <a href="${acceptUrl}" style="color:#367BEC;word-break:break-all;">${acceptUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;border-top:1px solid #E2E8F0;">
              <p style="margin:24px 0 0 0;font-size:13px;line-height:20px;color:#475569;">
                O convite expira em <strong>${expiresInDays} dias</strong>. Se você não esperava esse email, pode ignorar — nada vai acontecer.
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
 *
 * **Fix M7#4 review MEDIUM #18:** apóstrofo (`'`) também escapado pra cobrir
 * atributos em aspas simples (não usamos no template hoje, mas defense-in-
 * depth contra mudanças futuras + alinhamento com OWASP).
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Remove control chars (incluindo `\r\n`) — usado pra sanitizar valores que
 * vão pro subject do email (header MIME — `\n` separa headers). `signupSchema`
 * e `workspaceCreateSchema` já bloqueiam na entrada, mas duplicamos aqui pra
 * o template não confiar em invariantes externos (CLAUDE.md §7.2 — defense-
 * in-depth aplicado a sanitização também).
 */
function stripControlChars(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 32 && code !== 127) out += input[i];
  }
  return out;
}
