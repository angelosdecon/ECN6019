// Week 8 student page. The dashboard sets the phase:
//  lobby → r1 (guess) → r1res → r2 (guess) → r2res → theory → spot (self-paced) → results → end
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
  const ui = { guess: 50, edited: {}, sel: {}, none: {}, checked: null };
  S.onDoc("", (d) => { st.state = d; register(); render(); });
  S.onDoc("pl/" + pid, (d) => { st.mine = d; register(); render(); });

  const lobby = () => st.state && st.state.lobby;
  const phase = () => (st.state && st.state.phase) || "lobby";
  const mine = () => (st.mine && st.mine.lobby === lobby() ? st.mine : null);

  function register() {
    if (!lobby() || st.mine === undefined) return;
    if (mine() || register.pending === lobby()) return;
    register.pending = lobby();
    S.setDoc("pl/" + pid, { lobby: lobby(), name: myName, joinedAt: Date.now(), g: {}, s: {} });
  }

  const nameCard = () => `<div class="card soft small">You are <b>${myName}</b>. Remember it: winners are announced by name.</div>`;

  let lastSig = "";
  function render() {
    let sig, html;
    const ph = phase(), me = mine();
    if (!lobby()) { sig = "wait"; html = `<h2>Welcome</h2><div class="rule"></div><p>Waiting for the lecturer to open the session…</p>`; }
    else if (ph === "lobby") { sig = "lobby" + lobby(); html = `<h2>You're in</h2><div class="rule"></div><p>Keep this page open.</p>${nameCard()}
      <p class="muted">First a guessing game for the whole class, then some games to solve on your own.</p>`; }
    else if (ph === "r1" || ph === "r2") {
      const rk = ph, saved = me && me.g && me.g[rk] !== undefined ? me.g[rk] : null;
      if (!ui.edited[rk] && saved !== null) ui.guess = saved;
      sig = rk + "|" + saved + "|" + (ui.edited[rk] ? "e" : "");
      const prev = rk === "r2" && st.state.res && st.state.res.r1 ? st.state.res.r1 : null;
      html = `<div class="small muted">Round ${rk === "r1" ? 1 : 2} of 2</div><h2 style="margin-top:4px">Guess ⅔ of the average</h2><div class="rule"></div>
        <p>Pick a whole number from <b>0 to 100</b>. The winner is the person whose number is closest to <b>two thirds of the class average</b>.</p>
        ${prev ? `<div class="card soft small">Round 1: the average was <b>${B.num(prev.avg)}</b>, so the target was <b>${B.num(prev.target)}</b>.</div>` : ""}
        <div class="stepper"><button id="minus">−</button><div class="value" id="gval">${ui.guess}</div><button id="plus">+</button></div>
        <input type="range" id="slider" min="0" max="100" step="1" value="${ui.guess}">
        <div class="quick">${[0, 10, 25, 33, 50, 67, 100].map((v) => `<button data-v="${v}">${v}</button>`).join("")}</div>
        <button class="primary full big" id="send">${saved === null ? "Send my number" : "Change my number"}</button>
        <p class="center small ${saved === null ? "muted" : ""}" id="sent">${saved === null ? "Not sent yet" : "✓ Sent: <b>" + saved + "</b>. You can change it until the round closes."}</p>`;
    }
    else if (ph === "r1res" || ph === "r2res") {
      const rk = ph.slice(0, 2), res = st.state.res && st.state.res[rk], g = me && me.g ? me.g[rk] : undefined;
      sig = ph + JSON.stringify(res || {}) + g;
      if (!res) html = `<h2>Round closed</h2><div class="rule"></div><p>Look up at the screen.</p>`;
      else {
        const won = res.winIds && res.winIds.includes(pid);
        html = `<h2>Round ${rk === "r1" ? 1 : 2}: results</h2><div class="rule"></div>
          ${won ? `<div class="card okcard"><b>🏆 You won!</b> Your number ${g} was the closest.</div>` : ""}
          <table class="mini"><tr><td>Class average</td><td class="num"><b>${B.num(res.avg)}</b></td></tr>
          <tr><td>⅔ of the average (target)</td><td class="num"><b>${B.num(res.target)}</b></td></tr>
          <tr><td>Winning number</td><td class="num"><b>${res.winVal}</b></td></tr>
          <tr><td>Your number</td><td class="num"><b>${g === undefined ? "–" : g}</b></td></tr></table>
          <p class="muted small">You are ${myName}.</p>`;
      }
    }
    else if (ph === "theory") { sig = "theory"; html = `<h2>Look up at the screen</h2><div class="rule"></div><p>What does game theory predict? Then, a set of games to solve on your phone.</p>`; }
    else { // spot, results, end: the self-paced exercise stays available
      const s = (me && me.s) || {}, gs = B.games(pid);
      let i = 0; while (i < gs.length && s["k" + i] && s["k" + i].nx) i++;
      if (i >= gs.length) {
        const ok = gs.filter((_, k) => s["k" + k] && s["k" + k].ok).length;
        sig = "done" + ok;
        html = `<h2>Well done!</h2><div class="rule"></div><div class="card soft"><p><b>${ok} / ${gs.length}</b> right first time.</p></div><p class="muted">Look up at the screen for how the class did.</p>`;
      } else {
        const g = gs[i], saved = s["k" + i], selKey = "k" + i;
        const sel = saved ? saved.sel : Object.keys(ui.sel[selKey] || {}).filter((x) => ui.sel[selKey][x]);
        const none = saved ? !saved.sel.length : !!ui.none[selKey];
        sig = "s" + i + JSON.stringify(sel) + none + (saved ? "c" + saved.ok : "");
        const dots = gs.map((_, k) => { const a = s["k" + k] && s["k" + k].nx ? s["k" + k] : null; return `<span class="chip ${a ? (a.ok ? "okc" : "noc") : k === i ? "cur" : "empty"}">${a ? (a.ok ? "✓" : "✗") : k + 1}</span>`; }).join("");
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
            <button class="primary full" id="next">${i + 1 < gs.length ? "Next game ▶" : "Finish ▶"}</button>`;
        }
        html = `<div class="seq">${dots}</div>${body}`;
      }
    }
    if (sig === lastSig) return;
    lastSig = sig; view.innerHTML = html; wire();
  }

  // The payoff matrix. Before checking: cells are buttons. After: best responses underlined, equilibria shaded.
  function matrix(g, sel, saved) {
    const n = g.m.length, done = !!saved;
    let h = `<table class="pm"><tr><th></th>${g.lab.c.map((c) => `<th class="p2">${c}</th>`).join("")}</tr>`;
    for (let r = 0; r < n; r++) {
      h += `<tr><th class="p1">${g.lab.r[r]}</th>`;
      for (let c = 0; c < n; c++) {
        const key = r + "," + c, [a, b] = g.m[r][c], on = sel.includes(key);
        let cls = "cell" + (on ? " on" : "");
        let A = a, Bv = b;
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

  function wire() {
    const ph = phase();
    if (ph === "r1" || ph === "r2") {
      const setG = (v) => { ui.guess = Math.max(0, Math.min(100, Math.round(v))); ui.edited[ph] = true; document.getElementById("gval").textContent = ui.guess; document.getElementById("slider").value = ui.guess; };
      document.getElementById("minus").onclick = () => setG(ui.guess - 1);
      document.getElementById("plus").onclick = () => setG(ui.guess + 1);
      document.getElementById("slider").oninput = (e) => setG(Number(e.target.value));
      view.querySelectorAll(".quick button").forEach((b) => (b.onclick = () => setG(Number(b.dataset.v))));
      document.getElementById("send").onclick = async () => {
        if (phase() !== ph) return;
        ui.edited[ph] = false;
        await S.updateDoc("pl/" + pid, { lobby: lobby(), name: myName, ["g." + ph]: ui.guess, ["t." + ph]: Date.now() });
      };
      return;
    }
    const gs = B.games(pid), s = (mine() && mine().s) || {};
    let i = 0; while (i < gs.length && s["k" + i] && s["k" + i].nx) i++;
    const key = "k" + i;
    view.querySelectorAll("button.cell[data-cell]").forEach((b) => (b.onclick = () => {
      ui.sel[key] = ui.sel[key] || {}; ui.sel[key][b.dataset.cell] = !ui.sel[key][b.dataset.cell]; ui.none[key] = false; render();
    }));
    const nb = document.getElementById("none");
    if (nb) nb.onclick = () => { ui.none[key] = !ui.none[key]; if (ui.none[key]) ui.sel[key] = {}; render(); };
    const ck = document.getElementById("check");
    if (ck) ck.onclick = async () => {
      if (s[key]) return;
      const sel = ui.none[key] ? [] : Object.keys(ui.sel[key] || {}).filter((x) => ui.sel[key][x]);
      const r = B.grade(gs[i], sel);
      await S.updateDoc("pl/" + pid, { lobby: lobby(), ["s." + key]: { ok: r.ok, tag: r.tag, sel, type: gs[i].type, t: Date.now(), nx: false } });
    };
    const nx = document.getElementById("next");
    if (nx) nx.onclick = async () => { await S.updateDoc("pl/" + pid, { ["s." + key + ".nx"]: true }); window.scrollTo(0, 0); };
  }
})();
