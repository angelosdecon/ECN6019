// Game rules and calculations shared by the student page and the dashboard.
window.BL = (function () {
  const PG = {
    endowment: 20,        // tokens per round
    multiplier: 2,        // the pot is doubled ...
    groupSize: 4,         // ... and shared equally in the group
    punishCost: 1,        // a punishment point costs the punisher 1 token
    punishEffect: 3,      // and removes 3 tokens from the target
    maxPunish: 5,         // at most 5 points per round in total
    chooseSecs: 25,
    punishSecs: 20,
    rounds: [
      { n: 1, punish: false }, { n: 2, punish: false }, { n: 3, punish: false }, { n: 4, punish: false },
      { n: 5, punish: true }, { n: 6, punish: true }
    ]
  };
  const COIN = { length: 20, playSecs: 90 };
  const ULT = { pie: 10, playSecs: 45 };   // £10 to split; whole pounds

  const COLOURS = [
    { name: "Green", hex: "#2e9e5b" }, { name: "Orange", hex: "#e8833a" },
    { name: "Purple", hex: "#7b4fc9" }, { name: "Blue", hex: "#2f7fd1" }, { name: "Pink", hex: "#d1477a" }
  ];

  function shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }

  // Split players into groups of 4; leftovers make a group of 3 or some groups of 5.
  function makeGroups(pids) {
    const p = shuffle(pids);
    const n = p.length;
    if (n === 0) return [];
    if (n <= 5) return [p];
    const k = Math.floor(n / 4);
    const rem = n % 4;
    let sizes = Array(k).fill(4);
    if (rem === 3) sizes.push(3);
    else if (rem > k) sizes = [3, 3];                 // n = 6
    else for (let i = 0; i < rem; i++) sizes[i] += 1;  // a few groups of 5
    const groups = []; let at = 0;
    for (const s of sizes) { groups.push(p.slice(at, at + s)); at += s; }
    return groups;
  }

  // Earnings in one round for every member of one group.
  // contrib: {pid: tokens} (missing = 0), punish: {punisherPid: {targetPid: points}} or null
  function roundEarnings(group, contrib, punish) {
    contrib = contrib || {}; punish = punish || {};
    const c = {}; let pot = 0;
    for (const pid of group) { c[pid] = clampInt(contrib[pid], 0, PG.endowment); pot += c[pid]; }
    const share = PG.multiplier * pot / group.length;
    const out = {};
    for (const pid of group) {
      const given = sumPoints(punish[pid], group, pid);
      let received = 0;
      for (const other of group) if (other !== pid && punish[other] && punish[other][pid]) received += clampInt(punish[other][pid], 0, PG.maxPunish);
      out[pid] = {
        contribution: c[pid], kept: PG.endowment - c[pid], pot, share,
        cost: given * PG.punishCost, lost: received * PG.punishEffect,
        total: PG.endowment - c[pid] + share - given * PG.punishCost - received * PG.punishEffect
      };
    }
    return out;
  }
  function sumPoints(map, group, self) {
    if (!map) return 0; let s = 0;
    for (const t of Object.keys(map)) if (t !== self && group.includes(t)) s += clampInt(map[t], 0, PG.maxPunish);
    return Math.min(s, PG.maxPunish);
  }
  function clampInt(v, lo, hi) { v = Math.round(Number(v) || 0); return Math.max(lo, Math.min(hi, v)); }

  function longestRun(seq) {
    if (!seq) return 0; let m = 1, r = 1;
    for (let i = 1; i < seq.length; i++) { r = seq[i] === seq[i - 1] ? r + 1 : 1; if (r > m) m = r; }
    return seq.length ? m : 0;
  }
  function switches(seq) { let s = 0; for (let i = 1; i < (seq || "").length; i++) if (seq[i] !== seq[i - 1]) s++; return s; }
  function randomSeq(n) { let s = ""; for (let i = 0; i < n; i++) s += Math.random() < 0.5 ? "H" : "T"; return s; }
  function newId() { return "p" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function fmt(x, d) { return (Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toString(); }
  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }

  return { PG, COIN, ULT, COLOURS, makeGroups, roundEarnings, longestRun, switches, randomSeq, newId, fmt, mean, clampInt, shuffle };
})();
