import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { boxForAspect, resizeBox, rotatedSize, type Box, type Handle } from '../lib/crop';
import { decode, release, setImageEditor, type EditKind, type ImageSource } from '../lib/image';
import { downscale, renderEdited } from '../lib/imageEdit';
import { Icon, Sheet } from './components';

/** What each kind of picture may be cropped to. `null` = free. */
const ASPECTS: Record<EditKind, { key: string; label: () => string; value: number | null }[]> = {
  product: [{ key: 'sq', label: () => t('Square'), value: 1 }], // item tiles are square
  proof: [
    { key: 'free', label: () => t('Free-form'), value: null },
    { key: 'sq', label: () => t('Square'), value: 1 },
    { key: '43', label: () => '4:3', value: 4 / 3 },
    { key: '34', label: () => '3:4', value: 3 / 4 },
  ],
  logo: [
    { key: 'free', label: () => t('Free-form'), value: null },
    { key: 'sq', label: () => t('Square'), value: 1 },
    { key: '21', label: () => '2:1', value: 2 },
  ],
};

const request = signal<{ file: File; kind: EditKind; resolve: (c: HTMLCanvasElement | null) => void } | null>(null);

/** Shows the editor for a picked file and resolves the edited picture (or null when cancelled). */
export const editImage = (file: File, kind: EditKind) => new Promise<HTMLCanvasElement | null>((resolve) => (request.value = { file, kind, resolve }));

// Every pick in the app goes through here (see lib/image.ts).
setImageEditor(editImage);

export function ImageEditorHost() {
  const r = request.value;
  if (!r) return null;
  return (
    <Editor
      file={r.file}
      kind={r.kind}
      onDone={(canvas) => {
        r.resolve(canvas);
        request.value = null;
      }}
    />
  );
}

const CORNERS: Handle[] = ['nw', 'ne', 'sw', 'se'];
const EDGES: Handle[] = ['n', 's', 'w', 'e'];

function Editor({ file, kind, onDone }: { file: File; kind: EditKind; onDone: (c: HTMLCanvasElement | null) => void }) {
  const choices = ASPECTS[kind];
  const [pic, setPic] = useState<{ full: ImageSource; preview: ImageSource } | null>(null);
  const [failed, setFailed] = useState(false);
  const [turns, setTurns] = useState(0);
  const [aspect, setAspect] = useState<number | null>(choices[0].value);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 1, h: 1 });
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle; x: number; y: number; box: Box; rect: DOMRect } | null>(null);

  useEffect(() => {
    let alive = true;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    decode(file)
      .catch(() => sleep(400).then(() => decode(file)))
      .then((full) => {
        if (!alive) return release(full);
        setPic({ full, preview: downscale(full) });
        setBox(boxForAspect(full.width, full.height, choices[0].value));
      })
      .catch((e) => {
        (window as unknown as { __editorError?: string }).__editorError = String(e?.stack || e);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [file]);
  useEffect(() => () => pic && release(pic.full), [pic]);

  // Redraw the preview when the rotation or adjustments change (not while the frame is dragged).
  useEffect(() => {
    if (!pic || !canvasRef.current) return;
    const out = renderEdited(pic.preview, { turns, box: { x: 0, y: 0, w: 1, h: 1 }, brightness, contrast }, 1400);
    const c = canvasRef.current;
    c.width = out.width;
    c.height = out.height;
    c.getContext('2d')!.drawImage(out, 0, 0);
  }, [pic, turns, brightness, contrast]);

  if (failed)
    return (
      <Sheet title={t('Edit photo')} onClose={() => onDone(null)}>
        <div class="banner bad"><div>{t('Could not read that photo.')}</div></div>
      </Sheet>
    );
  if (!pic)
    return (
      <Sheet title={t('Edit photo')} onClose={() => onDone(null)} full>
        <div class="splash" style="min-height:40dvh">{t('Loading…')}</div>
      </Sheet>
    );

  const rot = rotatedSize(pic.full.width, pic.full.height, turns);
  const reframe = (a: number | null, w = rot.w, h = rot.h) => setBox(boxForAspect(w, h, a));
  const turn = (d: number) => {
    const next = (turns + d + 4) % 4;
    const r = rotatedSize(pic.full.width, pic.full.height, next);
    setTurns(next);
    reframe(aspect, r.w, r.h);
  };
  const reset = () => {
    setTurns(0);
    setBrightness(0);
    setContrast(0);
    reframe(aspect, pic.full.width, pic.full.height);
  };

  const down = (handle: Handle) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { handle, x: e.clientX, y: e.clientY, box, rect: frameRef.current!.getBoundingClientRect() };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setBox(resizeBox(d.box, d.handle, (e.clientX - d.x) / d.rect.width, (e.clientY - d.y) / d.rect.height, { imgW: rot.w, imgH: rot.h, aspect }));
  };
  const up = () => (drag.current = null);

  const ratio = rot.w / rot.h;
  const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

  return (
    <Sheet
      title={t('Edit photo')}
      onClose={() => onDone(null)}
      full
      footer={
        <>
          <button class="btn" onClick={() => onDone(null)}>{t('Cancel')}</button>
          <button class="btn primary" onClick={() => onDone(renderEdited(pic.full, { turns, box, brightness, contrast }))}>{t('Use photo')}</button>
        </>
      }
    >
      <div class="stack">
        {/* The picture is inset 2.25rem each side: handles right at the screen edge would trigger Android's back gesture. */}
        <div class="crop-frame" ref={frameRef} style={`width:min(calc(100% - 4.5rem), ${(58 * ratio).toFixed(2)}dvh);aspect-ratio:${rot.w} / ${rot.h}`}>
          <canvas ref={canvasRef} class="crop-canvas" />
          {/* dim everything outside the frame */}
          <div class="crop-dim" style={`left:0;top:0;width:100%;height:${pct(box.y)}`} />
          <div class="crop-dim" style={`left:0;top:${pct(box.y + box.h)};width:100%;height:${pct(1 - box.y - box.h)}`} />
          <div class="crop-dim" style={`left:0;top:${pct(box.y)};width:${pct(box.x)};height:${pct(box.h)}`} />
          <div class="crop-dim" style={`left:${pct(box.x + box.w)};top:${pct(box.y)};width:${pct(1 - box.x - box.w)};height:${pct(box.h)}`} />
          <div
            class="crop-box"
            style={`left:${pct(box.x)};top:${pct(box.y)};width:${pct(box.w)};height:${pct(box.h)}`}
            onPointerDown={down('move')}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            role="presentation"
          >
            {(aspect ? CORNERS : [...CORNERS, ...EDGES]).map((h) => (
              <span key={h} class={`crop-h ${h}`} onPointerDown={down(h)} />
            ))}
          </div>
        </div>
        <div class="hint" style="text-align:center">{t('Drag the corners to crop. Drag inside the frame to move it.')}</div>

        <div class="row" style="gap:0.5rem">
          <button class="btn grow" onClick={() => turn(-1)} aria-label={t('Rotate left')}>
            <span style="display:inline-flex;transform:scaleX(-1)"><Icon name="rotate" /></span>
          </button>
          <button class="btn grow" onClick={() => turn(1)} aria-label={t('Rotate right')}>
            <Icon name="rotate" />
          </button>
        </div>

        {choices.length > 1 && (
          <div class="chips" style="padding:0">
            {choices.map((c) => (
              <button
                key={c.key}
                class={`chip ${aspect === c.value ? 'on' : ''}`}
                onClick={() => {
                  setAspect(c.value);
                  reframe(c.value);
                }}
              >
                {c.label()}
              </button>
            ))}
          </div>
        )}

        <label class="field">
          <span class="label">{t('Brightness')}</span>
          <input class="range" type="range" min={-50} max={50} step={5} value={brightness} onInput={(e) => setBrightness(Number((e.currentTarget as HTMLInputElement).value))} />
        </label>
        <label class="field">
          <span class="label">{t('Contrast')}</span>
          <input class="range" type="range" min={-50} max={50} step={5} value={contrast} onInput={(e) => setContrast(Number((e.currentTarget as HTMLInputElement).value))} />
        </label>
        <button class="btn sm" onClick={reset}>{t('Reset')}</button>
      </div>
    </Sheet>
  );
}
