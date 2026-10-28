// Week 5 game: "Run your own stall" (price-taking firms, p = MC, shutdown, market price).
// Rules and parameters shared by the student page and the dashboard.
window.BL = (function () {
  // Four kinds of stall. Cost of q trays in a day: C(q) = rent + c*q + q^2.
  // The extra cost of the k-th tray is c - 1 + 2k (odd numbers, so it never equals an even price).
  // Rents are chosen so every stall breaks even at a price of £12 (minimum average cost = 12).
  const TYPES = [
    { key: "tea",     food: "Bubble tea", icon: "🧋", rent: 25, c: 2, colour: "#2f7fd1" },
    { key: "bao",     food: "Bao buns",   icon: "🥟", rent: 16, c: 4, colour: "#2e9e5b" },
    { key: "falafel", food: "Falafel",    icon: "🧆", rent: 9,  c: 6, colour: "#e8833a" },
    { key: "churros", food: "Churros",    icon: "🍩", rent: 4,  c: 8, colour: "#d1477a" }
  ];
  const MAXQ = 10;          // at most 10 trays a day
  const CHOOSE_SECS = 35;

  // The rounds. price: fixed market price (the stall is a price-taker).
  // market: price set by the class's total output, P = a - Q/N (N = stalls that chose).
  const ROUNDS = [
    { n: 1, title: "A normal day",       price: 14, rentMult: 1, note: "Each tray sells for £14." },
    { n: 2, title: "The council doubles your rent", price: 14, rentMult: 2, note: "Rent is doubled today. Trays still sell for £14." },
    { n: 3, title: "A rainy day",        price: 6,  rentMult: 1, note: "Few customers: trays sell for only £6. Rent is paid whether you open or not." },
    { n: 4, title: "Market day",         market: { a: 17 }, rentMult: 1, note: "The price now depends on how much ALL stalls bring: more trays, lower price." },
    { n: 5, title: "Market day",         market: { a: 17 }, rentMult: 1, note: "Same market as yesterday." },
    { n: 6, title: "Heatwave!",          market: { a: 25 }, rentMult: 1, note: "Crowds in the square: demand is much higher today. The price still depends on what everyone brings." }
  ];

  const type = (k) => TYPES.find((t) => t.key === k) || TYPES[0];
  const extraCost = (t, k) => t.c - 1 + 2 * k;                         // cost of the k-th tray
  const varCost = (t, q) => t.c * q + q * q;
  const cost = (t, q, rentMult) => t.rent * (rentMult || 1) + varCost(t, q);
  // Profit: if you close (0 trays) you still pay the rent.
  const profit = (t, q, p, rentMult) => p * q - cost(t, q, rentMult);
  // Best output at price p: keep adding trays while the extra cost is at most the price.
  const bestQ = (t, p) => Math.max(0, Math.min(MAXQ, Math.floor((p - t.c + 1) / 2)));
  const marketPrice = (a, Q, N) => Math.max(0, N ? a - Q / N : a);

  // Each phone gets a stall type and a stall name from its id (same on phone and dashboard).
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const ADJ = ["Golden", "Lucky", "Happy", "Spicy", "Sunny", "Royal", "Cosmic", "Tiny", "Mighty", "Jolly", "Crispy", "Fancy", "Speedy", "Brave", "Sleepy", "Funky"];
  function typeOf(pid) { return TYPES[hash(pid) % TYPES.length]; }
  function nameOf(pid) { const h = hash(pid + "n"); return ADJ[h % ADJ.length] + " " + typeOf(pid).food + " #" + (10 + (h >>> 4) % 90); }

  function newId() { return "p" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function fmt(x, d) { return (Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toString(); }
  const pounds = (x) => { const r = Math.round(Math.abs(x) * 100) / 100; return Number.isInteger(r) ? String(r) : r.toFixed(2); };
  const money = (x) => (x < -0.004 ? "−£" : "£") + pounds(x);
  const gbp = (x) => "£" + pounds(x);
  // Price shown as "yesterday's price" before a market day: the last market day, or a normal day's price.
  function hintPrice(n, priceOfRound) {
    for (let k = n - 1; k >= 1; k--) if (ROUNDS[k - 1].market) { const p = priceOfRound(k); if (p != null) return p; }
    return ROUNDS[0].price;
  }
  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
  function clampInt(v, lo, hi) { v = Math.round(Number(v) || 0); return Math.max(lo, Math.min(hi, v)); }

  return { TYPES, MAXQ, CHOOSE_SECS, ROUNDS, type, extraCost, varCost, cost, profit, bestQ, marketPrice, typeOf, nameOf, newId, fmt, money, gbp, hintPrice, mean, clampInt };
})();
