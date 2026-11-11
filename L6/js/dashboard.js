// Week 6 dashboard: "Monopoly workout". Join QR, live progress, then where the class got stuck.
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
    { id: "work", label: "Exercise open: live progress" },
    { id: "results", label: "Results: where did we get stuck?" },
    { id: "end", label: "End" }
  ];
  $("steps").innerHTML = STEPS.map((s, i) => `<option value="${i}">${i + 1}. ${s.label}</option>`).join("");

  const D = { state: null, ans: [] };
  let charts = {}, mountedKey = null;
  S.onDoc("", (d) => { D.state = d; if (!d || !d.lobby) initSession(); render(); });
  S.onCol("ans", (a) => { D.ans = a; render(); });

  const lobby = () => (D.state && D.state.lobby) || null;
  const here = () => D.ans.filter((a) => a.data.lobby === lobby());
  const pct = (x) => Math.round(100 * x);
  const curStep = () => (D.state && D.state.step) || 0;

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
    await S.setDoc("", { lobby: lobby(), step: i, phase: STEPS[i].id, phaseId: "p" + Date.now() });
  }

  // ---------- statistics ----------
  function stepStats(key, n) {
    const rows = here().map((a) => a.data.r || {});
    return Array.from({ length: n }, (_, i) => {
      const ans = rows.map((r) => r[key + i]).filter(Boolean);
      const ok = ans.filter((a) => a.ok).length, tags = {};
      for (const a of ans) if (!a.ok) tags[a.tag] = (tags[a.tag] || 0) + 1;
      const top = Object.entries(tags).sort((x, y) => y[1] - x[1])[0];
      return { n: ans.length, ok, share: ans.length ? ok / ans.length : 0, top: top ? { tag: top[0], n: top[1] } : null };
    });
  }
  const done = (key, n) => here().filter((a) => { const r = a.data.r || {}; for (let i = 0; i < n; i++) if (!r[key + i]) return false; return true; }).length;
  const started = () => here().filter((a) => a.data.r && Object.keys(a.data.r).length).length;
  const avgScore = (key, n) => {
    const f = here().filter((a) => { const r = a.data.r || {}; for (let i = 0; i < n; i++) if (!r[key + i]) return false; return true; });
    return f.length ? B.mean(f.map((a) => { let s = 0; for (let i = 0; i < n; i++) if (a.data.r[key + i].ok) s++; return s; })) : null;
  };
  // What each common mistake means (for the results table).
  const MEANING = {
    "mr=demand": "used the demand curve as MR", "halved intercept": "halved the intercept", "slope ×4": "slope too steep",
    "P=MC (competitive Q)": "set P = MC (competitive output)", "MR=0 (ignored cost)": "set MR = 0 (ignored cost)",
    "price=MC": "charged P = MC", "revenue-max price": "price where MR = 0", "markup only": "gave the markup P − MC",
    "revenue (forgot cost)": "gave revenue (forgot cost)", "triangle (½)": "used a triangle (½)", "used competitive Q": "used the competitive Q",
    "forgot ½": "forgot the ½", "whole competitive surplus": "gave the whole competitive surplus", "halved twice": "halved twice",
    "inverted": "inverted the markup", "sign": "positive elasticity", "unit elastic": "said e = −1",
    "that's MC": "gave MC, not AC", "dropped a term": "dropped a term", "divided one term": "divided only one term",
    "forgot to halve": "forgot to divide by 2", "squared": "squared", "AC at q = 0": "used the constant term",
    "zero profit ≠ zero price": "zero profit → zero price", "used A, not Q": "used the demand intercept", "forgot ÷ q*": "forgot to divide by q*", "other": "other"
  };

  // ---------- render ----------
  const BLUE = "#3333b3", ORANGE = "#e8833a", GREY = "#d9d9d9";
  Chart.defaults.font.family = '"Helvetica Neue", Arial, sans-serif'; Chart.defaults.font.size = 16; Chart.defaults.color = "#333";
  function chart(id, config) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), config); }
  function barConfig(key, n) {
    const s = stepStats(key, n);
    return { type: "bar", data: { labels: B.STEP_LABELS[key],
      datasets: [{ label: "% right first time", data: s.map((x) => pct(x.share)), backgroundColor: s.map((x) => (x.share < 0.6 ? ORANGE : BLUE)) }] },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false },
        tooltip: { callbacks: { label: (c) => c.raw + "% (" + s[c.dataIndex].n + " answers)" } } },
        scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } } } };
  }
  function set(id, v) { const el = $(id); if (el && el.textContent !== String(v)) el.textContent = v; }
  function studentURL() { return location.href.replace(/dashboard\.html.*$/, "").replace(/\?.*$/, ""); }

  function render() {
    if (!D.state) return;
    const st = STEPS[curStep()], key = st.id + lobby();
    $("steps").value = curStep(); $("joined").textContent = here().length + " joined";
    if (mountedKey !== key) { mountedKey = key; mount(st); }
    update(st);
  }
  function mount(st) {
    for (const k of Object.keys(charts)) { charts[k].destroy(); delete charts[k]; }
    let h = "";
    if (st.id === "lobby") h = `<h1>Monopoly workout</h1><div class="rule"></div>
      <div class="qrwrap" style="flex-wrap:nowrap"><div class="qr" id="qr"></div><div style="flex:1;min-width:0">
        <p class="lead">Scan the code with your phone camera, or go to</p><p class="url" id="url"></p>
        <div class="kpis"><div class="kpi"><div class="v" id="k-joined">0</div><div class="l">phones joined</div></div></div>
        <p class="lead muted">A monopoly, step by step, at your own pace. After each answer you see whether it is right, and why.</p></div></div>`;
    if (st.id === "work") h = `<h1>Work through the steps on your phone</h1><div class="rule"></div>
      <p class="lead">Your own numbers, at your own pace. Finished early? Try the bonus exercise. Then the module feedback survey.</p>
      <div class="kpis">
        <div class="kpi"><div class="v" id="k-start">0</div><div class="l">started</div></div>
        <div class="kpi"><div class="v" id="k-done">0</div><div class="l">finished the monopoly</div></div>
        <div class="kpi"><div class="v" id="k-bonus">0</div><div class="l">finished the bonus</div></div></div>
      <div id="live" class="steprow"></div>`;
    if (st.id === "results") h = `<h1>Where did we get stuck?</h1><div class="rule"></div>
      <div class="cols"><div><h3>Monopoly: % right first time</h3><div class="chartbox"><canvas id="c-m"></canvas></div></div>
      <div><h3>Most common mistake at each step</h3><table class="types" id="mist"></table>
      <h3 style="margin-top:18px">Bonus (long run): % right first time</h3><div class="chartbox" style="height:200px"><canvas id="c-l"></canvas></div></div></div>`;
    if (st.id === "end") h = `<h1>Thank you</h1><div class="rule"></div><p class="lead">The steps: MR (twice the slope) → MR = MC → price from demand → profit (P − AC)Q → deadweight-loss triangle → markup −1/e.</p>`;
    stage.innerHTML = h;
    if (st.id === "lobby") {
      const url = studentURL(); set("url", url.replace(/^https?:\/\//, ""));
      const q = qrcode(0, "M"); q.addData(url); q.make(); $("qr").innerHTML = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    }
    if (st.id === "results") { chart("c-m", barConfig("m", 6)); chart("c-l", barConfig("l", 4)); }
  }
  function update(st) {
    if (st.id === "lobby") set("k-joined", here().length);
    if (st.id === "work") {
      set("k-start", started()); set("k-done", done("m", 6)); set("k-bonus", done("l", 4));
      const s = stepStats("m", 6), el = $("live");
      if (el) el.innerHTML = s.map((x, i) => `<div class="stepbox"><div class="l">${i + 1}. ${B.STEP_LABELS.m[i]}</div>
        <div class="v">${x.n ? pct(x.share) + "%" : "–"}</div><div class="l">${x.n} answered</div>
        <div class="bar"><span style="width:${x.n ? pct(x.share) : 0}%"></span></div></div>`).join("");
    }
    if (st.id === "results") {
      chart("c-m", barConfig("m", 6)); chart("c-l", barConfig("l", 4));
      const s = stepStats("m", 6), t = $("mist");
      if (t) t.innerHTML = `<tr><th>Step</th><th class="num">Right</th><th>Most common mistake</th></tr>` + s.map((x, i) =>
        `<tr><td>${i + 1}. ${B.STEP_LABELS.m[i]}</td><td class="num">${x.n ? pct(x.share) + "%" : "–"}</td><td>${x.top ? MEANING[x.top.tag] + " (" + x.top.n + ")" : "–"}</td></tr>`).join("");
    }
  }

  // ---------- demo: simulated students ----------
  async function addBots() {
    const items = [], P = { m: [0.85, 0.7, 0.55, 0.75, 0.45, 0.5], l: [0.8, 0.75, 0.7, 0.65] };
    for (let k = 0; k < 16; k++) {
      const id = "bot" + Math.random().toString(36).slice(2, 8), r = {};
      const depth = Math.random();
      for (const ex of B.EX) {
        const steps = ex.steps(id), n = ex.key === "m" ? Math.min(6, Math.floor(depth * 9)) : depth > 0.7 ? Math.floor((depth - 0.7) * 14) : 0;
        for (let i = 0; i < Math.min(n, steps.length); i++) {
          const ok = Math.random() < P[ex.key][i], wrong = steps[i].options.filter((o) => !o.correct), o = ok ? steps[i].options.find((x) => x.correct) : wrong[Math.floor(Math.random() * wrong.length)];
          r[ex.key + i] = { ok: o.correct, tag: o.tag, key: o.key, t: Date.now(), nx: true };
        }
      }
      items.push(["ans/" + id, { lobby: lobby(), joinedAt: Date.now(), r }]);
    }
    await S.batchSet(items);
  }
})();
