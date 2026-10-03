import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

export interface PickedContact {
  name: string;
  phones: string[];
  emails: string[];
}

// Local Android plugin (android/app/src/main/java/com/pocketpos/app/ContactPickerPlugin.java).
// It opens the system contact picker, which hands over only the contact the user taps — so the app needs
// no READ_CONTACTS permission and never sees the rest of the address book.
interface ContactPickerPlugin {
  pick(): Promise<{ cancelled?: boolean; name?: string; phone?: string }>;
}
const Native = registerPlugin<ContactPickerPlugin>('ContactPicker');

interface WebContactsApi {
  select(props: string[], opts?: { multiple?: boolean }): Promise<{ name?: string[]; tel?: string[]; email?: string[] }[]>;
}
const webApi = () => (typeof navigator !== 'undefined' ? (navigator as unknown as { contacts?: WebContactsApi }).contacts : undefined);

/** Android app: always. Browser: only where the Contact Picker API exists (Chrome on Android over https). */
export const canPickContact = () => isNative() || !!webApi();

/** Returns the picked contact, or null if the user backed out. */
export async function pickContact(): Promise<PickedContact | null> {
  if (isNative()) {
    const r = await Native.pick();
    if (r.cancelled) return null;
    return { name: (r.name ?? '').trim(), phones: r.phone ? [r.phone.trim()] : [], emails: [] };
  }
  const api = webApi();
  if (!api) throw new Error('This browser cannot open your contacts. Type the details instead.');
  try {
    const [c] = await api.select(['name', 'tel', 'email'], { multiple: false });
    if (!c) return null;
    return {
      name: (c.name?.[0] ?? '').trim(),
      phones: [...new Set((c.tel ?? []).map((t) => t.trim()).filter(Boolean))],
      emails: [...new Set((c.email ?? []).map((e) => e.trim()).filter(Boolean))],
    };
  } catch (e) {
    if ((e as Error).name === 'AbortError' || /cancel/i.test(String((e as Error).message))) return null;
    throw e;
  }
}
