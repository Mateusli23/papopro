import { describe, expect, it } from 'vitest';

import { formatCentsForCurrencyInput, parseCurrencyInputToCents } from './format';

describe('parseCurrencyInputToCents', () => {
  it('interpreta dígitos puros como reais inteiros', () => {
    expect(parseCurrencyInputToCents('800000')).toBe(80_000_000);
    expect(parseCurrencyInputToCents('50000')).toBe(5_000_000);
  });

  it('interpreta separadores de milhar como reais inteiros', () => {
    expect(parseCurrencyInputToCents('800.000')).toBe(80_000_000);
    expect(parseCurrencyInputToCents('R$ 1.200.000')).toBe(120_000_000);
  });

  it('preserva centavos quando há separador decimal explícito', () => {
    expect(parseCurrencyInputToCents('800.000,50')).toBe(80_000_050);
    expect(parseCurrencyInputToCents('800000.5')).toBe(80_000_050);
  });

  it('retorna zero para entrada vazia ou sem número', () => {
    expect(parseCurrencyInputToCents('')).toBe(0);
    expect(parseCurrencyInputToCents('R$')).toBe(0);
  });
});

describe('formatCentsForCurrencyInput', () => {
  it('formata centavos como reais inteiros editáveis', () => {
    expect(formatCentsForCurrencyInput(80_000_000)).toBe('800000');
  });

  it('mantém zero como campo vazio', () => {
    expect(formatCentsForCurrencyInput(0)).toBe('');
    expect(formatCentsForCurrencyInput(undefined)).toBe('');
  });
});
