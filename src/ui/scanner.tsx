import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { isNative } from '../lib/platform';
import { registerSheet } from '../lib/sheets';
import { Icon } from './components';

const request = signal<{ resolve: (code: string | null) => void } | null>(null);

/**
 * Scan a barcode. In the Android app this uses the ML Kit scanner; in a browser it opens the camera
 * with the BarcodeDetector API, and always offers manual entry as a fallback.
 */
export async function scanBarcode(): Promise<string | null> {
  if (isNative()) {
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      const { barcodes } = await BarcodeScanner.scan();
      return barcodes[0]?.rawValue ?? null;
    } catch (e) {
      if (/cancel/i.test(String((e as Error)?.message))) return null;
      // Scanner module unavailable on this device: fall through to the in-app camera.
    }
  }
  return new Promise((resolve) => {
    request.value = { resolve };
  });
}

declare global {
  interface Window {
    BarcodeDetector?: new (o?: { formats: string[] }) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> };
  }
}

export function ScannerHost() {
  const req = request.value;
  if (!req) return null;
  return <Scanner onDone={(code) => { req.resolve(code); request.value = null; }} />;
}

function Scanner({ onDone }: { onDone: (code: string | null) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState(() => t('Starting camera…'));
  const [manual, setManual] = useState('');
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => registerSheet(() => doneRef.current(null)), []); // back button cancels the scan

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | undefined;
    let timer = 0;
    (async () => {
      if (!window.BarcodeDetector) {
        setStatus(t('Camera scanning is not supported in this browser. Type the code instead.'));
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stop) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        setStatus(t('Point the camera at a barcode'));
        const detector = new window.BarcodeDetector!({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf'] });
        const tick = async () => {
          if (stop) return;
          try {
            const found = await detector.detect(v);
            if (found[0]?.rawValue) {
              navigator.vibrate?.(40);
              return onDone(found[0].rawValue);
            }
          } catch {
            /* frame not ready */
          }
          timer = window.setTimeout(tick, 150);
        };
        tick();
      } catch {
        setStatus(t('Camera permission was denied or no camera is available. Type the code instead.'));
      }
    })();
    return () => {
      stop = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div class="scanner">
      <video ref={video} playsInline muted />
      <div class="frame" />
      <div class="bar">
        <strong>{t('Scan barcode')}</strong>
        <button class="iconbtn" style="color:#fff" onClick={() => onDone(null)} aria-label={t('Cancel scan')}>
          <Icon name="close" />
        </button>
      </div>
      <div class="foot">
        <div class="small" style="margin-bottom:0.625rem">{status}</div>
        <form
          class="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onDone(manual.trim());
          }}
        >
          <input class="input grow" placeholder={t('Or type the code')} value={manual} onInput={(e) => setManual((e.currentTarget as HTMLInputElement).value)} />
          <button class="btn primary" type="submit">{t('Use')}</button>
        </form>
      </div>
    </div>
  );
}
