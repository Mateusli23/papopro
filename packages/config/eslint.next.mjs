/**
 * ESLint flat config para apps Next.js 14.
 * Estende a base do monorepo + regras do `eslint-config-next` via FlatCompat.
 *
 * Ordem: Next primeiro (configs.compat sobrescreve parser/globals/etc), depois
 * a nossa base (parser typescript-eslint, regras de import order, etc) ganha,
 * porque flat config aplica o último que casar.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import tsParser from '@typescript-eslint/parser';

import baseConfig from './eslint.config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends('next/core-web-vitals'),
  ...baseConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    rules: {
      // Compatibilidade com ESLint 9: algumas regras do `@next/eslint-plugin-next`
      // 14.2.x ainda usam APIs removidas (context.getAncestors). Religue quando
      // subir pra Next 15 ou trocar pelo plugin oficial em flat config.
      '@next/next/no-duplicate-head': 'off',
      // Páginas legadas não existem (App Router)
      '@next/next/no-html-link-for-pages': 'off',
      // React: aspas e similares geram ruído sem ganho real
      'react/no-unescaped-entities': 'off',
    },
  },
];
