-- ============================================================================
-- M11#6 — Handoffs (agente→humano + agente→agente) + job de lead_summaries
-- ============================================================================
-- Transforma `ai_agents.handoff_config` (JSONB parado desde M11#3) em runtime.
--
-- Schema mínimo — M11#6 é majoritariamente código (lib/ai/handoff.ts,
-- runtime.ts, Server Actions, UI). Só duas mudanças de banco:
--
--   1. `conversations.ai_enabled` — flag de "a IA atende esta conversa?".
--      Default true. Quando um handoff agente→humano dispara (manual,
--      keyword, intenção comercial, etapa Negociação, fora do horário) o
--      runtime/Server Action seta `false` — o roteador (M11#5) passa a pular
--      a conversa e nenhum agente responde até um humano clicar "Devolver
--      pra IA" (que volta pra `true`). Conversa que nunca teve IA também
--      fica `true` (default) — `false` significa, sem ambiguidade, "humano
--      assumiu".
--
--   2. `audit_action` ganha `handoff_reverted` — o evento de "Devolver pra
--      IA". `handoff_triggered` já existe desde M11#1 e cobre os 6 gatilhos
--      de disparo (discriminados por `changes.reason`).
--
-- RLS: `conversations` já tem políticas (M9#1) e elas filtram por
-- `current_workspace_id()` na linha inteira — adicionar coluna não exige
-- policy nova.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. conversations.ai_enabled
-- ----------------------------------------------------------------------------

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.conversations.ai_enabled IS
  'M11#6 — false = handoff agente→humano disparado (manual/keyword/intenção/etapa/fora-do-horário); o roteador pula a conversa até "Devolver pra IA". true (default) = IA pode atender.';

-- ----------------------------------------------------------------------------
-- 2. audit_action — handoff_reverted ("Devolver pra IA")
-- ----------------------------------------------------------------------------
-- handoff_triggered já existe desde M11#1; aqui só o evento inverso.

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'handoff_reverted';
