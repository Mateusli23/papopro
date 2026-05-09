'use client';

import * as React from 'react';

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

/**
 * Wrapper do `next-themes`. Os apps importam SEMPRE daqui — assim o design
 * system controla os defaults (dark mode como padrão, atributo `class` no
 * `<html>`, sem flash) e podemos trocar a lib sem refatorar layouts.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
