import { afterEach, describe, expect, it } from 'vitest';
import { handleBack, openSheetCount, registerSheet, setEmptyBackHandler } from './sheets';

const cleanups: (() => void)[] = [];
const reg = (fn: () => void) => {
  const off = registerSheet(fn);
  cleanups.push(off);
  return off;
};
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  setEmptyBackHandler(() => false);
});

describe('handleBack', () => {
  it('closes the top-most sheet first, then the one beneath, each on its own press', () => {
    const log: string[] = [];
    // Settings → Language & display size, as in the app: each sheet's close callback unregisters it.
    const offSettings = reg(() => { log.push('settings'); offSettings(); });
    const offDisplay = reg(() => { log.push('display'); offDisplay(); });
    expect(openSheetCount()).toBe(2);
    expect(handleBack()).toBe(true);
    expect(log).toEqual(['display']);
    expect(handleBack()).toBe(true);
    expect(log).toEqual(['display', 'settings']); // the second press from Settings still works
    expect(openSheetCount()).toBe(0);
  });

  it('asks the app (not the sheets) when nothing is open, and passes its answer on', () => {
    let asked = 0;
    setEmptyBackHandler(() => { asked++; return true; });
    expect(handleBack()).toBe(true);
    expect(asked).toBe(1);
    setEmptyBackHandler(() => false);
    expect(handleBack()).toBe(false); // caller then lets the OS leave the app
  });

  it('does not consult the empty handler while a sheet is open', () => {
    let asked = 0;
    setEmptyBackHandler(() => { asked++; return true; });
    let closed = 0;
    reg(() => closed++);
    handleBack();
    expect(closed).toBe(1);
    expect(asked).toBe(0);
  });

  it('unregistering removes exactly that entry, even out of order or with look-alike callbacks', () => {
    const order: number[] = [];
    const offA = reg(() => order.push(1));
    reg(() => order.push(2));
    offA(); // the lower sheet disappears first (e.g. a wizard step)
    handleBack();
    expect(order).toEqual([2]);
    offA(); // calling a cleanup twice is harmless
    expect(openSheetCount()).toBe(1);
  });

  it('a wizard step registered below a sheet is reached after the sheet closes', () => {
    let step = 2;
    reg(() => { step -= 1; }); // setup wizard past step 1: back = previous step
    const offSheet = reg(() => offSheet()); // a restore sheet opened on top
    handleBack();
    expect(step).toBe(2);
    handleBack();
    expect(step).toBe(1);
  });
});
