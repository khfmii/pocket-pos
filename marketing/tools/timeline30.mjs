// 30 s cut: which take plays when. Scene boundaries sit on bar lines (128 BPM → 1.875 s per bar).
export const FPS = 30;
export const DUR = 30.0;
export const BAR = 1.875;

export const SEGMENTS = [
  { v0: 0.0, v1: 1.875, take: 'sell30', a: 0.0, speed: 0 },          // hook: Sell screen held while the phone flies in
  { v0: 1.875, v1: 13.125, take: 'sell30', a: 0.0, speed: 1 },       // sell → pay → receipt → share (one continuous take)
  { v0: 13.125, v1: 15.375, take: 'translate30', a: 0.0, speed: 1 }, // Android: on-device translation
  { v0: 15.375, v1: 16.875, take: 'lang30', a: 0.0, speed: 1 },      // language flip
  { v0: 16.875, v1: 20.625, take: 'reports30', a: 0.0, speed: 1 },
  { v0: 20.625, v1: 24.375, take: 'backup30', a: 0.0, speed: 1 },    // Android: automatic backup
];
export const CUTS = [13.125, 15.375, 16.875, 20.625, 24.375, 26.25]; // flash + whoosh

export function segmentAt(v) {
  for (let i = SEGMENTS.length - 1; i >= 0; i--) if (v >= SEGMENTS[i].v0) return { seg: SEGMENTS[i], i };
  return { seg: SEGMENTS[0], i: 0 };
}
export function videoToTake(v) {
  const { seg, i } = segmentAt(v);
  const vv = Math.min(v, seg.v1);
  return { take: seg.take, tt: seg.a + (vv - seg.v0) * seg.speed, i };
}
export function takeToVideo(take, tt) {
  for (const s of SEGMENTS) {
    if (s.take !== take || s.speed === 0) continue;
    const end = s.a + (s.v1 - s.v0) * s.speed;
    if (tt >= s.a - 1e-6 && tt <= end + 1e-6) return s.v0 + (tt - s.a) / s.speed;
  }
  return null;
}
