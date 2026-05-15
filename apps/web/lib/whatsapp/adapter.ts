/**
 * Contrato do adapter WhatsApp (M9#1).
 *
 * Define a interface única que os provedores implementam — uazapi (Standard,
 * M9#2) e Cloud API Meta (Enterprise, V2). O resto do app (Server Actions,
 * webhook, anti-ban, heartbeat) só conhece essa interface, nunca o provedor
 * concreto. Migrar de Standard pra Enterprise no futuro = trocar o factory
 * sem retrabalho nas features (CLAUDE.md §6 WhatsApp Adapter Pattern).
 *
 * **Server-only:** o adapter usa segredos uazapi e bypassa RLS via Service Role
 * em operações administrativas (connect/disconnect/heartbeat). Nunca importar
 * em arquivos `'use client'`.
 *
 * **M9#1 escopo:** só o contrato + mockAdapter. uazapi real entra em M9#2,
 * Server Actions em M9#2/M9#3, webhook inbound em M9#3, anti-ban em M9#3,
 * heartbeat (Edge Function) em M9#5.
 */
import 'server-only';

/**
 * QR code retornado por `connectInstance`. `qrBase64` é entregue ao cliente
 * via Server Action e renderizado em `<img src="data:image/png;base64,...">`.
 * `expiresAt` controla o polling — provedor regenera o QR após ~60s; o cliente
 * pede um novo `connectInstance` se o usuário não escaneou a tempo.
 *
 * `externalInstanceId` é o ID que o provedor atribuiu pra essa sessão. App
 * salva em `WhatsappInstance.externalInstanceId` e usa em todas as chamadas
 * subsequentes (`getInstanceStatus`, `disconnectInstance`, `sendText`).
 */
export interface WhatsAppQrCode {
  externalInstanceId: string;
  qrBase64: string;
  expiresAt: Date;
}

/**
 * Estado atual da sessão. `phoneNumber` chega só depois que a sessão ficou
 * `connected` pela primeira vez (uazapi informa via `getInstanceStatus`).
 * `lastSeenAt` é o heartbeat — base do health score (M9#5).
 */
export interface WhatsAppInstanceStatus {
  status: 'connected' | 'connecting' | 'disconnected';
  phoneNumber?: string;
  lastSeenAt?: Date;
}

/**
 * Resultado de um envio de texto. `externalMessageId` é o ID do provedor,
 * usado pra dedup do webhook ACK e pra exibir status (entregue, lido).
 * `sentAt` é o timestamp do provedor, não o do banco — pode diferir do
 * `createdAt` da row em alguns ms.
 */
export interface SendTextResult {
  externalMessageId: string;
  sentAt: Date;
}

/**
 * Interface única que uazapi (M9#2) e Cloud API Meta (V2) implementam.
 *
 * **Não cobre webhook inbound** — esse é responsabilidade do route handler
 * em `app/api/webhooks/whatsapp/route.ts` (M9#3), que conhece o formato
 * específico do provedor.
 *
 * **Não cobre mídia no M9** — `sendMedia` entra junto com bucket
 * `whatsapp-media` no M9.x/M10. Aqui só `sendText` (e `internal_note` que
 * NÃO chama o adapter — fica só no banco).
 */
export interface WhatsAppAdapter {
  /**
   * Inicia uma sessão nova. Provedor gera o QR code, app armazena em
   * `WhatsappInstance.qrCode` + `qrExpiresAt`. Vendedor escaneia no celular
   * (WhatsApp → Dispositivos conectados); webhook `connected` do provedor
   * vira `status='connected'` no banco.
   *
   * `workspaceId` é usado pelo provedor pra rotular a instância (uazapi
   * permite múltiplas instâncias com tags) e pelo factory pra escolher o
   * adapter certo.
   */
  connectInstance(input: { workspaceId: string }): Promise<WhatsAppQrCode>;

  /**
   * Lê o estado da sessão. Usado pelo polling do QR (M9#2) e pelo heartbeat
   * (M9#5). `externalInstanceId` vem do `WhatsappInstance.externalInstanceId`
   * — o ID que o provedor atribuiu na conexão.
   */
  getInstanceStatus(input: {
    workspaceId: string;
    externalInstanceId: string;
  }): Promise<WhatsAppInstanceStatus>;

  /**
   * Encerra a sessão no provedor. Em uazapi isso é o `logout` da instância
   * (mantém os dados pro re-pareamento futuro). App seta `status='disconnected'`
   * + `disconnectedAt=NOW()` e bloqueia envios subsequentes.
   */
  disconnectInstance(input: { workspaceId: string; externalInstanceId: string }): Promise<void>;

  /**
   * Envia texto (máx 4096 chars, validado upstream via `sendTextMessageSchema`).
   * **Anti-ban (M9#3) é chamado ANTES** pelo Server Action — adapter assume
   * que o envio já foi autorizado (rate limit, janela horária, blacklist).
   *
   * `to` é o telefone E.164 (`+5511999998888`), normalizado pelo caller.
   * `body` é o texto final, sem placeholders (resolvidos no client).
   */
  sendText(input: {
    workspaceId: string;
    externalInstanceId: string;
    to: string;
    body: string;
  }): Promise<SendTextResult>;
}
