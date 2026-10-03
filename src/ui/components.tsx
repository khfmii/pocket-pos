import { signal } from '@preact/signals';
import type { ComponentChildren, ComponentProps } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { registerSheet } from '../lib/sheets';
import { parseMoney, toInput } from '../lib/money';
import { settings, toast } from '../lib/store';

// ---------- icons ----------

const PATHS: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2.5l2.2 11h10.6l2-8H6.3"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
  box: '<path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
  chart: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .7 3.3 2.6 3.7 5.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  wallet: '<path d="M4 7a2 2 0 0 1 2-2h12v3M4 7v10a2 2 0 0 0 2 2h14V8H6a2 2 0 0 1-2-1"/><circle cx="16.5" cy="13.5" r="1"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2.3 2.3L15.5 10"/>',
  database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5"/><path d="M12 8v4l2.5 1.5"/>',
  alert: '<path d="M12 4 21.5 20h-19zM12 10v4M12 17.3v.2"/>',
  percent: '<path d="M6 18 18 6"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
  note: '<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
  store: '<path d="M4 10 5 5h14l1 5M4 10v10h16V10M4 10a3 3 0 0 0 5.3 1.9A3 3 0 0 0 14.7 12 3 3 0 0 0 20 10M10 20v-5h4v5"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5M12 8v4l3 2"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="m21 16-5-5-8 8"/>',
  paperclip: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  type: '<path d="M4 7V5h10v2M9 5v14M7 19h4M14 11v-1h7v1M17.5 10v9M16 19h3"/>',
  contact: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M7.5 17c.8-2 2.5-3 4.5-3s3.7 1 4.5 3"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/>',
};

export function Icon({ name, size, class: cls = '' }: { name: keyof typeof PATHS | string; size?: 'sm' | 'lg'; class?: string }) {
  return (
    <svg class={`icon ${size ?? ''} ${cls}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[name] ?? '' }} />
  );
}

// ---------- layout ----------

export function Sheet({
  title,
  onClose,
  full,
  flush,
  children,
  footer,
  actions,
}: {
  title: string;
  onClose: () => void;
  full?: boolean;
  flush?: boolean; // no padding; body is a flex column (used by the cart)
  children: ComponentChildren;
  footer?: ComponentChildren;
  actions?: ComponentChildren;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => registerSheet(() => closeRef.current()), []);
  return (
    <div class="overlay" onClick={(e) => !full && e.target === e.currentTarget && onClose()}>
      <div class={`sheet ${full ? 'full' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet-head">
          {full && (
            <button class="iconbtn" onClick={onClose} aria-label={t('Back')}>
              <Icon name="back" />
            </button>
          )}
          <h2 class="ellipsis">{title}</h2>
          {actions}
          {!full && (
            <button class="iconbtn" onClick={onClose} aria-label={t('Close')}>
              <Icon name="close" />
            </button>
          )}
        </div>
        <div class={`sheet-body ${flush ? 'flush' : ''}`}>{children}</div>
        {footer && <div class="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon = 'box', title, children }: { icon?: string; title: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <div style="display:grid;place-items:center;margin-bottom:0.375rem;color:var(--muted)">
        <Icon name={icon} size="lg" />
      </div>
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export function SectionTitle({ children }: { children: ComponentChildren }) {
  return <div class="section-title">{children}</div>;
}

export function Avatar({ name }: { name: string }) {
  return <div class="avatar">{(name.trim()[0] ?? '?').toUpperCase()}</div>;
}

export function Row({
  icon,
  title,
  sub,
  right,
  onClick,
  emoji,
}: {
  icon?: string;
  emoji?: string;
  title: ComponentChildren;
  sub?: ComponentChildren;
  right?: ComponentChildren;
  onClick?: () => void;
}) {
  const body = (
    <>
      {(icon || emoji) && <div class="lead">{emoji ?? <Icon name={icon!} />}</div>}
      <div class="grow">
        <div class="bold ellipsis">{title}</div>
        {sub && <div class="sub ellipsis">{sub}</div>}
      </div>
      {right}
      {onClick && !right && <Icon name="right" class="chev" />}
    </>
  );
  return onClick ? (
    <button class="list-row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div class="list-row">{body}</div>
  );
}

// ---------- form controls ----------

/** Reads an input's value keeping digits only, writing the cleaned text back to the DOM
 *  (Preact will not re-render if the cleaned state is unchanged, so stray characters would stay visible). */
export function digitsOnly(e: Event): string {
  const el = e.currentTarget as HTMLInputElement;
  const clean = el.value.replace(/\D/g, '');
  if (el.value !== clean) el.value = clean;
  return clean;
}

export function Field({ label, hint, children }: { label?: string; hint?: ComponentChildren; children: ComponentChildren }) {
  return (
    <label class="field">
      {label && <span class="label">{label}</span>}
      {children}
      {hint && <div class="hint">{hint}</div>}
    </label>
  );
}

export function TextInput(props: ComponentProps<'input'> & { label?: string; hint?: ComponentChildren }) {
  const { label, hint, class: cls, ...rest } = props;
  return (
    <Field label={label} hint={hint}>
      <input class={`input ${cls ?? ''}`} autocomplete="off" {...rest} />
    </Field>
  );
}

export function MoneyInput({
  value,
  onChange,
  label,
  hint,
  big,
  autofocus,
  placeholder,
}: {
  value: number;
  onChange: (minor: number) => void;
  label?: string;
  hint?: ComponentChildren;
  big?: boolean;
  autofocus?: boolean;
  placeholder?: string;
}) {
  const dec = settings.value.currencyDecimals;
  const [text, setText] = useState(toInput(value, dec));
  // Re-sync when the parent changes the value (e.g. a quick-cash chip), but never fight the user's typing.
  useEffect(() => {
    if (parseMoney(text, dec) !== value) setText(toInput(value, dec));
  }, [value]);
  return (
    <Field label={label} hint={hint}>
      <input
        class={`input ${big ? 'big' : ''}`}
        inputMode={dec > 0 ? 'decimal' : 'numeric'}
        value={text}
        placeholder={placeholder ?? (dec > 0 ? '0.' + '0'.repeat(dec) : '0')}
        autofocus={autofocus}
        autocomplete="off"
        onFocus={(e) => (e.currentTarget as HTMLInputElement).select()}
        onInput={(e) => {
          const el = e.currentTarget as HTMLInputElement;
          const v = el.value.replace(/[^0-9.,]/g, '');
          if (v !== el.value) el.value = v;
          setText(v);
          onChange(parseMoney(v, dec));
        }}
      />
    </Field>
  );
}

export function NumberInput({
  value,
  onChange,
  label,
  hint,
  min = 0,
  max,
  decimals = false,
}: {
  value: number;
  onChange: (n: number) => void;
  label?: string;
  hint?: ComponentChildren;
  min?: number;
  max?: number;
  decimals?: boolean;
}) {
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => {
    if (Number(text || 0) !== value) setText(value ? String(value) : '');
  }, [value]);
  return (
    <Field label={label} hint={hint}>
      <input
        class="input"
        inputMode={decimals ? 'decimal' : 'numeric'}
        value={text}
        placeholder="0"
        autocomplete="off"
        onFocus={(e) => (e.currentTarget as HTMLInputElement).select()}
        onInput={(e) => {
          const el = e.currentTarget as HTMLInputElement;
          const typed = el.value.replace(decimals ? /[^0-9.,]/g : /\D/g, '');
          if (typed !== el.value) el.value = typed;
          const raw = typed.replace(',', '.');
          setText(raw);
          let n = Number(raw);
          if (!Number.isFinite(n)) n = 0;
          n = Math.max(min, max !== undefined ? Math.min(max, n) : n);
          onChange(n);
        }}
      />
    </Field>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label class="switch-row">
      <div class="grow">
        <div class="bold">{label}</div>
        {hint && <div class="small muted">{hint}</div>}
      </div>
      <span class="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
        <i />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} class={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} role="tab" aria-selected={o.value === value}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="chips">
      {options.map((o) => (
        <button key={o.value} class={`chip ${o.value === value ? 'on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div class="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label={t('Decrease')}>
        <Icon name="minus" size="sm" />
      </button>
      <span class="num">{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label={t('Increase')}>
        <Icon name="plus" size="sm" />
      </button>
    </div>
  );
}

// ---------- PIN pad ----------

export function PinPad({ value, onChange, onSubmit, max = 6, shake }: { value: string; onChange: (v: string) => void; onSubmit: () => void; max?: number; shake?: boolean }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  // Physical keyboards (tablets, desktop) work too.
  const latest = useRef({ value, onChange, onSubmit, max });
  latest.current = { value, onChange, onSubmit, max };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = latest.current;
      if (/^\d$/.test(e.key) && c.value.length < c.max) c.onChange(c.value + e.key);
      else if (e.key === 'Backspace') c.onChange(c.value.slice(0, -1));
      else if (e.key === 'Enter') c.onSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div>
      <div class={`pin-dots ${shake ? 'shake' : ''}`}>
        {Array.from({ length: max }, (_, i) => (
          <i key={i} class={i < value.length ? 'on' : ''} />
        ))}
      </div>
      <div class="numpad">
        {keys.map((k) => (
          <button key={k} onClick={() => value.length < max && onChange(value + k)}>
            {k}
          </button>
        ))}
        <button class="fn" onClick={() => onChange(value.slice(0, -1))} aria-label={t('Delete')}>
          ⌫
        </button>
        <button onClick={() => value.length < max && onChange(value + '0')}>0</button>
        <button class="fn" onClick={onSubmit} aria-label={t('Confirm')}>
          <Icon name="check" />
        </button>
      </div>
    </div>
  );
}

// ---------- dialogs & toast ----------

interface ConfirmReq {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}
const confirmReq = signal<ConfirmReq | null>(null);

export function confirmDialog(o: Omit<ConfirmReq, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => (confirmReq.value = { ...o, resolve }));
}

export function Host() {
  const c = confirmReq.value;
  const toastNow = toast.value;
  const done = (ok: boolean) => {
    c?.resolve(ok);
    confirmReq.value = null;
  };
  return (
    <>
      {c && (
        <Sheet
          title={c.title}
          onClose={() => done(false)}
          footer={
            <>
              <button class="btn" onClick={() => done(false)}>
                {t('Cancel')}
              </button>
              <button class={`btn ${c.danger ? 'danger' : 'primary'}`} onClick={() => done(true)}>
                {c.confirmLabel ?? t('Confirm')}
              </button>
            </>
          }
        >
          <div class="muted" style="white-space:pre-line">
            {c.message}
          </div>
        </Sheet>
      )}
      {toastNow && (
        <div class={`toast ${toastNow.kind === 'error' ? 'error' : ''}`} role="status">
          {toastNow.msg}
        </div>
      )}
    </>
  );
}

export function SettingsGroup({ children }: { children: ComponentChildren }) {
  return <div class="list">{children}</div>;
}
