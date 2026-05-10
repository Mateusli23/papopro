/**
 * Schemas Zod do composer da Inbox (M5#4b).
 *
 * Aplicado em UI hoje; em M9 vira input validation das Server Actions
 * `sendMessage` / `sendInternalNote` / `attachMedia` antes de tocar o
 * `WhatsAppAdapter`. Validar na borda, confiar no tipo internamente
 * (CLAUDE.md §5). Mensagens em pt-BR direto, propositivas (CLAUDE.md §7.6).
 */
import { z } from 'zod';

const MEDIA_KIND_VALUES = ['image', 'audio', 'document'] as const;

/**
 * Limite WhatsApp = 4096 chars. Deixamos 4096 estrito mesmo (não é o vendedor
 * que vai bater isso digitando manualmente — quem chega lá é texto colado).
 */
export const sendTextMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Escreva uma mensagem antes de enviar')
    .max(4096, 'Mensagem muito longa (máx 4096 caracteres)'),
});
export type SendTextMessageInput = z.infer<typeof sendTextMessageSchema>;

/**
 * Notas internas têm limite menor — são pra contexto rápido do time, não pra
 * playbook longo (esse vai pro Cérebro da Empresa em M11).
 */
export const sendInternalNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Escreva a nota antes de salvar')
    .max(2000, 'Nota muito longa (máx 2000 caracteres)'),
});
export type SendInternalNoteInput = z.infer<typeof sendInternalNoteSchema>;

/**
 * Mídia anexada pelo vendedor (mock em M5; em M9 vai pro bucket
 * `whatsapp-media` via Storage com RLS por workspace).
 *
 *  - `kind`: cobre os 3 tipos suportados pelo WhatsApp (vídeo entra em V2).
 *  - `mediaName`: nome do arquivo apresentado na bolha. Sempre exigido.
 *  - `mediaSizeKb`: aceita 0 só pra áudio gravado (sem arquivo real). Outros
 *     tipos esperam ≥1 KB — arquivo de 0 byte é inválido.
 *  - `mediaDurationSeconds`: obrigatório só pra `audio`. Schema cobre via refine.
 *  - `caption`: legenda opcional (image/document; áudio nunca tem caption).
 */
export const attachMediaSchema = z
  .object({
    kind: z.enum(MEDIA_KIND_VALUES, {
      error: 'Tipo de mídia inválido',
    }),
    mediaName: z
      .string()
      .trim()
      .min(1, 'Arquivo sem nome')
      .max(240, 'Nome do arquivo muito longo (máx 240)'),
    mediaSizeKb: z.number().int().min(0, 'Tamanho inválido'),
    mediaDurationSeconds: z.number().int().positive().optional(),
    caption: z.string().trim().max(1024, 'Legenda muito longa (máx 1024)').optional(),
  })
  .refine((v) => v.kind !== 'audio' || typeof v.mediaDurationSeconds === 'number', {
    message: 'Áudio precisa de duração',
    path: ['mediaDurationSeconds'],
  })
  .refine((v) => v.kind === 'audio' || v.mediaSizeKb >= 1, {
    message: 'Arquivo vazio',
    path: ['mediaSizeKb'],
  });
export type AttachMediaInput = z.infer<typeof attachMediaSchema>;

// Re-exports para selects e loops da UI / smoke test.
export const MEDIA_KINDS = MEDIA_KIND_VALUES;
