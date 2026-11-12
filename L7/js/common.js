// Week 7: "Be the market" – a Walrasian auctioneer game.
// Every phone is a trader in a two-good exchange economy (apples and bread). The lecturer is the auctioneer:
// she posts a price for apples (bread is the numeraire, £1 a loaf), each trader chooses what to buy and sell
// at that price, and the dashboard adds up excess demand. The price moves until the apple market clears.
// Shared by the student page and the dashboard.
window.BL = (function () {
  // ---------- The two types of trader ----------
  // Utility u = x^a · y^(1−a): the trader spends the share a of her income on apples.
  // Income m = p·wx + wy (the value of what she owns at today's prices).
  // With equal numbers of each type the equilibrium price is p* = 3:
  //   Bakers end with 2 apples and 6 loaves; Orchard owners with 1 apple and 6 loaves.
  // (Different numbers from the lecture example, where p* = 2.)
  const TYPES = {
    A: { key: "A", name: "Baker", icon: "🍞", a: 1 / 2, wx: 0, wy: 12, color: "#3333b3",
         likes: "You like apples and bread <b>equally</b>.",
         owns: "You own <b>12 loaves</b> of bread and <b>no apples</b>." },
    B: { key: "B", name: "Orchard owner", icon: "🍎", a: 1 / 3, wx: 3, wy: 0, color: "#d9711f",
         likes: "You like bread <b>twice as much</b> as apples.",
         owns: "You own <b>3 apples</b> and <b>no bread</b>." }
  };
  const START_PRICE = 1;          // suggested opening price (far too low: big excess demand for apples)
  const STEP = 0.1;               // slider step for apples

  // ---------- small helpers ----------
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function newId() { return "p" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  const num = (x, d) => { const k = Math.pow(10, d === undefined ? 2 : d), r = Math.round(x * k) / k; return (r < 0 ? "−" : "") + String(Math.abs(r)); };
  const money = (x) => "£" + (Math.round(x * 100) / 100).toFixed(2);
  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }

  // Type from the phone's id: about half of each.
  function typeOf(pid) { return hash(pid + "t") % 2 ? TYPES.A : TYPES.B; }
  const income = (t, p) => p * t.wx + t.wy;
  const utility = (t, x, y) => (x <= 0 || y <= 0 ? 0 : Math.pow(x, t.a) * Math.pow(y, 1 - t.a));
  // Best bundle at price p (Cobb–Douglas): x = a·m/p, y = (1−a)·m.
  function best(t, p) { const m = income(t, p); return { x: (t.a * m) / p, y: (1 - t.a) * m, m }; }
  // "Happiness points" shown on the phone: utility × 10, one decimal.
  const points = (t, x, y) => Math.round(10 * utility(t, x, y) * 10) / 10;

  // Equilibrium price for a class with nA Bakers and nB Orchard owners:
  // Σ a·(p·wx + wy)/p = Σ wx  ⇒  p* = Σ a·wy / Σ (1 − a)·wx.
  function eqPrice(nA, nB) {
    const A = TYPES.A, B = TYPES.B;
    const top = nA * A.a * A.wy + nB * B.a * B.wy, bot = nA * (1 - A.a) * A.wx + nB * (1 - B.a) * B.wx;
    return bot > 0 ? top / bot : null;
  }
  // Excess demand for apples if every trader chose her best bundle at p.
  function theoryZ(nA, nB, p) {
    const A = TYPES.A, B = TYPES.B;
    return nA * (best(A, p).x - A.wx) + nB * (best(B, p).x - B.wx);
  }

  return { TYPES, START_PRICE, STEP, hash, newId, num, money, mean, typeOf, income, utility, best, points, eqPrice, theoryZ };
})();
