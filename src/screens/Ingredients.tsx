import { useState } from 'preact/hooks';
import { t, tn } from '../i18n';
import { formatMoneyPrecise } from '../lib/money';
import { ALL_UNITS, compatibleUnits, costPerBaseUnit, packLabel, recipeCost, UNIT_LABEL } from '../lib/recipe';
import {
  blankIngredient, deleteIngredient, ingredients, money, productsUsing, saveIngredient, settings, showToast,
} from '../lib/store';
import type { Ingredient, IngredientUnit, Product, RecipeLine } from '../lib/types';
import { confirmDialog, Empty, Icon, MoneyInput, NumberInput, Segmented, Sheet, TextInput } from '../ui/components';

const precise = (minor: number) => formatMoneyPrecise(minor, settings.value, 4);
/** kg and L ingredients are quoted per kg / per L; everything else per its own unit. */
const quoteFactor = (u: IngredientUnit) => (u === 'kg' || u === 'l' ? 1000 : 1);

export function IngredientsList() {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const needle = q.trim().toLowerCase();
  const list = ingredients.value.filter((i) => !needle || i.name.toLowerCase().includes(needle));
  return (
    <div>
      <div class="pad" style="padding-bottom:0">
        <div class="row">
          <input class="input grow" type="search" placeholder={t('Search ingredients')} value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />
          <button class="btn primary" onClick={() => setEditing(blankIngredient())}><Icon name="plus" /> {t('Add')}</button>
        </div>
      </div>
      <div class="page-pad" style="padding-top:0.75rem">
        {ingredients.value.length === 0 ? (
          <Empty icon="flask" title={t('No ingredients yet')}>
            {t('Add what you buy (flour, milk, cups…) with its pack price. Then build items from them and the cost is worked out for you.')}
          </Empty>
        ) : (
          <div class="list">
            {list.map((i) => {
              const used = productsUsing(i.id).length;
              return (
                <button class="list-row" key={i.id} onClick={() => setEditing(i)}>
                  <div class="grow">
                    <div class="bold ellipsis">{i.name}</div>
                    <div class="sub">{packLabel(i, money)} · {precise(costPerBaseUnit(i) * quoteFactor(i.unit))} / {UNIT_LABEL(i.unit)}</div>
                  </div>
                  {used > 0 && <span class="pill brand">{tn(used, '{n} item', '{n} items')}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {editing && <IngredientEditor ingredient={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function IngredientEditor({ ingredient, onClose, onSaved }: { ingredient: Ingredient; onClose: () => void; onSaved?: (i: Ingredient) => void }) {
  const isNew = !ingredients.value.some((i) => i.id === ingredient.id);
  const [d, setD] = useState(ingredient);
  const set = <K extends keyof Ingredient>(k: K, v: Ingredient[K]) => setD((c) => ({ ...c, [k]: v }));
  const used = productsUsing(d.id);
  const perUnit = costPerBaseUnit(d) * quoteFactor(d.unit);
  const small = d.unit === 'kg' ? 'g' : d.unit === 'l' ? 'ml' : null;

  return (
    <Sheet
      title={isNew ? t('New ingredient') : t('Edit ingredient')}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button class="btn danger-ghost fixed" aria-label={t('Delete ingredient')} onClick={async () => {
              const usedBy = productsUsing(d.id).map((p) => p.name);
              if (usedBy.length) return showToast(t('Used by {names} — remove it from those recipes first', { names: usedBy.slice(0, 3).join(', ') + (usedBy.length > 3 ? '…' : '') }), 'error');
              if (!(await confirmDialog({ title: t('Delete {name}?', { name: d.name }), confirmLabel: t('Delete'), danger: true }))) return;
              await deleteIngredient(d.id);
              onClose();
            }}><Icon name="trash" /></button>
          )}
          <button class="btn primary" disabled={!d.name.trim() || d.packSize <= 0} onClick={async () => {
            const { ingredient: saved, itemsUpdated } = await saveIngredient(d);
            showToast(itemsUpdated ? tn(itemsUpdated, 'Saved · {n} item cost updated', 'Saved · {n} item costs updated') : t('Saved'));
            onSaved?.(saved);
            onClose();
          }}>{t('Save')}</button>
        </>
      }
    >
      <div class="stack">
        <TextInput label={t('Name')} value={d.name} autofocus={isNew} placeholder={t('e.g. Plain flour')} onInput={(e) => set('name', (e.currentTarget as HTMLInputElement).value)} />
        <div class="grid2">
          <NumberInput label={t('Pack size')} value={d.packSize} decimals onChange={(n) => set('packSize', n)} />
          <label class="field">
            <span class="label">{t('Unit')}</span>
            <select class="select" value={d.unit} onChange={(e) => set('unit', (e.currentTarget as HTMLSelectElement).value as IngredientUnit)}>
              {ALL_UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL(u)}</option>)}
            </select>
          </label>
        </div>
        <MoneyInput label={t('Price you pay for one pack')} value={d.packCost} onChange={(n) => set('packCost', n)} hint={t('Per pack as bought, e.g. a 1 kg bag costs 2.50.')} />
        <div class="card pad">
          <div class="muted small">{t('That works out to')}</div>
          <div class="money bold" style="font-size:1.375rem">{precise(perUnit)} <span class="muted small">{t('per {unit}', { unit: UNIT_LABEL(d.unit) })}</span></div>
          {small && <div class="small muted money">{precise(costPerBaseUnit(d))} {t('per {unit}', { unit: small })}</div>}
        </div>
        <TextInput label={t('Note (optional)')} value={d.note} placeholder={t('Supplier, brand…')} onInput={(e) => set('note', (e.currentTarget as HTMLInputElement).value)} />
        {!isNew && used.length > 0 && (
          <div class="banner info"><div>{t('Used in {names}. When you change the price, their cost updates automatically (past sales keep the cost they had).', { names: used.map((p) => p.name).join(', ') })}</div></div>
        )}
      </div>
    </Sheet>
  );
}

// ---------- recipe calculator inside the item editor ----------

export function CostEditor({ p, set }: { p: Product; set: <K extends keyof Product>(k: K, v: Product[K]) => void }) {
  const [newIng, setNewIng] = useState(false);
  const mode = p.costMode ?? 'manual';
  const recipe = p.recipe ?? [];
  const calc = recipeCost(p, ingredients.value);
  const cost = mode === 'recipe' ? calc.perItem : p.cost;
  const profit = p.price - cost;
  const margin = p.price > 0 && cost > 0 ? Math.round((profit / p.price) * 100) : null;

  const setLines = (lines: RecipeLine[]) => set('recipe', lines);
  const addLine = (id: string) => {
    const ing = ingredients.value.find((i) => i.id === id);
    if (ing) setLines([...recipe, { ingredientId: ing.id, qty: 0, unit: ing.unit }]);
  };

  return (
    <div class="card pad stack">
      <div class="bold">{t('Cost of making it')}</div>
      <Segmented value={mode} onChange={(m) => set('costMode', m)} options={[{ value: 'manual', label: t('Enter cost') }, { value: 'recipe', label: t('From ingredients') }]} />

      {mode === 'manual' ? (
        <MoneyInput label={t('Cost per item')} value={p.cost} onChange={(n) => set('cost', n)} hint={t("What one item costs you. Leave empty if you don't track it.")} />
      ) : (
        <>
          {ingredients.value.length === 0 && recipe.length === 0 && (
            <div class="banner info"><div>{t("You haven't added any ingredients yet. Create one, then use it here.")}</div></div>
          )}
          {recipe.map((line, i) => {
            const rc = calc.lines[i];
            const ing = rc?.ingredient;
            return (
              <div class="recipe-line" key={`${line.ingredientId}-${i}`}>
                <div class="row between">
                  <div class="bold ellipsis">{ing?.name ?? t('Deleted ingredient')}</div>
                  <button class="iconbtn" style="width:2.25rem;height:2.25rem" aria-label={t('Remove ingredient')} onClick={() => setLines(recipe.filter((_, j) => j !== i))}><Icon name="close" size="sm" /></button>
                </div>
                <div class="row" style="align-items:flex-end">
                  <div class="grow"><NumberInput label={t('Amount per batch')} value={line.qty} decimals onChange={(n) => setLines(recipe.map((l, j) => (j === i ? { ...l, qty: n } : l)))} /></div>
                  <label class="field" style="width:6rem">
                    <span class="label">{t('Unit')}</span>
                    <select class="select" value={line.unit} onChange={(e) => setLines(recipe.map((l, j) => (j === i ? { ...l, unit: (e.currentTarget as HTMLSelectElement).value as IngredientUnit } : l)))}>
                      {compatibleUnits(ing?.unit ?? line.unit).map((u) => <option key={u} value={u}>{UNIT_LABEL(u)}</option>)}
                    </select>
                  </label>
                  <div class="money bold" style="min-width:4rem;text-align:end;padding-bottom:0.75rem">{formatMoneyPrecise(rc?.cost ?? 0, settings.value, 2)}</div>
                </div>
              </div>
            );
          })}

          {ingredients.value.length > 0 && (
            <label class="field">
              <select class="select" value="" onChange={(e) => { const el = e.currentTarget as HTMLSelectElement; if (el.value) addLine(el.value); el.value = ''; }}>
                <option value="">{t('+ Add an ingredient…')}</option>
                {ingredients.value.filter((i) => !recipe.some((l) => l.ingredientId === i.id)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
          )}
          <button class="btn soft block" onClick={() => setNewIng(true)}><Icon name="plus" size="sm" /> {t('New ingredient')}</button>

          <div class="grid2">
            <NumberInput label={t('One batch makes (items)')} value={p.recipeYield ?? 1} min={1} onChange={(n) => set('recipeYield', Math.max(1, Math.floor(n) || 1))} hint={t('Ingredients above are for this many items.')} />
            <MoneyInput label={t('Extra cost per item')} value={p.extraCost ?? 0} onChange={(n) => set('extraCost', n)} hint={t('Packaging, labour, gas…')} />
          </div>

          <dl class="dl" style="border-top:1px solid var(--line);padding-top:0.625rem">
            <dt>{t('Ingredients, whole batch')}</dt><dd>{formatMoneyPrecise(calc.batchCost, settings.value, 2)}</dd>
            <dt>{t('Ingredients per item')}</dt><dd>{formatMoneyPrecise(calc.ingredientsPerItem, settings.value, 2)}</dd>
            {calc.extra > 0 && <><dt>{t('Extra per item')}</dt><dd>{money(calc.extra)}</dd></>}
            <dt class="bold" style="color:var(--text)">{t('Cost per item')}</dt><dd class="bold">{money(calc.perItem)}</dd>
          </dl>
          {calc.missing.length > 0 && <div class="banner bad"><div>{t('An ingredient used here was deleted. Remove that line or add it back.')}</div></div>}
        </>
      )}

      {p.price > 0 && cost > 0 && (
        <div class={`banner ${profit < 0 ? 'bad' : 'ok'}`} style="justify-content:space-between">
          <span>{t('Profit per item')}</span>
          <strong class="money">{money(profit)}{margin !== null && ` · ${margin}%`}</strong>
        </div>
      )}
      {newIng && <IngredientEditor ingredient={blankIngredient()} onClose={() => setNewIng(false)} onSaved={(i) => addLine(i.id)} />}
    </div>
  );
}
