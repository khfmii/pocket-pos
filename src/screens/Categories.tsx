import { useState } from 'preact/hooks';
import { t, tn } from '../i18n';
import { categoryFor, PRESET_GROUPS, type Preset } from '../lib/categories';
import { categories, deleteCategory, isEnabled, products, saveCategory, setCategoriesEnabled, setPresetsOn, showToast } from '../lib/store';
import type { Category } from '../lib/types';
import { confirmDialog, Empty, Icon, Segmented, Sheet, Switch, TextInput } from '../ui/components';
import { EmojiPicker } from '../ui/EmojiPicker';

const itemCount = (id: string) => products.value.filter((p) => p.categoryId === id).length;

/** The small on/off switch used at the end of a row. */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span class="switch">
      <input type="checkbox" checked={on} aria-label={label} onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
      <i />
    </span>
  );
}

export function CategoriesSheet({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'mine' | 'library'>(categories.value.length ? 'mine' : 'library');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  return (
    <Sheet
      title={t('Categories')}
      onClose={onClose}
      full
      actions={
        <button class="btn sm primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size="sm" /> {t('Add')}
        </button>
      }
    >
      <div class="stack">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'mine', label: t('My categories') }, { value: 'library', label: t('Add from library') }]} />
        {tab === 'mine' ? <MyCategories onEdit={setEditing} onLibrary={() => setTab('library')} /> : <Library />}
      </div>
      {editing && <CategoryEditor cat={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}

function MyCategories({ onEdit, onLibrary }: { onEdit: (c: Category) => void; onLibrary: () => void }) {
  if (categories.value.length === 0)
    return (
      <Empty icon="tag" title={t('No categories yet')}>
        <div>{t('Categories become filter chips on the Sell screen.')}</div>
        <button class="btn primary" style="margin-top:0.75rem" onClick={onLibrary}>{t('Add from library')}</button>
      </Empty>
    );
  return (
    <>
      <div class="list">
        {categories.value.map((c) => (
          <div class="list-row" key={c.id} style={isEnabled(c) ? '' : 'opacity:.6'}>
            <button class="cat-main" onClick={() => onEdit(c)}>
              <div class="lead">{c.emoji || '🏷️'}</div>
              <div class="grow">
                <div class="bold ellipsis">{c.name}</div>
                <div class="sub">{tn(itemCount(c.id), '{n} item', '{n} items')}{!isEnabled(c) && ` · ${t('Off')}`}</div>
              </div>
            </button>
            <Toggle on={isEnabled(c)} label={c.name} onChange={(v) => setCategoriesEnabled([c.id], v)} />
          </div>
        ))}
      </div>
      <div class="hint">{t('Turned-off categories are hidden from the Sell screen and item forms. Items keep their category.')}</div>
    </>
  );
}

const asInput = (p: Preset) => ({ id: p.id, emoji: p.emoji, name: p.name() });

function Library() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set([PRESET_GROUPS[0].id]));
  const needle = q.trim().toLowerCase();
  const isOn = (p: Preset) => {
    const have = categoryFor(categories.value, p);
    return !!have && isEnabled(have);
  };
  const flip = (id: string) => setOpen((cur) => { const n = new Set(cur); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      <div class="hint">{t('Switch on the categories your shop needs. Switching one off hides it without deleting your items.')}</div>
      <input class="input" type="search" placeholder={t('Search categories')} value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />
      {PRESET_GROUPS.map((g) => {
        const shown = needle ? g.presets.filter((p) => p.name().toLowerCase().includes(needle)) : g.presets;
        if (!shown.length) return null;
        const expanded = !!needle || open.has(g.id);
        const on = g.presets.filter(isOn).length;
        const allOn = on === g.presets.length;
        return (
          <div class="list" key={g.id}>
            <div class="row" style="background:var(--surface)">
              <button class="group-head" onClick={() => flip(g.id)} aria-expanded={expanded}>
                <Icon name={expanded ? 'down' : 'right'} size="sm" />
                <span style="font-size:1.375rem">{g.emoji}</span>
                <div class="grow">
                  <div class="bold">{g.name()}</div>
                  <div class="sub small muted">{t('{on} of {total} on', { on, total: g.presets.length })}</div>
                </div>
              </button>
              <button class="btn sm" style="margin-right:0.625rem" onClick={() => setPresetsOn(g.presets.map(asInput), !allOn)}>
                {allOn ? t('Clear') : t('Select all')}
              </button>
            </div>
            {expanded &&
              shown.map((p) => (
                <div class="list-row" key={p.id}>
                  <div class="lead">{p.emoji}</div>
                  <div class="grow bold">{p.name()}</div>
                  <Toggle on={isOn(p)} label={p.name()} onChange={(v) => setPresetsOn([asInput(p)], v)} />
                </div>
              ))}
          </div>
        );
      })}
    </>
  );
}

function CategoryEditor({ cat, onClose }: { cat: Category | null; onClose: () => void }) {
  const [name, setName] = useState(cat?.name ?? '');
  const [emoji, setEmoji] = useState(cat?.emoji ?? '');
  const [on, setOn] = useState(cat ? isEnabled(cat) : true);
  const clash = categories.value.some((c) => c.id !== cat?.id && c.name.trim().toLowerCase() === name.trim().toLowerCase());
  return (
    <Sheet
      title={cat ? t('Edit category') : t('New category')}
      onClose={onClose}
      footer={
        <>
          {cat && (
            <button
              class="btn danger-ghost fixed"
              aria-label={t('Delete {name}', { name: cat.name })}
              onClick={async () => {
                if (await confirmDialog({ title: t('Delete “{name}”?', { name: cat.name }), message: t('Items in it become uncategorised.'), danger: true, confirmLabel: t('Delete') })) {
                  await deleteCategory(cat.id);
                  onClose();
                }
              }}
            >
              <Icon name="trash" />
            </button>
          )}
          <button
            class="btn primary"
            disabled={!name.trim() || clash}
            onClick={async () => {
              await saveCategory({ ...(cat ?? {}), name, emoji, enabled: on });
              showToast(t('Saved'));
              onClose();
            }}
          >
            {t('Save')}
          </button>
        </>
      }
    >
      <div class="stack">
        <div class="row" style="gap:0.75rem">
          <div class="cat-preview" aria-hidden="true">{emoji || '🏷️'}</div>
          <div class="grow">
            <TextInput label={t('Name')} value={name} autofocus={!cat} placeholder={t('e.g. Desserts')} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} hint={clash ? t('You already have a category with this name.') : undefined} />
          </div>
        </div>
        <div>
          <div class="label muted small bold" style="margin-bottom:0.375rem">{t('Icon')}</div>
          <EmojiPicker value={emoji} onChange={setEmoji} clearable />
        </div>
        <Switch label={t('Show on the Sell screen')} hint={t('Turn off to hide it without deleting your items.')} checked={on} onChange={setOn} />
      </div>
    </Sheet>
  );
}
