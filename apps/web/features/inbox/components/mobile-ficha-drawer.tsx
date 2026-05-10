'use client';

import * as React from 'react';

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@papopro/ui';

import { LeadFichaPanel } from './lead-ficha-panel';

/**
 * Drawer (vaul) que sobe da borda inferior pra mostrar a ficha do lead em
 * mobile/tablet (`<lg`). Em `lg+` o painel fixo de 360px continua visível
 * e este componente fica controlado mas nunca abre — sem overhead.
 *
 * **Por que vaul, não Sheet?**
 *  - Drag-to-dismiss é gesto natural em mobile (mesmo padrão do Apple Maps,
 *    Google Maps, Telegram).
 *  - Drawer respeita safe-area inferior em iOS (vaul cuida).
 *  - Conteúdo é uma "ação profunda sobre o item" — exatamente o caso que o
 *    JSDoc do `Drawer` em `@papopro/ui` recomenda.
 *
 * O drawer envolve o `<LeadFichaPanel>` com `hideContainer` — o painel não
 * pinta seu próprio `<aside>` border/bg porque o drawer já provê chrome.
 *
 * Foco: vaul cuida do focus trap; quando fecha, devolve foco pro elemento
 * que disparou (botão "Ver lead" no header da thread). `Esc` também fecha,
 * cortesia do Radix Dialog interno.
 */
interface MobileFichaDrawerProps {
  conversationId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileFichaDrawer({ conversationId, open, onOpenChange }: MobileFichaDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] max-h-[85vh] lg:hidden">
        <DrawerHeader className="px-5 pb-2 pt-3 text-left">
          <DrawerTitle>Ficha do lead</DrawerTitle>
          <DrawerDescription className="text-caption">
            Ações rápidas e dados pra responder com contexto.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          <LeadFichaPanel conversationId={conversationId} hideContainer />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
