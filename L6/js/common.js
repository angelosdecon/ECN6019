// Week 6: "Monopoly workout" – a self-paced exercise on the phone, with feedback after each step.
// Shared by the student page and the dashboard.
window.BL = (function () {
  // ---------- Exercise 1: a monopoly. Demand P = a − bQ, constant MC = AC = c. ----------
  // Every set gives whole numbers, and the elasticity at the monopoly point is a simple number.
  // (P = 100 − 2Q, MC = 20 is the lecture's worked example, so it is not used here.)
  const MONO = [
    { a: 60, b: 1, c: 20 }, { a: 80, b: 1, c: 40 }, { a: 100, b: 1, c: 60 }, { a: 60, b: 2, c: 20 },
    { a: 80, b: 2, c: 40 }, { a: 120, b: 1, c: 40 }, { a: 90, b: 1, c: 30 }, { a: 120, b: 2, c: 60 },
    { a: 90, b: 2, c: 30 }, { a: 50, b: 1, c: 10 }, { a: 120, b: 1, c: 80 }, { a: 60, b: 1, c: 12 },
    { a: 40, b: 1, c: 20 }, { a: 150, b: 2, c: 50 }, { a: 120, b: 1, c: 60 }, { a: 160, b: 2, c: 80 }
  ];
  // ---------- Exercise 2 (bonus): long-run equilibrium. C(q) = q³ − 2h q² + (h² + m) q, demand Q = A − P. ----------
  // AC = q² − 2h q + h² + m has its minimum m at q = h.
  const LR = [
    { h: 3, m: 12, A: 162 }, { h: 4, m: 10, A: 130 }, { h: 2, m: 15, A: 95 }, { h: 5, m: 20, A: 170 },
    { h: 3, m: 20, A: 140 }, { h: 4, m: 15, A: 135 }, { h: 2, m: 10, A: 90 }, { h: 5, m: 12, A: 112 }
  ];

  // ---------- small helpers ----------
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let x = hash(seed) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  function shuffle(arr, seed) { const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const num = (x) => { const r = Math.round(x * 100) / 100; return (r < 0 ? "−" : "") + String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); };
  const lin = (a, k, v) => `${a} − ${k === 1 ? "" : num(k)}${v || "Q"}`;
  function newId() { return "p" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }

  // Options: the first is correct. Duplicates are removed; spare slots get nearby numbers.
  function opts(list, seed, numeric) {
    const seen = new Set(), out = [];
    for (const o of list) { if (seen.has(o.label)) continue; seen.add(o.label); out.push(o); }
    if (numeric) {
      const base = list[0].v; let k = 1;
      while (out.length < 4 && k < 20) {
        for (const v of [base + k * Math.max(1, Math.round(base / 10)), base - k * Math.max(1, Math.round(base / 10))]) {
          const label = numeric(v);
          if (v > 0 && !seen.has(label) && out.length < 4) { seen.add(label); out.push({ v, label, tag: "other" }); }
        }
        k++;
      }
    }
    return shuffle(out.slice(0, 4).map((o, i) => Object.assign({ correct: i === 0, key: "o" + i }, o)), seed);
  }

  // ---------- the steps ----------
  function monoSet(pid) { return MONO[hash(pid + "m") % MONO.length]; }
  function monoSteps(pid) {
    const { a, b, c } = monoSet(pid);
    const Q = (a - c) / (2 * b), P = (a + c) / 2, Qc = (a - c) / b, pi = (P - c) * Q, dwl = 0.5 * (P - c) * (Qc - Q);
    const e = -P / (P - c), g = (v) => "£" + num(v);
    const intro = `Demand: <b>P = ${lin(a, b)}</b>. Marginal cost is constant: <b>MC = AC = ${c}</b> (no fixed cost).`;
    return [
      { id: "mr", title: "Marginal revenue", intro,
        q: "Revenue is R = P·Q = (" + lin(a, b) + ")Q. What is marginal revenue?",
        options: opts([
          { label: "MR = " + lin(a, 2 * b), tag: "ok" },
          { label: "MR = " + lin(a, b), tag: "mr=demand" },
          { label: "MR = " + lin(a / 2, b), tag: "halved intercept" },
          { label: "MR = " + lin(a, 4 * b), tag: "slope ×4" }], pid + "s1"),
        why: `R = ${a}Q − ${b === 1 ? "" : b}Q², so MR = dR/dQ = ${lin(a, 2 * b)}. With linear demand, MR has the same intercept and <b>twice the slope</b>.`,
        tips: { "mr=demand": "That is the demand curve. Selling one more unit lowers the price on all units, so MR lies below demand." } },
      { id: "q", title: "Output",
        q: "The monopoly sets MR = MC. How much does it produce?",
        options: opts([
          { v: Q, label: "Q = " + num(Q), tag: "ok" },
          { v: Qc, label: "Q = " + num(Qc), tag: "P=MC (competitive Q)" },
          { v: a / (2 * b), label: "Q = " + num(a / (2 * b)), tag: "MR=0 (ignored cost)" },
          { v: Q / 2, label: "Q = " + num(Q / 2), tag: "slope ×4" }], pid + "s2", (v) => "Q = " + num(v)),
        why: `${lin(a, 2 * b)} = ${c} gives Q = (${a} − ${c}) / ${2 * b} = <b>${num(Q)}</b>.`,
        tips: { "P=MC (competitive Q)": "That is where P = MC: the competitive output. A monopoly stops where MR = MC, earlier.", "MR=0 (ignored cost)": "That is where MR = 0 (maximum revenue). Profit also counts cost: MR = MC." } },
      { id: "p", title: "Price",
        q: `At Q = ${num(Q)}, what price does the monopoly charge?`,
        options: opts([
          { v: P, label: g(P), tag: "ok" },
          { v: c, label: g(c), tag: "price=MC" },
          { v: a / 2, label: g(a / 2), tag: "revenue-max price" },
          { v: P - c, label: g(P - c), tag: "markup only" }], pid + "s3", g),
        why: `Read the price off the <b>demand</b> curve: P = ${a} − ${b === 1 ? "" : b + "×"}${num(Q)} = <b>${g(P)}</b>, well above MC = ${c}.`,
        tips: { "price=MC": "MC is the cost of the last unit. The monopoly charges what buyers will pay: read P off the demand curve." } },
      { id: "pi", title: "Profit",
        q: "What is the monopoly's profit?",
        options: opts([
          { v: pi, label: g(pi), tag: "ok" },
          { v: P * Q, label: g(P * Q), tag: "revenue (forgot cost)" },
          { v: pi / 2, label: g(pi / 2), tag: "triangle (½)" },
          { v: (P - c) * Qc, label: g((P - c) * Qc), tag: "used competitive Q" }], pid + "s4", g),
        why: `Profit = (P − AC) × Q = (${P} − ${c}) × ${num(Q)} = <b>${g(pi)}</b>: a rectangle, not a triangle.`,
        tips: { "revenue (forgot cost)": "That is revenue P × Q. Profit subtracts cost: (P − AC) × Q." } },
      { id: "dwl", title: "Deadweight loss",
        q: `A competitive industry would produce where P = MC, at Q = ${num(Qc)}. What is the deadweight loss of monopoly?`,
        options: opts([
          { v: dwl, label: g(dwl), tag: "ok" },
          { v: 2 * dwl, label: g(2 * dwl), tag: "forgot ½" },
          { v: 4 * dwl, label: g(4 * dwl), tag: "whole competitive surplus" },
          { v: dwl / 2, label: g(dwl / 2), tag: "halved twice" }], pid + "s5", g),
        why: `A triangle between demand and MC, from Q = ${num(Q)} to ${num(Qc)}: ½ × (${P} − ${c}) × (${num(Qc)} − ${num(Q)}) = <b>${g(dwl)}</b>.`,
        tips: { "forgot ½": "Close: the deadweight loss is a triangle, so multiply by ½.", "whole competitive surplus": "That is all of the competitive surplus. Only the triangle between Q_m and Q_c is lost." } },
      { id: "e", title: "The markup and elasticity",
        q: `The markup is (P − MC)/P = (${P} − ${c})/${P}. Using the inverse elasticity rule (P − MC)/P = −1/e, what is the price elasticity of demand e at this point?`,
        options: opts([
          { label: "e = " + num(e), tag: "ok" },
          { label: "e = " + num(1 / e), tag: "inverted" },
          { label: "e = " + num(-e), tag: "sign" },
          { label: "e = −1", tag: "unit elastic" }], pid + "s6"),
        why: `−1/e = ${num((P - c) / P)}, so e = <b>${num(e)}</b>. |e| > 1: a monopoly always produces where demand is <b>elastic</b>, because there MR > 0.`,
        tips: { "unit elastic": "e = −1 is where MR = 0. Here MR = MC > 0, so demand must be elastic: |e| > 1.", "sign": "Demand slopes down, so the elasticity is negative." } }
    ];
  }

  function lrSet(pid) { return LR[hash(pid + "l") % LR.length]; }
  function lrSteps(pid) {
    const { h, m, A } = lrSet(pid), k = h * h + m, Q = A - m, n = Q / h, g = (v) => "£" + num(v);
    const intro = `Identical firms, free entry, constant input prices. Each firm's long-run cost: <b>C(q) = q³ − ${2 * h}q² + ${k}q</b>. Market demand: <b>Q = ${A} − P</b>.`;
    return [
      { id: "ac", title: "Average cost", intro,
        q: "What is the firm's average cost AC = C/q?",
        options: opts([
          { label: `AC = q² − ${2 * h}q + ${k}`, tag: "ok" },
          { label: `AC = 3q² − ${4 * h}q + ${k}`, tag: "that's MC" },
          { label: `AC = q² − ${2 * h}q`, tag: "dropped a term" },
          { label: `AC = q³ − ${2 * h}q² + ${k}`, tag: "divided one term" }], pid + "l1"),
        why: `Divide every term by q: AC = <b>q² − ${2 * h}q + ${k}</b>.`,
        tips: { "that's MC": "That is the derivative dC/dq = MC. Average cost divides by q." } },
      { id: "qstar", title: "Efficient scale",
        q: "At what output q* is AC at its minimum?",
        options: opts([
          { v: h, label: "q* = " + h, tag: "ok" },
          { v: 2 * h, label: "q* = " + 2 * h, tag: "forgot to halve" },
          { v: h * h, label: "q* = " + h * h, tag: "squared" },
          { v: h + 1, label: "q* = " + (h + 1), tag: "other" }], pid + "l2", (v) => "q* = " + v),
        why: `dAC/dq = 2q − ${2 * h} = 0 gives <b>q* = ${h}</b>.` },
      { id: "plr", title: "Long-run price",
        q: "What is the long-run equilibrium price?",
        options: opts([
          { v: m, label: g(m), tag: "ok" },
          { v: k, label: g(k), tag: "AC at q = 0" },
          { v: m + h, label: g(m + h), tag: "other" },
          { v: 0, label: g(0), tag: "zero profit ≠ zero price" }], pid + "l3", g),
        why: `Free entry drives profit to zero: P = min AC = AC(${h}) = ${h * h} − ${2 * h * h} + ${k} = <b>${g(m)}</b>.`,
        tips: { "zero profit ≠ zero price": "Zero profit means P = AC, not P = 0." } },
      { id: "n", title: "Number of firms",
        q: "How many firms are there in the long run?",
        options: opts([
          { v: n, label: String(n), tag: "ok" },
          { v: A / h, label: num(A / h), tag: "used A, not Q" },
          { v: Q, label: String(Q), tag: "forgot ÷ q*" },
          { v: n / 2, label: num(n / 2), tag: "other" }], pid + "l4", (v) => num(v)),
        why: `Market output Q = ${A} − ${m} = ${Q}; each firm makes q* = ${h}, so n = ${Q} / ${h} = <b>${n}</b>.`,
        tips: { "used A, not Q": `First find market output at the long-run price: Q = ${A} − ${m}.` } }
    ];
  }

  const EX = [
    { key: "m", title: "Monopoly", steps: monoSteps },
    { key: "l", title: "Bonus: long-run equilibrium", steps: lrSteps }
  ];
  const STEP_LABELS = {
    m: ["MR", "Output", "Price", "Profit", "DWL", "Elasticity"],
    l: ["AC", "q*", "LR price", "Firms"]
  };

  return { MONO, LR, EX, STEP_LABELS, monoSteps, lrSteps, monoSet, lrSet, newId, mean, hash, num };
})();
