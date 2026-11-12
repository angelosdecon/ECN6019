// Week 8: two activities, shared by the student page and the dashboard.
//  1. "Guess 2/3 of the average": everyone picks 0–100; closest to 2/3 of the class average wins. Two rounds.
//  2. "Spot the equilibrium": a self-paced exercise. Each phone gets its own payoff matrices; tap the Nash equilibria.
window.BL = (function () {
  // ---------- small helpers ----------
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let x = hash(seed) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  function newId() { return "p" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
  const num = (x, d = 1) => { const k = Math.pow(10, d), r = Math.round(x * k) / k; return String(r); };

  // ---------- a fun name for each phone (so the winner can be announced) ----------
  const ADJ = ["Brave", "Clever", "Cosmic", "Daring", "Fizzy", "Gentle", "Golden", "Happy", "Jolly", "Lucky", "Mighty", "Nimble", "Quiet", "Rapid", "Shiny", "Sneaky", "Sunny", "Swift", "Witty", "Zesty"];
  const ANIMAL = ["Otter", "Falcon", "Panda", "Fox", "Koala", "Llama", "Owl", "Tiger", "Dolphin", "Badger", "Gecko", "Heron", "Lynx", "Moose", "Puffin", "Raven", "Walrus", "Yak", "Zebra", "Hedgehog"];
  function nameOf(pid) { const h = hash(pid + "n"); return ADJ[h % ADJ.length] + " " + ANIMAL[(h >>> 8) % ANIMAL.length] + " #" + ((h >>> 16) % 90 + 10); }

  // ---------- the guessing game ----------
  const FRACTION = 2 / 3;
  // guesses: array of {id, name, g}. Returns the average, the target and the winners.
  function guessResult(guesses) {
    if (!guesses.length) return null;
    const avg = mean(guesses.map((x) => x.g)), target = FRACTION * avg;
    let best = Infinity; for (const x of guesses) best = Math.min(best, Math.abs(x.g - target));
    const win = guesses.filter((x) => Math.abs(x.g - target) <= best + 1e-9);
    return { n: guesses.length, avg, target, winVal: win[0].g, winners: win.map((x) => x.name), winIds: win.map((x) => x.id) };
  }
  // The reasoning, step by step: 100, 66.7, 44.4, ...
  function steps(k) { const out = []; let x = 100; for (let i = 0; i <= k; i++) { out.push(x); x *= FRACTION; } return out; }

  // ---------- spot the equilibrium ----------
  // A game: m[r][c] = [row player's payoff, column player's payoff].
  function nash(m) {
    const R = m.length, C = m[0].length, out = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (isBR1(m, r, c) && isBR2(m, r, c)) out.push(r + "," + c);
    return out;
  }
  function isBR1(m, r, c) { for (let k = 0; k < m.length; k++) if (m[k][c][0] > m[r][c][0]) return false; return true; }
  function isBR2(m, r, c) { for (let k = 0; k < m[0].length; k++) if (m[r][k][1] > m[r][c][1]) return false; return true; }
  function strictBRs(m) { // no ties in any best response, so every answer is clear-cut
    const R = m.length, C = m[0].length;
    for (let c = 0; c < C; c++) { const v = m.map((row) => row[c][0]).sort((a, b) => b - a); if (v[0] === v[1]) return false; }
    for (let r = 0; r < R; r++) { const v = m[r].map((x) => x[1]).sort((a, b) => b - a); if (v[0] === v[1]) return false; }
    return true;
  }
  function dominant1(m) { for (let r = 0; r < m.length; r++) { let ok = true; for (let c = 0; c < m[0].length; c++) if (!isBR1(m, r, c)) ok = false; if (ok) return r; } return -1; }
  function dominant2(m) { for (let c = 0; c < m[0].length; c++) { let ok = true; for (let r = 0; r < m.length; r++) if (!isBR2(m, r, c)) ok = false; if (ok) return c; } return -1; }
  function cells(m) { const o = []; for (let r = 0; r < m.length; r++) for (let c = 0; c < m[0].length; c++) o.push([r, c]); return o; }
  function paretoBetter(m, a, b) { const x = m[a[0]][a[1]], y = m[b[0]][b[1]]; return x[0] > y[0] && x[1] > y[1]; }
  function maxSumCell(m) { let best = null, bs = -1; for (const [r, c] of cells(m)) { const s = m[r][c][0] + m[r][c][1]; if (s > bs) { bs = s; best = [r, c]; } } return best; }

  const TYPES = [
    { key: "pd", n: 2, title: "A dilemma", test: (m, ne) => ne.length === 1 && dominant1(m) >= 0 && dominant2(m) >= 0 && cells(m).some((x) => paretoBetter(m, x, ne[0].split(",").map(Number))) },
    { key: "one", n: 2, title: "One equilibrium?", test: (m, ne) => ne.length === 1 && (dominant1(m) < 0 || dominant2(m) < 0) },
    { key: "two", n: 2, title: "How many?", test: (m, ne) => ne.length === 2 },
    { key: "none", n: 2, title: "Look carefully", test: (m, ne) => ne.length === 0 },
    { key: "big1", n: 3, title: "A 3 × 3 game", test: (m, ne) => { if (ne.length !== 1) return false; const s = maxSumCell(m); return !ne.includes(s.join(",")); } },
    { key: "big2", n: 3, title: "Another 3 × 3 game", test: (m, ne) => ne.length === 2 }
  ];
  const TYPE_LABELS = ["Dominant strategies", "One equilibrium", "Two equilibria", "No equilibrium", "3 × 3, one", "3 × 3, two"];
  const LAB = { 2: { r: ["Up", "Down"], c: ["Left", "Right"] }, 3: { r: ["Top", "Middle", "Bottom"], c: ["Left", "Centre", "Right"] } };

  function makeGame(pid, k) {
    const T = TYPES[k], R = rng(pid + "g" + k);
    for (let it = 0; it < 20000; it++) {
      const m = Array.from({ length: T.n }, () => Array.from({ length: T.n }, () => [Math.floor(R() * 10), Math.floor(R() * 10)]));
      if (!strictBRs(m)) continue;
      const ne = nash(m);
      if (T.test(m, ne)) return { k, type: T.key, title: T.title, m, ne, lab: LAB[T.n] };
    }
    throw new Error("no game found for " + T.key);
  }
  const gamesCache = {};
  function games(pid) { if (!gamesCache[pid]) gamesCache[pid] = TYPES.map((_, k) => makeGame(pid, k)); return gamesCache[pid]; }

  // Grade an answer: sel is an array of "r,c" (empty = "no pure-strategy equilibrium").
  function grade(g, sel) {
    const S = new Set(sel), N = new Set(g.ne);
    const ok = S.size === N.size && [...S].every((x) => N.has(x));
    if (ok) return { ok: true, tag: "ok" };
    if (!S.size) return { ok: false, tag: "said none" };
    if (!N.size) return { ok: false, tag: "found one where none" };
    const wrong = [...S].filter((x) => !N.has(x));
    if (!wrong.length) return { ok: false, tag: "missed one" };
    const w = wrong[0].split(",").map(Number), ms = maxSumCell(g.m);
    if ((ms[0] === w[0] && ms[1] === w[1]) || g.ne.some((x) => paretoBetter(g.m, w, x.split(",").map(Number)))) return { ok: false, tag: "best for both" };
    if (isBR1(g.m, w[0], w[1]) || isBR2(g.m, w[0], w[1])) return { ok: false, tag: "one player only" };
    return { ok: false, tag: "other" };
  }
  // Why a cell is not an equilibrium: who would switch, and to what.
  function deviation(g, cell) {
    const [r, c] = cell.split(",").map(Number), m = g.m, out = [];
    if (!isBR1(m, r, c)) { let b = 0; for (let k = 0; k < m.length; k++) if (m[k][c][0] > m[b][c][0]) b = k; out.push(`the row player would switch to <b>${g.lab.r[b]}</b> (${m[b][c][0]} &gt; ${m[r][c][0]})`); }
    if (!isBR2(m, r, c)) { let b = 0; for (let k = 0; k < m[0].length; k++) if (m[r][k][1] > m[r][b][1]) b = k; out.push(`the column player would switch to <b>${g.lab.c[b]}</b> (${m[r][b][1]} &gt; ${m[r][c][1]})`); }
    return out.join(", and ");
  }
  const TIPS = {
    "said none": "There is one: look for a cell where <b>both</b> payoffs are best responses.",
    "found one where none": "Check each cell: in every one of them, someone would rather switch. Some games have no pure-strategy equilibrium.",
    "missed one": "Games can have more than one equilibrium: check every cell.",
    "best for both": "The cell that is best for both players need not be an equilibrium: ask whether each player would want to switch <b>on her own</b>.",
    "one player only": "One player is best-responding there, but the other is not. Both must be.",
    other: "Mark each player's best responses first, then look for cells where both are marked."
  };
  const MEANING = {
    "said none": "said “none” but there is one", "found one where none": "found one where there is none",
    "missed one": "missed an equilibrium", "best for both": "picked the cell best for both", "one player only": "only one player best-responding", other: "other"
  };

  return { hash, rng, newId, mean, num, nameOf, guessResult, steps, FRACTION, TYPES, TYPE_LABELS, games, grade, deviation, isBR1, isBR2, TIPS, MEANING, nash };
})();
