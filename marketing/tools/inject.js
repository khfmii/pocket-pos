// Virtual clock for deterministic capture: timers, rAF, Date.now/performance.now and CSS animations all follow
// __vt.tick(ms) instead of wall-clock time, so every captured frame sits at an exact video timestamp.
(() => {
  let VT = 0;
  const BASE = Date.now();
  let id = 1;
  const timers = new Map();
  let rafs = [];
  window.setTimeout = (fn, ms = 0, ...args) => { const i = id++; timers.set(i, { at: VT + Math.max(0, +ms || 0), fn, args, every: 0 }); return i; };
  window.setInterval = (fn, ms = 0, ...args) => { const i = id++; const e = Math.max(1, +ms || 1); timers.set(i, { at: VT + e, fn, args, every: e }); return i; };
  window.clearTimeout = window.clearInterval = (i) => { timers.delete(i); };
  window.requestAnimationFrame = (cb) => { const i = id++; rafs.push({ i, cb }); return i; };
  window.cancelAnimationFrame = (i) => { rafs = rafs.filter((r) => r.i !== i); };
  performance.now = () => VT;
  Date.now = () => BASE + VT;
  const seen = new WeakMap();
  function scrub() {
    for (const a of document.getAnimations()) {
      if (!seen.has(a)) seen.set(a, VT);
      const t = VT - seen.get(a);
      const ct = a.effect && a.effect.getComputedTiming();
      const end = ct ? ct.endTime : Infinity;
      if (end !== Infinity && t >= end) { try { a.finish(); } catch (e) {} }
      else { a.pause(); a.currentTime = t; }
    }
  }
  function runDue(limit) {
    for (let guard = 0; guard < 5000; guard++) {
      let best = null, bestId = 0;
      for (const [i, t] of timers) if (t.at <= limit && (!best || t.at < best.at || (t.at === best.at && i < bestId))) { best = t; bestId = i; }
      if (!best) return;
      VT = Math.max(VT, best.at);
      if (best.every) best.at += best.every; else timers.delete(bestId);
      try { best.fn(...best.args); } catch (e) { console.error(e); }
    }
  }
  window.__vt = {
    now: () => VT,
    tick(ms) {
      const target = VT + ms;
      runDue(target);
      VT = target;
      for (let pass = 0; pass < 3; pass++) {
        const cbs = rafs; rafs = [];
        for (const r of cbs) { try { r.cb(VT); } catch (e) { console.error(e); } }
        runDue(VT);
        if (!rafs.length) break;
      }
      scrub();
      return VT;
    },
  };
})();
