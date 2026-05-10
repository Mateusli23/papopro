'use client';

import * as React from 'react';

import { useRouter, usePathname } from 'next/navigation';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@papopro/ui';

import { SETTINGS_NAV } from './settings-nav-config';

/**
 * Substitui o sub-nav lateral em < lg. Aparece no topo do conteúdo de
 * `/settings` e troca rota direto via `router.push`. Evita uma segunda gaveta
 * mobile (a sidebar principal já é drawer).
 */
export function SettingsMobileSelect() {
  const router = useRouter();
  const pathname = usePathname();

  const current =
    SETTINGS_NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      ?.href ??
    SETTINGS_NAV[0]?.href ??
    '/settings/workspace';

  return (
    <div className="lg:hidden">
      <Select value={current} onValueChange={(href) => router.push(href)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <SelectItem key={item.href} value={item.href}>
                <span className="inline-flex items-center gap-2">
                  <Icon className="size-4" />
                  {item.label}
                  {item.ownerOnly && (
                    <span className="text-muted-foreground text-caption">(Owner)</span>
                  )}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
