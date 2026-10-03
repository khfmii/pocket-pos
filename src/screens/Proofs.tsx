import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n';
import { pickProofPhoto } from '../lib/image';
import { formatBytes, formatDateTime, shareImage } from '../lib/platform';
import { addAttachment, attachmentsFor, can, removeAttachment, showToast } from '../lib/store';
import type { Attachment } from '../lib/types';
import { confirmDialog, Icon, Sheet } from '../ui/components';

/** "Take photo" / "Choose photo" buttons. Resolves the compressed JPEG data URL, or null when cancelled. */
function PhotoButtons({ onPhoto, busy, setBusy }: { onPhoto: (dataUrl: string) => void | Promise<void>; busy: boolean; setBusy: (b: boolean) => void }) {
  async function go(source: 'camera' | 'library') {
    setBusy(true);
    try {
      const img = await pickProofPhoto(source);
      if (img) await onPhoto(img);
    } catch (e) {
      showToast((e as Error).message || t('Could not read that photo.'), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="grid2">
      <button class="btn" disabled={busy} onClick={() => go('camera')}>
        <Icon name="camera" /> {t('Take photo')}
      </button>
      <button class="btn" disabled={busy} onClick={() => go('library')}>
        <Icon name="image" /> {t('Choose photo')}
      </button>
    </div>
  );
}

function Thumbs({ items, onOpen }: { items: { id: string; image: string }[]; onOpen: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <div class="proof-grid">
      {items.map((a) => (
        <button key={a.id} class="proof-thumb" onClick={() => onOpen(a.id)} aria-label={t('View payment proof')}>
          <img src={a.image} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  );
}

/** Used while taking payment: photos are held in memory and saved together with the sale. */
export function ProofPicker({ images, onChange }: { images: string[]; onChange: (next: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div class="card pad stack">
      <div class="row between">
        <div>
          <div class="bold">
            <Icon name="paperclip" size="sm" /> {t('Payment proof')}
          </div>
          <div class="small muted">{t('Optional — attach a bank slip or screenshot.')}</div>
        </div>
      </div>
      <Thumbs items={images.map((image, i) => ({ id: String(i), image }))} onOpen={(id) => setOpen(Number(id))} />
      <PhotoButtons busy={busy} setBusy={setBusy} onPhoto={(img) => onChange([...images, img])} />
      {open !== null && images[open] && (
        <Sheet
          title={t('Payment proof')}
          onClose={() => setOpen(null)}
          footer={
            <button
              class="btn danger-ghost"
              onClick={() => {
                onChange(images.filter((_, i) => i !== open));
                setOpen(null);
              }}
            >
              <Icon name="trash" /> {t('Remove')}
            </button>
          }
        >
          <img class="proof-full" src={images[open]} alt={t('Payment proof')} />
        </Sheet>
      )}
    </div>
  );
}

/** Photos saved against an existing sale; add more or open one full size. */
export function ProofSection({ orderId, onChanged }: { orderId: string; onChanged?: () => void }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const reload = () => attachmentsFor(orderId).then(setItems);
  useEffect(() => {
    reload();
  }, [orderId]);
  const open = items.find((a) => a.id === openId);

  return (
    <div class="card pad stack">
      <div class="bold">
        <Icon name="paperclip" size="sm" /> {t('Payment proof')} {items.length > 0 && <span class="pill brand">{items.length}</span>}
      </div>
      {items.length === 0 && <div class="small muted">{t('No payment proof attached to this sale.')}</div>}
      <Thumbs items={items} onOpen={setOpenId} />
      <PhotoButtons
        busy={busy}
        setBusy={setBusy}
        onPhoto={async (img) => {
          await addAttachment(orderId, img);
          showToast(t('Payment proof saved'));
          await reload();
          onChanged?.();
        }}
      />
      {open && (
        <Sheet
          title={t('Payment proof')}
          onClose={() => setOpenId(null)}
          footer={
            <>
              {can('settings') && (
                <button
                  class="btn danger-ghost fixed"
                  aria-label={t('Delete')}
                  onClick={async () => {
                    if (!(await confirmDialog({ title: t('Delete this photo?'), message: t('It will be removed from this sale.'), confirmLabel: t('Delete'), danger: true }))) return;
                    await removeAttachment(open.id);
                    setOpenId(null);
                    await reload();
                    onChanged?.();
                  }}
                >
                  <Icon name="trash" />
                </button>
              )}
              <button class="btn" onClick={() => shareImage(open.image, `payment-proof-${new Date(open.at).toISOString().slice(0, 10)}.jpg`).catch(() => showToast(t('Could not share the photo.'), 'error'))}>
                <Icon name="share" /> {t('Share')}
              </button>
            </>
          }
        >
          <img class="proof-full" src={open.image} alt={t('Payment proof')} />
          <div class="small muted center" style="margin-top:0.625rem">
            {formatDateTime(open.at)}
            {open.by && ` · ${open.by}`} · {formatBytes(open.bytes)}
          </div>
        </Sheet>
      )}
    </div>
  );
}
