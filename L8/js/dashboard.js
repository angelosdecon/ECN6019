// Week 8 dashboard: "Guess 2/3 of the average" (two rounds) and "Spot the equilibrium".
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

  const STEPS = [
    { id: "lobby", label: "Join (QR code)" },
    { id: "r1", label: "Round 1: guess ⅔ of the average (open)" },
    { id: "r1res", label: "Round 1: results" },
    { id: "r2", label: "Round 2: guess again (open)" },
    { id: "r2res", label: "Round 2: results" },
    { id: "theory", label: "What game theory predicts" },
    { id: "spot", label: "Spot the equilibrium: live progress" },
    { id: "results", label: "Spot the equilibrium: results" },
    { id: "end", label: "End" }
  ];
  $("steps").innerHTML = STEPS.map((s, i) => `<option value="${i}">${i + 1}. ${s.label}</option>`).join("");

  const D = { state: null, pl: [] };
  let charts = {}, mountedKey = null;
  S.onDoc("", (d) => { D.state = d; if (!d || !d.lobby) initSession(); render(); });
  S.onCol("pl", (a) => { D.pl = a; render(); });

  const lobby = () => (D.state && D.state.lobby) || null;
  const here = () => D.pl.filter((a) => a.data.lobby === lobby());
  const pct = (x) => Math.round(100 * x);
  const curStep = () => (D.state && D.state.step) || 0;
  const guesses = (rk) => here().filter((a) => a.data.g && typeof a.data.g[rk] === "number").map((a) => ({ id: a.id, name: a.data.name || B.nameOf(a.id), g: a.data.g[rk] }));

  async function initSession() {
    if (initSession.done) return; initSession.done = true;
    const cur = await S.getDoc("");
    if (!cur || !cur.lobby) await S.setDoc("", { lobby: "L" + Date.now().toString(36), step: 0, phase: "lobby", phaseId: "init" });
  }
  $("next").onclick = () => goTo(curStep() + 1);
  $("back").onclick = () => goTo(curStep() - 1);
  $("steps").onchange = (e) => goTo(Number(e.target.value));
  $("newSession").onclick = async () => {
    if (!confirm("Start a new session? Everyone's phone re-joins automatically; earlier answers are kept out of the results.")) return;
    await S.setDoc("", { lobby: "L" + Date.now().toString(36), step: 0, phase: "lobby", phaseId: "p" + Date.now() });
  };
  $("bots").onclick = addBots;
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight" || e.key === "PageDown") goTo(curStep() + 1);
    if (e.key === "ArrowLeft" || e.key === "PageUp") goTo(curStep() - 1);
  });
  async function goTo(i) {
    if (i < 0 || i >= STEPS.length || !D.state) return;
    const id = STEPS[i].id, upd = { lobby: lobby(), step: i, phase: id, phaseId: "p" + Date.now(), res: D.state.res || {} };
    // Closing a round: freeze its result (the phones read it from here).
    if (id === "r1res" || id === "r2res") { const rk = id.slice(0, 2), r = B.guessResult(guesses(rk)); if (r) upd.res[rk] = r; }
    await S.setDoc("", upd);
  }

  // ---------- statistics for "spot the equilibrium" ----------
  function spotStats() {
    const rows = here().map((a) => a.data.s || {});
    return B.TYPES.map((_, k) => {
      const ans = rows.map((r) => r["k" + k]).filter(Boolean);
      const ok = ans.filter((a) => a.ok).length, tags = {};
      for (const a of ans) if (!a.ok) tags[a.tag] = (tags[a.tag] || 0) + 1;
      const top = Object.entries(tags).sort((x, y) => y[1] - x[1])[0];
      return { n: ans.length, ok, share: ans.length ? ok / ans.length : 0, top: top ? { tag: top[0], n: top[1] } : null };
    });
  }
  const started = () => here().filter((a) => a.data.s && Object.keys(a.data.s).length).length;
  const finished = () => here().filter((a) => { const s = a.data.s || {}; return B.TYPES.every((_, k) => s["k" + k]); }).length;

  // ---------- charts ----------
  const BLUE = "#3333b3", ORANGE = "#e8833a", GREY = "#cfcfcf";
  Chart.defaults.font.family = '"Helvetica Neue", Arial, sans-serif'; Chart.defaults.font.size = 16; Chart.defaults.color = "#333";
  function chart(id, config) { if (charts[id]) { charts[id].data = config.data; charts[id].update("none"); return; } charts[id] = new Chart($(id), config); }
  const BINS = Array.from({ length: 20 }, (_, i) => i * 5);
  const binLabels = BINS.map((b) => (b === 95 ? "95–100" : b + "–" + (b + 4)));
  function hist(vals) { const h = BINS.map(() => 0); for (const v of vals) h[Math.min(19, Math.floor(v / 5))]++; return h; }
  function histConfig(sets) {
    return { type: "bar", data: { labels: binLabels, datasets: sets },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: sets.length > 1 } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "students" } }, x: { title: { display: true, text: "number chosen" } } } } };
  }
  function set(id, v) { const el = $(id); if (el && el.innerHTML !== String(v)) el.innerHTML = v; }
  function studentURL() { return location.href.replace(/dashboard\.html.*$/, "").replace(/\?.*$/, ""); }

  // ---------- render ----------
  function render() {
    if (!D.state) return;
    const st = STEPS[curStep()], key = st.id + lobby();
    $("steps").value = curStep(); $("joined").textContent = here().length + " joined";
    if (mountedKey !== key) { mountedKey = key; mount(st); }
    update(st);
  }
  function resultBlock(rk) {
    return `<div class="kpis">
      <div class="kpi"><div class="v" id="k-n">–</div><div class="l">numbers</div></div>
      <div class="kpi"><div class="v" id="k-avg">–</div><div class="l">class average</div></div>
      <div class="kpi"><div class="v" id="k-t">–</div><div class="l">⅔ of the average: the target</div></div>
      <div class="kpi"><div class="v" id="k-w">–</div><div class="l">winning number</div></div></div>
      <p class="winner" id="winners"></p>
      <div class="chartbox"><canvas id="c-h"></canvas></div>`;
  }
  function mount(st) {
    for (const k of Object.keys(charts)) { charts[k].destroy(); delete charts[k]; }
    let h = "";
    if (st.id === "lobby") h = `<h1>Two games on your phone</h1><div class="rule"></div>
      <div class="qrwrap" style="flex-wrap:nowrap"><div class="qr" id="qr"></div><div style="flex:1;min-width:0">
        <p class="lead">Scan the code with your phone camera, or go to</p><p class="url" id="url"></p>
        <div class="kpis"><div class="kpi"><div class="v" id="k-joined">0</div><div class="l">phones joined</div></div></div>
        <p class="lead muted">1. Guess ⅔ of the average (two rounds). 2. Spot the equilibrium, at your own pace.</p></div></div>`;
    if (st.id === "r1" || st.id === "r2") h = `<h1>${st.id === "r1" ? "Round 1" : "Round 2"}: guess ⅔ of the average</h1><div class="rule"></div>
      <p class="lead">Pick a whole number from 0 to 100. The winner is closest to <b>two thirds of the class average</b>.${st.id === "r2" ? " Now you know how the class played round 1." : ""}</p>
      <div class="kpis"><div class="kpi"><div class="v" id="k-sent">0</div><div class="l">numbers sent</div></div>
      <div class="kpi"><div class="v" id="k-joined2">0</div><div class="l">phones joined</div></div></div>`;
    if (st.id === "r1res") h = `<h1>Round 1: results</h1><div class="rule"></div>` + resultBlock("r1");
    if (st.id === "r2res") h = `<h1>Round 2: results</h1><div class="rule"></div>` + resultBlock("r2");
    if (st.id === "theory") {
      const s = B.steps(6);
      h = `<h1>What does game theory predict?</h1><div class="rule"></div>
        <p class="lead">No one should pick more than ⅔ × 100. If everyone knows that, no one should pick more than ⅔ of that, and so on:</p>
        <div class="ladder">${s.map((x) => `<span class="s">${B.num(x)}</span>`).join('<span class="arr">→</span>')}<span class="arr">→ … →</span><span class="s zero">0</span></div>
        <p class="lead"><b>Nash equilibrium: everyone picks 0.</b> If everyone else picks 0, so should you.</p>
        <div class="kpis"><div class="kpi"><div class="v" id="k-a1">–</div><div class="l">our average, round 1</div></div>
        <div class="kpi"><div class="v" id="k-a2">–</div><div class="l">our average, round 2</div></div>
        <div class="kpi"><div class="v" id="k-z">–</div><div class="l">picked 0 in round 2</div></div></div>
        <p class="lead muted">In classic experiments the first-round average is around 35 (Nagel, 1995), and guesses fall as players learn.</p>`;
    }
    if (st.id === "spot") h = `<h1>Spot the equilibrium</h1><div class="rule"></div>
      <p class="lead">Your own games, at your own pace: tap every pure-strategy Nash equilibrium, or “none”.</p>
      <div class="kpis"><div class="kpi"><div class="v" id="k-start">0</div><div class="l">started</div></div>
      <div class="kpi"><div class="v" id="k-done">0</div><div class="l">finished all six</div></div></div>
      <div id="live" class="steprow"></div>`;
    if (st.id === "results") h = `<h1>Spot the equilibrium: how did we do?</h1><div class="rule"></div>
      <div class="cols"><div><h3>% right first time</h3><div class="chartbox"><canvas id="c-s"></canvas></div></div>
      <div><h3>Most common mistake</h3><table class="types" id="mist"></table></div></div>`;
    if (st.id === "end") h = `<h1>Thank you</h1><div class="rule"></div>
      <p class="lead">To find a Nash equilibrium: mark each player's best responses; the equilibria are the cells where <b>both</b> are marked. A game can have one, several or none.</p>`;
    stage.innerHTML = h;
    if (st.id === "lobby") {
      const url = studentURL(); set("url", url.replace(/^https?:\/\//, ""));
      const q = qrcode(0, "M"); q.addData(url); q.make(); $("qr").innerHTML = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    }
  }
  function update(st) {
    if (st.id === "lobby") set("k-joined", here().length);
    if (st.id === "r1" || st.id === "r2") { set("k-sent", guesses(st.id).length); set("k-joined2", here().length); }
    if (st.id === "r1res" || st.id === "r2res") {
      const rk = st.id.slice(0, 2), r = (D.state.res && D.state.res[rk]) || B.guessResult(guesses(rk));
      if (r) {
        set("k-n", r.n); set("k-avg", B.num(r.avg)); set("k-t", B.num(r.target)); set("k-w", r.winVal);
        const w = r.winners.slice(0, 4).join(", ") + (r.winners.length > 4 ? ` and ${r.winners.length - 4} more` : "");
        set("winners", `🏆 ${r.winners.length > 1 ? "Winners" : "Winner"}: ${w}`);
      }
      const sets = [];
      if (rk === "r2") sets.push({ label: "Round 1", data: hist(guesses("r1").map((x) => x.g)), backgroundColor: GREY });
      sets.push({ label: rk === "r1" ? "Round 1" : "Round 2", data: hist(guesses(rk).map((x) => x.g)), backgroundColor: BLUE });
      chart("c-h", histConfig(sets));
    }
    if (st.id === "theory") {
      const r1 = guesses("r1"), r2 = guesses("r2"), res = D.state.res || {};
      // use the frozen round results, so the averages match the results screens
      set("k-a1", res.r1 ? B.num(res.r1.avg) : r1.length ? B.num(B.mean(r1.map((x) => x.g))) : "–");
      set("k-a2", res.r2 ? B.num(res.r2.avg) : r2.length ? B.num(B.mean(r2.map((x) => x.g))) : "–");
      set("k-z", r2.length ? pct(r2.filter((x) => x.g === 0).length / r2.length) + "%" : "–");
    }
    if (st.id === "spot") {
      set("k-start", started()); set("k-done", finished());
      const s = spotStats(), el = $("live");
      if (el) el.innerHTML = s.map((x, i) => `<div class="stepbox"><div class="l">${i + 1}. ${B.TYPE_LABELS[i]}</div>
        <div class="v">${x.n ? pct(x.share) + "%" : "–"}</div><div class="l">${x.n} answered</div>
        <div class="bar"><span style="width:${x.n ? pct(x.share) : 0}%"></span></div></div>`).join("");
    }
    if (st.id === "results") {
      const s = spotStats();
      chart("c-s", { type: "bar", data: { labels: B.TYPE_LABELS, datasets: [{ label: "% right first time", data: s.map((x) => pct(x.share)), backgroundColor: s.map((x) => (x.share < 0.6 ? ORANGE : BLUE)) }] },
        options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } } } });
      const t = $("mist");
      if (t) t.innerHTML = `<tr><th>Game</th><th class="num">Right</th><th>Most common mistake</th></tr>` + s.map((x, i) =>
        `<tr><td>${i + 1}. ${B.TYPE_LABELS[i]}</td><td class="num">${x.n ? pct(x.share) + "%" : "–"}</td><td>${x.top ? B.MEANING[x.top.tag] + " (" + x.top.n + ")" : "–"}</td></tr>`).join("");
    }
  }

  // ---------- demo: simulated students ----------
  async function addBots() {
    const items = [], P = [0.85, 0.7, 0.55, 0.45, 0.6, 0.4];
    for (let k = 0; k < 16; k++) {
      const id = "bot" + Math.random().toString(36).slice(2, 8), lvl = Math.floor(Math.random() * 4);
      const g1 = Math.min(100, Math.max(0, Math.round(50 * Math.pow(2 / 3, lvl) + (Math.random() - 0.5) * 20)));
      const g2 = Math.max(0, Math.round(g1 * (0.4 + Math.random() * 0.4)));
      const s = {}, gs = B.games(id), depth = Math.floor(Math.random() * 7);
      for (let i = 0; i < depth; i++) {
        const g = gs[i], right = Math.random() < P[i];
        let sel = g.ne.slice();
        if (!right) sel = g.ne.length ? (Math.random() < 0.5 ? [] : ["0,0", "1,1"].filter((x) => !g.ne.includes(x)).slice(0, 1)) : ["0,0"];
        const r = B.grade(g, sel);
        s["k" + i] = { ok: r.ok, tag: r.tag, sel, type: g.type, t: Date.now(), nx: true };
      }
      const st = curStep(), g = {};
      if (st >= 1) g.r1 = g1; if (st >= 3) g.r2 = g2;
      items.push(["pl/" + id, { lobby: lobby(), name: B.nameOf(id), joinedAt: Date.now(), g, s }]);
    }
    await S.batchSet(items);
  }
})();
