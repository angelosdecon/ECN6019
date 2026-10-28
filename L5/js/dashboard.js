// Week 5 dashboard: "Run your own stall". Join QR, live answers, results, market price and leaderboard.
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

  // ---------- running order ----------
  const STEPS = [{ id: "lobby", label: "Join (QR code)" }, { id: "intro", label: "The game: your stall and your costs" }];
  for (const r of B.ROUNDS) {
    STEPS.push({ id: "choose", round: r.n, label: `Day ${r.n} (${r.title}): choose` });
    STEPS.push({ id: "results", round: r.n, label: `Day ${r.n}: results` });
  }
  STEPS.push({ id: "final", label: "Leaderboard and lessons" }, { id: "end", label: "End" });
  $("steps").innerHTML = STEPS.map((s, i) => `<option value="${i}">${i + 1}. ${s.label}</option>`).join("");

  // ---------- live data ----------
  const D = { state: null, players: [], firms: [] };
  let mountedKey = null, charts = {};
  S.onDoc("", (d) => { D.state = d; if (!d || !d.lobby) initSession(); render(); botsReact(); });
  S.onCol("players", (a) => { D.players = a; render(); });
  S.onCol("firm", (a) => { D.firms = a; render(); });

  const lobby = () => (D.state && D.state.lobby) || null;
  const here = () => D.players.filter((p) => p.data.lobby === lobby());
  const firms = () => D.firms.filter((f) => f.data.lobby === lobby());
  const qOf = (f, n) => (f.data.q && f.data.q["r" + n] != null ? B.clampInt(f.data.q["r" + n], 0, B.MAXQ) : null);
  const answered = (n) => firms().filter((f) => qOf(f, n) != null);
  const pct = (x) => Math.round(100 * x);
  const R = (n) => B.ROUNDS[n - 1];

  function priceOf(n, market) {
    const r = R(n); if (r.price != null) return r.price;
    const m = (market || (D.state && D.state.market) || {})["r" + n];
    return m ? m.p : null;
  }
  // Equilibrium with equal numbers of each stall: the price where demand meets the class's p = MC supply.
  function eqPrice(a) {
    let best = null, gap = 1e9;
    for (let p = 0; p <= 30; p += 0.5) { const g = Math.abs(a - B.mean(B.TYPES.map((t) => B.bestQ(t, p))) - p); if (g < gap - 1e-9) { gap = g; best = p; } }
    return best;
  }

  async function initSession() {
    if (initSession.done) return; initSession.done = true;
    const cur = await S.getDoc("");
    if (!cur || !cur.lobby) await S.setDoc("", { lobby: "L" + Date.now().toString(36), step: 0, game: "lobby", phase: "", phaseId: "init" });
  }

  // ---------- navigation ----------
  $("next").onclick = () => goTo(curStep() + 1);
  $("back").onclick = () => goTo(curStep() - 1);
  $("steps").onchange = (e) => goTo(Number(e.target.value));
  $("newSession").onclick = async () => {
    if (!confirm("Start a new session? Everyone's phone re-joins automatically; earlier answers are kept out of the results.")) return;
    await S.setDoc("", { lobby: "L" + Date.now().toString(36), step: 0, game: "lobby", phase: "", phaseId: "p" + Date.now() });
  };
  $("bots").onclick = addBots;
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight" || e.key === "PageDown") goTo(curStep() + 1);
    if (e.key === "ArrowLeft" || e.key === "PageUp") goTo(curStep() - 1);
  });
  const curStep = () => (D.state && D.state.step) || 0;

  let busy = false;
  async function goTo(i) {
    if (busy || i < 0 || i >= STEPS.length || !D.state) return;
    busy = true;
    try {
      const st = STEPS[i];
      const s = { lobby: lobby(), step: i, phaseId: "p" + Date.now(), round: st.round || 0, secs: 0,
        game: st.id === "lobby" ? "lobby" : st.id === "end" ? "end" : "stall", phase: st.id,
        market: Object.assign({}, D.state.marketLobby === lobby() ? D.state.market : {}), marketLobby: lobby(), ranks: D.state.ranks || null };
      if (st.id === "choose") s.secs = B.CHOOSE_SECS;
      if (st.id === "results" && R(st.round).market) {
        const rows = answered(st.round), Q = rows.reduce((a, f) => a + qOf(f, st.round), 0), N = rows.length;
        s.market["r" + st.round] = { p: Math.round(100 * B.marketPrice(R(st.round).market.a, Q, N)) / 100, Q, N };
      }
      if (st.id === "results" || st.id === "final") s.ranks = rankAll(st.id === "final" ? B.ROUNDS.length : st.round, s.market);
      await S.setDoc("", s);
    } finally { busy = false; }
  }

  function totals(upto, market) {
    return firms().map((f) => {
      const t = B.type(f.data.type); let tot = 0, played = 0;
      for (let n = 1; n <= upto; n++) {
        const p = priceOf(n, market); if (p == null) continue;
        const q = qOf(f, n); if (q != null) played++;
        tot += B.profit(t, q == null ? 0 : q, p, R(n).rentMult);
      }
      return { id: f.id, type: t, tot, played };
    }).filter((x) => x.played > 0).sort((a, b) => b.tot - a.tot);
  }
  function rankAll(upto, market) {
    const list = totals(upto, market), by = {};
    list.forEach((x, k) => { by[x.id] = { rank: k + 1, of: list.length }; });
    return { upto, by };
  }

  // ---------- charts ----------
  const BLUE = "#3333b3", ORANGE = "#e8833a", GREY = "#b5b5b5";
  Chart.defaults.font.family = '"Helvetica Neue", Arial, sans-serif';
  Chart.defaults.font.size = 16; Chart.defaults.color = "#333";
  function chart(id, config) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), config); return charts[id]; }
  function refresh(id, config) {
    const c = charts[id]; if (!c) return;
    c.data.labels = config.data.labels;
    config.data.datasets.forEach((d, i) => { if (c.data.datasets[i]) c.data.datasets[i].data = d.data; });
    c.update("none");
  }
  // Average trays chosen by each kind of stall, against the best number at today's price.
  function typeConfig(n) {
    const p = priceOf(n);
    const labels = B.TYPES.map((t) => t.icon + " " + t.food);
    const chosen = B.TYPES.map((t) => { const v = answered(n).filter((f) => f.data.type === t.key).map((f) => qOf(f, n)); return v.length ? Math.round(10 * B.mean(v)) / 10 : null; });
    const best = B.TYPES.map((t) => (p == null ? null : B.bestQ(t, p)));
    return { type: "bar", data: { labels, datasets: [
      { label: "Average trays brought", data: chosen, backgroundColor: BLUE },
      { label: "Best at today's price (p = MC)", data: best, backgroundColor: ORANGE }] },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true, max: B.MAXQ, title: { display: true, text: "trays" } } } } };
  }
  function priceConfig() {
    const days = B.ROUNDS.filter((r) => r.market);
    const labels = days.map((r) => "Day " + r.n + (r.market.a !== days[0].market.a ? " (heatwave)" : ""));
    const actual = days.map((r) => priceOf(r.n));
    const eq = days.map((r) => eqPrice(r.market.a));
    return { type: "line", data: { labels, datasets: [
      { label: "Market price", data: actual, borderColor: BLUE, backgroundColor: BLUE, borderWidth: 4, pointRadius: 8, tension: 0, spanGaps: false },
      { label: "Equilibrium (demand = class supply)", data: eq, borderColor: ORANGE, backgroundColor: ORANGE, borderDash: [8, 6], borderWidth: 3, pointRadius: 0, stepped: "middle" }] },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { position: "bottom" } },
        scales: { y: { min: 0, max: 26, title: { display: true, text: "£ per tray" } } } } };
  }

  // ---------- views ----------
  const studentURL = () => { const u = new URL("index.html", location.href); if (/[?&]demo=1/.test(location.search)) u.search = "?demo=1"; return u.toString(); };
  const kpi = (id, label, v) => `<div class="kpi"><div class="v" id="${id}">${v == null ? "–" : v}</div><div class="l">${label}</div></div>`;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const setHTML = (id, v) => { const el = $(id); if (el) el.innerHTML = v; };

  let phaseStart = {};
  function timerLoop() {
    const s = D.state, el = $("dtimer");
    if (el && s && s.secs) {
      if (!phaseStart[s.phaseId]) phaseStart[s.phaseId] = Date.now();
      const left = Math.max(0, Math.ceil((phaseStart[s.phaseId] + s.secs * 1000 - Date.now()) / 1000));
      el.textContent = left > 0 ? left + "s" : "time's up";
      el.classList.toggle("out", left === 0);
    }
    requestAnimationFrame(timerLoop);
  }
  requestAnimationFrame(timerLoop);

  const LESSON = {
    1: "Best rule: keep adding trays while the <b>extra cost of a tray is no more than the price</b>. That is <b>p = MC</b>.",
    2: "Rent is a <b>fixed cost</b>: it does not change the extra cost of a tray, so the <b>best output is the same as on day 1</b>. Stay open: closing still pays the rent and loses more.",
    3: "Open only if sales cover the <b>extra (variable) costs</b>: price ≥ minimum AVC. Bubble tea and bao should open and lose <b>less than the rent</b>; falafel and churros should close. That is the <b>shutdown rule</b>.",
    4: "Each stall takes the price as given, but <b>together you set it</b>. Equilibrium is where the class's supply (each stall on p = MC) meets demand: about <b>£EQ</b>.",
    5: "Did the price settle down? Stalls react to yesterday's price, so prices can overshoot before they settle near <b>£EQ</b>.",
    6: "Demand shifts out: the price rises and every stall <b>moves up its MC curve</b>. New equilibrium about <b>£EQ</b>."
  };
  const lesson = (n) => LESSON[n].replace("£EQ", R(n).market ? B.gbp(eqPrice(R(n).market.a)) : "");

  function render() {
    const s = D.state; if (!s) return;
    set("joined", here().length + " joined");
    $("steps").value = String(s.step || 0);
    const st = STEPS[s.step || 0];
    const key = s.phaseId + "|" + (s.step || 0);
    if (key !== mountedKey) { mountedKey = key; for (const k in charts) charts[k].destroy(); charts = {}; stage.innerHTML = mount(st, s); afterMount(st, s); }
    update(st, s);
  }

  function mount(st, s) {
    const n = st.round, r = n ? R(n) : null;
    switch (st.id) {
      case "lobby": return `<h1>Run your own stall: join</h1><div class="rule"></div>
        <div class="qrwrap"><div class="qr" id="qr"></div><div><p class="lead">Scan with your phone camera, or open:</p><p class="url" id="url"></p>
        <div class="kpis">${kpi("k-joined", "stalls open for business", 0)}</div><p class="muted">Keep the page open: it changes by itself. Anonymous, not graded.</p></div></div>`;
      case "intro": return `<h1>Run your own stall</h1><div class="rule"></div>
        <div class="cols"><div class="card soft lead"><b>Each day</b><ul>
          <li>Choose how many <b>trays</b> to bring (0 = stay closed).</li>
          <li><b>Rent</b> is paid every day, <b>even if you close</b>.</li>
          <li>Each extra tray costs more than the last (your phone shows your table).</li></ul>
          <b>Profit</b> = price × trays − total cost. Highest total profit over ${B.ROUNDS.length} days wins.</div>
          <div><table class="types"><tr><th>Stall</th><th class="num">Rent</th><th class="num">Extra cost of trays 1, 2, 3…</th><th class="num">Stalls</th></tr>
          ${B.TYPES.map((t) => `<tr><td>${t.icon} ${t.food}</td><td class="num">£${t.rent}</td><td class="num">£${B.extraCost(t, 1)}, ${B.extraCost(t, 2)}, ${B.extraCost(t, 3)}…</td><td class="num" id="n-${t.key}">–</td></tr>`).join("")}</table>
          <p class="muted">You are small: you cannot change the price.</p></div></div>`;
      case "choose": return `<h1>Day ${n}: ${r.title}</h1><div class="rule"></div>
        <div class="banner">${r.note}</div>
        <div class="kpis">${r.price != null ? kpi("k-p", "price per tray", "£" + r.price) : kpi("k-p", "price: set by all your trays", "?")}${kpi("k-ans", "stalls decided", null)}<div class="kpi"><div class="v timer" id="dtimer">–</div><div class="l">time left</div></div></div>
        <div class="progress"><div id="bar"></div></div>`;
      case "results": return `<h1>Day ${n}: results</h1><div class="rule"></div>
        <div class="kpis">${kpi("k-p", r.market ? "market price" : "price", null)}${r.market ? kpi("k-Q", "average trays per stall", null) : kpi("k-best", "chose the best output", null)}${n === 2 ? kpi("k-chg", "changed output from day 1", null) : n === 3 ? kpi("k-shut", "right open/close decision", null) : kpi("k-closed", "stayed closed", null)}${kpi("k-prof", "average profit", null)}</div>
        <div class="banner">${lesson(n)}</div>
        <div class="cols"><div class="chartbox"><canvas id="c-type"></canvas></div>${r.market ? `<div class="chartbox"><canvas id="c-price"></canvas></div>` : `<div class="card lead" id="topbox"></div>`}</div>`;
      case "final": return `<h1>Leaderboard</h1><div class="rule"></div>
        <div class="cols"><div><table class="lb" id="lb"></table></div>
        <div><div class="card soft lead"><b>What the market showed</b><ul>
          <li>A price-taking stall supplies where <b>p = MC</b>.</li>
          <li><b>Fixed costs</b> (rent) do not change how much to supply.</li>
          <li><b>Shut down</b> only if the price is below minimum AVC.</li>
          <li>Together, stalls on their MC curves make the <b>market supply curve</b>.</li></ul>
          Every stall here breaks even at <b>£12</b> (minimum AC). What happens when new stalls can enter? <b>Week 6</b>.</div>
          <table class="types" id="bytype"></table></div></div>`;
      case "end": return `<h1>Thanks for playing</h1><div class="rule"></div><p class="lead">Use the step menu below to go back to any screen.</p>`;
    }
    return "";
  }

  function afterMount(st, s) {
    if (st.id === "lobby") {
      const url = studentURL(); set("url", url.replace(/^https?:\/\//, ""));
      const q = qrcode(0, "M"); q.addData(url); q.make(); $("qr").innerHTML = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    }
    if ($("c-type")) chart("c-type", typeConfig(st.round));
    if ($("c-price")) chart("c-price", priceConfig());
  }

  function update(st, s) {
    const n = st.round;
    if (st.id === "lobby") set("k-joined", here().length);
    if (st.id === "intro") for (const t of B.TYPES) set("n-" + t.key, here().filter((p) => p.data.type === t.key).length);
    if (st.id === "choose") {
      const a = answered(n).length, tot = Math.max(here().length, a);
      set("k-ans", a + " / " + tot); const el = $("bar"); if (el) el.style.width = (tot ? pct(a / tot) : 0) + "%";
    }
    if (st.id === "results") {
      const r = R(n), p = priceOf(n), rows = answered(n);
      set("k-p", p == null ? "–" : B.gbp(p));
      const prof = rows.map((f) => B.profit(B.type(f.data.type), qOf(f, n), p || 0, r.rentMult));
      set("k-prof", rows.length && p != null ? B.money(B.mean(prof)) : "–");
      if (r.market) set("k-Q", rows.length ? B.fmt(B.mean(rows.map((f) => qOf(f, n))), 1) : "–");
      else set("k-best", rows.length ? pct(rows.filter((f) => qOf(f, n) === B.bestQ(B.type(f.data.type), p)).length / rows.length) + "%" : "–");
      if (n === 2) { const both = rows.filter((f) => qOf(f, 1) != null); set("k-chg", both.length ? pct(both.filter((f) => qOf(f, 2) !== qOf(f, 1)).length / both.length) + "%" : "–"); }
      else if (n === 3) set("k-shut", rows.length ? pct(rows.filter((f) => (qOf(f, 3) > 0) === (B.bestQ(B.type(f.data.type), p) > 0)).length / rows.length) + "%" : "–");
      else set("k-closed", rows.length ? pct(rows.filter((f) => qOf(f, n) === 0).length / rows.length) + "%" : "–");
      refresh("c-type", typeConfig(n));
      if (r.market) refresh("c-price", priceConfig());
      const box = $("topbox");
      if (box) {
        const list = totals(n).slice(0, 5);
        box.innerHTML = `<b>Top stalls so far</b><table class="lb" style="font-size:18px">${list.map((x, k) => `<tr><td>${k + 1}. ${x.type.icon} ${B.nameOf(x.id)}</td><td class="num">${B.money(x.tot)}</td></tr>`).join("") || "<tr><td>–</td></tr>"}</table>`;
      }
    }
    if (st.id === "final") {
      const list = totals(B.ROUNDS.length);
      setHTML("lb", `<tr><th>Stall</th><th class="num">Total profit</th></tr>` + list.slice(0, 10).map((x, k) => `<tr><td>${k + 1}. ${x.type.icon} ${B.nameOf(x.id)}</td><td class="num">${B.money(x.tot)}</td></tr>`).join(""));
      // best possible total for each type, playing p = MC every day (market prices as they turned out)
      setHTML("bytype", `<tr><th>Stall</th><th class="num">Class average</th><th class="num">Playing p = MC</th></tr>` + B.TYPES.map((t) => {
        const mine = list.filter((x) => x.type.key === t.key).map((x) => x.tot);
        let best = 0; for (const r of B.ROUNDS) { const p = priceOf(r.n); if (p != null) best += B.profit(t, B.bestQ(t, p), p, r.rentMult); }
        return `<tr><td>${t.icon} ${t.food}</td><td class="num">${mine.length ? B.money(B.mean(mine)) : "–"}</td><td class="num">${B.money(best)}</td></tr>`;
      }).join(""));
    }
  }

  // ---------- demo: simulated students ----------
  async function addBots() {
    if (!S.demo || !lobby()) return;
    for (let i = 0; i < 16; i++) {
      const id = "pbot" + Math.random().toString(36).slice(2, 7);
      await S.setDoc("players/" + id, { lobby: lobby(), joinedAt: Date.now(), bot: true, type: B.typeOf(id).key, skill: Math.random() });
    }
  }
  const acted = {};
  function botsReact() {
    const s = D.state; if (!S.demo || !s || s.phase !== "choose" || acted[s.phaseId]) return;
    acted[s.phaseId] = true;
    const n = s.round, r = R(n);
    let guess = r.price; if (guess == null) { guess = B.hintPrice(n, (k) => priceOf(k, s.market)); if (r.market.a > 20) guess += 4; }
    for (const b of D.players.filter((p) => p.data.bot && p.data.lobby === s.lobby)) {
      const t = B.type(b.data.type), good = b.data.skill > 0.35;
      let q = B.bestQ(t, guess || 13);
      if (!good) q += Math.round((Math.random() - 0.5) * 4);
      if (n === 2 && Math.random() < 0.35) q -= 1 + Math.floor(Math.random() * 2);
      if (n === 3 && !good && Math.random() < 0.5) q = q > 0 ? 0 : 2;
      q = B.clampInt(q, 0, B.MAXQ);
      setTimeout(async () => {
        const f = await S.getDoc("firm/" + b.id);
        if (f && f.lobby === s.lobby) S.updateDoc("firm/" + b.id, { ["q.r" + n]: q });
        else S.setDoc("firm/" + b.id, { lobby: s.lobby, type: t.key, q: { ["r" + n]: q } });
      }, 300 + Math.random() * 4000);
    }
  }
})();
