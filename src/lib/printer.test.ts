import { describe, expect, it } from 'vitest';
import { describePrintError, sanitize } from './printer';

describe('printer settings', () => {
  it('starts with nothing chosen, and survives damaged storage', () => {
    expect(sanitize(null)).toEqual({ address: '', name: '', cut: false, auto: false });
    expect(sanitize('junk')).toEqual({ address: '', name: '', cut: false, auto: false });
    expect(sanitize({ address: 12, name: ['x'], cut: 'yes', auto: 1 })).toEqual({ address: '', name: '', cut: false, auto: false });
  });

  it('keeps a well-formed choice', () => {
    expect(sanitize({ address: '00:11:22:33:44:55', name: 'MPT-II', cut: true, auto: true })).toEqual({
      address: '00:11:22:33:44:55', name: 'MPT-II', cut: true, auto: true,
    });
  });
});

describe('print errors', () => {
  it('turns each native code into a message that says what to do', () => {
    expect(describePrintError(new Error('no-printer'))).toMatch(/Choose a printer/);
    expect(describePrintError(new Error('permission-denied'))).toMatch(/permission/);
    expect(describePrintError(new Error('bluetooth-unavailable'))).toMatch(/no Bluetooth/);
    expect(describePrintError(new Error('bluetooth-off'))).toMatch(/Turn it on/);
    expect(describePrintError(new Error('connect-failed'))).toMatch(/in range and paired/);
    expect(describePrintError(new Error('device-not-found'))).toMatch(/in range and paired/);
    expect(describePrintError(new Error('write-failed'))).toMatch(/Printing failed/);
    expect(describePrintError('???')).toMatch(/Printing failed/);
  });
});
