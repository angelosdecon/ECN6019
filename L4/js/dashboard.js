// Lecturer dashboard: shows the join QR and live class results, and moves everyone through the games.
(function () {
  const S = window.Store, B = window.BL, PG = B.PG, cfg = window.BIASLAB_CONFIG || {};
  const stage = document.getElementById("stage");
  const $ = (id) => document.getElementById(id);
  document.getElementById("modname").textContent = cfg.moduleName || "";
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

  // ---------- the running order ----------
  const STEPS = [{ id: "lobby", label: "Join (QR code)" }, { id: "pg-intro", label: "Public goods: form groups and show the rules" }];
  for (const r of PG.rounds) {
    if (r.n === 5) STEPS.push({ id: "pg-rule", label: "Public goods: new rule (punishment)", round: 4 });
    STEPS.push({ id: "pg-choose", label: `Public goods: round ${r.n} – choose`, round: r.n });
    if (r.punish) STEPS.push({ id: "pg-punish", label: `Public goods: round ${r.n} – punish`, round: r.n });
    STEPS.push({ id: "pg-results", label: `Public goods: round ${r.n} – results`, round: r.n });
    if (r.n === 4) STEPS.push({ id: "pg-chart", label: "Public goods: class chart, rounds 1–4", round: 4 });
  }
  STEPS.push({ id: "pg-final", label: "Public goods: final reveal", round: PG.rounds.length });
  STEPS.push({ id: "coin-play", label: "Fake a coin: play" }, { id: "coin-results", label: "Fake a coin: results" },
    { id: "coin-spot", label: "Fake a coin: spot the fake (vote)" }, { id: "coin-reveal", label: "Fake a coin: reveal" },
    { id: "end", label: "End" });
  $("steps").innerHTML = STEPS.map((s, i) => `<option value="${i}">${i + 1}. ${s.label}</option>`).join("");

  // ---------- live data ----------
  const D = { state: null, players: [], groups: [], coin: [] };
  let mountedKey = null, charts = {};
  S.onDoc("", (d) => { D.state = d; if (!d || !d.lobby) initSession(); render(); botsReact(); });
  S.onCol("players", (a) => { D.players = a; render(); });
  S.onCol("groups", (a) => { D.groups = a; render(); });
  S.onCol("coin", (a) => { D.coin = a; render(); });

  const lobby = () => (D.state && D.state.lobby) || null;
  const here = () => D.players.filter((p) => p.data.lobby === lobby());
  const curGroups = () => D.groups.filter((g) => g.data.formation && g.data.formation === (D.state && D.state.formation));
  const coinRows = () => D.coin.filter((c) => c.data.lobby === lobby());
  const rk = (r) => "r" + r;
  const pct = (x) => Math.round(100 * x);

  async function initSession() {
    if (initSession.done) return; initSession.done = true;
    const cur = await S.getDoc("");
    if (!cur || !cur.lobby) await S.setDoc("", { lobby: "L" + Date.now().toString(36), step: 0, game: "lobby", phase: "", phaseId: "init" });
  }

  // ---------- navigation ----------
  $("next").onclick = () => goTo(curStep() + 1);
  $("back").onclick = () => goTo(curStep() - 1);
  $("steps").onchange = (e) => goTo(Number(e.target.value));
  $("startPG").onclick = () => goTo(1);
  $("startCoin").onclick = () => goTo(STEPS.findIndex((s) => s.id === "coin-play"));
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
      const st = STEPS[i], prev = STEPS[curStep()];
      const s = { lobby: lobby(), step: i, phaseId: "p" + Date.now(), formation: D.state.formation || null, coinLobby: D.state.coinLobby || null, spot: D.state.spot || null };
      const game = st.id.startsWith("pg") ? "pg" : st.id.startsWith("coin") ? "coin" : st.id === "end" ? "end" : "lobby";
      Object.assign(s, { game, phase: st.id.split("-")[1] || "", round: st.round || 0, secs: 0 });

      if (st.id === "pg-intro") {
        const formed = D.state.formation && D.state.formationLobby === lobby() && curGroups().length;
        const comingFromBefore = !prev.id.startsWith("pg") || prev.id === "pg-intro";
        if (!formed || (comingFromBefore && confirm("Groups already exist for this session. Form NEW groups and restart the public goods game? (Cancel keeps the current groups.)"))) {
          const f = await formGroups();
          if (!f) { alert("Nobody has joined yet. Show the QR code first."); return; }
          s.formation = f; s.formationLobby = lobby();
        } else { s.formationLobby = D.state.formationLobby; }
      } else if (st.id.startsWith("pg")) {
        s.formationLobby = D.state.formationLobby || null;
        if (!(D.state.formation && D.state.formationLobby === lobby())) {
          const f = await formGroups(); if (!f) { alert("Nobody has joined yet. Show the QR code first."); return; }
          s.formation = f; s.formationLobby = lobby();
        }
      } else s.formationLobby = D.state.formationLobby || null;

      if (st.id === "pg-choose") s.secs = PG.chooseSecs;
      if (st.id === "pg-punish") s.secs = PG.punishSecs;
      if (st.id === "coin-play") {
        s.secs = B.COIN.playSecs;
        if (D.state.coinLobby !== lobby()) { await S.clearCol("coin"); s.coinLobby = lobby(); s.spot = null; }
      }
      if (st.id === "coin-spot" && (!D.state.spot || D.state.spot.lobby !== lobby())) s.spot = pickSpot();
      await S.setDoc("", s);
    } finally { busy = false; }
  }

  async function formGroups() {
    const ids = here().map((p) => p.id);
    if (!ids.length) return null;
    const f = "f" + Date.now().toString(36);
    const groups = B.makeGroups(ids);
    await S.clearCol("groups");
    const items = [];
    for (let k = 0; k < groups.length; k++) {
      const gid = f + "g" + (k + 1), colour = {};
      groups[k].forEach((p, j) => (colour[p] = j));
      items.push(["groups/" + gid, { formation: f, members: groups[k], colour }, false]);
      for (const p of groups[k]) items.push(["players/" + p, { group: gid }, true]);
    }
    await S.batchSet(items);
    return f;
  }

  function pickSpot() {
    const fakes = coinRows().map((c) => c.data.fake).filter(Boolean);
    let fake = null, best = -1;
    for (const f of fakes) { const score = (B.longestRun(f) <= 3 ? 100 : 0) + B.switches(f); if (score > best) { best = score; fake = f; } }
    if (!fake) fake = "HTHHTHTTHTHHTHTTHTHT";
    let real = B.randomSeq(B.COIN.length), tries = 0;
    while (!(B.longestRun(real) >= 5 && B.switches(real) <= 10) && tries++ < 5000) real = B.randomSeq(B.COIN.length);
    const realIsA = Math.random() < 0.5;
    return { A: realIsA ? real : fake, B: realIsA ? fake : real, real: realIsA ? "A" : "B", lobby: lobby() };
  }

  // ---------- numbers for the charts ----------
  function roundStats(r) {
    const vals = [], totals = {};
    for (const g of curGroups()) {
      const m = g.data.members || [], c = (g.data.c || {})[rk(r)] || {};
      for (const p of m) vals.push(B.clampInt(c[p], 0, PG.endowment));
    }
    let answered = 0; for (const g of curGroups()) { const c = (g.data.c || {})[rk(r)] || {}; answered += (g.data.members || []).filter((p) => c[p] != null).length; }
    return { vals, avg: B.mean(vals), answered, n: vals.length, totals };
  }
  function punishStats(r) {
    let answered = 0, punishers = 0, lowRecv = [], highRecv = [];
    for (const g of curGroups()) {
      const m = g.data.members || [], c = (g.data.c || {})[rk(r)] || {}, p = (g.data.p || {})[rk(r)] || {};
      for (const x of m) {
        if (p[x]) { answered++; if (Object.values(p[x]).some((v) => v > 0)) punishers++; }
        let recv = 0; for (const y of m) if (y !== x && p[y] && p[y][x]) recv += p[y][x];
        (B.clampInt(c[x], 0, PG.endowment) < PG.endowment / 2 ? lowRecv : highRecv).push(recv);
      }
    }
    return { answered, punishers, lowRecv: B.mean(lowRecv), highRecv: B.mean(highRecv), nLow: lowRecv.length };
  }
  function doneRounds() {
    const s = D.state; if (!s || s.game !== "pg") return 0;
    if (s.phase === "final") return PG.rounds.length;
    if (["results", "chart", "rule"].includes(s.phase)) return s.round;
    return Math.max(0, (s.round || 1) - 1);
  }
  function totalsByPlayer() {
    const tot = {}, contr = {};
    for (const g of curGroups()) {
      const m = g.data.members || [];
      for (let r = 1; r <= PG.rounds.length; r++) {
        const e = B.roundEarnings(m, (g.data.c || {})[rk(r)], (g.data.p || {})[rk(r)]);
        for (const p of m) { tot[p] = (tot[p] || 0) + e[p].total; (contr[p] = contr[p] || []).push(e[p].contribution); }
      }
    }
    return { tot, contr };
  }

  // ---------- charts ----------
  const BLUE = "#3333b3", ORANGE = "#e8833a";
  Chart.defaults.font.family = '"Helvetica Neue", Arial, sans-serif';
  Chart.defaults.font.size = 16; Chart.defaults.color = "#333";
  function chart(id, config) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), config); return charts[id]; }
  function lineConfig(upto) {
    const labels = PG.rounds.map((r) => (r.punish ? r.n + " (punish)" : String(r.n)));
    const avgs = PG.rounds.map((r) => (r.n <= upto ? pct(roundStats(r.n).avg / PG.endowment) : null));
    const firstP = PG.rounds.findIndex((r) => r.punish);
    const plain = avgs.map((v, i) => (i < firstP ? v : null));
    const pun = avgs.map((v, i) => (i >= firstP ? v : i === firstP - 1 && upto > firstP ? v : null));
    return {
      type: "line",
      data: { labels, datasets: [
        { label: "Without punishment", data: plain, borderColor: BLUE, backgroundColor: BLUE, borderWidth: 4, pointRadius: 7, tension: 0 },
        { label: "With punishment", data: pun, borderColor: ORANGE, backgroundColor: ORANGE, borderWidth: 4, pointRadius: (c) => (c.dataIndex < firstP ? 0 : 7), tension: 0,
          segment: { borderDash: (c) => (c.p0DataIndex < firstP ? [6, 6] : undefined) } }
      ] },
      options: { maintainAspectRatio: false, animation: false, spanGaps: false,
        scales: { x: { title: { display: true, text: "round" } }, y: { min: 0, max: 100, title: { display: true, text: "% of tokens in the pot" } } },
        plugins: { legend: { position: "bottom" } } }
    };
  }
  function histConfig(vals) {
    const bins = ["0", "1–4", "5–9", "10–14", "15–19", "20"], cnt = [0, 0, 0, 0, 0, 0];
    for (const v of vals) cnt[v === 0 ? 0 : v === 20 ? 5 : 1 + Math.floor(v / 5)]++;
    return { type: "bar", data: { labels: bins, datasets: [{ label: "students", data: cnt, backgroundColor: BLUE }] },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } },
        scales: { x: { title: { display: true, text: "tokens put in the pot" } }, y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "students" } } } } };
  }
  function runConfig(fakes, reals) {
    const labels = ["1", "2", "3", "4", "5", "6", "7+"];
    const dist = (arr) => { const c = Array(7).fill(0); for (const s of arr) c[Math.min(7, B.longestRun(s)) - 1]++; return c.map((x) => (arr.length ? pct(x / arr.length) : 0)); };
    return { type: "bar", data: { labels, datasets: [
      { label: "You, pretending", data: dist(fakes), backgroundColor: ORANGE },
      { label: "Real coins", data: dist(reals), backgroundColor: BLUE }] },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { position: "bottom" } },
        scales: { x: { title: { display: true, text: "longest streak of the same side in 20 tosses" } }, y: { beginAtZero: true, title: { display: true, text: "% of sequences" } } } } };
  }

  // ---------- views ----------
  const studentURL = () => { const u = new URL("index.html", location.href); if (/[?&]demo=1/.test(location.search)) u.search = "?demo=1"; return u.toString(); };
  const chipRow = (seq, cls) => `<div class="seq ${cls || ""}">${[...(seq || "")].map((x) => `<span class="chip ${x}">${x}</span>`).join("")}</div>`;
  const kpi = (id, label, v) => `<div class="kpi"><div class="v" id="${id}">${v == null ? "–" : v}</div><div class="l">${label}</div></div>`;
  const progress = (id) => `<div class="progress"><div id="${id}"></div></div>`;
  function setProgress(id, a, n) { const el = $(id); if (el) el.style.width = (n ? pct(a / n) : 0) + "%"; }
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };

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
    const r = s.round;
    switch (st.id) {
      case "lobby": return `<h1>Join the games</h1><div class="rule"></div>
        <div class="qrwrap"><div class="qr" id="qr"></div><div><p class="lead">Scan with your phone camera, or open:</p><p class="url" id="url"></p>
        <div class="kpis">${kpi("k-joined", "students joined", 0)}</div><p class="muted">Keep the page open: it changes by itself when a game starts. Answers are anonymous.</p></div></div>`;
      case "pg-intro": return `<h1>Public goods game</h1><div class="rule"></div>
        <div class="cols"><div class="card soft lead"><b>Each round</b><ul>
          <li>You get <b>${PG.endowment} tokens</b>.</li><li>Choose how many to put in your <b>group's pot</b> (groups of ${PG.groupSize}); keep the rest.</li>
          <li>The pot is <b>doubled</b> and shared <b>equally</b> in the group, whatever each person put in.</li></ul>
          <b>Earnings</b> = tokens kept + share of the pot.</div>
          <div><div class="kpis">${kpi("k-groups", "groups", null)}${kpi("k-players", "players", null)}</div>
          <p class="lead">Everyone in: ${PG.endowment * 2} each. Nobody in: ${PG.endowment} each.</p><p class="muted">Same groups for all ${PG.rounds.length} rounds. Your phone shows your colour and your group.</p></div></div>`;
      case "pg-choose": return `<h1>Round ${r} of ${PG.rounds.length}: choose</h1><div class="rule"></div>
        ${PG.rounds[r - 1].punish ? `<p class="lead"><span class="pill">Punishment round</span> After choosing, everyone sees their group and can punish.</p>` : `<p class="lead">How many of your ${PG.endowment} tokens go in the pot?</p>`}
        <div class="kpis">${kpi("k-ans", "answers in", null)}<div class="kpi"><div class="v timer" id="dtimer">–</div><div class="l">time left</div></div></div>${progress("bar")}`;
      case "pg-punish": return `<h1>Round ${r}: punish</h1><div class="rule"></div>
        <p class="lead">Each point costs the punisher ${PG.punishCost} token and removes ${PG.punishEffect} tokens from the target.</p>
        <div class="kpis">${kpi("k-ans", "decisions in", null)}<div class="kpi"><div class="v timer" id="dtimer">–</div><div class="l">time left</div></div></div>${progress("bar")}`;
      case "pg-results": return `<h1>Round ${r}: results</h1><div class="rule"></div>
        <div class="kpis">${kpi("k-avg", "average put in (of " + PG.endowment + ")", null)}${kpi("k-zero", "put in nothing", null)}${kpi("k-all", "put in everything", null)}${PG.rounds[r - 1].punish ? kpi("k-pun", "punished someone", null) : ""}</div>
        <div class="cols"><div class="chartbox"><canvas id="c-hist"></canvas></div><div class="chartbox"><canvas id="c-line"></canvas></div></div>`;
      case "pg-chart": return `<h1>How did the class do?</h1><div class="rule"></div>
        <div class="chartbox tall"><canvas id="c-line"></canvas></div>
        <p class="lead">Self-interest predicts <b>0%</b>: each token you put in returns only ${B.fmt(PG.multiplier / PG.groupSize, 2)} to you. Best for the group: <b>100%</b>. Why do contributions fall?</p>`;
      case "pg-rule": return `<h1>New rule for rounds 5 and 6</h1><div class="rule"></div>
        <div class="card soft lead"><p>After everyone chooses, you see what each member of your group put in.</p>
        <p>You can then give <b>punishment points</b>: each point <b>costs you ${PG.punishCost} token</b> and <b>removes ${PG.punishEffect} tokens</b> from the person you punish (max ${PG.maxPunish} per round).</p>
        <p>A purely self-interested player <b>never punishes</b>: it costs them, and the game ends after round 6.</p></div>
        <p class="lead">Prediction? Will contributions change?</p>`;
      case "pg-final": return `<h1>Public goods game: final results</h1><div class="rule"></div>
        <div class="kpis">${kpi("k-a14", "average put in, rounds 1–4", null)}${kpi("k-a56", "average put in, rounds 5–6", null)}${kpi("k-pun", "punished at least once", null)}${kpi("k-top", "top earner's average contribution", null)}</div>
        <div class="cols"><div class="chartbox"><canvas id="c-line"></canvas></div><div class="card lead" id="punbox"></div></div>`;
      case "coin-play": return `<h1>Fake a coin</h1><div class="rule"></div>
        <p class="lead">Pretend to toss a fair coin <b>${B.COIN.length} times</b>: tap H or T on your phone and make it look <b>truly random</b>.</p>
        <div class="kpis">${kpi("k-ans", "sequences in", null)}<div class="kpi"><div class="v timer" id="dtimer">–</div><div class="l">time left</div></div></div>${progress("bar")}`;
      case "coin-results": return `<h1>You vs a real coin</h1><div class="rule"></div>
        <div class="kpis">${kpi("k-runF", "your longest streak (average)", null)}${kpi("k-runR", "real coin's longest streak (average)", null)}${kpi("k-swF", "your switches H↔T (average)", null)}${kpi("k-swR", "real coin's switches (average)", null)}</div>
        <div class="chartbox tall"><canvas id="c-run"></canvas></div>
        <p class="muted">In theory, 20 real tosses give a longest streak of about 4.7 on average and 9.5 switches; 46% of real sequences contain a streak of 5 or more.</p>`;
      case "coin-spot": case "coin-reveal": return `<h1>Spot the fake</h1><div class="rule"></div>
        <p class="lead">One was made by a student pretending; one is a real coin. Which is <b>real</b>? Vote on your phone.</p>
        <div class="card"><h2>A <span id="tagA"></span></h2>${chipRow(s.spot && s.spot.A, "bigseq")}</div>
        <div class="card"><h2>B <span id="tagB"></span></h2>${chipRow(s.spot && s.spot.B, "bigseq")}</div>
        <div class="kpis">${kpi("k-vA", "voted A", null)}${kpi("k-vB", "voted B", null)}${st.id === "coin-reveal" ? kpi("k-right", "spotted the real coin", null) : ""}</div>`;
      case "end": return `<h1>Thanks for playing</h1><div class="rule"></div><p class="lead">Use the step menu below to go back to any screen.</p>`;
    }
    return "";
  }

  function afterMount(st, s) {
    if (st.id === "lobby") {
      const url = studentURL(); set("url", url.replace(/^https?:\/\//, ""));
      const q = qrcode(0, "M"); q.addData(url); q.make(); $("qr").innerHTML = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    }
    if ($("c-line")) chart("c-line", lineConfig(doneRounds()));
    if ($("c-hist")) chart("c-hist", histConfig(roundStats(s.round).vals));
    if ($("c-run")) chart("c-run", runConfig([], []));
  }

  function update(st, s) {
    const r = s.round;
    if (st.id === "lobby") set("k-joined", here().length);
    if (st.id === "pg-intro") { set("k-groups", curGroups().length); set("k-players", curGroups().reduce((a, g) => a + (g.data.members || []).length, 0)); }
    if (st.id === "pg-choose") { const x = roundStats(r); set("k-ans", x.answered + " / " + x.n); setProgress("bar", x.answered, x.n); }
    if (st.id === "pg-punish") { const x = punishStats(r), n = roundStats(r).n; set("k-ans", x.answered + " / " + n); setProgress("bar", x.answered, n); }
    if (st.id === "pg-results") {
      const x = roundStats(r);
      set("k-avg", B.fmt(x.avg, 1)); set("k-zero", pct(x.vals.filter((v) => v === 0).length / (x.n || 1)) + "%"); set("k-all", pct(x.vals.filter((v) => v === PG.endowment).length / (x.n || 1)) + "%");
      if (PG.rounds[r - 1].punish) { const p = punishStats(r); set("k-pun", pct(p.punishers / (x.n || 1)) + "%"); }
      refresh("c-hist", histConfig(x.vals)); refresh("c-line", lineConfig(doneRounds()));
    }
    if (st.id === "pg-chart") refresh("c-line", lineConfig(doneRounds()));
    if (st.id === "pg-final") {
      const early = [], late = []; for (const r2 of PG.rounds) (r2.punish ? late : early).push(roundStats(r2.n).avg);
      set("k-a14", B.fmt(B.mean(early), 1)); set("k-a56", B.fmt(B.mean(late), 1));
      const punishedOnce = new Set(); let lowR = [], highR = [];
      for (const r2 of PG.rounds.filter((x) => x.punish)) {
        for (const g of curGroups()) { const p = (g.data.p || {})[rk(r2.n)] || {}; for (const x in p) if (Object.values(p[x]).some((v) => v > 0)) punishedOnce.add(x); }
        const ps = punishStats(r2.n); lowR.push(ps.lowRecv); highR.push(ps.highRecv);
      }
      const n = curGroups().reduce((a, g) => a + (g.data.members || []).length, 0);
      set("k-pun", pct(punishedOnce.size / (n || 1)) + "%");
      const { tot, contr } = totalsByPlayer();
      const top = Object.keys(tot).sort((a, b) => tot[b] - tot[a])[0];
      set("k-top", top ? B.fmt(B.mean(contr[top]), 1) + " / " + PG.endowment : "–");
      const box = $("punbox");
      if (box) box.innerHTML = `<b>Who got punished?</b><p>Points received per round, on average:</p>
        <p>Put in less than ${PG.endowment / 2}: <b>${B.fmt(B.mean(lowR), 1)}</b> points<br>Put in ${PG.endowment / 2} or more: <b>${B.fmt(B.mean(highR), 1)}</b> points</p>
        <p class="muted">The top earner put in ${top ? B.fmt(B.mean(contr[top]), 1) : "–"} tokens per round on average; the class average was ${B.fmt(B.mean(early.concat(late)), 1)}.</p>`;
      refresh("c-line", lineConfig(PG.rounds.length));
    }
    if (st.id === "coin-play") { const n = here().length, a = coinRows().filter((c) => c.data.fake).length; set("k-ans", a + " / " + n); setProgress("bar", a, n); }
    if (st.id === "coin-results") {
      const rows = coinRows().filter((c) => c.data.fake);
      const fakes = rows.map((c) => c.data.fake), reals = rows.map((c) => c.data.real);
      set("k-runF", fakes.length ? B.fmt(B.mean(fakes.map(B.longestRun)), 1) : "–"); set("k-runR", reals.length ? B.fmt(B.mean(reals.map(B.longestRun)), 1) : "–");
      set("k-swF", fakes.length ? B.fmt(B.mean(fakes.map(B.switches)), 1) : "–"); set("k-swR", reals.length ? B.fmt(B.mean(reals.map(B.switches)), 1) : "–");
      refresh("c-run", runConfig(fakes, reals));
    }
    if (st.id === "coin-spot" || st.id === "coin-reveal") {
      const v = coinRows().map((c) => c.data.vote).filter(Boolean);
      const a = v.filter((x) => x === "A").length, b = v.filter((x) => x === "B").length;
      set("k-vA", a); set("k-vB", b);
      if (st.id === "coin-reveal" && s.spot) {
        set("k-right", pct((s.spot.real === "A" ? a : b) / ((a + b) || 1)) + "%");
        set("tagA", s.spot.real === "A" ? "· real coin" : "· made by a student"); set("tagB", s.spot.real === "B" ? "· real coin" : "· made by a student");
      }
    }
  }
  function refresh(id, config) {
    const c = charts[id]; if (!c) return;
    c.data.labels = config.data.labels;
    config.data.datasets.forEach((d, i) => { if (c.data.datasets[i]) c.data.datasets[i].data = d.data; });
    c.update("none");
  }

  // ---------- demo: simulated students ----------
  async function addBots() {
    if (!S.demo || !lobby()) return;
    for (let i = 0; i < 16; i++) {
      const id = "pbot" + Math.random().toString(36).slice(2, 7);
      await S.setDoc("players/" + id, { lobby: lobby(), joinedAt: Date.now(), bot: true, coop: Math.random() });
    }
  }
  const acted = {};
  function botsReact() {
    const s = D.state; if (!S.demo || !s || acted[s.phaseId]) return;
    acted[s.phaseId] = true;
    const bots = D.players.filter((p) => p.data.bot && p.data.lobby === s.lobby);
    const later = (fn) => setTimeout(fn, 400 + Math.random() * 5000);
    if (s.game === "pg" && (s.phase === "choose" || s.phase === "punish")) {
      for (const b of bots) {
        const g = curGroups().find((x) => (x.data.members || []).includes(b.id)); if (!g) continue;
        const coop = b.data.coop, r = s.round;
        if (s.phase === "choose") {
          const base = r <= 4 ? coop - 0.12 * (r - 1) : coop + 0.2 - 0.05 * (r - 5);
          const v = B.clampInt(PG.endowment * (base + (Math.random() - 0.5) * 0.3), 0, PG.endowment);
          later(() => S.updateDoc("groups/" + g.id, { ["c." + rk(r) + "." + b.id]: v }));
        } else {
          later(async () => {
            const gd = await S.getDoc("groups/" + g.id); const c = (gd.c || {})[rk(r)] || {};
            const pts = {}; let left = PG.maxPunish;
            for (const o of gd.members) if (o !== b.id) { pts[o] = 0; if (coop > 0.4 && (c[o] || 0) < 8 && left > 0) { const k = Math.min(left, 1 + Math.floor(Math.random() * 3)); pts[o] = k; left -= k; } }
            S.updateDoc("groups/" + g.id, { ["p." + rk(r) + "." + b.id]: pts });
          });
        }
      }
    }
    if (s.game === "coin" && s.phase === "play") {
      for (const b of bots) {
        let seq = Math.random() < 0.5 ? "H" : "T";
        while (seq.length < B.COIN.length) { const last = seq[seq.length - 1]; const run = seq.length - seq.replace(/(.)\1*$/, "").length; seq += Math.random() < (run >= 3 ? 0.9 : 0.6) ? (last === "H" ? "T" : "H") : last; }
        later(() => S.setDoc("coin/" + b.id, { fake: seq, real: B.randomSeq(B.COIN.length), lobby: s.lobby }, true));
      }
    }
    if (s.game === "coin" && s.phase === "spot" && s.spot) {
      for (const b of bots) { const wrong = s.spot.real === "A" ? "B" : "A"; later(() => S.setDoc("coin/" + b.id, { vote: Math.random() < 0.6 ? wrong : s.spot.real, lobby: s.lobby }, true)); }
    }
  }
})();
