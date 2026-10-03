import { useEffect, useMemo, useState } from 'preact/hooks';
import { t, tn } from '../i18n';
import { uid } from '../lib/crypto';
import { pickPhoto } from '../lib/image';
import { toCsv, parseCsv } from '../lib/csv';
import { parseMoney, toInput } from '../lib/money';
import { nameMatches } from '../lib/names';
import { autoTranslateProduct } from '../lib/nameTranslate';
import { pickFile, saveTextFile } from '../lib/platform';
import { registerSheet } from '../lib/sheets';
import {
  adjustStock, blankProduct, categories, deleteProduct, enabledCategories, isEnabled, lowStock, money, moveProducts, products, saveCategory,
  productName, saveProduct, settings, showToast, loadAll,
} from '../lib/store';
import type { Product, StockReason, Variant } from '../lib/types';
import { confirmDialog, Empty, Icon, MoneyInput, NumberInput, Row, Segmented, Sheet, Switch, TextInput } from '../ui/components';
import { EmojiPicker } from '../ui/EmojiPicker';
import { scanBarcode } from '../ui/scanner';
import { CategoriesSheet } from './Categories';
import { NamesSection } from './ItemNames';
import { CostEditor, IngredientsList } from './Ingredients';

export function Products() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [cats, setCats] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [view, setView] = useState<'items' | 'ingredients'>('items');
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); };
  // The OS back button leaves selection mode first, like closing a sheet.
  useEffect(() => (selecting ? registerSheet(stopSelecting) : undefined), [selecting]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.value.filter(
      (p) =>
        (filter === 'all' || (filter === 'low' ? p.trackStock && p.stock <= p.lowStock : p.categoryId === filter)) &&
        (!needle || nameMatches(p, needle) || p.sku.toLowerCase().includes(needle) || p.barcode.includes(needle)),
    );
  }, [products.value, q, filter]);

  const catName = (id: string) => categories.value.find((c) => c.id === id)?.name ?? t('Uncategorised');

  const switcher = (
    <div class="pad" style="padding-bottom:0">
      <Segmented value={view} onChange={setView} options={[{ value: 'items', label: t('Items') }, { value: 'ingredients', label: t('Ingredients') }]} />
    </div>
  );
  if (view === 'ingredients')
    return (
      <div>
        {switcher}
        <IngredientsList />
      </div>
    );

  return (
    <div>
      {switcher}
      <div class="pad" style="padding-bottom:0">
        {selecting ? (
          <div class="row">
            <button class="btn" onClick={stopSelecting} aria-label={t('Cancel')}><Icon name="close" /></button>
            <div class="grow bold">{t('{n} selected', { n: picked.size })}</div>
            <button class="btn" onClick={() => setPicked(picked.size === list.length ? new Set() : new Set(list.map((p) => p.id)))}>
              {picked.size === list.length && list.length > 0 ? t('Clear') : t('Select all')}
            </button>
          </div>
        ) : (
          <div class="row wrap">
            <input class="input grow" style="flex:1 1 9rem;min-width:9rem" type="search" placeholder={t('Search items')} value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />
            <button class="btn" onClick={() => setSelecting(true)} aria-label={t('Select items')}><Icon name="check" /></button>
            <button class="btn" onClick={() => setCats(true)} aria-label={t('Categories')}><Icon name="tag" /></button>
            <button class="btn" onClick={() => setCsvOpen(true)} aria-label={t('Import or export')}><Icon name="file" /></button>
          </div>
        )}
      </div>
      <div style="margin-top:0.625rem">
        <div class="chips">
          <button class={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>{t('All')} ({products.value.length})</button>
          {lowStock.value.length > 0 && (
            <button class={`chip ${filter === 'low' ? 'on' : ''}`} onClick={() => setFilter('low')}>
              <Icon name="alert" size="sm" /> {t('Low stock')} ({lowStock.value.length})
            </button>
          )}
          {categories.value.map((c) => (
            <button key={c.id} class={`chip ${filter === c.id ? 'on' : ''}`} style={isEnabled(c) ? '' : 'opacity:.55'} onClick={() => setFilter(c.id)}>{c.emoji} {c.name}</button>
          ))}
        </div>
      </div>
      <div class="page-pad" style="padding-top:0;padding-bottom:6.875rem">
        {products.value.length === 0 ? (
          <Empty icon="box" title={t('Add your first item')}>{t('Tap “Add item”, or import a CSV from the file button above.')}</Empty>
        ) : list.length === 0 ? (
          <Empty icon="search" title={t('No items match')} />
        ) : (
          <div class="list">
            {list.map((p) => (
              <button class="list-row" key={p.id} onClick={() => (selecting ? setPicked((cur) => { const n = new Set(cur); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; }) : setEditing(p))} style={p.active ? '' : 'opacity:.55'} aria-pressed={selecting ? picked.has(p.id) : undefined}>
                {selecting && <span class={`check ${picked.has(p.id) ? 'on' : ''}`}><Icon name="check" size="sm" /></span>}
                <div class="lead">{p.image ? <img src={p.image} alt="" loading="lazy" /> : p.emoji || '🛍️'}</div>
                <div class="grow">
                  <div class="bold ellipsis">{productName(p)}{!p.active && ` ${t('(hidden)')}`}</div>
                  <div class="sub ellipsis">{catName(p.categoryId)}{p.sku && ` · ${p.sku}`}{p.variants.length > 0 && ` · ${tn(p.variants.length + 1, '{n} size', '{n} sizes')}`}</div>
                </div>
                <div style="text-align:right">
                  <div class="money bold">{money(p.price)}</div>
                  {p.trackStock && (
                    <span class={`pill ${p.stock <= 0 ? 'bad' : p.stock <= p.lowStock ? 'warn' : ''}`}>{t('{n} in stock', { n: p.stock })}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {selecting ? (
        <div class="selbar">
          <div class="grow small muted">{tn(picked.size, '{n} item selected', '{n} items selected')}</div>
          <button class="btn primary" disabled={picked.size === 0} onClick={() => setMoving(true)}>
            <Icon name="tag" size="sm" /> {t('Change category')}
          </button>
        </div>
      ) : (
        <button class="fab" onClick={() => setEditing(blankProduct())}>
          <Icon name="plus" /> {t('Add item')}
        </button>
      )}
      {moving && (
        <MoveSheet
          count={picked.size}
          onClose={() => setMoving(false)}
          onPick={async (categoryId) => {
            const n = await moveProducts([...picked], categoryId);
            setMoving(false);
            stopSelecting();
            showToast(tn(n, '{n} item moved', '{n} items moved'));
          }}
        />
      )}
      {editing && <ProductEditor product={editing} onClose={() => setEditing(null)} />}
      {cats && <CategoriesSheet onClose={() => setCats(false)} />}
      {csvOpen && <CsvSheet onClose={() => setCsvOpen(false)} />}
    </div>
  );
}

const COLORS = ['', '#0f766e', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a'];

function ProductEditor({ product, onClose }: { product: Product; onClose: () => void }) {
  const isNew = !products.value.some((p) => p.id === product.id);
  const [p, setP] = useState<Product>(product);
  const [stockOpen, setStockOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((cur) => ({ ...cur, [k]: v }));
  const live = products.value.find((x) => x.id === p.id);
  const dup = p.barcode && products.value.some((x) => x.id !== p.id && x.barcode === p.barcode);

  async function save() {
    if (!p.name.trim()) return showToast(t('Give the item a name'), 'error');
    const saved = await saveProduct({ ...p, variants: p.variants.filter((v) => v.name.trim()) });
    // Translate new and renamed items in the background (Android, when the shop turned it on); never blocks saving.
    void autoTranslateProduct(saved.id, isNew || saved.name !== product.name).then((r) => {
      if (r.translated) showToast(t('{n} names translated', { n: r.translated }));
    });
    showToast(t('Saved'));
    onClose();
  }

  async function photo(source: 'camera' | 'library') {
    setPhotoBusy(true);
    try {
      const img = await pickPhoto(source);
      if (img) set('image', img);
    } catch (e) {
      showToast((e as Error).message || t('Could not read that photo.'), 'error');
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <Sheet
      title={isNew ? t('New item') : t('Edit item')}
      onClose={onClose}
      full
      footer={
        <>
          {!isNew && (
            <button
              class="btn danger-ghost fixed"
              onClick={async () => {
                if (await confirmDialog({ title: t('Delete {name}?', { name: p.name }), message: t('Past sales keep their record of this item. You can hide it instead to keep it for later.'), confirmLabel: t('Delete'), danger: true })) {
                  await deleteProduct(p.id);
                  onClose();
                }
              }}
              aria-label={t('Delete item')}
            >
              <Icon name="trash" />
            </button>
          )}
          <button class="btn primary" onClick={save}>{t('Save item')}</button>
        </>
      }
    >
      <div class="stack">
        <TextInput label={t('Name')} value={p.name} onInput={(e) => set('name', (e.currentTarget as HTMLInputElement).value)} placeholder={t('e.g. Iced latte')} autofocus={isNew} />
        <NamesSection p={p} setP={setP} />

        <div>
          <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Photo')}</div>
          <div class="photo-edit">
            <div class="photo-box">{p.image ? <img src={p.image} alt="" /> : p.emoji || '🛍️'}</div>
            <div class="stack grow" style="gap:0.5rem">
              <button class="btn sm" disabled={photoBusy} onClick={() => photo('camera')}><Icon name="camera" size="sm" /> {t('Take photo')}</button>
              <button class="btn sm" disabled={photoBusy} onClick={() => photo('library')}><Icon name="image" size="sm" /> {t('Choose photo')}</button>
              {p.image && <button class="btn sm danger-ghost" onClick={() => set('image', undefined)}>{t('Remove photo')}</button>}
            </div>
          </div>
          <div class="hint">{t('Photos are cropped to a square and kept small. Without a photo, the icon below is shown.')}</div>
        </div>

        <MoneyInput label={t('Price')} value={p.price} onChange={(n) => set('price', n)} />
        <CostEditor p={p} set={set} />

        <label class="field">
          <span class="label">{t('Category')}</span>
          <select class="select" value={p.categoryId} onChange={(e) => set('categoryId', (e.currentTarget as HTMLSelectElement).value)}>
            <option value="">{t('Uncategorised')}</option>
            {categories.value.filter((c) => isEnabled(c) || c.id === p.categoryId).map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </label>

        <div>
          <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Icon & colour')}</div>
          <EmojiPicker value={p.emoji} onChange={(e) => set('emoji', e)} />
          <div class="row" style="margin-top:0.625rem">
            {COLORS.map((c) => (
              <button
                key={c || 'none'}
                aria-label={c ? t('Colour {c}', { c }) : t('No colour')}
                onClick={() => set('color', c)}
                style={`width:1.875rem;height:1.875rem;border-radius:50%;border:${p.color === c ? '3px solid var(--text)' : '2px solid var(--line)'};background:${c || 'var(--surface)'}`}
              />
            ))}
          </div>
        </div>

        <div class="grid2">
          <TextInput label={t('SKU')} value={p.sku} onInput={(e) => set('sku', (e.currentTarget as HTMLInputElement).value)} />
          <label class="field">
            <span class="label">{t('Barcode')}</span>
            <div class="input-wrap">
              <input class="input" inputMode="numeric" value={p.barcode} onInput={(e) => set('barcode', (e.currentTarget as HTMLInputElement).value.trim())} autocomplete="off" />
              <button class="iconbtn" aria-label={t('Scan barcode')} onClick={async () => { const c = await scanBarcode(); if (c) set('barcode', c); }}>
                <Icon name="scan" size="sm" />
              </button>
            </div>
            {dup && <div class="hint" style="color:var(--danger)">{t('Another item already uses this barcode.')}</div>}
          </label>
        </div>

        <div class="card pad">
          <Switch label={t('Charge tax')} hint={settings.value.taxRate ? `${settings.value.taxName} ${settings.value.taxRate}%` : t('Set a tax rate in Settings first')} checked={p.taxable} onChange={(v) => set('taxable', v)} />
          <Switch label={t('Track stock')} hint={t('Counts down with each sale')} checked={p.trackStock} onChange={(v) => set('trackStock', v)} />
          {p.trackStock && (
            <div class="grid2" style="margin-top:0.5rem">
              {isNew ? (
                <NumberInput label={t('Starting stock')} value={p.stock} onChange={(n) => set('stock', Math.floor(n))} />
              ) : (
                <div>
                  <div class="label muted small bold" style="margin-bottom:0.375rem">{t('In stock')}</div>
                  <button class="btn block" onClick={() => setStockOpen(true)}>{live?.stock ?? p.stock} · {t('Adjust')}</button>
                </div>
              )}
              <NumberInput label={t('Low-stock alert at')} value={p.lowStock} onChange={(n) => set('lowStock', Math.floor(n))} />
            </div>
          )}
          <Switch label={t('Show in Sell screen')} checked={p.active} onChange={(v) => set('active', v)} />
        </div>

        <div>
          <div class="row between" style="margin-bottom:0.375rem">
            <div class="bold">{t('Sizes / options')}</div>
            <button class="btn sm soft" onClick={() => set('variants', [...p.variants, { id: uid(), name: '', price: p.price, barcode: '' }])}>
              <Icon name="plus" size="sm" /> {t('Add')}
            </button>
          </div>
          {p.variants.length === 0 && <div class="hint">{t('Optional. Add options that have their own price, such as Small / Large.')}</div>}
          {p.variants.map((v, i) => (
            <VariantRow
              key={v.id}
              v={v}
              onChange={(nv) => set('variants', p.variants.map((x, j) => (j === i ? nv : x)))}
              onRemove={() => set('variants', p.variants.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      </div>
      {stockOpen && <StockSheet product={live ?? p} onClose={() => setStockOpen(false)} />}
    </Sheet>
  );
}

function VariantRow({ v, onChange, onRemove }: { v: Variant; onChange: (v: Variant) => void; onRemove: () => void }) {
  return (
    <div class="row" style="align-items:flex-end;margin-bottom:0.5rem">
      <div class="grow"><TextInput label={t('Name')} value={v.name} placeholder={t('Large')} onInput={(e) => onChange({ ...v, name: (e.currentTarget as HTMLInputElement).value })} /></div>
      <div style="width:7.5rem"><MoneyInput label={t('Price')} value={v.price} onChange={(n) => onChange({ ...v, price: n })} /></div>
      <button class="iconbtn" style="margin-bottom:2px" onClick={onRemove} aria-label={t('Remove option')}><Icon name="trash" size="sm" /></button>
    </div>
  );
}

function StockSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const [mode, setMode] = useState<'receive' | 'count' | 'waste'>('receive');
  const [n, setN] = useState(0);
  const [note, setNote] = useState('');
  const delta = mode === 'receive' ? n : mode === 'waste' ? -n : n - product.stock;
  const reason: StockReason = mode === 'receive' ? 'receive' : mode === 'waste' ? 'waste' : 'adjust';
  return (
    <Sheet
      title={t('Stock · {name}', { name: product.name })}
      onClose={onClose}
      footer={
        <button
          class="btn primary"
          disabled={!delta}
          onClick={async () => {
            await adjustStock(product.id, delta, reason, note);
            showToast(t('Stock is now {n}', { n: product.stock + delta }));
            onClose();
          }}
        >
          {t('Save')}
        </button>
      }
    >
      <div class="stack">
        <div class="center">
          <div class="muted small">{t('Currently in stock')}</div>
          <div class="num" style="font-size:2.25rem;font-weight:800">{product.stock}</div>
        </div>
        <Segmented value={mode} onChange={(m) => { setMode(m); setN(0); }} options={[{ value: 'receive', label: t('Received') }, { value: 'count', label: t('Stock count') }, { value: 'waste', label: t('Waste / loss') }]} />
        <NumberInput label={mode === 'receive' ? t('Units received') : mode === 'waste' ? t('Units lost') : t('Counted on shelf')} value={n} onChange={(v) => setN(Math.floor(v))} />
        {!!delta && <div class="hint">{t('New stock level: {n} ({delta})', { n: product.stock + delta, delta: `${delta > 0 ? '+' : ''}${delta}` })}</div>}
        <TextInput label={t('Note (optional)')} value={note} onInput={(e) => setNote((e.currentTarget as HTMLInputElement).value)} placeholder={t('e.g. supplier invoice 1042')} />
      </div>
    </Sheet>
  );
}

/** Pick the category the selected items should move to. */
function MoveSheet({ count, onPick, onClose }: { count: number; onPick: (categoryId: string) => void; onClose: () => void }) {
  const countIn = (id: string) => products.value.filter((p) => p.categoryId === id).length;
  return (
    <Sheet title={tn(count, 'Move {n} item to…', 'Move {n} items to…')} onClose={onClose}>
      <div class="list">
        <button class="list-row" onClick={() => onPick('')}>
          <div class="lead">🏷️</div>
          <div class="grow bold">{t('Uncategorised')}</div>
        </button>
        {enabledCategories.value.map((c) => (
          <button class="list-row" key={c.id} onClick={() => onPick(c.id)}>
            <div class="lead">{c.emoji || '🏷️'}</div>
            <div class="grow">
              <div class="bold ellipsis">{c.name}</div>
              <div class="sub">{tn(countIn(c.id), '{n} item', '{n} items')}</div>
            </div>
          </button>
        ))}
      </div>
      {enabledCategories.value.length === 0 && <div class="hint" style="margin-top:0.75rem">{t('No categories yet. Categories become filter chips on the Sell screen.')}</div>}
    </Sheet>
  );
}

// ---------- CSV import / export of the catalogue ----------

const HEADERS = ['name', 'category', 'price', 'cost', 'sku', 'barcode', 'stock', 'track_stock', 'low_stock', 'taxable', 'active'];

export function productsCsv(): string {
  const dec = settings.value.currencyDecimals;
  const cat = (id: string) => categories.value.find((c) => c.id === id)?.name ?? '';
  return toCsv([
    HEADERS,
    ...products.value.map((p) => [p.name, cat(p.categoryId), toInput(p.price, dec) || '0', toInput(p.cost, dec) || '0', p.sku, p.barcode, p.stock, p.trackStock ? 'yes' : 'no', p.lowStock, p.taxable ? 'yes' : 'no', p.active ? 'yes' : 'no']),
  ]);
}

const yes = (v: string | undefined, dflt: boolean) => (v === undefined || v.trim() === '' ? dflt : /^(y|yes|true|1)$/i.test(v.trim()));

export async function importProductsCsv(text: string): Promise<{ created: number; updated: number; skipped: number }> {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error(t('The file has no data rows.'));
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  if (!head.includes('name')) throw new Error(t('The first row must be a header that includes a "name" column.'));
  const col = (r: string[], k: string) => {
    const i = head.indexOf(k);
    return i >= 0 ? (r[i] ?? '').trim() : undefined;
  };
  const dec = settings.value.currencyDecimals;
  let created = 0, updated = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const name = col(r, 'name');
    if (!name) { skipped++; continue; }
    const sku = col(r, 'sku') ?? '';
    const barcode = col(r, 'barcode') ?? '';
    const existing = products.value.find((p) => (barcode && p.barcode === barcode) || (sku && p.sku === sku) || p.name.toLowerCase() === name.toLowerCase());
    const catText = col(r, 'category');
    let categoryId = existing?.categoryId ?? '';
    if (catText) {
      let c = categories.value.find((x) => x.name.toLowerCase() === catText.toLowerCase());
      if (!c) { await saveCategory({ name: catText }); c = categories.value.find((x) => x.name.toLowerCase() === catText.toLowerCase()); }
      categoryId = c?.id ?? '';
    }
    const base = existing ?? blankProduct();
    const stockText = col(r, 'stock');
    await saveProduct({
      ...base, name, categoryId, sku: sku || base.sku, barcode: barcode || base.barcode,
      price: col(r, 'price') !== undefined ? parseMoney(col(r, 'price')!, dec) : base.price,
      cost: col(r, 'cost') !== undefined ? parseMoney(col(r, 'cost')!, dec) : base.cost,
      stock: stockText ? Math.floor(Number(stockText)) || 0 : base.stock,
      trackStock: yes(col(r, 'track_stock'), stockText ? true : base.trackStock),
      lowStock: col(r, 'low_stock') ? Math.floor(Number(col(r, 'low_stock'))) || base.lowStock : base.lowStock,
      taxable: yes(col(r, 'taxable'), base.taxable),
      active: yes(col(r, 'active'), base.active),
    });
    existing ? updated++ : created++;
  }
  await loadAll();
  return { created, updated, skipped };
}

function CsvSheet({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={t('Import & export items')} onClose={onClose}>
      <div class="stack">
        <div class="list">
          <Row icon="download" title={t('Export items (CSV)')} sub={t('Open in Excel or Google Sheets')} onClick={async () => {
            await saveTextFile('pocketpos-items.csv', productsCsv(), 'text/csv');
          }} />
          <Row icon="upload" title={t('Import items (CSV)')} sub={busy ? t('Importing…') : t('Adds new items, updates matches by barcode, SKU or name')} onClick={async () => {
            const f = await pickFile('.csv,text/csv');
            if (!f) return;
            setBusy(true);
            try {
              const r = await importProductsCsv(await f.text());
              showToast(r.skipped ? t('{created} added, {updated} updated, {skipped} skipped', { created: r.created, updated: r.updated, skipped: r.skipped }) : t('{created} added, {updated} updated', { created: r.created, updated: r.updated }));
              onClose();
            } catch (e) {
              showToast((e as Error).message, 'error');
            } finally {
              setBusy(false);
            }
          }} />
        </div>
        <div class="hint">{t('Columns: {cols}. Only name is required. Export first to get a ready-made template. Importing never deletes items. Items costed from ingredients keep their calculated cost.', { cols: HEADERS.join(', ') })}</div>
      </div>
    </Sheet>
  );
}
