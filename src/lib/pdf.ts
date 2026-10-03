/**
 * Smallest useful PDF writer: one page that is entirely one JPEG.
 * A rendered receipt is already pixels (so every script — CJK, Thai, accents — looks right without embedding fonts),
 * and wrapping it as a PDF gives people a normal document to email, print or file.
 */
const enc = new TextEncoder();

const hex16 = (s: string) => {
  let out = 'FEFF'; // UTF-16BE with byte-order mark: the PDF way to store non-ASCII text
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16).padStart(4, '0');
  return out.toUpperCase();
};

const pdfDate = (d: Date) => {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `D:${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
};

/** `jpeg` is the encoded file; `px` its pixel size. The page is `pageWidthPt` wide and as tall as the image needs. */
export function imagePdf(jpeg: Uint8Array, px: { w: number; h: number }, pageWidthPt: number, meta: { title?: string; date?: Date } = {}): Uint8Array {
  const pageW = +pageWidthPt.toFixed(2);
  const pageH = +((pageWidthPt * px.h) / px.w).toFixed(2);
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (b: Uint8Array | string) => {
    const u = typeof b === 'string' ? enc.encode(b) : b;
    chunks.push(u);
    len += u.length;
  };
  const obj = (n: number, body: () => void) => {
    offsets[n] = len;
    push(`${n} 0 obj\n`);
    body();
    push('endobj\n');
  };

  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // high-bit comment: tells tools this file is binary
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>\n'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n'));
  obj(3, () =>
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\n`),
  );
  obj(4, () => {
    push(`<< /Type /XObject /Subtype /Image /Width ${px.w} /Height ${px.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push('\nendstream\n');
  });
  const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}endstream\n`));
  obj(6, () => push(`<< ${meta.title ? `/Title <${hex16(meta.title)}> ` : ''}/Producer (Pocket POS) /CreationDate (${pdfDate(meta.date ?? new Date())}) >>\n`));

  const xref = len;
  push('xref\n0 7\n0000000000 65535 f \n');
  for (let n = 1; n <= 6; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(len);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export const mmToPt = (mm: number) => (mm * 72) / 25.4;
