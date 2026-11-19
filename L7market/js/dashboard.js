// Week 7 dashboard: "Be the market". The lecturer is the auctioneer: post a price, open a round,
// watch the orders come in, close the round, read off excess demand, and move the price.
(function () {
  const S = window.Store, B = window.BL, cfg = window.BIASLAB_CONFIG || {};
  const stage = document.getElementById("stage");
  const $ = (id) => document.getElementById(id);
  $("modname").textContent = cfg.moduleName || "";
  if (S.demo) { $("demoflag").innerHTML = '<span class="demo-flag">DEMO MODE – this computer only</span>'; $("bots").classList.remove("hidden"); }

  // ---------- passcode gate ----------
  const GATE = "ecn-ok-" + S.root;
  if (cfg.passcode && sessionStorage.getItem(GATE) !== "1") {
    document.querySelector("main").innerHTML = `<div class="gate"><h2>Dashboard</h2><div class="rule" style="margin:8px auto 14px"></div>
      <p class="muted">Enter the passcode.</p><input id="pc" type="password" autofocus><button class="primary full" id="go">Open</button>
      <p class="small muted">Students: you need <a href="index.html">the student page</a>.</p></div>`;
    $("controls").style.display = "none";
    const go = () => { if ($("pc").value === cfg.passcode) { sessionStorage.setItem(GATE, "1"); location.reload(); } else $("pc").value = ""; };
    $("go").onclick = go; $("pc").onkeydown = (e) => { if (e.key === "Enter") go(); };
    return;
  }

  const D = { state: null, tr: [] };
  let charts = {}, mountedKey = null;
  S.onDoc("", (d) => { D.state = d; if (!d || !d.lobby) initSession(); render(); });
  S.onCol("tr", (a) => { D.tr = a; render(); });

  const lobby = () => (D.state && D.state.lobby) || null;
  const here = () => D.tr.filter((a) => a.data.lobby === lobby());
  const counts = (list) => ({ nA: list.filter((a) => a.data.type === "A").length, nB: list.filter((a) => a.data.type === "B").length });
  const rk = (r) => "r" + r;

  async function initSession() {
    if (initSession.done) return; initSession.done = true;
    const cur = await S.getDoc("");
    if (!cur || !cur.lobby) await S.setDoc("", newState());
  }
  const newState = () => ({ lobby: "L" + Date.now().toString(36), phase: "lobby", round: 0, price: B.START_PRICE, open: false, hist: [], eq: null });

  // ---------- one round's orders ----------
  function roundStats(r) {
    const orders = here().map((a) => ({ type: a.data.type, o: a.data.r && a.data.r[rk(r)] })).filter((a) => a.o);
    const T = B.TYPES;
    let want = 0, avail = 0, bread = 0, breadHave = 0;
    for (const a of orders) { const t = T[a.type]; want += a.o.x; avail += t.wx; bread += a.o.y; breadHave += t.wy; }
    const c = { nA: orders.filter((a) => a.type === "A").length, nB: orders.filter((a) => a.type === "B").length };
    return { n: orders.length, want, avail, zx: want - avail, zy: bread - breadHave, ...c };
  }
  // Suggested next price: scale the price by apples wanted / apples available (the auctioneer's rule).
  function suggest(p, h) {
    if (!h || !h.avail || !h.want) return p;
    return Math.max(0.1, Math.round(10 * p * (h.want / h.avail)) / 10);
  }

  // ---------- controls ----------
  $("open").onclick = async () => {
    if (!D.state) return;
    const p = Number($("price").value);
    if (!(p > 0)) { alert("Enter a positive price."); return; }
    const r = (D.state.round || 0) + (D.state.open ? 0 : 1);
    await S.setDoc("", { lobby: lobby(), phase: "round", round: r, price: Math.round(p * 100) / 100, open: true }, true);
  };
  $("close").onclick = async () => {
    const s = D.state; if (!s || s.phase !== "round" || !s.open) return;
    const st = roundStats(s.round), hist = (s.hist || []).filter((e) => e.r !== s.round);
    hist.push({ r: s.round, p: s.price, ...st });
    await S.setDoc("", { open: false, hist }, true);
    $("price").value = suggest(s.price, st);
  };
  $("reveal").onclick = async () => {
    const s = D.state; if (!s) return;
    const c = counts(here()), p = B.eqPrice(c.nA, c.nB);
    if (!p) { alert("Need at least one trader of each type."); return; }
    await S.setDoc("", { phase: "reveal", open: false, eq: { p: Math.round(p * 100) / 100, nA: c.nA, nB: c.nB } }, true);
  };
  $("lobbyBtn").onclick = () => S.setDoc("", { phase: "lobby", open: false }, true);
  $("newSession").onclick = async () => {
    if (!confirm("Start a new session? Everyone's phone re-joins automatically; earlier orders are kept out of the results.")) return;
    await S.setDoc("", newState());
    $("price").value = B.START_PRICE;
  };
  $("bots").onclick = addBots;

  // ---------- render ----------
  const BLUE = "#3333b3", ORANGE = "#e8833a";
  Chart.defaults.font.family = '"Helvetica Neue", Arial, sans-serif'; Chart.defaults.font.size = 16; Chart.defaults.color = "#333";
  function chart(id, config) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), config); }
  function set(id, v) { const el = $(id); if (el && el.innerHTML !== String(v)) el.innerHTML = v; }
  function studentURL() { return location.href.replace(/dashboard\.html.*$/, "").replace(/\?.*$/, ""); }

  function view() {
    const s = D.state;
    if (s.phase === "round") return s.open ? "open" : "closed";
    return s.phase;
  }
  function render() {
    if (!D.state) return;
    const v = view(), key = v + lobby() + (D.state.round || 0) + ((D.state.hist || []).length);
    $("joined").textContent = here().length + " joined";
    $("close").disabled = v !== "open";
    if (mountedKey !== key) { mountedKey = key; mount(v); }
    update(v);
  }

  function priceChart(withEq) {
    const h = (D.state.hist || []).slice().sort((a, b) => a.r - b.r);
    const ds = [
      { type: "line", label: "Price of an apple (£)", data: h.map((e) => e.p), borderColor: BLUE, backgroundColor: BLUE, yAxisID: "y", tension: 0, pointRadius: 6, borderWidth: 3 },
      { type: "bar", label: "Excess demand for apples", data: h.map((e) => Math.round(e.zx * 10) / 10), backgroundColor: h.map((e) => (e.zx > 0 ? ORANGE : "#9fb4e0")), yAxisID: "y2" }
    ];
    if (withEq && D.state.eq) ds.push({ type: "line", label: "Equilibrium price", data: h.map(() => D.state.eq.p), borderColor: "#2e9e5b", borderDash: [8, 6], pointRadius: 0, yAxisID: "y", borderWidth: 2 });
    return { data: { labels: h.map((e) => "Round " + e.r), datasets: ds },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { position: "bottom" } },
        scales: { y: { position: "left", min: 0, suggestedMax: Math.max(1, ...h.map((e) => e.p), (withEq && D.state.eq ? D.state.eq.p : 0)) * 1.25, title: { display: true, text: "£ per apple" } },
                  y2: { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "apples" } } } } };
  }

  function mount(v) {
    for (const k of Object.keys(charts)) { charts[k].destroy(); delete charts[k]; }
    const s = D.state, A = B.TYPES.A, Bt = B.TYPES.B;
    let h = "";
    if (v === "lobby") h = `<h1>Be the market</h1><div class="rule"></div>
      <div class="qrwrap" style="flex-wrap:nowrap"><div class="qr" id="qr"></div><div style="flex:1;min-width:0">
        <p class="lead">Scan the code with your phone camera, or go to</p><p class="url" id="url"></p>
        <div class="kpis"><div class="kpi"><div class="v" id="k-A">0</div><div class="l">${A.icon} Bakers (12 loaves, no apples)</div></div>
          <div class="kpi"><div class="v" id="k-B">0</div><div class="l">${Bt.icon} Orchard owners (3 apples, no bread)</div></div></div>
        <p class="lead muted">I am the auctioneer. I call out a price for apples; you choose what to buy and sell. Bread always costs £1.</p></div></div>`;
    if (v === "open") h = `<h1>Round ${s.round}: send your orders</h1><div class="rule"></div>
      <div class="cols"><div><div class="muted lead">Price of an apple</div><div class="bigprice">${B.money(s.price)}</div>
        <p class="lead">A loaf of bread: £1. Choose the bundle that makes you happiest, then send it.</p></div>
        <div class="kpis" style="align-content:flex-start"><div class="kpi"><div class="v" id="k-sent">0</div><div class="l">orders sent</div></div>
          <div class="kpi"><div class="v" id="k-of">0</div><div class="l">traders joined</div></div></div></div>
      <div class="progress" style="margin-top:12px"><div id="bar"></div></div>`;
    if (v === "closed") h = `<h1>Round ${s.round}: what did the market want at ${B.money(s.price)}?</h1><div class="rule"></div>
      <div class="kpis">
        <div class="kpi"><div class="v" id="k-want">–</div><div class="l">apples wanted</div></div>
        <div class="kpi"><div class="v" id="k-avail">–</div><div class="l">apples available</div></div>
        <div class="kpi"><div class="v" id="k-zx">–</div><div class="l">excess demand for apples</div></div>
        <div class="kpi"><div class="v" id="k-zy">–</div><div class="l">excess demand for bread</div></div></div>
      <div class="cols"><div><p class="lead" id="verdict"></p><p class="lead" id="walras"></p><p class="muted" id="theory"></p></div>
        <div class="chartbox" style="height:320px"><canvas id="c-p"></canvas></div></div>`;
    if (v === "reveal") h = `<h1>The equilibrium</h1><div class="rule"></div>
      <div class="cols"><div>
        <p class="lead">With <b id="r-nA"></b> Bakers and <b id="r-nB"></b> Orchard owners, the apple market clears at</p>
        <div class="bigprice" id="r-p"></div>
        <p class="muted">Bakers spend half their income on apples: 12 ÷ (2 × price). Orchard owners spend a third of theirs: 3 × price ÷ (3 × price) = 1 apple, whatever the price. At the equilibrium price, the apples everyone wants add up to the apples that exist.</p>
        <table class="types" id="r-tab"></table></div>
        <div class="chartbox" style="height:360px"><canvas id="c-p"></canvas></div></div>`;
    if (v === "end") h = `<h1>Thank you</h1><div class="rule"></div><p class="lead">The auctioneer raised the price when apples were in excess demand and lowered it when they were in excess supply, until the market cleared: a Walrasian equilibrium.</p>`;
    stage.innerHTML = h;
    if (v === "lobby") {
      const url = studentURL(); set("url", url.replace(/^https?:\/\//, ""));
      const q = qrcode(0, "M"); q.addData(url); q.make(); $("qr").innerHTML = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    }
    if (v === "closed" && $("c-p")) chart("c-p", priceChart(false));
    if (v === "reveal" && $("c-p")) chart("c-p", priceChart(true));
  }

  function update(v) {
    const s = D.state;
    if (v === "lobby") { const c = counts(here()); set("k-A", c.nA); set("k-B", c.nB); }
    if (v === "open") {
      const st = roundStats(s.round), n = here().length;
      set("k-sent", st.n); set("k-of", n);
      const bar = $("bar"); if (bar) bar.style.width = (n ? (100 * st.n) / n : 0) + "%";
    }
    if (v === "closed") {
      const h = (s.hist || []).find((e) => e.r === s.round); if (!h) return;
      set("k-want", B.num(h.want, 1)); set("k-avail", B.num(h.avail, 1));
      set("k-zx", (h.zx > 0 ? "+" : "") + B.num(h.zx, 1)); set("k-zy", (h.zy > 0 ? "+" : "") + B.num(h.zy, 1));
      const close = Math.abs(h.zx) < 0.05 * Math.max(1, h.avail);
      set("verdict", close ? `<span class="arrow ok">✓</span> The apple market (almost) clears at ${B.money(h.p)}.`
        : h.zx > 0 ? `<span class="arrow up">▲</span> Excess <b>demand</b> for apples: raise the price. Suggested next price: <b>${B.money(suggest(h.p, h))}</b>`
                   : `<span class="arrow down">▼</span> Excess <b>supply</b> of apples: lower the price. Suggested next price: <b>${B.money(suggest(h.p, h))}</b>`);
      const val = h.p * h.zx + h.zy;
      set("walras", `<b>Walras' law:</b> ${B.money(h.p)} × (${B.num(h.zx, 1)}) + (${B.num(h.zy, 1)}) = <b>${B.num(Math.abs(val) < 0.005 ? 0 : val, 2)}</b>. Excess demand for apples is paid for with an excess supply of bread.`);
      const tz = B.theoryZ(h.nA, h.nB, h.p);
      set("theory", `If all ${h.n} traders had chosen their very best bundle, excess demand for apples would be ${B.num(tz, 1)}.`);
    }
    if (v === "reveal" && s.eq) {
      set("r-nA", s.eq.nA); set("r-nB", s.eq.nB); set("r-p", B.money(s.eq.p));
      const A = B.TYPES.A, Bt = B.TYPES.B, a = B.best(A, s.eq.p), b = B.best(Bt, s.eq.p);
      set("r-tab", `<tr><th></th><th class="num">owns</th><th class="num">ends with</th><th class="num">happiness</th></tr>
        <tr><td>${A.icon} Baker</td><td class="num">0 🍎, 12 🍞</td><td class="num">${B.num(a.x, 2)} 🍎, ${B.num(a.y, 2)} 🍞</td><td class="num">0 → ${B.num(B.points(A, a.x, a.y), 1)}</td></tr>
        <tr><td>${Bt.icon} Orchard owner</td><td class="num">3 🍎, 0 🍞</td><td class="num">${B.num(b.x, 2)} 🍎, ${B.num(b.y, 2)} 🍞</td><td class="num">0 → ${B.num(B.points(Bt, b.x, b.y), 1)}</td></tr>`);
    }
  }

  // ---------- demo: simulated students ----------
  async function addBots() {
    const s = D.state; if (!s) return;
    const items = [];
    for (let k = 0; k < 16; k++) {
      const id = "bot" + Math.random().toString(36).slice(2, 8), t = B.typeOf(id), r = {};
      if (s.phase === "round" && s.open) {
        const p = s.price, m = B.income(t, p), bx = B.best(t, p).x;
        const x = Math.max(0, Math.min(m / p, Math.round(10 * bx * (0.8 + 0.4 * Math.random())) / 10));
        r[rk(s.round)] = { p, x, y: m - p * x, t: Date.now() };
      }
      items.push(["tr/" + id, { lobby: lobby(), type: t.key, joinedAt: Date.now(), r }]);
    }
    await S.batchSet(items);
  }
  // In demo mode, bots that have joined also answer each new round.
  if (S.demo) {
    let answered = null;
    setInterval(async () => {
      const s = D.state; if (!s || s.phase !== "round" || !s.open || answered === lobby() + s.round) return;
      const bots = here().filter((a) => a.id.startsWith("bot")); if (!bots.length) return;
      answered = lobby() + s.round;
      const items = bots.map((a) => {
        const t = B.TYPES[a.data.type], p = s.price, m = B.income(t, p), bx = B.best(t, p).x;
        const x = Math.max(0, Math.min(m / p, Math.round(10 * bx * (0.8 + 0.4 * Math.random())) / 10));
        return ["tr/" + a.id, { r: { [rk(s.round)]: { p, x, y: m - p * x, t: Date.now() } } }, true];
      });
      await S.batchSet(items);
    }, 1500);
  }
})();
