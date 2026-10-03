import { describe, expect, it } from 'vitest';
import { boxForAspect, cropRect, fullBox, MIN_SIDE, moveBox, resizeBox, rotatedSize, type Box, type Handle } from './crop';

const inside = (b: Box) => b.x >= -1e-9 && b.y >= -1e-9 && b.x + b.w <= 1 + 1e-9 && b.y + b.h <= 1 + 1e-9 && b.w > 0 && b.h > 0;
const pxAspect = (b: Box, imgW: number, imgH: number) => (b.w * imgW) / (b.h * imgH);

describe('boxForAspect', () => {
  it('is the whole picture when there is no ratio', () => {
    expect(boxForAspect(4000, 3000, null)).toEqual(fullBox());
  });

  it('fits the largest centred square into a landscape and a portrait photo', () => {
    const land = boxForAspect(4000, 3000, 1);
    expect(land.h).toBe(1);
    expect(land.w).toBeCloseTo(0.75);
    expect(land.x).toBeCloseTo(0.125);
    expect(pxAspect(land, 4000, 3000)).toBeCloseTo(1);

    const port = boxForAspect(3000, 4000, 1);
    expect(port.w).toBe(1);
    expect(port.h).toBeCloseTo(0.75);
    expect(port.y).toBeCloseTo(0.125);
  });

  it('works for other ratios', () => {
    expect(pxAspect(boxForAspect(1000, 1000, 16 / 9), 1000, 1000)).toBeCloseTo(16 / 9);
    expect(pxAspect(boxForAspect(2000, 500, 4 / 3), 2000, 500)).toBeCloseTo(4 / 3);
  });
});

describe('moving', () => {
  it('keeps the box inside the picture', () => {
    const b = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
    expect(moveBox(b, -1, -1)).toMatchObject({ x: 0, y: 0, w: 0.5, h: 0.5 });
    expect(moveBox(b, 1, 1)).toMatchObject({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
    const m = moveBox(b, 0.1, -0.05);
    expect(m.x).toBeCloseTo(0.3);
    expect(m.y).toBeCloseTo(0.15);
  });
});

describe('free resizing', () => {
  const o = { imgW: 1000, imgH: 800, aspect: null };
  const b = { x: 0.2, y: 0.3, w: 0.5, h: 0.4 };

  it('each edge moves only itself', () => {
    const e = resizeBox(b, 'e', 0.1, 0.5, o);
    expect(e.x).toBe(0.2); // the west, north and south edges stayed put
    expect(e.y).toBe(0.3);
    expect(e.h).toBeCloseTo(0.4);
    expect(resizeBox(b, 'e', 0.1, 0, o).w).toBeCloseTo(0.6);
    expect(resizeBox(b, 'w', 0.1, 0, o).x).toBeCloseTo(0.3);
    expect(resizeBox(b, 'w', 0.1, 0, o).w).toBeCloseTo(0.4);
    expect(resizeBox(b, 'n', 0, 0.1, o).h).toBeCloseTo(0.3);
    expect(resizeBox(b, 's', 0, 0.1, o).h).toBeCloseTo(0.5);
  });

  it('a corner moves two edges', () => {
    const r = resizeBox(b, 'se', 0.1, 0.1, o);
    expect(r.w).toBeCloseTo(0.6);
    expect(r.h).toBeCloseTo(0.5);
    const q = resizeBox(b, 'nw', -0.1, -0.1, o);
    expect(q.x).toBeCloseTo(0.1);
    expect(q.y).toBeCloseTo(0.2);
    expect(q.w).toBeCloseTo(0.6);
  });

  it('stops at the picture edge and at the minimum size, for every handle', () => {
    const handles: Handle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    for (const h of handles) {
      for (const [dx, dy] of [[5, 5], [-5, -5], [5, -5], [-5, 5]]) {
        const r = resizeBox(b, h, dx, dy, o);
        expect(inside(r), `${h} ${dx},${dy}`).toBe(true);
        expect(r.w).toBeGreaterThanOrEqual(MIN_SIDE - 1e-9);
        expect(r.h).toBeGreaterThanOrEqual(MIN_SIDE - 1e-9);
      }
    }
    expect(resizeBox(b, 'e', -5, 0, o).w).toBeCloseTo(MIN_SIDE);
  });
});

describe('resizing with a fixed ratio', () => {
  const dims = [{ imgW: 1000, imgH: 1000 }, { imgW: 4000, imgH: 3000 }, { imgW: 600, imgH: 2400 }];
  const ratios = [1, 4 / 3, 3 / 4, 16 / 9];

  it('keeps the exact ratio and stays inside, whichever corner is dragged and however far', () => {
    for (const { imgW, imgH } of dims) {
      for (const aspect of ratios) {
        const start = boxForAspect(imgW, imgH, aspect);
        // shrink first so there is room to grow in every direction
        const small = resizeBox(start, 'se', -0.3, -0.3, { imgW, imgH, aspect });
        for (const h of ['ne', 'nw', 'se', 'sw'] as Handle[]) {
          for (const [dx, dy] of [[0.07, 0.02], [-0.2, 0.05], [0.3, -0.4], [9, 9], [-9, -9]]) {
            const r = resizeBox(small, h, dx, dy, { imgW, imgH, aspect });
            const label = `${imgW}x${imgH} @${aspect.toFixed(2)} ${h} ${dx},${dy}`;
            expect(inside(r), label).toBe(true);
            expect(pxAspect(r, imgW, imgH), label).toBeCloseTo(aspect, 6);
          }
        }
      }
    }
  });

  it('the opposite corner stays where it was', () => {
    const o = { imgW: 1000, imgH: 1000, aspect: 1 };
    const b = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
    const r = resizeBox(b, 'se', 0.1, 0.1, o);
    expect(r.x).toBeCloseTo(0.2);
    expect(r.y).toBeCloseTo(0.2);
    expect(r.w).toBeCloseTo(0.5);
    const q = resizeBox(b, 'nw', -0.1, -0.1, o);
    expect(q.x + q.w).toBeCloseTo(0.6); // east edge fixed
    expect(q.y + q.h).toBeCloseTo(0.6); // south edge fixed
  });

  it('ignores edge handles, which would break the ratio', () => {
    const b = boxForAspect(1000, 1000, 1);
    expect(resizeBox(b, 'e', 0.1, 0, { imgW: 1000, imgH: 1000, aspect: 1 })).toEqual(b);
  });
});

describe('cropRect', () => {
  it('rounds to whole pixels inside the picture and is never empty', () => {
    expect(cropRect({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 }, 1000, 800)).toEqual({ x: 100, y: 160, w: 500, h: 400 });
    expect(cropRect(fullBox(), 640, 480)).toEqual({ x: 0, y: 0, w: 640, h: 480 });
    expect(cropRect({ x: 0.9999, y: 0.9999, w: 0.0001, h: 0.0001 }, 100, 100)).toEqual({ x: 99, y: 99, w: 1, h: 1 });
    const r = cropRect({ x: 0.55, y: 0, w: 0.5, h: 1 }, 101, 50); // would spill past the right edge
    expect(r.x + r.w).toBeLessThanOrEqual(101);
  });
});

describe('rotatedSize', () => {
  it('swaps sides on odd quarter-turns', () => {
    expect(rotatedSize(400, 300, 0)).toEqual({ w: 400, h: 300 });
    expect(rotatedSize(400, 300, 1)).toEqual({ w: 300, h: 400 });
    expect(rotatedSize(400, 300, 2)).toEqual({ w: 400, h: 300 });
    expect(rotatedSize(400, 300, 3)).toEqual({ w: 300, h: 400 });
  });
});
