import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, tn } from '../i18n';
import { adjustmentAmount, computeCart, depositSum } from '../lib/cart';
import { canPickContact, pickContact } from '../lib/contacts';
import { nameMatches } from '../lib/names';
import { formatTime } from '../lib/platform';
import {
  addToCart, blankCustomer, cancelCart, cancelPending, cart, customers, enabledCategories, findByCode, inCart, lineName, money, parkCart,
  parkedList, patchLine, productName, products, recallParked, removeOne, saveCustomer, setCartCustomer, setCartNote, setLineTotal,
  setOrderDiscount, setQty, settings, shift, showToast, totals,
} from '../lib/store';
import type { Adjustment, CartLine, Order, Product } from '../lib/types';
import { confirmDialog, Empty, Icon, MoneyInput, NumberInput, Segmented, Sheet, Stepper, TextInput } from '../ui/components';
import { scanBarcode } from '../ui/scanner';
import { CheckoutSheet } from './Checkout';
import { SaleComplete } from './Receipt';

/** Hardware barcode scanners type like a very fast keyboard and finish with Enter. */
function useWedgeScanner(onCode: (code: string) => void) {
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    let buf = '';
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const now = performance.now();
      if (now - last > 80) buf = '';
      last = now;
      if (e.key === 'Enter') {
        if (buf.length >= 4) cb.current(buf);
        buf = '';
      } else if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function Sell() {
  const [q, setQ] = useState('');
  const [chosenCat, setCat] = useState('all');
  // A category switched off while it was selected quietly falls back to "All".
  const cat = chosenCat === 'all' || enabledCategories.value.some((c) => c.id === chosenCat) ? chosenCat : 'all';
  const [pickVariant, setPickVariant] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null); // product whose lines are being edited from the grid
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<Order | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.value.filter(
      (p) =>
        p.active &&
        (cat === 'all' || p.categoryId === cat) &&
        (!needle || nameMatches(p, needle) || p.sku.toLowerCase().includes(needle) || p.barcode.includes(needle)),
    );
  }, [products.value, q, cat]);

  function add(p: Product, variantId = '') {
    const v = p.variants.find((x) => x.id === variantId);
    addToCart(p, v);
    navigator.vibrate?.(8);
    if (p.trackStock && p.stock - inCart(p.id) < 0) showToast(t('Only {n} in stock — selling anyway', { n: Math.max(0, p.stock) }), 'error');
  }

  function tap(p: Product) {
    if (p.variants.length) setPickVariant(p);
    else add(p);
  }

  /** The − on a tile: one unit off, or a small chooser when the item is in the order on several lines. */
  function less(p: Product) {
    navigator.vibrate?.(8);
    if (!removeOne(p.id)) setAdjusting(p.id);
  }

  function byCode(code: string): boolean {
    const hit = findByCode(code);
    if (!hit) {
      showToast(t('No item with code {code}', { code }), 'error');
      return false;
    }
    add(hit.product, hit.variant?.id);
    return true;
  }

  useWedgeScanner(byCode);

  async function scan() {
    const code = await scanBarcode();
    if (code) byCode(code);
  }

  const tot = totals.value;
  const lines = cart.value.lines;

  return (
    <div class="sell">
      <div class="sell-catalog">
        <div class="sell-top">
          <div class="input-wrap grow">
            <input
              class="input"
              type="search"
              placeholder={t('Search or scan item')}
              value={q}
              onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && q.trim() && findByCode(q) && byCode(q)) setQ('');
              }}
              enterkeyhint="search"
            />
            {q && (
              <button class="iconbtn" onClick={() => setQ('')} aria-label={t('Clear search')}>
                <Icon name="close" size="sm" />
              </button>
            )}
          </div>
          <button class="btn soft" style="width:3rem;padding:0" onClick={scan} aria-label={t('Scan barcode')}>
            <Icon name="scan" />
          </button>
          <button class="iconbtn" style="width:3rem;height:3rem;border:1px solid var(--line);background:var(--surface)" onClick={() => setHeldOpen(true)} aria-label={t('Pending orders')}>
            <Icon name="pause" />
            {parkedList.value.length > 0 && <span class="badge-dot">{parkedList.value.length}</span>}
          </button>
        </div>
        {enabledCategories.value.length > 0 && (
          <div class="chips">
            <button class={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>
              {t('All')}
            </button>
            {enabledCategories.value.map((c) => (
              <button key={c.id} class={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        )}
        <div class="sell-scroll">
          {products.value.length === 0 ? (
            <Empty icon="box" title={t('No items yet')}>
              {t('Add your first item from the Items tab, or load sample data in Settings → Data & backup.')}
            </Empty>
          ) : list.length === 0 ? (
            <Empty icon="search" title={t('No match')}>
              {t('Nothing matches “{q}”.', { q })}
            </Empty>
          ) : (
            <div class="tiles">
              {list.map((p) => {
                const n = inCart(p.id);
                const out = p.trackStock && p.stock <= 0;
                const low = p.trackStock && !out && p.stock <= p.lowStock;
                const from = p.variants.length ? Math.min(p.price, ...p.variants.map((v) => v.price)) : p.price;
                return (
                  <div key={p.id} class={`tile-cell ${n > 0 ? 'in' : ''}`}>
                    <button class="tile" onClick={() => tap(p)} style={p.color ? `border-top:0.25rem solid ${p.color}` : ''}>
                      {(out || low) && <span class={`pill stock ${out ? 'bad' : 'warn'}`}>{out ? t('Out') : t('{n} left', { n: p.stock })}</span>}
                      {p.image ? <img class="thumb" src={p.image} alt="" loading="lazy" /> : <span class="emoji">{p.emoji || '🛍️'}</span>}
                      <span class="name">{productName(p)}</span>
                      <span class="price money">{p.variants.length ? t('from {price}', { price: money(from) }) : money(from)}</span>
                    </button>
                    {n > 0 && (
                      <div class="tile-qty">
                        <button onClick={() => less(p)} aria-label={t('Remove one {name}', { name: productName(p) })}>
                          <Icon name="minus" size="sm" />
                        </button>
                        <button class="count" onClick={() => setAdjusting(p.id)} aria-label={t('Change quantity of {name}', { name: productName(p) })}>
                          {n}
                        </button>
                        <button onClick={() => tap(p)} aria-label={t('Add one {name}', { name: productName(p) })}>
                          <Icon name="plus" size="sm" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {lines.length > 0 && (
          <button class="cartbar" onClick={() => setCartOpen(true)}>
            <Icon name="cart" />
            <span class="count">{tot.itemCount}</span>
            <span>{t('Review order')}</span>
            <span class="total money">{money(tot.total)}</span>
            <Icon name="right" />
          </button>
        )}
      </div>

      <aside class="sell-panel">
        <CartView onCharge={() => setPaying(true)} />
      </aside>

      {pickVariant && (
        <Sheet title={productName(pickVariant)} onClose={() => setPickVariant(null)}>
          <div class="list">
            {[{ id: '', name: t('Regular'), price: pickVariant.price }, ...pickVariant.variants].map((v) => (
              <button
                key={v.id || 'base'}
                class="list-row"
                onClick={() => {
                  add(pickVariant, v.id);
                  setPickVariant(null);
                }}
              >
                <div class="grow bold">{v.name}</div>
                <div class="money bold">{money(v.price)}</div>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {cartOpen && (
        <Sheet title={t('Current order')} onClose={() => setCartOpen(false)} full flush>
          <CartView
            onCharge={() => {
              setCartOpen(false);
              setPaying(true);
            }}
            onEmpty={() => setCartOpen(false)}
          />
        </Sheet>
      )}

      {adjusting && <ProductLinesSheet productId={adjusting} onClose={() => setAdjusting(null)} />}
      {heldOpen && <PendingSheet onClose={() => setHeldOpen(false)} onPay={() => setPaying(true)} />}
      {paying && (
        <CheckoutSheet
          onClose={() => setPaying(false)}
          onPending={() => setPaying(false)}
          onDone={(o) => {
            setPaying(false);
            setDone(o);
          }}
        />
      )}
      {done && <SaleComplete order={done} onClose={() => setDone(null)} />}
    </div>
  );
}

// ---------- cart ----------

function CartView({ onCharge, onEmpty }: { onCharge: () => void; onEmpty?: () => void }) {
  const c = cart.value;
  const tot = totals.value;
  const s = settings.value;
  const [editing, setEditing] = useState<string | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const customer = customers.value.find((x) => x.id === c.customerId);
  const editLine = c.lines.find((l) => l.id === editing);
  const taken = depositSum(c.paid); // deposits already paid on this order
  const due = tot.total - taken;

  if (!c.lines.length)
    return (
      <div class="cart">
        <Empty icon="cart" title={t('Order is empty')}>
          {t('Tap items to add them.')}
        </Empty>
      </div>
    );

  return (
    <div class="cart">
      <div class="cart-lines" style="flex:1">
        {c.lines.map((l, i) => {
          const cl = tot.lines[i];
          const listTotal = l.qty * l.unitPrice;
          const custom = l.lineTotal != null && l.lineTotal !== listTotal;
          return (
            <div class="cart-line" key={l.id}>
              <button class="info" onClick={() => setEditing(l.id)}>
                <div class="bold ellipsis">{lineName(l)}{l.variantName && <span class="muted"> · {l.variantName}</span>}</div>
                <div class="small muted money">
                  {custom ? t('custom price') : t('{price} each', { price: money(l.unitPrice) })}
                  {cl.discount > 0 && <span> · −{money(cl.discount)}</span>}
                  {l.note && <span> · {l.note}</span>}
                </div>
              </button>
              <Stepper value={l.qty} onChange={(n) => setQty(l.id, n)} />
              <div class="money bold" style="min-width:4rem;text-align:end">
                {(custom || cl.discount > 0) && <div class="strike">{money(custom ? listTotal : cl.gross)}</div>}
                {money(cl.gross - cl.discount)}
              </div>
            </div>
          );
        })}
        <div class="list" style="margin:0.875rem 0">
          <button class="list-row" onClick={() => setCustomerOpen(true)}>
            <Icon name="user" />
            <div class="grow">
              <div>{customer ? customer.name : t('Add customer')}</div>
              {customer?.note && <div class="sub ellipsis" style="color:var(--warn)">{customer.note}</div>}
            </div>
            {customer && s.loyaltyEnabled && <span class="pill brand">{t('{n} pts', { n: customer.points })}</span>}
            <Icon name="right" class="chev" />
          </button>
          <button class="list-row" onClick={() => setDiscountOpen(true)}>
            <Icon name="percent" /> <div class="grow">{tot.orderDiscount ? t('Discount −{amount}', { amount: money(tot.orderDiscount) }) : t('Add discount')}</div>
            <Icon name="right" class="chev" />
          </button>
          <button class="list-row" onClick={() => setNoteOpen(true)}>
            <Icon name="note" /> <div class="grow ellipsis">{c.note || t('Add order note')}</div>
            <Icon name="right" class="chev" />
          </button>
        </div>
      </div>
      <div class="cart-foot">
        <div class="sum-row"><span class="muted">{t('Subtotal')}</span><span class="money">{money(tot.subtotal)}</span></div>
        {tot.orderDiscount > 0 && <div class="sum-row"><span class="muted">{t('Discount')}</span><span class="money">−{money(tot.orderDiscount)}</span></div>}
        {tot.tax > 0 && (
          <div class="sum-row">
            <span class="muted">{s.taxName} {s.taxRate}%{s.taxInclusive ? ` ${t('(included)')}` : ''}</span>
            <span class="money">{money(tot.tax)}</span>
          </div>
        )}
        <div class={`sum-row ${taken ? '' : 'total'}`}><span>{t('Total')}</span><span class="money">{money(tot.total)}</span></div>
        {taken > 0 && (
          <>
            <div class="sum-row"><span class="muted">{t('Paid so far')}</span><span class="money">−{money(taken)}</span></div>
            <div class="sum-row total"><span>{t('Balance due')}</span><span class="money">{money(Math.max(0, due))}</span></div>
          </>
        )}
        {s.requireShift && !shift.value && <div class="banner" style="margin:0.5rem 0">{t('Open a shift (More → Shift) before charging.')}</div>}
        <div class="row wrap" style="margin-top:0.625rem">
          <button
            class="btn"
            onClick={async () => {
              const message = taken > 0 ? t('The {amount} already paid has to be given back to the customer.', { amount: money(taken) }) : t('All items will be removed.');
              if (await confirmDialog({ title: t('Clear this order?'), message, confirmLabel: t('Clear'), danger: true })) {
                await cancelCart();
                onEmpty?.();
              }
            }}
            aria-label={t('Clear order')}
          >
            <Icon name="trash" />
          </button>
          <button
            class="btn"
            onClick={async () => {
              await parkCart();
              showToast(t('Order saved as pending — open it from the pause button'));
              onEmpty?.();
            }}
          >
            <Icon name="pause" /> {t('Hold')}
          </button>
          <button class="btn primary lg grow" style="flex:1 1 9rem" disabled={s.requireShift && !shift.value} onClick={onCharge}>
            {taken > 0 ? (due > 0 ? t('Collect {amount}', { amount: money(due) }) : t('Complete sale')) : t('Charge {amount}', { amount: money(tot.total) })}
          </button>
        </div>
      </div>

      {editLine && <LineSheet line={editLine} onClose={() => setEditing(null)} />}
      {discountOpen && (
        <Sheet title={t('Order discount')} onClose={() => setDiscountOpen(false)} footer={<button class="btn primary" onClick={() => setDiscountOpen(false)}>{t('Done')}</button>}>
          <AdjustmentEditor value={c.discount} base={tot.subtotal} onChange={setOrderDiscount} />
        </Sheet>
      )}
      {noteOpen && (
        <Sheet title={t('Order note')} onClose={() => setNoteOpen(false)} footer={<button class="btn primary" onClick={() => setNoteOpen(false)}>{t('Done')}</button>}>
          <textarea class="textarea" value={c.note} placeholder={t('e.g. table 4, gift wrap')} onInput={(e) => setCartNote((e.currentTarget as HTMLTextAreaElement).value)} />
        </Sheet>
      )}
      {customerOpen && <CustomerPicker onClose={() => setCustomerOpen(false)} />}
    </div>
  );
}

export function AdjustmentEditor({ value, base, onChange }: { value: Adjustment | null; base: number; onChange: (a: Adjustment | null) => void }) {
  const type = value?.type ?? 'none';
  return (
    <div class="stack">
      <Segmented
        value={type}
        options={[
          { value: 'none', label: t('None') },
          { value: 'percent', label: t('% off') },
          { value: 'amount', label: t('Amount off') },
        ]}
        onChange={(v) => onChange(v === 'none' ? null : { type: v, value: value?.type === v ? value.value : 0 })}
      />
      {value?.type === 'percent' && <NumberInput label={t('Percent off')} value={value.value} max={100} decimals onChange={(n) => onChange({ type: 'percent', value: n })} />}
      {value?.type === 'amount' && <MoneyInput label={t('Amount off')} value={value.value} onChange={(n) => onChange({ type: 'amount', value: n })} />}
      {value && <div class="hint">{t('Takes off {amount}', { amount: money(adjustmentAmount(value, base)) })}</div>}
    </div>
  );
}

/** Edit what is in the order for one item without leaving the grid: its full editor, or a list when it is on several lines. */
function ProductLinesSheet({ productId, onClose }: { productId: string; onClose: () => void }) {
  const lines = cart.value.lines.filter((l) => l.productId === productId);
  const [asList] = useState(lines.length > 1); // decided on opening, so trimming a list down to one line doesn't swap the sheet under the finger
  const [editing, setEditing] = useState<string | null>(null);
  const editLine = lines.find((l) => l.id === editing);
  useEffect(() => {
    if (!lines.length) onClose();
  }, [lines.length]);
  if (lines.length === 0) return null;
  if (!asList) return <LineSheet line={lines[0]} onClose={onClose} />;
  return (
    <Sheet title={lineName(lines[0])} onClose={onClose} footer={<button class="btn primary" onClick={onClose}>{t('Done')}</button>}>
      <div class="list">
        {lines.map((l) => (
          <div class="list-row" key={l.id}>
            <button class="grow" style="background:none;border:0;text-align:start;padding:0;min-width:0" onClick={() => setEditing(l.id)}>
              <div class="bold ellipsis">{l.variantName || t('Regular')}</div>
              <div class="sub money">{t('{price} each', { price: money(l.unitPrice) })}{l.note && ` · ${l.note}`}</div>
            </button>
            <Stepper value={l.qty} onChange={(n) => setQty(l.id, n)} />
          </div>
        ))}
      </div>
      {editLine && <LineSheet line={editLine} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}

function LineSheet({ line, onClose }: { line: CartLine; onClose: () => void }) {
  const listTotal = line.qty * line.unitPrice;
  const custom = line.lineTotal != null && line.lineTotal !== listTotal;
  const shownTotal = line.lineTotal ?? listTotal;
  return (
    <Sheet
      title={lineName(line)}
      onClose={onClose}
      footer={
        <>
          <button class="btn danger-ghost" onClick={() => { setQty(line.id, 0); onClose(); }}>
            <Icon name="trash" /> {t('Remove')}
          </button>
          <button class="btn primary" onClick={onClose}>{t('Done')}</button>
        </>
      }
    >
      <div class="stack">
        <div class="row between">
          <span class="bold">{t('Quantity')}</span>
          <Stepper value={line.qty} min={1} onChange={(n) => patchLine(line.id, { qty: n })} />
        </div>
        <MoneyInput label={t('Unit price')} value={line.unitPrice} onChange={(n) => patchLine(line.id, { unitPrice: n, lineTotal: null })} hint={t('Changes the price for this sale only.')} />
        <MoneyInput
          label={t('Item total')}
          value={shownTotal}
          onChange={(n) => setLineTotal(line.id, n === listTotal ? null : n)}
          hint={t('Charge a different amount for this item — for example a special price for this customer.')}
        />
        {custom && (
          <button class="btn sm" onClick={() => setLineTotal(line.id, null)}>
            {t('Reset to list price ({amount})', { amount: money(listTotal) })}
          </button>
        )}
        <div>
          <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Item discount')}</div>
          <AdjustmentEditor value={line.discount} base={shownTotal} onChange={(a) => patchLine(line.id, { discount: a })} />
        </div>
        <TextInput label={t('Note')} value={line.note} placeholder={t('e.g. no sugar')} onInput={(e) => patchLine(line.id, { note: (e.currentTarget as HTMLInputElement).value })} />
      </div>
    </Sheet>
  );
}

function CustomerPicker({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const needle = q.trim().toLowerCase();
  const list = customers.value.filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.phone.includes(needle));

  async function fromContacts() {
    try {
      const c = await pickContact();
      if (!c) return;
      const saved = await saveCustomer({ ...blankCustomer(), name: c.name || c.phones[0] || t('Customer'), phone: c.phones[0] ?? '', email: c.emails[0] ?? '' });
      setCartCustomer(saved.id);
      onClose();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  return (
    <Sheet title={t('Customer')} onClose={onClose}>
      {cart.value.customerId && (
        <button class="btn block" style="margin-bottom:0.75rem" onClick={() => { setCartCustomer(''); onClose(); }}>
          {t('Remove customer from order')}
        </button>
      )}
      {adding ? (
        <div class="stack">
          <TextInput label={t('Name')} value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} autofocus />
          <TextInput label={t('Phone')} type="tel" value={phone} onInput={(e) => setPhone((e.currentTarget as HTMLInputElement).value)} />
          <button
            class="btn primary block"
            disabled={!name.trim()}
            onClick={async () => {
              const c = await saveCustomer({ ...blankCustomer(), name, phone });
              setCartCustomer(c.id);
              onClose();
            }}
          >
            {t('Save & add to order')}
          </button>
        </div>
      ) : (
        <>
          <div class="row" style="margin-bottom:0.75rem">
            <input class="input grow" type="search" placeholder={t('Search name or phone')} value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />
            <button class="btn soft" onClick={() => { setName(q); setAdding(true); }}>
              <Icon name="plus" /> {t('New')}
            </button>
            {canPickContact() && (
              <button class="btn soft" onClick={fromContacts} aria-label={t('Pick from phone contacts')}>
                <Icon name="contact" />
              </button>
            )}
          </div>
          {list.length === 0 ? (
            <Empty icon="users" title={t('No customers found')} />
          ) : (
            <div class="list">
              {list.map((c) => (
                <button key={c.id} class="list-row" onClick={() => { setCartCustomer(c.id); onClose(); }}>
                  <div class="grow">
                    <div class="bold">{c.name}</div>
                    <div class="sub">{c.phone || t('No phone')}</div>
                    {c.note && <div class="sub ellipsis" style="color:var(--warn)">{c.note}</div>}
                  </div>
                  {settings.value.loyaltyEnabled && <span class="pill brand">{t('{n} pts', { n: c.points })}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

/** Orders set aside — unpaid, or part-paid with a deposit — to be opened and finished later. */
function PendingSheet({ onClose, onPay }: { onClose: () => void; onPay: () => void }) {
  const s = settings.value;
  const rows = parkedList.value.map((p) => {
    const total = computeCart(p.cart, { rate: s.taxRate, inclusive: s.taxInclusive }).total;
    const paid = depositSum(p.cart.paid);
    return { p, total, paid, due: total - paid };
  });
  const toCollect = rows.reduce((a, r) => a + Math.max(0, r.due), 0);
  const blocked = s.requireShift && !shift.value;

  async function open(id: string, thenPay: boolean) {
    await recallParked(id);
    onClose();
    if (thenPay) onPay();
  }

  return (
    <Sheet title={t('Pending orders')} onClose={onClose}>
      {rows.length === 0 ? (
        <Empty icon="pause" title={t('No pending orders')}>{t('Use “Hold” in the order screen to set a sale aside. You can take a deposit first from the payment screen.')}</Empty>
      ) : (
        <div class="stack">
          {rows.length > 1 && <div class="hint">{t('{amount} to collect in total', { amount: money(toCollect) })}</div>}
          <div class="list">
            {rows.map(({ p, total, paid, due }) => (
              <div class="list-row pending" key={p.id}>
                <button class="pending-open" onClick={() => open(p.id, false)}>
                  <div class="bold ellipsis">{p.name}</div>
                  <div class="sub">{tn(p.cart.lines.reduce((a, l) => a + l.qty, 0), '{n} item', '{n} items')} · {formatTime(p.createdAt)}</div>
                  <div class="row wrap" style="gap:0.375rem;margin-top:0.25rem">
                    <span class="money bold">{money(total)}</span>
                    {paid > 0 ? <span class="pill warn">{t('{amount} paid', { amount: money(paid) })}</span> : <span class="pill">{t('Unpaid')}</span>}
                  </div>
                </button>
                <div class="row" style="gap:0.25rem">
                  <button class="btn sm primary" disabled={blocked} onClick={() => open(p.id, true)}>
                    {due > 0 ? t('Pay {amount}', { amount: money(due) }) : t('Complete sale')}
                  </button>
                  <button
                    class="iconbtn"
                    aria-label={t('Delete pending order')}
                    onClick={async () => {
                      const message = paid > 0 ? t('The {amount} already paid has to be given back to the customer.', { amount: money(paid) }) : undefined;
                      if (await confirmDialog({ title: t('Delete pending order?'), message, danger: true, confirmLabel: t('Delete') })) await cancelPending(p.id);
                    }}
                  >
                    <Icon name="trash" size="sm" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {blocked && <div class="banner"><div>{t('Open a shift (More → Shift) before charging.')}</div></div>}
        </div>
      )}
    </Sheet>
  );
}
