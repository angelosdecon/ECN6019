// Week 7: "Walrasian workout" – a self-paced exercise on the phone, with hints and feedback after each step.
// Two consumers, two goods, Cobb–Douglas utility, prices p_x = p and p_y = 1.
// Shared by the student page and the dashboard.
window.BL = (function () {
  // ---------- The economies ----------
  // u_A = x^a y^(1−a), u_B = x^b y^(1−b); endowments ω_A = eA, ω_B = eB.
  // Round 0 (the class exercise) is the lecture economy, the same on every phone, so the dashboard compares like with like
  // and the worked example on the slides is the solution. Rounds 1, 2, … ("Try another economy") draw from SETS.
  const LECT = { a: "1/2", b: "1/3", eA: [2, 8], eB: [2, 2] };
  // Every set gives a whole-number price (2, 3 or 4) and whole-number allocations.
  // None repeats the lecture example, PS7, the recording or the January 2026/2027 exams.
  const SETS = [
    { a: "2/3", b: "1/2", eA: [6, 3], eB: [1, 6] },
    { a: "1/3", b: "2/3", eA: [2, 4], eB: [1, 8] },
    { a: "1/2", b: "1/3", eA: [1, 6], eB: [3, 6] },
    { a: "1/2", b: "1/4", eA: [3, 10], eB: [2, 4] },
    { a: "1/4", b: "3/4", eA: [3, 3], eB: [1, 9] },
    { a: "1/3", b: "1/2", eA: [1, 10], eB: [4, 4] },
    { a: "1/3", b: "3/4", eA: [2, 3], eB: [4, 8] },
    { a: "1/2", b: "2/3", eA: [4, 6], eB: [1, 6] },
    { a: "1/2", b: "3/4", eA: [3, 4], eB: [2, 8] },
    { a: "3/4", b: "1/4", eA: [2, 6], eB: [2, 6] },
    { a: "2/3", b: "1/3", eA: [1, 8], eB: [2, 4] },
    { a: "1/4", b: "1/2", eA: [2, 4], eB: [1, 6] },
    { a: "2/3", b: "1/4", eA: [3, 6], eB: [2, 4] },
    { a: "1/4", b: "2/3", eA: [2, 4], eB: [3, 6] },
    { a: "3/4", b: "1/2", eA: [2, 6], eB: [3, 3] },
    { a: "3/4", b: "1/3", eA: [4, 8], eB: [2, 3] }
  ];

  // ---------- fractions ----------
  const gcd = (x, y) => (y ? gcd(y, x % y) : Math.abs(x));
  function fr(n, d) { d = d || 1; if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; }
  const parse = (s) => { const [n, d] = String(s).split("/").map(Number); return fr(n, d || 1); };
  const add = (x, y) => fr(x.n * y.d + y.n * x.d, x.d * y.d);
  const sub = (x, y) => fr(x.n * y.d - y.n * x.d, x.d * y.d);
  const mul = (x, y) => fr(x.n * y.n, x.d * y.d);
  const div = (x, y) => fr(x.n * y.d, x.d * y.n);
  const I = (k) => fr(k, 1);
  const val = (x) => x.n / x.d;
  const SUP = { "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾" };
  function fs(x) { if (x.d === 1) return (x.n < 0 ? "−" : "") + Math.abs(x.n); const k = Math.abs(x.n) + "/" + x.d; return (x.n < 0 ? "−" : "") + (SUP[k] || k); }
  // "N/p": e.g. 6/p, 20/(3p)
  function overP(x) { return x.d === 1 ? `${x.n}/p` : `${x.n}/(${x.d}p)`; }
  // income expression e1·p + e2
  function inc(e1, e2) { const t = e1 === 0 ? "" : (e1 === 1 ? "p" : e1 + "p"); return t && e2 ? `${t} + ${e2}` : t || String(e2); }

  // ---------- small helpers ----------
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let x = hash(seed) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  function shuffle(arr, seed) { const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function newId() { return "p" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
  const num = (x) => { const r = Math.round(x * 100) / 100; return (r < 0 ? "−" : "") + String(Math.abs(r)); };

  // Options: the first is correct. Duplicates are removed; spare slots get nearby whole numbers.
  function opts(list, seed, numeric) {
    const seen = new Set(), out = [];
    for (const o of list) { if (!o || seen.has(o.label)) continue; seen.add(o.label); out.push(o); }
    if (numeric) {
      const base = list[0].v; let k = 1;
      while (out.length < 4 && k < 20) {
        for (const v of [base + k, base - k]) {
          const label = numeric(v);
          if (v > 0 && !seen.has(label) && out.length < 4) { seen.add(label); out.push({ v, label, tag: "other" }); }
        }
        k++;
      }
    }
    return shuffle(out.slice(0, 4).map((o, i) => Object.assign({ correct: i === 0, key: "o" + i }, o)), seed);
  }

  // ---------- the economy for one phone, with all the numbers ----------
  function econ(pid, round) {
    round = round || 0;
    const s = round === 0 ? LECT : SETS[(hash(pid + "w") + round - 1) % SETS.length];
    const a = parse(s.a), b = parse(s.b), [ax, ay] = s.eA, [bx, by] = s.eB;
    const X = ax + bx, Y = ay + by;
    // total demand for x: a(ax p + ay)/p + b(bx p + by)/p = (a·ay + b·by)/p + (a·ax + b·bx)
    const N = add(mul(a, I(ay)), mul(b, I(by))), C = add(mul(a, I(ax)), mul(b, I(bx)));
    const D = sub(I(X), C), p = div(N, D);
    const P = val(p), mA = P * ax + ay, mB = P * bx + by;
    const xA = val(a) * mA / P, yA = (1 - val(a)) * mA, xB = val(b) * mB / P, yB = (1 - val(b)) * mB;
    return { s, a, b, ax, ay, bx, by, X, Y, N, C, D, p, P, mA, mB, xA, yA, xB, yB };
  }
  const util = (sh, x, y) => Math.pow(x, sh) * Math.pow(y, 1 - sh);

  // ---------- the steps ----------
  function wSteps(pid, round) {
    round = round || 0; const sd = pid + "r" + round;
    const e = econ(pid, round), { a, b, ax, ay, bx, by, X, Y, N, C, D, P } = e;
    const A1 = 1 - val(a), B1 = 1 - val(b), a1 = fr(a.d - a.n, a.d), b1 = fr(b.d - b.n, b.d);
    const iA = inc(ax, ay), iB = inc(bx, by);
    const xAexpr = `${fs(a)}(${iA})/p`, xBexpr = `${fs(b)}(${iB})/p`;
    const intro = `<b>A</b>: u<sub>A</sub> = x<sup>${fs(a)}</sup>y<sup>${fs(a1)}</sup>, endowment ω<sub>A</sub> = (${ax}, ${ay}).<br>
      <b>B</b>: u<sub>B</sub> = x<sup>${fs(b)}</sup>y<sup>${fs(b1)}</sup>, endowment ω<sub>B</sub> = (${bx}, ${by}).<br>
      Prices: p<sub>x</sub> = p, p<sub>y</sub> = 1.`;
    const g = (x, y) => `(${num(x)}, ${num(y)})`;
    // wrong-share and other distractor values
    const zSw = (() => { const N2 = add(mul(a1, I(ay)), mul(b1, I(by))), C2 = add(mul(a1, I(ax)), mul(b1, I(bx))); return { N2, D2: sub(I(X), C2) }; })();
    const pSw = val(zSw.D2) > 0 ? val(div(zSw.N2, zSw.D2)) : null;
    const pInv = val(div(D, N));
    return [
      { id: "inc", title: "Incomes", intro, fact: `m<sub>A</sub> = ${iA}, m<sub>B</sub> = ${iB}`,
        q: "Income is the market value of the endowment. What are A's and B's incomes at prices (p, 1)?",
        hint: "Multiply each good the consumer owns by its price: m = p × (units of x) + 1 × (units of y).",
        options: opts([
          { label: `m<sub>A</sub> = ${iA}, m<sub>B</sub> = ${iB}`, tag: "ok" },
          { label: `m<sub>A</sub> = ${inc(ay, ax)}, m<sub>B</sub> = ${inc(by, bx)}`, tag: "price on the wrong good" },
          { label: `m<sub>A</sub> = ${ax + ay}, m<sub>B</sub> = ${bx + by}`, tag: "ignored the price" },
          { label: `m<sub>A</sub> = ${inc(ax, by)}, m<sub>B</sub> = ${inc(bx, ay)}`, tag: "mixed up the endowments" },
          { label: `m<sub>A</sub> = ${inc(ax, 0)}, m<sub>B</sub> = ${inc(bx, 0)}`, tag: "left out y" },
          { label: `m<sub>A</sub> = ${(ax + ay)}p, m<sub>B</sub> = ${(bx + by)}p`, tag: "priced everything at p" },
          { label: `m<sub>A</sub> = ${inc(ax, ay)} − p, m<sub>B</sub> = ${inc(bx, by)} − p`, tag: "other" }], sd + "1"),
        why: `m<sub>A</sub> = p × ${ax} + 1 × ${ay} = <b>${iA}</b> and m<sub>B</sub> = p × ${bx} + 1 × ${by} = <b>${iB}</b>. Income depends on the price, because the consumers earn it by selling what they own.`,
        tips: { "price on the wrong good": "p is the price of x, so it multiplies the units of x, the first number in the endowment.", "ignored the price": "Goods are worth their price: x is worth p each, y is worth 1 each." } },
      { id: "xA", title: "A's demand for x", fact: `x<sub>A</sub> = ${xAexpr}`,
        q: `What is A's Marshallian demand for x?`,
        hint: `Remember: with Cobb-Douglas utility u = x<sup>a</sup>y<sup>1−a</sup>, the Marshallian demands are x = a·m/p<sub>x</sub> and y = (1 − a)·m/p<sub>y</sub>. For A, a = ${fs(a)}, m<sub>A</sub> = ${iA} and p<sub>x</sub> = p, so you are looking for x<sub>A</sub> = a·m<sub>A</sub>/p.`,
        options: opts([
          { label: `x<sub>A</sub> = ${xAexpr}`, tag: "ok" },
          { label: `x<sub>A</sub> = ${fs(a1)}(${iA})/p`, tag: "wrong share" },
          { label: `x<sub>A</sub> = ${fs(a)}(${iA})`, tag: "forgot to divide by p" },
          { label: `x<sub>A</sub> = ${fs(a)}(${iA})·p`, tag: "multiplied by p" },
          { label: `x<sub>A</sub> = ${fs(a)}(${inc(ay, ax)})/p`, tag: "price on the wrong good" },
          { label: `x<sub>A</sub> = ${fs(a)}(${iB})/p`, tag: "used B's income" }], sd + "2"),
        why: `A spends ${fs(a)} of her income on x, and x costs p: x<sub>A</sub> = a·m<sub>A</sub>/p = <b>${xAexpr}</b>. (y gets the rest: y<sub>A</sub> = ${fs(a1)}(${iA}).)`,
        tips: { "wrong share": `That is the share spent on y (1 − a = ${fs(a1)}). The exponent on x is ${fs(a)}.`, "forgot to divide by p": "That is spending on x in £. To get units, divide by the price p." } },
      { id: "xB", title: "B's demand for x", fact: `x<sub>B</sub> = ${xBexpr}`,
        q: "Now B. What is B's Marshallian demand for x?",
        hint: `Remember: with Cobb-Douglas utility u = x<sup>b</sup>y<sup>1−b</sup>, the Marshallian demand for x is x = b·m/p<sub>x</sub>. For B, b = ${fs(b)} (the exponent on x in u<sub>B</sub>), m<sub>B</sub> = ${iB} and p<sub>x</sub> = p, so you are looking for x<sub>B</sub> = b·m<sub>B</sub>/p.`,
        options: opts([
          { label: `x<sub>B</sub> = ${xBexpr}`, tag: "ok" },
          { label: `x<sub>B</sub> = ${fs(b1)}(${iB})/p`, tag: "wrong share" },
          { label: `x<sub>B</sub> = ${fs(a)}(${iB})/p`, tag: "used A's share" },
          { label: `x<sub>B</sub> = ${fs(b)}(${iA})/p`, tag: "used A's income" },
          { label: `x<sub>B</sub> = ${fs(b)}(${iB})`, tag: "forgot to divide by p" },
          { label: `x<sub>B</sub> = ${fs(b)}(${inc(by, bx)})/p`, tag: "price on the wrong good" }], sd + "3"),
        why: `x<sub>B</sub> = b·m<sub>B</sub>/p = <b>${xBexpr}</b>.`,
        tips: { "wrong share": `That is B's share on y (${fs(b1)}).`, "used A's share": "Each consumer has her own share: use the exponent in u<sub>B</sub>.", "used A's income": "B spends B's own income, the value of B's endowment." } },
      { id: "z", title: "Excess demand for x", fact: `z<sub>x</sub>(p) = ${overP(N)} − ${fs(D)}`,
        q: `Excess demand is total demand minus what exists: z<sub>x</sub>(p) = x<sub>A</sub> + x<sub>B</sub> − ${X}. Simplified, what is it?`,
        hint: `Split each demand: ${fs(a)}(${iA})/p = ${fs(mul(a, I(ax)))} + ${overP(mul(a, I(ay)))}. Add the two demands, then subtract the ${X} units of x that exist (${ax} + ${bx}).`,
        options: opts([
          { label: `z<sub>x</sub>(p) = ${overP(N)} − ${fs(D)}`, tag: "ok" },
          { label: `z<sub>x</sub>(p) = ${overP(N)} + ${fs(C)}`, tag: "forgot to subtract the endowment" },
          { label: `z<sub>x</sub>(p) = ${overP(N)} + ${fs(C)} − ${Y}`, tag: "subtracted the total of y" },
          val(zSw.D2) !== 0 ? { label: `z<sub>x</sub>(p) = ${overP(zSw.N2)} ${val(zSw.D2) >= 0 ? "−" : "+"} ${fs(fr(Math.abs(zSw.D2.n), zSw.D2.d))}`, tag: "wrong share" } : null,
          { label: `z<sub>x</sub>(p) = ${overP(N)} − ${X}`, tag: "dropped part of demand" },
          { label: `z<sub>x</sub>(p) = ${fs(D)} − ${overP(N)}`, tag: "sign" }], sd + "4"),
        why: `x<sub>A</sub> + x<sub>B</sub> = ${fs(C)} + ${overP(N)}. Subtract the ${X} units that exist: z<sub>x</sub> = ${overP(N)} + ${fs(C)} − ${X} = <b>${overP(N)} − ${fs(D)}</b>.`,
        tips: { "forgot to subtract the endowment": `That is total demand. Excess demand subtracts the ${X} units of x that exist.`, "subtracted the total of y": `This is the market for x: subtract the total amount of x, ${X}.` } },
      { id: "p", title: "The equilibrium price", fact: `Equilibrium price p* = ${fs(e.p)}`,
        q: `The market for x clears when z<sub>x</sub>(p) = 0: ${overP(N)} = ${fs(D)}. What is p*?`,
        hint: `Multiply both sides by p, then divide: p = (${fs(N)}) ÷ (${fs(D)}).`,
        options: opts([
          { v: P, label: "p* = " + num(P), tag: "ok" },
          { v: pInv, label: "p* = " + fs(div(D, N)), tag: "inverted" },
          pSw && pSw > 0 && Math.abs(pSw - P) > 1e-9 ? { v: pSw, label: "p* = " + num(pSw), tag: "wrong share" } : null,
          { v: 1, label: "p* = 1", tag: "set p = 1" }], sd + "5", (v) => "p* = " + num(v)),
        why: `${overP(N)} = ${fs(D)} gives p = ${fs(N)} ÷ ${fs(D)} = <b>${num(P)}</b>. One unit of x costs ${num(P)} units of y. By Walras' law, the market for y clears too.`,
        tips: { "inverted": "Check: at your answer, is z<sub>x</sub> = 0? Solve N/p = D for p: p = N/D.", "set p = 1": "p<sub>y</sub> = 1 is the normalisation. p = p<sub>x</sub> must be found from market clearing." } },
      { id: "A", title: "A's bundle", fact: `A consumes ${g(e.xA, e.yA)}`,
        q: `At p* = ${num(P)}, A's income is ${num(e.mA)}. What bundle (x<sub>A</sub>, y<sub>A</sub>) does A consume?`,
        hint: `x<sub>A</sub> = ${fs(a)} × ${num(e.mA)} / ${num(P)}; y<sub>A</sub> = ${fs(a1)} × ${num(e.mA)} (y costs 1).`,
        options: opts([
          { label: `A: ${g(e.xA, e.yA)}`, tag: "ok" },
          { label: `A: ${g(e.yA, e.xA)}`, tag: "swapped x and y" },
          { label: `A: ${g(ax, ay)}`, tag: "no trade (endowment)" },
          { label: `A: ${g(A1 * e.mA / P, val(a) * e.mA)}`, tag: "wrong share" },
          { label: `A: ${g(val(a) * e.mA, A1 * e.mA)}`, tag: "forgot to divide by p" },
          { label: `A: ${g(val(a) * (ax + ay), A1 * (ax + ay))}`, tag: "used p = 1" },
          { label: `A: ${g(e.xB, e.yB)}`, tag: "gave B's bundle" }], sd + "6"),
        why: `m<sub>A</sub> = ${num(P)} × ${ax} + ${ay} = ${num(e.mA)}. x<sub>A</sub> = ${fs(a)} × ${num(e.mA)} / ${num(P)} = <b>${num(e.xA)}</b>; y<sub>A</sub> = ${fs(a1)} × ${num(e.mA)} = <b>${num(e.yA)}</b>. A ${e.xA > ax ? "buys" : "sells"} ${num(Math.abs(e.xA - ax))} of x.`,
        tips: { "no trade (endowment)": "That is what A starts with. At p* she trades to her best bundle on the budget line." } },
      { id: "B", title: "B's bundle and market clearing", fact: `B consumes ${g(e.xB, e.yB)}; both markets clear`,
        q: `B's income at p* is ${num(e.mB)}. What does B consume? (Check: the two bundles must add up to (${X}, ${Y}).)`,
        hint: `x<sub>B</sub> = ${fs(b)} × ${num(e.mB)} / ${num(P)}; y<sub>B</sub> = ${fs(b1)} × ${num(e.mB)}. Or: whatever A does not take.`,
        options: opts([
          { label: `B: ${g(e.xB, e.yB)}`, tag: "ok" },
          { label: `B: ${g(bx, by)}`, tag: "no trade (endowment)" },
          { label: `B: ${g(e.yB, e.xB)}`, tag: "swapped x and y" },
          { label: `B: ${g(B1 * e.mB / P, val(b) * e.mB)}`, tag: "wrong share" },
          { label: `B: ${g(val(b) * e.mB, B1 * e.mB)}`, tag: "forgot to divide by p" },
          { label: `B: ${g(val(b) * (bx + by), B1 * (bx + by))}`, tag: "used p = 1" },
          { label: `B: ${g(e.xA, e.yA)}`, tag: "gave A's bundle" }], sd + "7"),
        why: `x<sub>B</sub> = ${fs(b)} × ${num(e.mB)} / ${num(P)} = <b>${num(e.xB)}</b>; y<sub>B</sub> = ${fs(b1)} × ${num(e.mB)} = <b>${num(e.yB)}</b>. Check: x: ${num(e.xA)} + ${num(e.xB)} = ${X}; y: ${num(e.yA)} + ${num(e.yB)} = ${Y}. Both markets clear: a Walrasian equilibrium.`,
        tips: { "no trade (endowment)": "That is B's endowment. At p* B trades too: what A buys, B sells." } }
    ];
  }

  function bSteps(pid, round) {
    round = round || 0; const sd = pid + "r" + round;
    const e = econ(pid, round), { a, b, P } = e, a1 = fr(a.d - a.n, a.d);
    const mrsA = val(a) / (1 - val(a)) * e.yA / e.xA;
    return [
      { id: "mrs", title: "Bonus: the MRS at the equilibrium", intro: `Equilibrium: p* = ${num(P)}; A consumes (${num(e.xA)}, ${num(e.yA)}), B consumes (${num(e.xB)}, ${num(e.yB)}).`,
        fact: `MRS<sub>A</sub> = MRS<sub>B</sub> = ${num(P)} = p*`,
        q: `For u = x<sup>a</sup>y<sup>1−a</sup>, MRS = (a/(1−a))·(y/x). What is A's MRS at her equilibrium bundle?`,
        hint: `a/(1 − a) = ${fs(a)} ÷ ${fs(a1)}; y/x = ${num(e.yA)}/${num(e.xA)}.`,
        options: opts([
          { v: mrsA, label: "MRS<sub>A</sub> = " + num(mrsA), tag: "ok" },
          { v: e.yA / e.xA, label: "MRS<sub>A</sub> = " + num(e.yA / e.xA), tag: "forgot a/(1−a)" },
          { v: e.xA / e.yA, label: "MRS<sub>A</sub> = " + num(e.xA / e.yA), tag: "inverted" },
          { v: 1 / P, label: "MRS<sub>A</sub> = " + fs(fr(1, P)), tag: "inverted" },
          { v: val(a), label: "MRS<sub>A</sub> = " + fs(a), tag: "gave the share" }], sd + "8", (v) => "MRS<sub>A</sub> = " + num(v)),
        why: `MRS<sub>A</sub> = (${fs(a)}/${fs(a1)}) × ${num(e.yA)}/${num(e.xA)} = <b>${num(mrsA)}</b> = p*. Every consumer sets MRS = price ratio, so MRS<sub>B</sub> = ${num(P)} too.` },
      { id: "fwt", title: "Bonus: what does this show?",
        q: `MRS<sub>A</sub> = MRS<sub>B</sub> = p* = ${num(P)} at the equilibrium. What does this tell us?`,
        hint: "Think about the contract curve: where are the two indifference curves tangent?",
        options: opts([
          { label: "The allocation is Pareto efficient: it is on the contract curve (First Welfare Theorem)", tag: "ok" },
          { label: "The allocation is fair: both consumers end up equally well off", tag: "efficient = fair" },
          { label: "Both consumers end up with the same bundle", tag: "same bundle" },
          { label: "It shows Walras' law: the value of excess demand is zero", tag: "Walras' law" }], sd + "9"),
        why: "Equal MRSs mean the indifference curves are tangent: no trade can make one better off without hurting the other. The equilibrium is <b>Pareto efficient</b>, as the First Welfare Theorem says. Efficient is not the same as fair: that depends on the endowments.",
        tips: { "efficient = fair": "Pareto efficiency says nothing about fairness: giving everything to one person is efficient too.", "Walras' law": "Walras' law holds at every price, not only in equilibrium. Equal MRSs are about efficiency." } }
    ];
  }

  const EX = [
    { key: "w", title: "Walrasian equilibrium", steps: wSteps },
    { key: "b", title: "Bonus: efficiency", steps: bSteps }
  ];
  const STEP_LABELS = {
    w: ["Incomes", "A's demand", "B's demand", "Excess demand", "p*", "A's bundle", "B's bundle"],
    b: ["MRS", "Efficiency"]
  };

  return { SETS, LECT, EX, STEP_LABELS, econ, util, wSteps, bSteps, newId, mean, hash, num };
})();
