import { describe, expect, it } from 'vitest';
import { imagePdf, mmToPt } from './pdf';

const latin1 = (u: Uint8Array) => new TextDecoder('latin1').decode(u);

describe('imagePdf', () => {
  // Not a decodable JPEG, but the writer treats it as opaque bytes — including awkward ones like "endstream".
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x65, 0x6e, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6d, 0x0a, 0xff, 0xd9]);
  const pdf = imagePdf(jpeg, { w: 760, h: 1500 }, mmToPt(58), { title: 'Receipt #0042 · 抹茶', date: new Date(Date.UTC(2026, 9, 2, 6, 30, 5)) });
  const s = latin1(pdf);

  it('is a well-formed single-page PDF', () => {
    expect(s.startsWith('%PDF-1.4\n')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(s).toContain('/Type /Catalog');
    expect(s).toContain('/Count 1');
    expect(s).toContain('/Filter /DCTDecode');
    expect(s).toContain('/Width 760 /Height 1500');
    expect(s).toContain('/CreationDate (D:20261002063005Z)');
  });

  it('sizes the page to the paper width and the image aspect ratio', () => {
    const w = +mmToPt(58).toFixed(2);
    const h = +((mmToPt(58) * 1500) / 760).toFixed(2);
    expect(s).toContain(`/MediaBox [0 0 ${w} ${h}]`);
    expect(w).toBeCloseTo(164.41, 1);
  });

  it('has a cross-reference table whose offsets point at the objects', () => {
    const start = Number(s.match(/startxref\n(\d+)\n%%EOF/)![1]);
    expect(s.slice(start, start + 4)).toBe('xref');
    const entries = s.slice(start).split('\n').slice(3, 9); // after "xref", "0 7", free entry
    expect(entries).toHaveLength(6);
    entries.forEach((e, i) => {
      expect(e).toMatch(/^\d{10} 00000 n $/);
      const off = Number(e.slice(0, 10));
      expect(s.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it('embeds the JPEG byte for byte with an exact /Length', () => {
    const len = Number(s.match(/\/Length (\d+) >>\nstream\n\xff/)?.[1] ?? s.match(/\/DCTDecode \/Length (\d+)/)![1]);
    expect(len).toBe(jpeg.length);
    const at = s.indexOf('stream\n\xff\xd8') + 'stream\n'.length;
    expect([...pdf.slice(at, at + len)]).toEqual([...jpeg]);
    expect(s.slice(at + len, at + len + 14)).toBe('\nendstream\nend');
  });

  it('stores a non-ASCII title as UTF-16BE hex', () => {
    expect(s).toMatch(/\/Title <FEFF0052/);
    expect(s).toContain('62B9'); // 抹
  });
});
