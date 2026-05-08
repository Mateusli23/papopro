## O que muda

<!-- Resuma em 1-2 linhas. Inclua o número do marco quando aplicável (ex: M3). -->

## Por quê

<!-- Justifique a mudança. Linke a seção do PRD/PLAN quando relevante. -->

## Como testar

<!-- Passos pra reproduzir / validar localmente. -->

## Checklist

- [ ] Lint e typecheck passando localmente (`pnpm lint && pnpm typecheck`)
- [ ] Sem hex hardcoded em componentes (somente em `tailwind.preset.ts`)
- [ ] Microcopy em pt-BR direto (CTAs em verbo no infinitivo)
- [ ] Server Components por default; `"use client"` apenas onde necessário
- [ ] Validação Zod em todo input externo (form, search params, webhook)
- [ ] (Backend) `workspace_id` filtrado no código mesmo com RLS ativa
- [ ] Documentação atualizada se algo em CLAUDE.md/PRD/PLAN ficou desatualizado
