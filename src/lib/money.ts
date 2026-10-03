import { locale } from '../i18n';
import type { Settings } from './types';

export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'TWD', name: 'New Taiwan Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'MXN', name: 'Mexican Peso' },
];

export function decimalsFor(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, decimals: number) {
  const key = `${locale.value}:${currency}:${decimals}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale.value, {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    } catch {
      f = new Intl.NumberFormat(locale.value, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    formatters.set(key, f);
  }
  return f;
}

type MoneyCfg = Pick<Settings, 'currency' | 'currencyDecimals'>;

export function formatMoney(minor: number, cfg: MoneyCfg): string {
  return formatter(cfg.currency, cfg.currencyDecimals).format(minor / 10 ** cfg.currencyDecimals);
}

/** Like formatMoney but keeps up to `maxDecimals` places, for unit costs that are fractions of a cent (e.g. 0.0025 per gram). */
export function formatMoneyPrecise(minor: number, cfg: MoneyCfg, maxDecimals = 4): string {
  const key = `p:${locale.value}:${cfg.currency}:${cfg.currencyDecimals}:${maxDecimals}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale.value, {
        style: 'currency', currency: cfg.currency,
        minimumFractionDigits: cfg.currencyDecimals, maximumFractionDigits: Math.max(cfg.currencyDecimals, maxDecimals),
      });
    } catch {
      f = new Intl.NumberFormat(locale.value, { minimumFractionDigits: cfg.currencyDecimals, maximumFractionDigits: maxDecimals });
    }
    formatters.set(key, f);
  }
  return f.format(minor / 10 ** cfg.currencyDecimals);
}

/** Plain number string for inputs/CSV: "12.50". */
export function toInput(minor: number, decimals: number): string {
  if (!minor) return '';
  return (minor / 10 ** decimals).toFixed(decimals);
}

/** Parses "12.5", "12,50", "1 234.00" into minor units. Returns 0 for junk. */
export function parseMoney(text: string, decimals: number): number {
  let s = text.trim().replace(/\s/g, '');
  if (!s) return 0;
  // A lone comma with 1-2 trailing digits is a decimal comma ("12,50").
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 10 ** decimals);
}

/** Quick-cash suggestions for a bill: exact, then round-ups to common note sizes. */
export function quickCash(total: number, decimals: number): number[] {
  const unit = 10 ** decimals;
  const major = total / unit;
  const out = new Set<number>([total]);
  const steps = major < 20 ? [1, 5, 10, 20, 50] : major < 200 ? [5, 10, 20, 50, 100] : [50, 100, 500, 1000];
  for (const step of steps) {
    const up = Math.ceil(major / step) * step;
    out.add(Math.round(up * unit));
  }
  return [...out].filter((v) => v >= total).sort((a, b) => a - b).slice(0, 5);
}

/** Currency name in the app language (falls back to the English list). */
export function currencyName(code: string, fallback = code): string {
  try {
    return new Intl.DisplayNames([locale.value], { type: 'currency' }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}
