// Shared by the compositor page and the audio mixer: how video time maps onto the recorded takes.
export const FPS = 30;
export const DUR = 15.0;

// Each segment plays `take` from take-time `a` at `speed` (0 = freeze) between video times v0..v1.
export const SEGMENTS = [
  { v0: 0.0, v1: 1.7, take: 'sell', a: 0.0, speed: 0 },
  { v0: 1.7, v1: 3.7, take: 'sell', a: 0.3, speed: 1.15 },
  { v0: 3.7, v1: 5.95, take: 'sell', a: 2.6, speed: 1.35 },
  { v0: 5.95, v1: 8.7, take: 'sell', a: 5.64, speed: 1.25 },
  { v0: 8.7, v1: 11.0, take: 'lang', a: 0.0, speed: 1.0 },
  { v0: 11.0, v1: 12.7, take: 'reports', a: 0.25, speed: 1.0 },
];

export const CUTS = [8.7, 11.0, 12.68]; // flash + whoosh

export function segmentAt(v) {
  for (let i = SEGMENTS.length - 1; i >= 0; i--) if (v >= SEGMENTS[i].v0) return { seg: SEGMENTS[i], i };
  return { seg: SEGMENTS[0], i: 0 };
}

/** Take-time for a video time (last segment holds its final frame after it ends). */
export function videoToTake(v) {
  const { seg, i } = segmentAt(v);
  const vv = Math.min(v, seg.v1);
  return { take: seg.take, tt: seg.a + (vv - seg.v0) * seg.speed, i };
}

/** Video time at which take-time `tt` of `take` plays, or null when it's cut. */
export function takeToVideo(take, tt) {
  for (const s of SEGMENTS) {
    if (s.take !== take || s.speed === 0) continue;
    const end = s.a + (s.v1 - s.v0) * s.speed;
    if (tt >= s.a - 1e-6 && tt <= end + 1e-6) return s.v0 + (tt - s.a) / s.speed;
  }
  return null;
}
