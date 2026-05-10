'use client';

import * as React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

import {
  BrandArcs,
  Button,
  Card,
  CardContent,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@papopro/ui';
import { ArrowRight, CheckCircle2, Loader2 } from '@papopro/ui/icons';

/**
 * Seção de CTA final + formulário de trial. O formulário valida com Zod via
 * React Hook Form (mesmo stack do `apps/web`), faz POST mockado pro
 * `/api/trial-signup` (que só valida e devolve `{ ok: true }`) e redireciona
 * pra `app.pipeflow.com.br/signup` com `nome`, `email` e `empresa` na URL —
 * a app pré-preenche e o usuário só precisa digitar a senha de novo.
 *
 * Decisões registradas:
 *  - Senha **não** vai na URL nem em sessionStorage. Coletamos pra UX feel
 *    "completo" e validar tamanho mínimo, mas descartamos no redirect (M7
 *    pega senha real no app).
 *  - Toast de sucesso aparece antes do redirect — usuário vê que deu certo
 *    em vez de só "sumir" pra outra URL.
 *  - Em erro de validação 422, mostramos a primeira mensagem; em 500
 *    genérico, copy propositiva ("Tente de novo em alguns instantes").
 *
 * `BrandArcs variant="empty-state"` ao fundo dá presença sutil de marca sem
 * competir com o formulário — mesma escolha do hero, mas em variante mais
 * discreta porque aqui o foco é o input.
 */

const formSchema = z.object({
  nome: z.string().trim().min(2, 'Digite seu nome completo.'),
  email: z.string().trim().toLowerCase().email('Email inválido.'),
  senha: z.string().min(8, 'Senha precisa ter pelo menos 8 caracteres.'),
  empresa: z.string().trim().min(2, 'Digite o nome da sua empresa.'),
});

type FormValues = z.infer<typeof formSchema>;

const TRUST_SIGNALS: ReadonlyArray<string> = [
  '7 dias grátis — sem cartão',
  'Cancelamento em 1 clique',
  'Dados no Brasil (LGPD)',
];

export function CtaSection() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { nome: '', email: '', senha: '', empresa: '' },
    mode: 'onTouched',
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch('/api/trial-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? 'Não foi possível criar a conta — tente de novo em instantes.');
        return;
      }

      toast.success('Conta criada! Redirecionando…');

      // Pré-preenche app/signup com nome, email e empresa. Senha NÃO viaja por URL.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.pipeflow.com.br';
      const params = new URLSearchParams({
        nome: values.nome,
        email: values.email,
        empresa: values.empresa,
        source: 'landing',
      });
      // Pequeno delay pro toast aparecer antes do redirect (UX, não loading real).
      window.setTimeout(() => {
        window.location.href = `${appUrl}/signup?${params.toString()}`;
      }, 600);
    } catch {
      toast.error('Sem conexão com o servidor — verifique sua internet.');
    }
  }

  return (
    <section id="cta-final" className="relative overflow-hidden py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-30">
        <BrandArcs variant="empty-state" />
      </div>

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <h2 className="text-foreground text-3xl font-bold tracking-tight md:text-4xl">
              Pronto pra parar de <span className="text-primary">perder lead por esquecimento</span>
              ?
            </h2>
            <p className="text-muted-foreground text-body-lg mt-4">
              Crie sua conta e comece o trial agora. Em ~10 minutos seus primeiros leads já estão no
              funil com cadência rodando.
            </p>
          </div>

          <Card className="bg-card border-border mt-10 shadow-lg">
            <CardContent className="p-6 md:p-8">
              <Form {...form}>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={form.handleSubmit(onSubmit)}
                  noValidate
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome completo</FormLabel>
                          <FormControl>
                            <Input autoComplete="name" placeholder="Marina Souza" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="empresa"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Empresa</FormLabel>
                          <FormControl>
                            <Input
                              autoComplete="organization"
                              placeholder="Imobiliária Souza"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email comercial</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder="marina@imobiliariasouza.com.br"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="senha"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            placeholder="Mínimo 8 caracteres"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Use uma senha forte — letras, números e símbolos.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Criando sua conta…
                      </>
                    ) : (
                      <>
                        Começar 7 dias grátis
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  <ul className="text-muted-foreground text-caption mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                    {TRUST_SIGNALS.map((signal) => (
                      <li key={signal} className="flex items-center gap-1.5">
                        <CheckCircle2 className="text-success size-4" aria-hidden />
                        <span>{signal}</span>
                      </li>
                    ))}
                  </ul>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
