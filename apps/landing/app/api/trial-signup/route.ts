import { NextResponse } from 'next/server';

import { z } from 'zod';

/**
 * Route handler do CTA final da landing.
 *
 * Em Bloco A (UI mockada) o handler apenas **valida** o payload com Zod e
 * devolve `{ ok: true }`. Não persiste nada, não cria usuário, não dispara
 * email — tudo isso fica pra M7 (Auth + multi-tenant + RLS), quando o
 * Supabase entra. Aqui o objetivo é:
 *
 *  1. Estabelecer o contrato (schema + URL) que o frontend usará agora e
 *     que o backend real consumirá em M7.
 *  2. Bloquear payloads malformados antes do redirect, evitando que o
 *     usuário chegue na app com dados inválidos.
 *  3. Servir como ponto de hook pra analytics no futuro (server-side
 *     tracking, anti-bot, captcha — tudo entra aqui sem mudar o cliente).
 *
 * `senha` chega no body por consistência com o formulário, mas **não**
 * propagamos pra lugar nenhum nem persistimos — quando M7 chegar, a senha
 * real será coletada novamente no app (jamais em URL de redirect; jamais
 * em sessionStorage). Aqui é puro placeholder pra que a tela da landing
 * sinta "completa".
 */

const trialSignupSchema = z.object({
  nome: z.string().trim().min(2, 'Digite seu nome completo.'),
  email: z.string().trim().toLowerCase().email('Email inválido.'),
  senha: z.string().min(8, 'Senha precisa ter pelo menos 8 caracteres.'),
  empresa: z.string().trim().min(2, 'Digite o nome da sua empresa.'),
});

export type TrialSignupInput = z.infer<typeof trialSignupSchema>;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body inválido — espero JSON.' }, { status: 400 });
  }

  const result = trialSignupSchema.safeParse(payload);
  if (!result.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Dados inválidos.',
        details: result.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  // Em Bloco A não persistimos. Em M7 isso vira `await createPendingSignup(...)`.
  return NextResponse.json({ ok: true });
}
