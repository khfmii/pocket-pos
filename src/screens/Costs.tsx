import { useState } from 'preact/hooks';
import { locale, t } from '../i18n';
import { costTime, dayInput, totalCosts } from '../lib/report';
import { blankExpense, deleteExpense, ingredients, money, saveExpense, saveSettings, settings, showToast } from '../lib/store';
import type { Expense } from '../lib/types';
import { confirmDialog, Icon, MoneyInput, NumberInput, Segmented, Sheet, TextInput } from '../ui/components';

const SHOWN = 5;
const kindLabel = (k: Expense['kind']) => (k === 'ingredients' ? t('Ingredients') : t('Other'));
const dayLabel = (ts: number) => new Date(ts).toLocaleDateString(locale.value, { day: 'numeric', month: 'short' });

/**
 * The costs added for the report's period, and the choice of what profit is worked out from: the cost of the items
 * sold (each item's own cost or recipe), or the costs the shop added here (ingredients bought, rent, packaging…).
 */
export function CostsCard({ costs, defaultDay, onChanged }: { costs: Expense[]; defaultDay: number; onChanged: () => void }) {
  const [editing, setEditing] = useState<Expense | null>(null);
  const [all, setAll] = useState(false);
  const basis = settings.value.profitBasis ?? 'sold';
  const shown = all ? costs : costs.slice(0, SHOWN);

  return (
    <div class="card pad stack">
      <div class="row between" style="gap:0.75rem">
        <div class="bold">{t('Costs')}</div>
        <button class="btn sm primary" onClick={() => setEditing(blankExpense(defaultDay))}>
          <Icon name="plus" size="sm" /> {t('Add cost')}
        </button>
      </div>

      <div>
        <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Calculate profit from')}</div>
        <Segmented
          value={basis}
          onChange={(b) => void saveSettings({ profitBasis: b })}
          options={[{ value: 'sold', label: t('Cost of items sold') }, { value: 'added', label: t('Costs added') }]}
        />
        <div class="hint">
          {basis === 'sold'
            ? t('Gross profit: sales without tax, minus what the items sold cost (from each item’s cost or recipe).')
            : t('Net profit: sales without tax, minus the costs you add here for this period.')}
        </div>
      </div>

      {costs.length === 0 ? (
        <div class="muted small">{t('No costs added in this period.')}</div>
      ) : (
        <>
          <div class="row between">
            <span class="muted">{t('Costs added')}</span>
            <strong class="money">{money(totalCosts(costs))}</strong>
          </div>
          <div class="list">
            {shown.map((c) => (
              <button class="list-row" key={c.id} onClick={() => setEditing(c)}>
                <div class="grow">
                  <div class="bold ellipsis">{c.label || kindLabel(c.kind)}</div>
                  <div class="sub">{dayLabel(c.at)} · {kindLabel(c.kind)}</div>
                </div>
                <div class="money bold">{money(c.amount)}</div>
              </button>
            ))}
          </div>
          {costs.length > SHOWN && (
            <button class="btn sm" onClick={() => setAll(!all)}>{all ? t('Show less') : t('Show all {n}', { n: costs.length })}</button>
          )}
        </>
      )}
      {editing && <CostSheet cost={editing} isNew={editing.updatedAt === 0} onClose={() => setEditing(null)} onSaved={onChanged} />}
    </div>
  );
}

function CostSheet({ cost, isNew, onClose, onSaved }: { cost: Expense; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Expense>(cost);
  const [day, setDay] = useState(dayInput(cost.at));
  const [packs, setPacks] = useState(cost.packs ?? 1);
  const set = <K extends keyof Expense>(k: K, v: Expense[K]) => setD((c) => ({ ...c, [k]: v }));
  const ing = ingredients.value.find((i) => i.id === d.ingredientId);

  /** Choosing an ingredient fills in what it usually costs; the amount and name stay editable. */
  function pick(id: string) {
    const i = ingredients.value.find((x) => x.id === id);
    if (!i) return setD((c) => ({ ...c, ingredientId: undefined, packs: undefined }));
    setPacks(1);
    setD((c) => ({ ...c, ingredientId: i.id, packs: 1, label: i.name, amount: i.packCost }));
  }
  function changePacks(n: number) {
    setPacks(n);
    if (ing) setD((c) => ({ ...c, packs: n, amount: Math.round(ing.packCost * n) }));
  }

  async function save() {
    try {
      const { ingredientId: _i, packs: _p, ...rest } = d;
      await saveExpense({ ...rest, at: costTime(day), ...(d.kind === 'ingredients' && ing ? { ingredientId: ing.id, packs } : {}) });
      showToast(t('Saved'));
      onSaved();
      onClose();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  return (
    <Sheet
      title={isNew ? t('Add cost') : t('Edit cost')}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button
              class="btn danger-ghost fixed"
              aria-label={t('Delete cost')}
              onClick={async () => {
                if (!(await confirmDialog({ title: t('Delete {name}?', { name: d.label || kindLabel(d.kind) }), confirmLabel: t('Delete'), danger: true }))) return;
                await deleteExpense(d.id);
                onSaved();
                onClose();
              }}
            >
              <Icon name="trash" />
            </button>
          )}
          <button class="btn primary" disabled={!(d.amount > 0) || !day} onClick={save}>{t('Save')}</button>
        </>
      }
    >
      <div class="stack">
        <Segmented value={d.kind} onChange={(k) => set('kind', k)} options={[{ value: 'ingredients', label: t('Ingredients') }, { value: 'other', label: t('Other') }]} />
        {d.kind === 'ingredients' && ingredients.value.length > 0 && (
          <>
            <label class="field">
              <span class="label">{t('Ingredient bought (optional)')}</span>
              <select class="select" value={d.ingredientId ?? ''} onChange={(e) => pick((e.currentTarget as HTMLSelectElement).value)}>
                <option value="">{t('— Not from the list —')}</option>
                {ingredients.value.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            {ing && <NumberInput label={t('Packs bought')} value={packs} decimals min={0} onChange={changePacks} hint={t('The amount below is worked out from the pack price; change it if you paid something different.')} />}
          </>
        )}
        <TextInput label={t('What was it for?')} value={d.label} placeholder={d.kind === 'ingredients' ? t('e.g. Flour 25 kg') : t('e.g. Rent, packaging, gas')} onInput={(e) => set('label', (e.currentTarget as HTMLInputElement).value)} />
        <MoneyInput label={t('Amount')} value={d.amount} onChange={(n) => set('amount', n)} />
        <label class="field">
          <span class="label">{t('Date')}</span>
          <input class="input" type="date" value={day} onInput={(e) => setDay((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
    </Sheet>
  );
}
