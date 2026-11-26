// Week 8 student page. The dashboard sets the phase:
//  lobby → work, wres (Cournot workout, self-paced) → r1 → r1res → r2 → r2res → theory (guess ⅔ of the average)
//  → spot, sres (spot the equilibrium, optional) → end
// The Cournot workout stays available after its step; "Spot the equilibrium" can also be opened from the workout's last screen.
(function () {
  const S = window.Store, B = window.BL, cfg = window.BIASLAB_CONFIG || {};
  const view = document.getElementById("view");
  document.getElementById("modname").textContent = (cfg.moduleName || "") + (S.demo ? " · demo mode" : "");

  const idStore = S.demo ? sessionStorage : localStorage;
  const ID_KEY = "ecn-pid-" + S.root;
  let pid = idStore.getItem(ID_KEY);
  if (!pid) { pid = B.newId(); idStore.setItem(ID_KEY, pid); }
  const myName = B.nameOf(pid);

  let hiddenAt = null;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 3000) location.reload();
    hiddenAt = null;
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });

  const st = { state: null, mine: undefined };
  const ui = { guess: 50, edited: {}, sel: {}, none: {}, picked: null, hint: null, mode: "cournot" };
  // Round 0 of the workout is saved for the dashboard; "Try another market" (rounds 1, 2, …) stays on this phone.
  const prac = { round: 0, r: {} };
  S.onDoc("", (d) => { st.state = d; register(); render(); });
  S.onDoc("pl/" + pid, (d) => { st.mine = d; register(); render(); });

  const lobby = () => st.state && st.state.lobby;
  const phase = () => (st.state && st.state.phase) || "lobby";
  const mine = () => (st.mine && st.mine.lobby === lobby() ? st.mine : null);
  const GUESS = ["r1", "r1res", "r2", "r2res", "theory"];

  function register() {
    if (!lobby() || st.mine === undefined) return;
    if (mine() || register.pending === lobby()) return;
    register.pending = lobby();
    S.setDoc("pl/" + pid, { lobby: lobby(), name: myName, joinedAt: Date.now(), g: {}, s: {}, w: {}, h: {} });
  }

  const nameCard = () => `<div class="card soft small">You are <b>${myName}</b>. Remember it: if we play the guessing game, winners are announced by name.</div>`;
  const chips = (n, get, cur) => Array.from({ length: n }, (_, k) => { const a = get(k); return `<span class="chip ${a ? (a.ok ? "okc" : "noc") : k === cur ? "cur" : "empty"}">${a ? (a.ok ? "✓" : "✗") : k + 1}</span>`; }).join("");

  // ---------------------------------------------------------------- render
  let lastSig = "";
  function render() {
    let out;
    const ph = phase();
    if (!lobby()) out = { sig: "wait", html: `<h2>Welcome</h2><div class="rule"></div><p>Waiting for the lecturer to open the session…</p>` };
    else if (ph === "lobby") out = { sig: "lobby" + lobby(), html: `<h2>You're in</h2><div class="rule"></div><p>Keep this page open.</p>${nameCard()}
      <p class="muted">First a Cournot duopoly to solve step by step, before we do it together on the slides. Later, if there is time, a guessing game for the whole class.</p>` };
    else if (GUESS.includes(ph)) out = guessView(ph);
    else if (ph === "spot" || ph === "sres" || ui.mode === "spot") out = spotView();
    else out = cournotView();
    if (out.sig === lastSig) return;
    lastSig = out.sig; view.innerHTML = out.html; wire();
  }

  // ---------------------------------------------------------------- Cournot workout
  const answers = () => (prac.round ? prac.r : (mine() && mine().w) || {});
  function position() {
    const r = answers();
    for (const ex of B.EX) {
      const steps = ex.steps(pid, prac.round);
      for (let i = 0; i < steps.length; i++) if (!r[ex.key + i] || !r[ex.key + i].nx) return { ex, steps, i, r };
    }
    return { done: true, r };
  }
  function score(r, key, n) { let ok = 0; for (let i = 0; i < n; i++) if (r[key + i] && r[key + i].ok) ok++; return ok; }

  function cournotView() {
    const pos = position(), m = B.market(pid, prac.round);
    if (pos.done) {
      const NC = B.EX[0].steps(pid).length, NB = B.EX[1].steps(pid).length;
      const c = score(pos.r, "c", NC), b = score(pos.r, "b", NB);
      return { sig: "cdone" + prac.round + c + b, html: `<h2>${prac.round ? "Market " + (prac.round + 1) + " done!" : "Well done!"}</h2><div class="rule"></div>
        ${graph(m, 99)}
        <div class="card soft"><p><b>Cournot duopoly:</b> ${c} / ${NC} right first time</p><p><b>Bonus (three firms):</b> ${b} / ${NB} right first time</p></div>
        ${prac.round ? `<p class="muted">Extra practice: these answers stay on your phone.</p>` : `<p class="muted">Look up at the screen for how the class did.</p>`}
        <button class="primary full" id="another">Try another market ▶</button>
        <p class="small muted center">New numbers just for you, same steps. Good practice for Problem Set 8, Questions 4–6, and the exam.</p>
        <button class="full" id="tospot" style="margin-top:10px">More practice: spot the equilibrium ▶</button>` };
    }
    const { ex, steps, i, r } = pos, s = steps[i], saved = r[ex.key + i];
    const picked = saved ? { key: saved.key } : ui.picked && ui.picked.step === ex.key + i ? ui.picked : null;
    const hintOpen = ui.hint === ex.key + i;
    const level = ex.key === "c" ? i + (picked ? 1 : 0) : 99;
    let body = `<div class="small muted">${prac.round ? "Market " + (prac.round + 1) + " · " : ""}${ex.title} · step ${i + 1} of ${steps.length}</div>
      <h2 style="margin-top:4px">${s.title}</h2><div class="rule"></div>
      <div class="card soft small">${steps[0].intro}${i ? `<div class="known"><b>What we know so far</b><ul>${steps.slice(0, i).map((x) => `<li>${x.fact}</li>`).join("")}</ul></div>` : ""}</div>
      ${graph(m, level)}
      <p>${s.q}</p>`;
    if (!picked) {
      body += hintOpen ? `<div class="hint">💡 ${s.hint}</div>` : `<button class="hintbtn" id="hint">💡 Hint</button>`;
      body += `<div class="opts">${s.options.map((o) => `<button class="opt" data-k="${o.key}">${o.label}</button>`).join("")}</div>`;
    } else {
      const o = s.options.find((x) => x.key === picked.key), right = s.options.find((x) => x.correct);
      body += `<div class="opts">${s.options.map((x) => `<button class="opt ${x.correct ? "right" : x.key === o.key ? "wrong" : "dim"}" disabled>${x.label}</button>`).join("")}</div>
        <div class="card ${o.correct ? "okcard" : "nocard"}"><b>${o.correct ? "✓ Right." : "✗ Not quite. The answer is " + right.label + "."}</b>
        ${!o.correct && s.tips && s.tips[o.tag] ? `<p>${s.tips[o.tag]}</p>` : ""}<p>${s.why}</p></div>
        <button class="primary full" id="next">${i + 1 < steps.length ? "Next step ▶" : ex.key === "c" ? "Bonus: three firms ▶" : "Finish ▶"}</button>`;
    }
    const dots = chips(steps.length, (k) => (r[ex.key + k] && r[ex.key + k].nx ? r[ex.key + k] : null), i);
    return { sig: "c" + prac.round + "-" + ex.key + i + (picked ? picked.key : "") + (hintOpen ? "h" : ""),
      html: `<div class="seq">${dots}</div>${body}<p class="small muted center">${score(r, ex.key, steps.length)} right so far</p>` };
  }

  // The best-response diagram, to scale, with the student's own numbers.
  // It fills in as the steps are done: axes → firm 1's best response (after step 3) → firm 2's and the equilibrium (after step 4).
  function graph(m, level) {
    const { k, h, q } = m, W = 330, H = 286, L = 44, T = 18, PW = 250, PH = 222;
    const X = (u) => L + (u / k) * PW, Y = (v) => T + PH - (v / k) * PH;
    const BLUE = "#3333b3", ORANGE = "#c4621a", GREEN = "#2e9e5b", GREY = "#777", n = B.num;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="egraph" role="img" aria-label="Best-response diagram">
      <line x1="${X(0)}" y1="${Y(0)}" x2="${X(k) + 10}" y2="${Y(0)}" stroke="#333" stroke-width="1.4"/>
      <line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(k) - 8}" stroke="#333" stroke-width="1.4"/>
      <text x="${X(k) + 12}" y="${Y(0) + 4}" font-size="12">q<tspan font-size="9" dy="2">1</tspan></text>
      <text x="${X(0) - 4}" y="${Y(k) - 10}" font-size="12" text-anchor="end">q<tspan font-size="9" dy="2">2</tspan></text>
      <text x="${X(0) - 4}" y="${Y(0) + 14}" font-size="10" text-anchor="end" fill="${GREY}">0</text>`;
    for (const t of [h, k]) s += `<line x1="${X(t)}" y1="${Y(0)}" x2="${X(t)}" y2="${Y(0) + 4}" stroke="#333"/><text x="${X(t)}" y="${Y(0) + 15}" font-size="10" text-anchor="middle" fill="${GREY}">${n(t)}</text>
      <line x1="${X(0)}" y1="${Y(t)}" x2="${X(0) - 4}" y2="${Y(t)}" stroke="#333"/><text x="${X(0) - 6}" y="${Y(t) + 4}" font-size="10" text-anchor="end" fill="${GREY}">${n(t)}</text>`;
    if (level < 3) s += `<text x="${X(k / 2)}" y="${Y(k / 2)}" font-size="11" text-anchor="middle" fill="${GREY}">the best responses appear here</text>`;
    if (level >= 3) s += `<line x1="${X(h)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(k)}" stroke="${BLUE}" stroke-width="2.4"/>
      <text x="${X(0) + 8}" y="${Y(k) + 12}" font-size="12" font-weight="700" fill="${BLUE}">BR<tspan font-size="9" dy="2">1</tspan></text>`;
    if (level >= 4) s += `<line x1="${X(0)}" y1="${Y(h)}" x2="${X(k)}" y2="${Y(0)}" stroke="${ORANGE}" stroke-width="2.4"/>
      <text x="${X(k) - 4}" y="${Y(0) - 10}" font-size="12" font-weight="700" fill="${ORANGE}" text-anchor="end">BR<tspan font-size="9" dy="2">2</tspan></text>
      <line x1="${X(q)}" y1="${Y(q)}" x2="${X(q)}" y2="${Y(0)}" stroke="#999" stroke-dasharray="3 3"/>
      <line x1="${X(q)}" y1="${Y(q)}" x2="${X(0)}" y2="${Y(q)}" stroke="#999" stroke-dasharray="3 3"/>
      <text x="${X(q)}" y="${Y(0) + 15}" font-size="10" text-anchor="middle" fill="${GREEN}" font-weight="700">${n(q)}</text>
      <text x="${X(0) - 6}" y="${Y(q) + 4}" font-size="10" text-anchor="end" fill="${GREEN}" font-weight="700">${n(q)}</text>
      <circle cx="${X(q)}" cy="${Y(q)}" r="5.5" fill="${GREEN}"/>
      <text x="${X(q) + 9}" y="${Y(q) - 7}" font-size="12" font-weight="700" fill="${GREEN}">Nash equilibrium</text>`;
    return s + `</svg>`;
  }

  function showHint() {
    const pos = position(); if (pos.done) return;
    const step = pos.ex.key + pos.i;
    ui.hint = step; render();
    if (!prac.round) S.updateDoc("pl/" + pid, { lobby: lobby(), ["h." + step]: true });
  }
  // The first answer is saved straight away (so the dashboard sees it); "Next" just moves on.
  function pick(key) {
    const pos = position(); if (pos.done || pos.r[pos.ex.key + pos.i]) return;
    const s = pos.steps[pos.i], o = s.options.find((x) => x.key === key), step = pos.ex.key + pos.i;
    ui.picked = { step, key };
    if (prac.round) { prac.r[step] = { ok: o.correct, tag: o.tag, key, nx: false }; render(); return; }
    render();
    S.updateDoc("pl/" + pid, { lobby: lobby(), ["w." + step]: { ok: o.correct, tag: o.tag, key, t: Date.now(), nx: false } });
  }
  async function next() {
    const pos = position(); if (pos.done) return;
    const step = pos.ex.key + pos.i;
    if (!pos.r[step]) return;
    if (prac.round) prac.r[step].nx = true;
    else await S.updateDoc("pl/" + pid, { ["w." + step + ".nx"]: true });
    ui.picked = null; ui.hint = null; window.scrollTo(0, 0); render();
  }
  function another() { prac.round++; prac.r = {}; ui.picked = null; ui.hint = null; window.scrollTo(0, 0); render(); }

  // ---------------------------------------------------------------- guess ⅔ of the average
  function guessView(ph) {
    const me = mine();
    if (ph === "r1" || ph === "r2") {
      const rk = ph, saved = me && me.g && me.g[rk] !== undefined ? me.g[rk] : null;
      if (!ui.edited[rk] && saved !== null) ui.guess = saved;
      const prev = rk === "r2" && st.state.res && st.state.res.r1 ? st.state.res.r1 : null;
      return { sig: rk + "|" + saved + "|" + (ui.edited[rk] ? "e" : ""), html: `<div class="small muted">Round ${rk === "r1" ? 1 : 2} of 2</div><h2 style="margin-top:4px">Guess ⅔ of the average</h2><div class="rule"></div>
        <p>Pick a whole number from <b>0 to 100</b>. The winner is the person whose number is closest to <b>two thirds of the class average</b>.</p>
        ${prev ? `<div class="card soft small">Round 1: the average was <b>${B.num(prev.avg)}</b>, so the target was <b>${B.num(prev.target)}</b>.</div>` : ""}
        <div class="stepper"><button id="minus">−</button><div class="value" id="gval">${ui.guess}</div><button id="plus">+</button></div>
        <input type="range" id="slider" min="0" max="100" step="1" value="${ui.guess}">
        <div class="quick">${[0, 10, 25, 33, 50, 67, 100].map((v) => `<button data-v="${v}">${v}</button>`).join("")}</div>
        <button class="primary full big" id="send">${saved === null ? "Send my number" : "Change my number"}</button>
        <p class="center small ${saved === null ? "muted" : ""}" id="sent">${saved === null ? "Not sent yet" : "✓ Sent: <b>" + saved + "</b>. You can change it until the round closes."}</p>
        <p class="small muted center">You are ${myName}.</p>` };
    }
    if (ph === "r1res" || ph === "r2res") {
      const rk = ph.slice(0, 2), res = st.state.res && st.state.res[rk], g = me && me.g ? me.g[rk] : undefined;
      const sig = ph + JSON.stringify(res || {}) + g;
      if (!res) return { sig, html: `<h2>Round closed</h2><div class="rule"></div><p>Look up at the screen.</p>` };
      const won = res.winIds && res.winIds.includes(pid);
      return { sig, html: `<h2>Round ${rk === "r1" ? 1 : 2}: results</h2><div class="rule"></div>
        ${won ? `<div class="card okcard"><b>🏆 You won!</b> Your number ${g} was the closest.</div>` : ""}
        <table class="mini"><tr><td>Class average</td><td class="num"><b>${B.num(res.avg)}</b></td></tr>
        <tr><td>⅔ of the average (target)</td><td class="num"><b>${B.num(res.target)}</b></td></tr>
        <tr><td>Winning number</td><td class="num"><b>${res.winVal}</b></td></tr>
        <tr><td>Your number</td><td class="num"><b>${g === undefined ? "–" : g}</b></td></tr></table>
        <p class="muted small">You are ${myName}.</p>` };
    }
    return { sig: "theory", html: `<h2>Look up at the screen</h2><div class="rule"></div><p>What does game theory predict?</p>` };
  }

  // ---------------------------------------------------------------- spot the equilibrium
  function spotView() {
    const me = mine(), s = (me && me.s) || {}, gs = B.games(pid);
    const back = ui.mode === "spot" ? `<button class="full" id="tocournot" style="margin-top:12px">◀ Back to the Cournot workout</button>` : "";
    let i = 0; while (i < gs.length && s["k" + i] && s["k" + i].nx) i++;
    if (i >= gs.length) {
      const ok = gs.filter((_, k) => s["k" + k] && s["k" + k].ok).length;
      return { sig: "sdone" + ok + ui.mode, html: `<h2>Well done!</h2><div class="rule"></div><div class="card soft"><p><b>${ok} / ${gs.length}</b> games right first time.</p></div>${back}` };
    }
    const g = gs[i], saved = s["k" + i], selKey = "k" + i;
    const sel = saved ? saved.sel : Object.keys(ui.sel[selKey] || {}).filter((x) => ui.sel[selKey][x]);
    const none = saved ? !saved.sel.length : !!ui.none[selKey];
    const dots = chips(gs.length, (k) => (s["k" + k] && s["k" + k].nx ? s["k" + k] : null), i);
    let body = `<div class="small muted">Spot the equilibrium · game ${i + 1} of ${gs.length}</div><h2 style="margin-top:4px">${g.title}</h2><div class="rule"></div>
      <p class="small">Each cell shows (<span class="p1">row player</span>, <span class="p2">column player</span>). Tap <b>every</b> pure-strategy Nash equilibrium, or “none”.</p>
      ${matrix(g, sel, saved)}`;
    if (!saved) {
      body += `<button class="full ${none ? "chosen" : ""}" id="none" style="margin-top:10px">${none ? "✓ " : ""}There is no pure-strategy equilibrium</button>
        <button class="primary full" id="check" style="margin-top:10px" ${sel.length || none ? "" : "disabled"}>Check</button>`;
    } else {
      const wrongCells = saved.sel.filter((x) => !g.ne.includes(x));
      const nameCell = (x) => { const [r, c] = x.split(",").map(Number); return `(${g.lab.r[r]}, ${g.lab.c[c]})`; };
      body += `<div class="card ${saved.ok ? "okcard" : "nocard"}"><b>${saved.ok ? "✓ Right." : "✗ Not quite."}</b>
        <p>${g.ne.length ? `Nash equilibri${g.ne.length > 1 ? "a" : "um"}: <b>${g.ne.map(nameCell).join(" and ")}</b> (shaded): both payoffs are best responses (underlined).` : "There is <b>no</b> pure-strategy Nash equilibrium: in every cell someone would rather switch."}</p>
        ${wrongCells.map((x) => `<p>At ${nameCell(x)}, ${B.deviation(g, x)}.</p>`).join("")}
        ${!saved.ok && B.TIPS[saved.tag] ? `<p class="small">${B.TIPS[saved.tag]}</p>` : ""}</div>
        <button class="primary full" id="snext">${i + 1 < gs.length ? "Next game ▶" : "Finish ▶"}</button>`;
    }
    return { sig: "s" + i + JSON.stringify(sel) + none + (saved ? "c" + saved.ok : "") + ui.mode, html: `<div class="seq">${dots}</div>${body}${back}` };
  }
  // The payoff matrix. Before checking: cells are buttons. After: best responses underlined, equilibria shaded.
  function matrix(g, sel, saved) {
    const n = g.m.length, done = !!saved;
    let h = `<table class="pm"><tr><th></th>${g.lab.c.map((c) => `<th class="p2">${c}</th>`).join("")}</tr>`;
    for (let r = 0; r < n; r++) {
      h += `<tr><th class="p1">${g.lab.r[r]}</th>`;
      for (let c = 0; c < n; c++) {
        const key = r + "," + c, [a, b] = g.m[r][c], on = sel.includes(key);
        let cls = "cell" + (on ? " on" : ""), A = a, Bv = b;
        if (done) {
          if (B.isBR1(g.m, r, c)) A = `<u>${a}</u>`;
          if (B.isBR2(g.m, r, c)) Bv = `<u>${b}</u>`;
          cls = "cell" + (g.ne.includes(key) ? " ne" : "") + (on && !g.ne.includes(key) ? " bad" : "") + (on && g.ne.includes(key) ? " good" : "");
        }
        h += `<td><button class="${cls}" data-cell="${key}" ${done ? "disabled" : ""}><span class="p1">${A}</span>, <span class="p2">${Bv}</span></button></td>`;
      }
      h += `</tr>`;
    }
    return h + `</table>`;
  }

  // ---------------------------------------------------------------- buttons
  function wire() {
    const ph = phase(), $ = (id) => document.getElementById(id);
    if (ph === "r1" || ph === "r2") {
      const setG = (v) => { ui.guess = Math.max(0, Math.min(100, Math.round(v))); ui.edited[ph] = true; $("gval").textContent = ui.guess; $("slider").value = ui.guess; };
      $("minus").onclick = () => setG(ui.guess - 1);
      $("plus").onclick = () => setG(ui.guess + 1);
      $("slider").oninput = (e) => setG(Number(e.target.value));
      view.querySelectorAll(".quick button").forEach((b) => (b.onclick = () => setG(Number(b.dataset.v))));
      $("send").onclick = async () => {
        if (phase() !== ph) return;
        ui.edited[ph] = false;
        await S.updateDoc("pl/" + pid, { lobby: lobby(), name: myName, ["g." + ph]: ui.guess, ["t." + ph]: Date.now() });
      };
      return;
    }
    // Cournot workout
    view.querySelectorAll(".opt[data-k]").forEach((b) => (b.onclick = () => pick(b.dataset.k)));
    if ($("next")) $("next").onclick = next;
    if ($("hint")) $("hint").onclick = showHint;
    if ($("another")) $("another").onclick = another;
    if ($("tospot")) $("tospot").onclick = () => { ui.mode = "spot"; window.scrollTo(0, 0); render(); };
    if ($("tocournot")) $("tocournot").onclick = () => { ui.mode = "cournot"; window.scrollTo(0, 0); render(); };
    // Spot the equilibrium
    const gs = B.games(pid), s = (mine() && mine().s) || {};
    let i = 0; while (i < gs.length && s["k" + i] && s["k" + i].nx) i++;
    const key = "k" + i;
    view.querySelectorAll("button.cell[data-cell]").forEach((b) => (b.onclick = () => {
      ui.sel[key] = ui.sel[key] || {}; ui.sel[key][b.dataset.cell] = !ui.sel[key][b.dataset.cell]; ui.none[key] = false; render();
    }));
    if ($("none")) $("none").onclick = () => { ui.none[key] = !ui.none[key]; if (ui.none[key]) ui.sel[key] = {}; render(); };
    if ($("check")) $("check").onclick = async () => {
      if (s[key]) return;
      const sel = ui.none[key] ? [] : Object.keys(ui.sel[key] || {}).filter((x) => ui.sel[key][x]);
      const r = B.grade(gs[i], sel);
      await S.updateDoc("pl/" + pid, { lobby: lobby(), ["s." + key]: { ok: r.ok, tag: r.tag, sel, type: gs[i].type, t: Date.now(), nx: false } });
    };
    if ($("snext")) $("snext").onclick = async () => { await S.updateDoc("pl/" + pid, { ["s." + key + ".nx"]: true }); window.scrollTo(0, 0); };
  }
})();
