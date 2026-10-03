// Finds every translatable string: t('…') and tn(n, '…one', '…other') calls in src/. Used by the coverage test and for translators.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'i18n') continue; // language files themselves
      walk(p, out);
    } else if (['.ts', '.tsx'].includes(extname(p)) && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

/** Parses a JS string literal starting at i; returns [value, indexAfter] or null. */
function readString(src, i) {
  const q = src[i];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  let out = '';
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') {
      const n = src[j + 1];
      out += n === 'n' ? '\n' : n;
      j++;
    } else if (c === q) return [out, j + 1];
    else if (q === '`' && c === '$' && src[j + 1] === '{') return null; // interpolated template: not a static key
    else out += c;
  }
  return null;
}

/** Splits the argument list of a call whose "(" is at `open` into top-level argument source strings. */
function splitArgs(src, open) {
  const args = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      const r = readString(src, i);
      if (!r) {
        // skip an interpolated template conservatively
        let j = i + 1;
        while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
        i = j;
      } else i = r[1] - 1;
    } else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) {
      depth--;
      if (depth === 0) {
        args.push(src.slice(start, i));
        return args;
      }
    } else if (c === ',' && depth === 1) {
      args.push(src.slice(start, i));
      start = i + 1;
    }
  }
  return args;
}

const literal = (arg) => {
  const s = arg.trim();
  const r = readString(s, 0);
  return r && r[1] === s.length ? r[0] : null;
};

export function extractKeys(root = 'src') {
  /** key -> { plural: 'one' | 'other' | null } */
  const keys = new Map();
  const add = (k, plural = null) => {
    if (k && !keys.has(k)) keys.set(k, { plural });
  };
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8');
    const re = /(?<![\w.$])(tn|t)\(/g;
    let m;
    while ((m = re.exec(src))) {
      const args = splitArgs(src, m.index + m[0].length - 1);
      if (m[1] === 't') add(literal(args[0] ?? ''));
      else {
        add(literal(args[1] ?? ''), 'one');
        add(literal(args[2] ?? ''), 'other');
      }
    }
  }
  return keys;
}

if (process.argv[1]?.endsWith('i18n-keys.mjs')) {
  const keys = extractKeys();
  const arg = process.argv[2];
  if (arg === '--json') console.log(JSON.stringify([...keys.keys()], null, 1));
  else console.log(`${keys.size} translatable strings`);
}
