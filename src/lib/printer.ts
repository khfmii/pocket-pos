import { registerPlugin } from '@capacitor/core';
import { signal } from '@preact/signals';
import { t } from '../i18n';
import { monoFromRgba, printJob, toBase64 } from './escpos';
import { isNative } from './device';
import type { Block } from './receipt';
import { renderForPrint } from './receiptImage';

/**
 * Bluetooth thermal receipt printers (Android app). The printer is paired once in Android's Bluetooth settings, then
 * picked here; printing opens a classic Bluetooth (SPP) connection, sends the receipt as an ESC/POS picture, and
 * disconnects. The choice is device-local: a printer's address means nothing on another phone.
 */
export interface PairedDevice {
  name: string;
  address: string;
  isPrinter: boolean;
}

// Local Android plugin (android/app/src/main/java/com/pocketpos/app/BluetoothPrinterPlugin.java). Replaceable in tests.
export interface PrinterApi {
  listPaired(): Promise<{ devices: PairedDevice[] }>;
  print(o: { address: string; data: string }): Promise<{ bytes: number }>;
  openSettings(): Promise<void>;
}

export const deps: { native: PrinterApi; isNative: () => boolean } = {
  native: registerPlugin<PrinterApi>('BluetoothPrinter'),
  isNative,
};

export interface PrinterConfig {
  address: string; // '' = none chosen
  name: string;
  cut: boolean; // send a cut command after each receipt (printers without a cutter ignore it)
  auto: boolean; // print by itself after each sale
}

const KEY = 'pocketpos.printer';
const defaults = (): PrinterConfig => ({ address: '', name: '', cut: false, auto: false });

export function sanitize(v: unknown): PrinterConfig {
  const d = defaults();
  if (!v || typeof v !== 'object') return d;
  const o = v as Record<string, unknown>;
  return {
    address: typeof o.address === 'string' ? o.address : '',
    name: typeof o.name === 'string' ? o.name : '',
    cut: o.cut === true,
    auto: o.auto === true,
  };
}

function read(): PrinterConfig {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return defaults();
  }
}

export const printer = signal<PrinterConfig>(read());

export function updatePrinter(patch: Partial<PrinterConfig>) {
  printer.value = { ...printer.value, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(printer.value));
  } catch {
    /* storage unavailable: the choice just won't survive a restart */
  }
}

export const canBluetoothPrint = () => deps.isNative();
export const hasPrinter = () => !!printer.value.address;

/** Turns a native error code into something a shop owner can act on. */
export function describePrintError(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  if (/no-printer/.test(m)) return t('Choose a printer first.');
  if (/permission-denied/.test(m)) return t('Bluetooth permission was not granted. Allow it to print.');
  if (/bluetooth-unavailable/.test(m)) return t('This device has no Bluetooth.');
  if (/bluetooth-off/.test(m)) return t('Bluetooth is off. Turn it on and try again.');
  if (/device-not-found|connect-failed/.test(m)) return t('Could not reach the printer. Check that it is on, in range and paired.');
  return t('Printing failed. Check the printer and try again.');
}

/** Draws the receipt for the printer and sends it. Throws a coded error (see describePrintError). */
export async function printBlocks(blocks: Block[], logo: string, paperMm: number): Promise<void> {
  const cfg = printer.value;
  if (!cfg.address) throw new Error('no-printer');
  const { canvas, logoRect } = await renderForPrint(blocks, logo, paperMm);
  const px = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const mono = monoFromRgba(px.data, px.width, px.height, { dither: logoRect ? [logoRect] : [] });
  await deps.native.print({ address: cfg.address, data: toBase64(printJob(mono, { cut: cfg.cut })) });
}
