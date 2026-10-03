import { useState } from 'preact/hooks';
import { t } from '../i18n';
import { EMOJI_GROUPS, firstGrapheme, QUICK_EMOJIS } from '../lib/emoji';
import { Icon, TextInput } from './components';

/**
 * Icon chooser: a row of common icons, and a "More icons" panel with every group plus a box for pasting any emoji
 * from the phone's own emoji keyboard.
 */
export function EmojiPicker({ value, onChange, clearable }: { value: string; onChange: (emoji: string) => void; clearable?: boolean }) {
  const [more, setMore] = useState(false);
  const [tab, setTab] = useState(0);
  const [typed, setTyped] = useState('');

  const pick = (e: string) => (
    <button key={e} class={value === e ? 'on' : ''} onClick={() => onChange(e)} aria-label={e} aria-pressed={value === e}>
      {e}
    </button>
  );

  return (
    <div class="stack">
      <div class="emoji-grid">{QUICK_EMOJIS.map(pick)}</div>
      <div class="row wrap">
        <button class="btn sm grow" onClick={() => setMore(!more)} aria-expanded={more}>
          <Icon name={more ? 'up' : 'down'} size="sm" /> {more ? t('Fewer icons') : t('More icons')}
        </button>
        {clearable && value && (
          <button class="btn sm danger-ghost" onClick={() => onChange('')}>{t('Remove icon')}</button>
        )}
      </div>
      {more && (
        <div class="emoji-more">
          <div class="emoji-tabs" role="tablist">
            {EMOJI_GROUPS.map((g, i) => (
              <button key={g.id} role="tab" aria-selected={i === tab} class={i === tab ? 'on' : ''} onClick={() => setTab(i)}>
                {g.list[0]}
              </button>
            ))}
          </div>
          <div class="emoji-grid">{EMOJI_GROUPS[tab].list.map(pick)}</div>
          <TextInput
            label={t('Or paste any emoji')}
            value={typed}
            placeholder="😀"
            onInput={(e) => {
              const el = e.currentTarget as HTMLInputElement;
              const g = firstGrapheme(el.value);
              el.value = g; // write the cleaned value back, or extra typed characters would stay visible
              setTyped(g);
              if (g) onChange(g);
            }}
          />
        </div>
      )}
    </div>
  );
}
