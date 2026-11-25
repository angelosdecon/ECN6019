// Week 8: three activities, shared by the student page and the dashboard.
//  1. "Cournot workout" (main, 26 Nov 2026): a self-paced Cournot duopoly, step by step, multiple choice with hints.
//  2. "Guess 2/3 of the average" (if there is time): everyone picks 0–100; closest to 2/3 of the class average wins. Two rounds.
//  3. "Spot the equilibrium" (optional extra practice): each phone gets its own payoff matrices; tap the Nash equilibria.
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


  // =====================================================================
  // Cournot workout (self-paced, multiple choice with hints, like Weeks 6–7)
  // Demand p = a − Q, Q = q1 + q2, constant MC = c. Each phone gets its own (a, c) from its id.
  // a − c is a multiple of 12, so the two-firm, three-firm and monopoly answers are all whole numbers.
  // None repeats the lecture (100, 4), the recording (41, 1), PS8 (20, 2), (90, 6), (84, 12),
  // the January 2026 (120, 20) / January 2027 (150 − 2Q, 30) / resit (130, 10) exams or the mock (150, 30).
  // =====================================================================
  const CSETS = [[50, 2], [64, 4], [75, 3], [80, 8], [62, 2], [54, 6], [70, 10], [88, 4],
    [110, 2], [60, 12], [76, 4], [96, 12], [66, 6], [58, 10], [125, 5], [112, 4]];
  function shuffle(arr, seed) { const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // Options: the first is correct; three distractors are drawn (per phone) from the rest.
  // Duplicate labels are removed; for numeric steps, spare slots get nearby whole numbers.
  function opts(list, seed, numeric) {
    const seen = new Set(), ok = list[0], rest = [];
    seen.add(ok.label);
    for (const o of shuffle(list.slice(1), seed + "d")) { if (!o || seen.has(o.label)) continue; seen.add(o.label); rest.push(o); }
    const out = [ok].concat(rest.slice(0, 3));
    if (numeric) {
      let k = 1;
      while (out.length < 4 && k < 30) {
        for (const v of [ok.v + k, ok.v - k]) { const label = numeric(v); if (v > 0 && !seen.has(label) && out.length < 4) { seen.add(label); out.push({ v, label, tag: "other" }); } }
        k++;
      }
    }
    return shuffle(out.map((o, i) => Object.assign({ correct: i === 0, key: "o" + i }, o)), seed);
  }
  function market(pid, round) {
    const [a, c] = CSETS[(hash(pid + "c") + (round || 0)) % CSETS.length], k = a - c;
    return { a, c, k, h: k / 2, q: k / 3, Q: 2 * k / 3, p: a - 2 * k / 3, pi: (k / 3) * (k / 3),
      q3: k / 4, Q3: 3 * k / 4, p3: a - 3 * k / 4, pm: (a + c) / 2, qm: k / 2, pim: (k / 2) * (k / 2) };
  }
  const q1 = "q<sub>1</sub>", q2 = "q<sub>2</sub>", qi = "q<sub>i</sub>", Qmi = "Q<sub>−i</sub>", p1 = "π<sub>1</sub>";
  const cost = (c) => (c === 1 ? "" : c) + q1;
  const fmt = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(Math.round(v * 100) / 100)).replace(/^-/, "−");
  const N = (v) => fmt(v);

  function cIntro(m) {
    return `Market demand: <b>p = ${m.a} − Q</b>, where Q = ${q1} + ${q2}.<br>Each firm has cost C(q) = ${m.c}q, so marginal cost is <b>MC = ${m.c}</b>.<br>The two firms choose their outputs at the same time.`;
  }
  function cSteps(pid, round) {
    round = round || 0; const sd = pid + "c" + round, m = market(pid, round), { a, c, k, h, q, Q, p, pi, pm, qm } = m;
    const piExpr = `${k}${q1} − ${q1}<sup>2</sup> − ${q1}${q2}`;
    return [
      { id: "profit", title: "Firm 1's profit", intro: cIntro(m), fact: `${p1} = (${a} − ${q1} − ${q2})${q1} − ${cost(c)} = ${piExpr}`,
        q: `Firm 1 takes firm 2's output ${q2} as given. Which is firm 1's profit?`,
        hint: `Profit = revenue − cost. Revenue is the price times firm 1's <b>own</b> output ${q1}, and the price depends on <b>total</b> output Q = ${q1} + ${q2}.`,
        options: opts([
          { label: `${p1} = (${a} − ${q1} − ${q2})${q1} − ${cost(c)}`, tag: "ok" },
          { label: `${p1} = (${a} − ${q1} − ${q2})(${q1} + ${q2}) − ${cost(c)}`, tag: "revenue on total output" },
          { label: `${p1} = (${a} − ${q1})${q1} − ${cost(c)}`, tag: "forgot the rival" },
          { label: `${p1} = (${a} − ${q1} − ${q2})${q1}`, tag: "forgot cost" },
          { label: `${p1} = (${a} − ${q1} − ${q2})${q1} − ${c}(${q1} + ${q2})`, tag: "cost of both firms" }], sd + "0"),
        why: `${p1} = p·${q1} − ${cost(c)} = (${a} − ${q1} − ${q2})${q1} − ${cost(c)} = <b>${piExpr}</b>. Firm 1's profit depends on firm 2's output through the price: that is what makes it a game.`,
        tips: { "revenue on total output": `Firm 1 is paid only for what <b>it</b> sells: revenue is p × ${q1}, not p × Q.`,
          "forgot the rival": `The price depends on <b>total</b> output: p = ${a} − (${q1} + ${q2}).`,
          "forgot cost": `Profit is revenue <b>minus</b> cost, and each unit costs ${c}.`,
          "cost of both firms": `Firm 1 pays only for its own output: cost is ${cost(c)}.` } },
      { id: "foc", title: "First-order condition", fact: `∂${p1}/∂${q1} = ${k} − 2${q1} − ${q2} = 0`,
        q: `Firm 1 chooses ${q1} to maximise ${p1} = ${piExpr}, with ${q2} fixed. What is the first-order condition ∂${p1}/∂${q1} = 0?`,
        hint: `Differentiate term by term with respect to ${q1}: ${k}${q1} gives ${k}, ${q1}<sup>2</sup> gives 2${q1}, and ${q1}${q2} gives ${q2} (${q2} is a constant for firm 1).`,
        options: opts([
          { label: `${k} − 2${q1} − ${q2} = 0`, tag: "ok" },
          { label: `${k} − ${q1} − ${q2} = 0`, tag: "forgot the 2" },
          { label: `${k} − 2${q1} − 2${q2} = 0`, tag: "differentiated q2 too" },
          { label: `${k} − 2${q1} = 0`, tag: "dropped the rival" },
          { label: `${a} − 2${q1} − ${q2} = 0`, tag: "forgot the cost" }], sd + "1"),
        why: `∂${p1}/∂${q1} = <b>${k} − 2${q1} − ${q2} = 0</b>. Equivalently MR<sub>1</sub> = ${a} − 2${q1} − ${q2} equals MC = ${c}.`,
        tips: { "forgot the 2": `The derivative of ${q1}<sup>2</sup> is 2${q1}.`,
          "differentiated q2 too": `${q2} is a constant for firm 1, so ${q1}${q2} differentiates to ${q2}, not 2${q2}.`,
          "dropped the rival": `The term −${q1}${q2} differentiates to −${q2}: it does not vanish.`,
          "forgot the cost": `Profit includes −${cost(c)}, which differentiates to −${c}: ${a} − ${c} = ${k}.` } },
      { id: "br", title: "Best response", fact: `BR<sub>1</sub>(${q2}): ${q1} = ${h} − ½${q2}; by symmetry ${q2} = ${h} − ½${q1}`,
        q: `Solve ${k} − 2${q1} − ${q2} = 0 for ${q1}. What is firm 1's best response to ${q2}?`,
        hint: `Move 2${q1} to one side: 2${q1} = ${k} − ${q2}. Then divide <b>both</b> terms by 2.`,
        options: opts([
          { label: `${q1} = ${h} − ½${q2}`, tag: "ok" },
          { label: `${q1} = ${k} − ${q2}`, tag: "forgot to halve" },
          { label: `${q1} = ${h} − ${q2}`, tag: "halved only the intercept" },
          { label: `${q1} = ${h}`, tag: "ignored the rival" },
          { label: `${q1} = ${k} − 2${q2}`, tag: "solved for q2" }], sd + "2"),
        why: `2${q1} = ${k} − ${q2}, so <b>${q1} = ${h} − ½${q2}</b>. If firm 2 produces nothing, firm 1 produces ${h}, the monopoly output; for every unit firm 2 adds, firm 1 produces half a unit less. Firm 2's best response is the same with the roles swapped: ${q2} = ${h} − ½${q1}.`,
        tips: { "forgot to halve": `From 2${q1} = ${k} − ${q2}, divide both sides by 2.`,
          "halved only the intercept": `Divide <b>both</b> terms by 2: ${q2} becomes ½${q2}.`,
          "ignored the rival": `${h} is firm 1's output only if firm 2 produces nothing. The best response depends on ${q2}.`,
          "solved for q2": `Rearrange for ${q1}, not ${q2}: 2${q1} = ${k} − ${q2}.` } },
      { id: "q", title: "Equilibrium output", fact: `q<sub>1</sub>* = q<sub>2</sub>* = ${N(q)} (where the best responses cross)`,
        q: `In the Nash equilibrium each output is a best response to the other. The firms are identical, so ${q1} = ${q2} = q. What is q*?`,
        hint: `Put ${q1} = ${q2} = q into the best response: q = ${h} − ½q. Collect the q terms: (3/2)q = ${h}.`,
        options: opts([
          { v: q, label: N(q), tag: "ok" },
          { v: qm, label: N(qm), tag: "monopoly output" },
          { v: k / 4, label: N(k / 4), tag: "cartel share" },
          { v: k, label: N(k), tag: "competitive output" },
          { v: Q, label: N(Q), tag: "gave total output" }], sd + "3", N),
        why: `q = ${h} − ½q ⇒ (3/2)q = ${h} ⇒ <b>q* = ${N(q)}</b>. Check with the formula: q* = (a − c)/(3b) = ${k}/3 = ${N(q)}. On the graph, it is where the two best responses cross.`,
        tips: { "monopoly output": `${N(qm)} is the best response to ${q2} = 0. But firm 2 produces too, so firm 1 cuts back.`,
          "cartel share": `${N(k / 4)} each is half the monopoly output: what a cartel would do, not the Nash equilibrium.`,
          "competitive output": `${k} is the competitive (p = MC) <b>total</b> output.`,
          "gave total output": `${N(Q)} is total output Q = 2q*. The question asks for each firm's output.` } },
      { id: "p", title: "Market price", fact: `Q* = ${N(Q)}, p* = ${N(p)}`,
        q: `Total output is Q* = ${q1}* + ${q2}*. What is the market price p*?`,
        hint: `Q* = 2 × ${N(q)}. Then read the price off the demand curve: p = ${a} − Q.`,
        options: opts([
          { v: p, label: N(p), tag: "ok" },
          { v: a - q, label: N(a - q), tag: "used q, not Q" },
          { v: c, label: N(c), tag: "set p = MC" },
          { v: pm, label: N(pm), tag: "monopoly price" },
          { v: Q, label: N(Q), tag: "gave Q" }], sd + "4", N),
        why: `Q* = 2 × ${N(q)} = ${N(Q)}, so p* = ${a} − ${N(Q)} = <b>${N(p)}</b>: above marginal cost (${c}) but below the monopoly price (${N(pm)}).`,
        tips: { "used q, not Q": `The price depends on <b>total</b> output: both firms' ${N(q)} units.`,
          "set p = MC": `p = MC is the competitive (or Bertrand) price. Cournot firms keep the price above MC.`,
          "monopoly price": `${N(pm)} is the monopoly price, with output ${N(qm)}. Two firms produce more, so the price is lower.`,
          "gave Q": `${N(Q)} is total output. Now put it into the demand curve.` } },
      { id: "pi", title: "Profit", fact: `π<sub>1</sub>* = π<sub>2</sub>* = ${N(pi)}`,
        q: `What is each firm's profit in the Cournot equilibrium?`,
        hint: `Profit = (price − cost per unit) × own output. Cost per unit is MC = ${c}.`,
        options: opts([
          { v: pi, label: N(pi), tag: "ok" },
          { v: p * q, label: N(p * q), tag: "forgot cost" },
          { v: (p - c) * Q, label: N((p - c) * Q), tag: "used total output" },
          { v: (pm - c) * q, label: N((pm - c) * q), tag: "used the monopoly price" }], sd + "5", N),
        why: `π = (p* − c) × q* = (${N(p)} − ${c}) × ${N(q)} = <b>${N(pi)}</b> each, ${N(2 * pi)} together. A monopoly would earn ${N(m.pim)}: that is why the firms would like to form a cartel.`,
        tips: { "forgot cost": `That is revenue, p* × q*. Subtract the cost, ${c} per unit.`,
          "used total output": `Each firm earns on its <b>own</b> output, ${N(q)}, not on Q* = ${N(Q)}.`,
          "used the monopoly price": `Use the Cournot price you just found, p* = ${N(p)}.` } }
    ];
  }
  function bSteps(pid, round) {
    round = round || 0; const sd = pid + "b" + round, m = market(pid, round), { a, c, k, q, p, q3, Q3, p3, pm } = m;
    return [
      { id: "q3", title: "Bonus: three firms", intro: `Same market, <b>p = ${m.a} − Q</b>, MC = ${m.c}. A third identical firm enters.`, fact: `three firms: q* = ${N(q3)} each, Q* = ${N(Q3)}`,
        q: `Each firm i takes the others' total output ${Qmi} as given. Its first-order condition is ${k} − 2${qi} − ${Qmi} = 0. In a symmetric equilibrium ${Qmi} = 2q. What is q* now?`,
        hint: `Substitute ${qi} = q and ${Qmi} = 2q: ${k} − 2q − 2q = 0.`,
        options: opts([
          { v: q3, label: N(q3), tag: "ok" },
          { v: q, label: N(q), tag: "two-firm answer" },
          { v: k / 2, label: N(k / 2), tag: "monopoly output" },
          { v: Q3, label: N(Q3), tag: "gave total output" },
          { v: k / 6, label: N(k / 6), tag: "divided by 2n" }], sd + "0", N),
        why: `${k} − 4q = 0 ⇒ <b>q* = ${N(q3)}</b>. In general, with n firms q* = (a − c)/((n + 1)b): ${k}/4 = ${N(q3)}.`,
        tips: { "two-firm answer": `With three firms, ${Qmi} is the output of the <b>two</b> others: 2q.`,
          "gave total output": `${N(Q3)} is total output, 3q*. The question asks for each firm.`,
          "divided by 2n": `The first-order condition gives 2q + 2q = 4q = ${k}, so divide by 4.` } },
      { id: "p3", title: "Bonus: the price", fact: `three firms: p* = ${N(p3)}`,
        q: `With three firms, what is the market price?`,
        hint: `Total output is Q* = 3 × ${N(q3)}. Then p = ${a} − Q.`,
        options: opts([
          { v: p3, label: N(p3), tag: "ok" },
          { v: p, label: N(p), tag: "two-firm price" },
          { v: a - q3, label: N(a - q3), tag: "used q, not Q" },
          { v: c, label: N(c), tag: "set p = MC" }], sd + "1", N),
        why: `Q* = 3 × ${N(q3)} = ${N(Q3)}, so p* = ${a} − ${N(Q3)} = <b>${N(p3)}</b>: lower than with two firms (${N(p)}).`,
        tips: { "two-firm price": `${N(p)} is the price with two firms. A third firm adds output.`, "used q, not Q": `Use total output, 3 × ${N(q3)}.` } },
      { id: "many", title: "Bonus: many firms", fact: `as n grows, p* → MC = ${c}`,
        q: `With n firms, p* = c + (a − c)/(n + 1). As the number of firms keeps growing, what happens to the Cournot price?`,
        hint: `What happens to (a − c)/(n + 1) when n becomes very large?`,
        options: opts([
          { label: `It falls towards marginal cost, ${c}`, tag: "ok" },
          { label: `It falls towards zero`, tag: "towards zero" },
          { label: `It stays at the two-firm price, ${N(p)}`, tag: "stays" },
          { label: `It rises towards the monopoly price, ${N(pm)}`, tag: "rises" },
          { label: `It falls below marginal cost`, tag: "below MC" }], sd + "2"),
        why: `The markup (a − c)/(n + 1) shrinks towards 0, so p* → c = <b>${c}</b>: with n = 1 we get the monopoly price ${N(pm)}, with n = 2 the duopoly price ${N(p)}, and with many firms the competitive price. More firms, less market power.`,
        tips: { "towards zero": `Firms never sell below cost: the price falls to MC = ${c}, not to 0.`, "below MC": `Below MC every firm would make a loss on each unit.` } }
    ];
  }
  const EX = [{ key: "c", title: "Cournot duopoly", steps: cSteps }, { key: "b", title: "Bonus: three firms", steps: bSteps }];
  const STEP_LABELS = { c: ["Profit", "First-order condition", "Best response", "Output q*", "Price p*", "Profit π*"], b: ["q*, 3 firms", "p*, 3 firms", "Many firms"] };
  const CMEANING = {
    "revenue on total output": "revenue on total output Q", "forgot the rival": "left the rival out of the price", "forgot cost": "forgot the cost",
    "cost of both firms": "charged firm 1 for both outputs", "forgot the 2": "forgot the 2 in 2q₁", "differentiated q2 too": "differentiated q₂ as well",
    "dropped the rival": "dropped the −q₂ term", "forgot the cost": "forgot −c", "forgot to halve": "forgot to divide by 2",
    "halved only the intercept": "halved only the intercept", "ignored the rival": "gave the monopoly output", "solved for q2": "solved for the wrong output",
    "monopoly output": "gave the monopoly output", "cartel share": "gave the cartel share", "competitive output": "gave the competitive output",
    "gave total output": "gave total output, not per firm", "used q, not Q": "used one firm's output in demand", "set p = MC": "set p = MC",
    "monopoly price": "gave the monopoly price", "gave Q": "gave Q, not p", "used total output": "used total output",
    "used the monopoly price": "used the monopoly price", "two-firm answer": "kept the two-firm answer", "divided by 2n": "divided by 2n",
    "two-firm price": "kept the two-firm price", "towards zero": "said towards zero", stays: "said it stays", rises: "said it rises", "below MC": "said below MC", other: "other"
  };

  return { hash, rng, newId, mean, num, nameOf, guessResult, steps, FRACTION, TYPES, TYPE_LABELS, games, grade, deviation, isBR1, isBR2, TIPS, MEANING, nash,
    CSETS, market, cSteps, bSteps, EX, STEP_LABELS, CMEANING };
})();
