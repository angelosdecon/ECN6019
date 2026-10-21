// Student page: one page for all games; it follows whatever the lecturer opens.
(function () {
  const S = window.Store, B = window.BL, PG = B.PG, cfg = window.BIASLAB_CONFIG || {};
  const view = document.getElementById("view");
  document.getElementById("modname").textContent = (cfg.moduleName || "") + (S.demo ? " · demo mode" : "");

  // Each phone keeps its own anonymous id. In demo mode each browser tab is a separate student.
  const idStore = S.demo ? sessionStorage : localStorage;
  const ID_KEY = "ecn-pid-" + S.root;
  let pid = idStore.getItem(ID_KEY);
  if (!pid) { pid = B.newId(); idStore.setItem(ID_KEY, pid); }

  // Phones pause pages when the screen locks or the student switches app, and the live
  // connection does not always resume. When the page comes back after a pause, reload it:
  // the phone keeps its anonymous id, so the student goes straight back to their group.
  let hiddenAt = null;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 3000) location.reload();
    hiddenAt = null;
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });
  window.addEventListener("online", () => location.reload());

  const st = { state: null, player: null, group: null, coin: null };
  const ui = { choose: {}, punish: {}, coinSeq: "", phaseSeen: {} };
  let unGroup = null, groupId = null, lastSig = "";

  S.onDoc("", (d) => { st.state = d; register(); render(); });
  S.onDoc("players/" + pid, (d) => {
    st.player = d;
    const g = d && d.group;
    if (g !== groupId) {
      groupId = g; if (unGroup) unGroup(); st.group = null;
      if (g) unGroup = S.onDoc("groups/" + g, (gd) => { st.group = gd; render(); });
    }
    register(); render();
  });
  S.onDoc("coin/" + pid, (d) => { st.coin = d; render(); });

  // Join the current lobby (one write each time the lecturer opens a new session).
  function register() {
    const lobby = st.state && st.state.lobby;
    if (!lobby || st.player === undefined) return;
    if (st.player && st.player.lobby === lobby) return;
    if (register.pending === lobby) return;
    register.pending = lobby;
    // demo mode keeps data in one browser, so stagger tabs to avoid two tabs saving at the same instant
    setTimeout(() => S.setDoc("players/" + pid, { lobby, joinedAt: Date.now() }, true), S.demo ? Math.random() * 1500 : 0);
  }

  // ---------------- helpers ----------------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const colourOf = (p) => (st.group && st.group.colour && st.group.colour[p] != null ? B.COLOURS[st.group.colour[p]] : B.COLOURS[0]);
  const badge = (p, label) => { const c = colourOf(p); return `<span class="badge" style="background:${c.hex}">${esc(label || c.name)}</span>`; };
  const dot = (p) => `<span class="dot" style="background:${colourOf(p).hex}"></span>`;
  const members = () => (st.group && st.group.members) || [];
  const rk = (r) => "r" + r;
  const myContribution = (r) => { const c = st.group && st.group.c && st.group.c[rk(r)]; return c && c[pid] != null ? c[pid] : null; };
  const chips = (seq, n) => { let h = ""; for (let i = 0; i < n; i++) h += seq[i] ? `<span class="chip ${seq[i]}">${seq[i]}</span>` : `<span class="chip empty">·</span>`; return `<div class="seq">${h}</div>`; };

  function earningsUpTo(r) {
    let total = 0;
    for (let k = 1; k <= r; k++) {
      const g = st.group || {};
      const e = B.roundEarnings(members(), (g.c || {})[rk(k)], (g.p || {})[rk(k)]);
      if (e[pid]) total += e[pid].total;
    }
    return total;
  }

  // Countdown: started when this phone first sees the phase; advisory only (the lecturer closes the round).
  function deadline() {
    const s = st.state; if (!s || !s.secs) return null;
    if (!ui.phaseSeen[s.phaseId]) ui.phaseSeen[s.phaseId] = Date.now() + s.secs * 1000;
    return ui.phaseSeen[s.phaseId];
  }
  setInterval(() => {
    const el = document.getElementById("timer"); const d = deadline();
    if (!el || !d) return;
    const left = Math.max(0, Math.ceil((d - Date.now()) / 1000));
    el.textContent = left > 0 ? left + "s" : "Time's up: submit now";
    el.classList.toggle("out", left === 0);
  }, 250);
  const timerHtml = () => `<div class="small muted">Time left: <span id="timer" class="timer">…</span></div>`;

  // ---------------- render ----------------
  function render() {
    const s = st.state;
    let sig, html;
    if (!s || !s.lobby) { sig = "wait"; html = `<h2>Welcome</h2><div class="rule"></div><p>Waiting for the lecturer to open the session…</p>`; }
    else if (s.game === "pg") [sig, html] = renderPG(s);
    else if (s.game === "coin") [sig, html] = renderCoin(s);
    else if (s.game === "end") { sig = "end"; html = `<h2>Thanks for playing</h2><div class="rule"></div><p>You can close this page. Keep it open if the lecturer says there is more to come.</p>`; }
    else { sig = "lobby"; html = `<h2>You're in!</h2><div class="rule"></div><p class="lead">Keep this page open. It will change by itself when the lecturer starts a game.</p><p class="muted small">Your answers are anonymous.</p>`; }
    const status = document.getElementById("status");
    if (!status.dataset.ready) {
      status.dataset.ready = "1";
      status.innerHTML = '<a href="#" id="reload" style="color:var(--blue)">Not updating? Tap here</a>';
      document.getElementById("reload").onclick = (e) => { e.preventDefault(); location.reload(); };
    }
    if (sig === lastSig) return;          // nothing that this phone shows has changed
    lastSig = sig; view.innerHTML = html; bind(s);
  }

  // ---------- public goods game ----------
  function renderPG(s) {
    const inGame = st.group && st.group.formation === s.formation && (st.group.members || []).includes(pid);
    if (!inGame) return ["pg-out", `<h2>Public goods game</h2><div class="rule"></div><p>This game started before you joined, so you are watching this one. Look at the screen. You will play in the next game.</p>`];
    const n = members().length, r = s.round;
    const head = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">${badge(pid, "You are " + colourOf(pid).name)}<span class="pill">${r ? "Round " + r + " of " + PG.rounds.length : "Public goods"}</span></div>`;

    if (s.phase === "intro") {
      const others = members().filter((m) => m !== pid).map((m) => dot(m) + " " + colourOf(m).name).join(", ");
      return ["pg-intro-" + n, `${head}<h2 style="margin-top:14px">Public goods game</h2><div class="rule"></div>
        <p>You are in a group of <b>${n}</b> with ${others}. Groups stay the same in every round.</p>
        <div class="card soft"><b>Each round</b><ul>
        <li>You get <b>${PG.endowment} tokens</b>.</li>
        <li>Choose how many to put in the <b>group pot</b>; you keep the rest.</li>
        <li>The pot is <b>doubled</b> and shared <b>equally</b> among all ${n} of you, whatever each person put in.</li></ul>
        <b>Your earnings</b> = tokens you kept + your share of the pot.</div>
        <p class="muted small">Example: if everyone puts in all ${PG.endowment}, the pot is ${PG.endowment * n}, doubled to ${2 * PG.endowment * n}, so everyone earns ${2 * PG.endowment}. If nobody puts anything in, everyone keeps ${PG.endowment}.</p>
        <p>Wait for round 1 to open.</p>`];
    }

    if (s.phase === "choose") {
      const mine = myContribution(r);
      if (ui.choose.round !== r) { ui.choose = { round: r, value: mine != null ? mine : 10 }; }
      const prev = r > 1 ? `<p class="small muted">Your earnings so far: <b>${B.fmt(earningsUpTo(r - 1), 1)}</b> tokens.</p>` : "";
      const rule = PG.rounds[r - 1] && PG.rounds[r - 1].punish ? `<p class="small"><span class="pill">Punishment round</span> After everyone chooses, you will see the contributions and can punish.</p>` : "";
      return ["pg-choose-" + r + "-" + mine + "-" + s.phaseId, `${head}
        <h2 style="margin-top:14px">How many of your ${PG.endowment} tokens go in the pot?</h2><div class="rule"></div>
        ${rule}
        <div class="stepper"><button id="minus">−</button><div class="value" id="val">${ui.choose.value}</div><button id="plus">+</button></div>
        <input type="range" id="slider" min="0" max="${PG.endowment}" value="${ui.choose.value}">
        <div class="quick">${[0, 5, 10, 15, 20].map((v) => `<button data-v="${v}">${v}</button>`).join("")}</div>
        <button class="primary big full" id="submit">${mine != null ? "Change my choice" : "Put in the pot"}</button>
        ${mine != null ? `<p class="center" style="color:var(--ok)"><b>Submitted: ${mine} tokens.</b> You can change it until the round closes.</p>` : ""}
        ${timerHtml()}${prev}
        <p class="small muted">The pot is doubled and shared equally among the ${n} of you.</p>`];
    }

    if (s.phase === "punish") {
      const others = members().filter((m) => m !== pid);
      const c = (st.group.c || {})[rk(r)] || {};
      const sent = st.group.p && st.group.p[rk(r)] && st.group.p[rk(r)][pid];
      if (ui.punish.round !== r) { ui.punish = { round: r, pts: {} }; others.forEach((o) => (ui.punish.pts[o] = sent && sent[o] ? sent[o] : 0)); }
      const used = Object.values(ui.punish.pts).reduce((a, b) => a + b, 0);
      const rows = others.map((o) => `<div class="pointsrow"><div>${dot(o)} <b>${colourOf(o).name}</b> put in <b>${c[o] != null ? c[o] : 0}</b></div>
        <div class="ctl"><button data-dec="${o}">−</button><span>${ui.punish.pts[o]}</span><button data-inc="${o}">+</button></div></div>`).join("");
      return ["pg-punish-" + r + "-" + JSON.stringify(ui.punish.pts) + "-" + JSON.stringify(sent || null) + "-" + JSON.stringify(c), `${head}
        <h2 style="margin-top:14px">Punish anyone?</h2><div class="rule"></div>
        <p>You put in <b>${c[pid] != null ? c[pid] : 0}</b>. Each punishment point <b>costs you ${PG.punishCost} token</b> and <b>removes ${PG.punishEffect} tokens</b> from that person (at most ${PG.maxPunish} points in total).</p>
        ${rows}
        <p>Points used: <b>${used}</b> of ${PG.maxPunish} · cost to you: <b>${used * PG.punishCost}</b></p>
        <button class="primary big full" id="psubmit">${sent ? "Change my punishment" : "Confirm"}</button>
        ${sent ? `<p class="center" style="color:var(--ok)"><b>Confirmed.</b> You can change it until the lecturer closes this stage.</p>` : ""}
        ${timerHtml()}`];
    }

    if (s.phase === "results" || s.phase === "chart") {
      const g = st.group, c = (g.c || {})[rk(r)] || {}, p = (g.p || {})[rk(r)];
      const e = B.roundEarnings(members(), c, p);
      const me = e[pid];
      const rows = members().map((m) => `<tr class="${m === pid ? "me" : ""}"><td>${dot(m)} ${colourOf(m).name}${m === pid ? " (you)" : ""}</td><td class="num">${e[m].contribution}</td><td class="num">${B.fmt(e[m].total, 1)}</td></tr>`).join("");
      const pun = p ? `<tr><td>Punishment: cost to you</td><td class="num">−${me.cost}</td></tr><tr><td>Punishment: removed by others</td><td class="num">−${me.lost}</td></tr>` : "";
      return ["pg-res-" + r + "-" + JSON.stringify(e) + s.phase, `${head}
        <h2 style="margin-top:14px">Round ${r} results</h2><div class="rule"></div>
        <table class="mini"><tr><th>Group member</th><th class="num">Put in</th><th class="num">Earned</th></tr>${rows}</table>
        <div class="card soft"><table class="mini">
          <tr><td>Pot</td><td class="num">${me.pot} → doubled ${2 * me.pot}</td></tr>
          <tr><td>You kept</td><td class="num">${me.kept}</td></tr>
          <tr><td>Your share of the pot</td><td class="num">+${B.fmt(me.share, 1)}</td></tr>${pun}
          <tr class="me"><td>Your earnings this round</td><td class="num">${B.fmt(me.total, 1)}</td></tr>
          <tr><td>Total so far</td><td class="num">${B.fmt(earningsUpTo(r), 1)}</td></tr></table></div>
        ${s.phase === "chart" ? `<p><b>Look at the screen:</b> how did the whole class do?</p>` : `<p class="muted">Wait for the next round.</p>`}`];
    }

    if (s.phase === "rule") {
      return ["pg-rule", `${head}<h2 style="margin-top:14px">New rule for rounds 5 and 6</h2><div class="rule"></div>
        <div class="card soft"><p>After everyone has chosen, you will see what each member of your group put in.</p>
        <p>You can then give <b>punishment points</b>: each point <b>costs you ${PG.punishCost} token</b> and <b>removes ${PG.punishEffect} tokens</b> from the person you give it to. At most ${PG.maxPunish} points per round. You do not have to punish anyone.</p></div>
        <p>Same groups, same pot rules. Wait for round 5 to open.</p>`];
    }

    if (s.phase === "final") {
      const mine = []; for (let k = 1; k <= PG.rounds.length; k++) { const v = myContribution(k); mine.push(v == null ? 0 : v); }
      return ["pg-final-" + earningsUpTo(PG.rounds.length), `${head}<h2 style="margin-top:14px">Game over</h2><div class="rule"></div>
        <div class="kpis"><div class="kpi"><div class="v">${B.fmt(earningsUpTo(PG.rounds.length), 1)}</div><div class="l">your total tokens</div></div>
        <div class="kpi"><div class="v">${B.fmt(B.mean(mine), 1)}</div><div class="l">your average contribution (of ${PG.endowment})</div></div></div>
        <p>Look at the screen for the class results.</p>`];
    }
    return ["pg-other", `<p>Look at the screen.</p>`];
  }

  // ---------- fake a coin ----------
  function renderCoin(s) {
    const c = st.coin && st.coin.lobby === s.lobby ? st.coin : {};
    if (s.phase === "play") {
      if (c.fake) return ["coin-done-" + c.fake, `<h2>Done!</h2><div class="rule"></div><p>Your sequence:</p>${chips(c.fake, B.COIN.length)}<p class="muted">Wait for the results on the screen.</p>`];
      const seq = ui.coinSeq, n = B.COIN.length;
      return ["coin-play-" + seq + "-" + s.phaseId, `<h2>Fake a coin</h2><div class="rule"></div>
        <p>Pretend you are tossing a fair coin <b>${n} times</b>. Tap H or T for each toss and try to make it look <b>truly random</b>. No real coin, no thinking too long.</p>
        ${chips(seq, n)}
        <div class="coinpad"><button class="h" id="h" ${seq.length >= n ? "disabled" : ""}>H</button><button class="t" id="t" ${seq.length >= n ? "disabled" : ""}>T</button></div>
        <div style="display:flex;gap:10px"><button id="undo" ${seq.length ? "" : "disabled"}>Undo</button><button class="primary full" style="flex:1" id="csubmit" ${seq.length === n ? "" : "disabled"}>Submit (${seq.length}/${n})</button></div>`];
    }
    if (s.phase === "results") {
      if (!c.fake) return ["coin-res-none", `<h2>Fake a coin</h2><div class="rule"></div><p>Look at the screen.</p>`];
      return ["coin-res-" + c.fake, `<h2>Your sequence vs a real coin</h2><div class="rule"></div>
        <p><b>You (pretending):</b></p>${chips(c.fake, c.fake.length)}
        <p class="small">Longest streak: <b>${B.longestRun(c.fake)}</b> · switches between H and T: <b>${B.switches(c.fake)}</b></p>
        <p><b>A real coin, tossed ${c.real.length} times for you:</b></p>${chips(c.real, c.real.length)}
        <p class="small">Longest streak: <b>${B.longestRun(c.real)}</b> · switches: <b>${B.switches(c.real)}</b></p>
        <p class="muted small">Look at the screen for the whole class.</p>`];
    }
    if (s.phase === "spot" || s.phase === "reveal") {
      const sp = s.spot || {}; const v = c.vote;
      const res = s.phase === "reveal" ? `<div class="card soft"><b>Sequence ${sp.real} was the real coin.</b> ${v ? (v === sp.real ? "You spotted it!" : "You picked the fake one; most people do.") : ""}</div>` : "";
      return ["coin-" + s.phase + "-" + v + "-" + (sp.A || ""), `<h2>Spot the fake</h2><div class="rule"></div>
        <p>One of these was made by a student pretending. The other is a real coin. Which is the <b>real</b> coin?</p>
        <p><b>A</b></p>${chips(sp.A || "", (sp.A || "").length)}<p><b>B</b></p>${chips(sp.B || "", (sp.B || "").length)}
        <div class="vote"><button data-vote="A" class="${v === "A" ? "chosen" : ""}" ${s.phase === "reveal" ? "disabled" : ""}>A is real</button><button data-vote="B" class="${v === "B" ? "chosen" : ""}" ${s.phase === "reveal" ? "disabled" : ""}>B is real</button></div>${res}`];
    }
    return ["coin-other", `<p>Look at the screen.</p>`];
  }

  // ---------------- events ----------------
  function bind(s) {
    const $ = (id) => document.getElementById(id);
    if (s && s.game === "pg" && s.phase === "choose") {
      const set = (v) => { ui.choose.value = Math.max(0, Math.min(PG.endowment, v)); $("val").textContent = ui.choose.value; $("slider").value = ui.choose.value; };
      $("minus").onclick = () => set(ui.choose.value - 1);
      $("plus").onclick = () => set(ui.choose.value + 1);
      $("slider").oninput = (e) => set(Number(e.target.value));
      view.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => set(Number(b.dataset.v))));
      $("submit").onclick = () => { $("submit").disabled = true; S.updateDoc("groups/" + groupId, { ["c." + rk(s.round) + "." + pid]: ui.choose.value }); };
    }
    if (s && s.game === "pg" && s.phase === "punish") {
      const used = () => Object.values(ui.punish.pts).reduce((a, b) => a + b, 0);
      view.querySelectorAll("[data-inc]").forEach((b) => (b.onclick = () => { if (used() < PG.maxPunish) { ui.punish.pts[b.dataset.inc]++; render(); } }));
      view.querySelectorAll("[data-dec]").forEach((b) => (b.onclick = () => { if (ui.punish.pts[b.dataset.dec] > 0) { ui.punish.pts[b.dataset.dec]--; render(); } }));
      $("psubmit").onclick = () => { $("psubmit").disabled = true; S.updateDoc("groups/" + groupId, { ["p." + rk(s.round) + "." + pid]: Object.assign({}, ui.punish.pts) }); };
    }
    if (s && s.game === "coin" && s.phase === "play" && $("h")) {
      const add = (x) => { if (ui.coinSeq.length < B.COIN.length) { ui.coinSeq += x; render(); } };
      $("h").onclick = () => add("H"); $("t").onclick = () => add("T");
      $("undo").onclick = () => { ui.coinSeq = ui.coinSeq.slice(0, -1); render(); };
      $("csubmit").onclick = () => { $("csubmit").disabled = true; S.setDoc("coin/" + pid, { fake: ui.coinSeq, real: B.randomSeq(B.COIN.length), lobby: s.lobby }, true); };
    }
    if (s && s.game === "coin" && s.phase === "spot") {
      view.querySelectorAll("[data-vote]").forEach((b) => (b.onclick = () => S.setDoc("coin/" + pid, { vote: b.dataset.vote, lobby: s.lobby }, true)));
    }
  }
})();
