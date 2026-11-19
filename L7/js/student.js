// Week 7 student page: a self-paced Walrasian-equilibrium exercise with hints and feedback after every step.
// The phone waits until the lecturer opens the exercise on the dashboard; after that each student goes at their own pace.
(function () {
  const S = window.Store, B = window.BL, cfg = window.BIASLAB_CONFIG || {};
  const view = document.getElementById("view");
  document.getElementById("modname").textContent = (cfg.moduleName || "") + (S.demo ? " · demo mode" : "");

  const idStore = S.demo ? sessionStorage : localStorage;
  const ID_KEY = "ecn-pid-" + S.root;
  let pid = idStore.getItem(ID_KEY);
  if (!pid) { pid = B.newId(); idStore.setItem(ID_KEY, pid); }

  let hiddenAt = null;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 3000) location.reload();
    hiddenAt = null;
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });

  const st = { state: null, mine: undefined };
  const ui = { picked: null, hint: null };   // option just picked; step whose hint is open
  S.onDoc("", (d) => { st.state = d; register(); render(); });
  S.onDoc("ans/" + pid, (d) => { st.mine = d; register(); render(); });

  const lobby = () => st.state && st.state.lobby;
  const open = () => st.state && ["work", "results", "end"].includes(st.state.phase);
  const mine = () => (st.mine && st.mine.lobby === lobby() ? st.mine : null);
  const NW = B.EX[0].steps(pid).length, NB = B.EX[1].steps(pid).length;

  function register() {
    if (!lobby() || st.mine === undefined) return;
    if (mine() || register.pending === lobby()) return;
    register.pending = lobby();
    S.setDoc("ans/" + pid, { lobby: lobby(), joinedAt: Date.now(), r: {} });
  }

  // Where is this student? The first exercise/step without an answer.
  function position() {
    const r = (mine() && mine().r) || {};
    for (const ex of B.EX) {
      const steps = ex.steps(pid);
      for (let i = 0; i < steps.length; i++) if (!r[ex.key + i] || !r[ex.key + i].nx) return { ex, steps, i, r };
    }
    return { done: true, r };
  }
  function score(r, key, n) { let ok = 0, done = 0; for (let i = 0; i < n; i++) { const a = r[key + i]; if (a) { done++; if (a.ok) ok++; } } return { ok, done }; }

  let lastSig = "";
  function render() {
    let sig, html;
    if (!lobby()) { sig = "wait"; html = `<h2>Welcome</h2><div class="rule"></div><p>Waiting for the lecturer to open the session…</p>`; }
    else if (!open()) { sig = "lobby" + lobby(); html = `<h2>You're in</h2><div class="rule"></div><p>Keep this page open. The exercise starts when the lecturer opens it.</p><div class="card soft small">A Walrasian equilibrium, step by step, with your own numbers. Stuck? Tap <b>Hint</b>. After each answer you see straight away whether it is right, and why.</div>`; }
    else {
      const pos = position();
      if (pos.done) {
        const w = score(pos.r, "w", NW), b = score(pos.r, "b", NB);
        sig = "done" + w.ok + b.ok;
        html = `<h2>Well done!</h2><div class="rule"></div>
          ${graph(B.econ(pid), 99)}
          <div class="card soft"><p><b>Walrasian equilibrium:</b> ${w.ok} / ${NW} right first time</p><p><b>Bonus (efficiency):</b> ${b.ok} / ${NB} right first time</p></div>
          <p class="muted">Look up at the screen for how the class did. The same steps are in the lecture notes, and in Problem Set 7, Question 4.</p>`;
      } else {
        const { ex, steps, i, r } = pos, s = steps[i], saved = r[ex.key + i];
        const picked = saved ? { key: saved.key } : ui.picked && ui.picked.step === ex.key + i ? ui.picked : null;
        const hintOpen = ui.hint === ex.key + i;
        sig = ex.key + i + (picked ? picked.key : "") + (hintOpen ? "h" : "");
        const sc = score(r, ex.key, steps.length);
        const level = ex.key === "w" ? i + (picked ? 1 : 0) : 99;
        const dots = steps.map((_, k) => { const a = r[ex.key + k] && r[ex.key + k].nx ? r[ex.key + k] : null; return `<span class="chip ${a ? (a.ok ? "okc" : "noc") : k === i ? "cur" : "empty"}">${a ? (a.ok ? "✓" : "✗") : k + 1}</span>`; }).join("");
        let body = `<div class="small muted">${ex.title} · step ${i + 1} of ${steps.length}</div>
          <h2 style="margin-top:4px">${s.title}</h2><div class="rule"></div>
          <div class="card soft small">${steps[0].intro}${i ? `<div class="known"><b>What we know so far</b><ul>${steps.slice(0, i).map((x) => `<li>${x.fact}</li>`).join("")}</ul></div>` : ""}</div>
          ${graph(B.econ(pid), level)}
          <p>${s.q}</p>`;
        if (!picked) {
          body += hintOpen ? `<div class="hint">💡 ${s.hint}</div>` : `<button class="hintbtn" id="hint">💡 Hint</button>`;
          body += `<div class="opts">${s.options.map((o) => `<button class="opt" data-k="${o.key}">${o.label}</button>`).join("")}</div>`;
        } else {
          const o = s.options.find((x) => x.key === picked.key), right = s.options.find((x) => x.correct);
          body += `<div class="opts">${s.options.map((x) => `<button class="opt ${x.correct ? "right" : x.key === o.key ? "wrong" : "dim"}" disabled>${x.label}</button>`).join("")}</div>
            <div class="card ${o.correct ? "okcard" : "nocard"}"><b>${o.correct ? "✓ Right." : "✗ Not quite. The answer is " + right.label + "."}</b>
            ${!o.correct && s.tips && s.tips[o.tag] ? `<p>${s.tips[o.tag]}</p>` : ""}<p>${s.why}</p></div>
            <button class="primary full" id="next">${i + 1 < steps.length ? "Next step ▶" : ex.key === "w" ? "Bonus question ▶" : "Finish ▶"}</button>`;
        }
        html = `<div class="seq">${dots}</div>${body}<p class="small muted center">${sc.ok} right so far</p>`;
      }
    }
    if (sig === lastSig) return;
    lastSig = sig; view.innerHTML = html;
    view.querySelectorAll(".opt[data-k]").forEach((b) => (b.onclick = () => pick(b.dataset.k)));
    const nx = document.getElementById("next"); if (nx) nx.onclick = next;
    const hb = document.getElementById("hint"); if (hb) hb.onclick = showHint;
  }

  // The Edgeworth box, drawn with the student's own numbers.
  // It fills in as the steps are done: endowment E → budget line at p* → A's bundle → the equilibrium W with
  // both indifference curves tangent to the budget line.
  function graph(e, level) {
    const { X, Y, ax, ay, P } = e, a = e.a.n / e.a.d, b = e.b.n / e.b.d;
    const W = 330, H = 292, L = 40, T = 26, BW = 236, BH = 210;
    const x = (u) => L + (u / X) * BW, y = (v) => T + BH - (v / Y) * BH;
    const n = (v) => B.num(v), BLUE = "#3333b3", ORANGE = "#d9711f", GREEN = "#2e9e5b", GREY = "#777";
    let s = `<svg viewBox="0 0 ${W} ${H}" class="egraph" role="img" aria-label="Edgeworth box">
      <defs><clipPath id="bx"><rect x="${x(0)}" y="${y(Y)}" width="${BW}" height="${BH}"/></clipPath></defs>
      <rect x="${x(0)}" y="${y(Y)}" width="${BW}" height="${BH}" fill="none" stroke="#333" stroke-width="1.4"/>
      <text x="${x(0) - 4}" y="${y(0) + 14}" font-size="11" text-anchor="end">O<tspan font-size="8" dy="2">A</tspan></text>
      <text x="${x(X) + 4}" y="${y(Y) - 4}" font-size="11">O<tspan font-size="8" dy="2">B</tspan></text>
      <text x="${x(X / 2)}" y="${y(0) + 26}" font-size="11" text-anchor="middle">x (total ${X}) →</text>
      <text x="${x(0) - 22}" y="${y(Y / 2)}" font-size="11" text-anchor="middle" transform="rotate(-90 ${x(0) - 22} ${y(Y / 2)})">y (total ${Y})</text>`;
    // tick labels for A
    s += `<text x="${x(ax)}" y="${y(0) + 13}" font-size="10" text-anchor="middle" fill="${GREY}">${ax}</text>
      <text x="${x(0) - 4}" y="${y(ay) + 4}" font-size="10" text-anchor="end" fill="${GREY}">${ay}</text>
      <line x1="${x(ax)}" y1="${y(ay)}" x2="${x(ax)}" y2="${y(0)}" stroke="#bbb" stroke-dasharray="3 3"/>
      <line x1="${x(0)}" y1="${y(ay)}" x2="${x(ax)}" y2="${y(ay)}" stroke="#bbb" stroke-dasharray="3 3"/>`;
    if (level >= 5) {
      // budget line through E with slope −p*: y = ay + P (ax − x)
      const pts = [0, X].map((u) => `${x(u)},${y(ay + P * (ax - u))}`).join(" ");
      s += `<polyline points="${pts}" stroke="#333" stroke-width="2" fill="none" clip-path="url(#bx)"/>`;
      // label the line where it leaves the box on the side with more room
      let lx = ax < X / 2 ? Math.min(X, ax + (Y + 0 - ay) / -P) : ax - 0.3 * ax, ly;
      lx = ax < X / 2 ? ax + 0.55 * (X - ax) : 0.45 * ax; ly = ay + P * (ax - lx);
      if (ly > 0.08 * Y && ly < 0.92 * Y) s += `<text x="${x(lx) + 6}" y="${y(ly) - 8}" font-size="10" fill="#333" paint-order="stroke" stroke="#fff" stroke-width="3">budget line, slope −${n(P)}</text>`;
    }
    if (level >= 7) {
      // indifference curves through W, tangent to the budget line
      const UA = B.util(a, e.xA, e.yA), UB = B.util(b, e.xB, e.yB), ptsA = [], ptsB = [];
      for (let k = 1; k < 120; k++) {
        const u = (k / 120) * X;
        const vA = Math.pow(UA / Math.pow(u, a), 1 / (1 - a));
        if (vA <= Y * 1.5) ptsA.push(`${x(u)},${y(vA)}`);
        const vB = Y - Math.pow(UB / Math.pow(X - u, b), 1 / (1 - b));
        if (vB >= -Y * 0.5) ptsB.push(`${x(u)},${y(vB)}`);
      }
      s += `<polyline points="${ptsA.join(" ")}" stroke="${BLUE}" stroke-width="2" fill="none" clip-path="url(#bx)"/>
        <polyline points="${ptsB.join(" ")}" stroke="${ORANGE}" stroke-width="2" fill="none" clip-path="url(#bx)"/>`;
    }
    if (level >= 6) {
      s += `<line x1="${x(e.xA)}" y1="${y(e.yA)}" x2="${x(e.xA)}" y2="${y(0)}" stroke="${BLUE}" stroke-dasharray="3 3"/>
        <line x1="${x(0)}" y1="${y(e.yA)}" x2="${x(e.xA)}" y2="${y(e.yA)}" stroke="${BLUE}" stroke-dasharray="3 3"/>
        <text x="${x(e.xA)}" y="${y(0) + 13}" font-size="10" text-anchor="middle" fill="${BLUE}" font-weight="700">${n(e.xA)}</text>
        <text x="${x(0) - 4}" y="${y(e.yA) + 4}" font-size="10" text-anchor="end" fill="${BLUE}" font-weight="700">${n(e.yA)}</text>
        <circle cx="${x(e.xA)}" cy="${y(e.yA)}" r="5" fill="${GREEN}"/>
        <text x="${x(e.xA) + 8}" y="${y(e.yA) - 6}" font-size="12" font-weight="700" fill="${GREEN}">W</text>`;
    }
    if (level >= 7) {
      s += `<text x="${x(e.xA)}" y="${y(Y) - 4}" font-size="10" text-anchor="middle" fill="${ORANGE}" font-weight="700">${n(e.xB)}</text>
        <text x="${x(X) + 4}" y="${y(e.yA) + 4}" font-size="10" fill="${ORANGE}" font-weight="700">${n(e.yB)}</text>
        <line x1="${x(e.xA)}" y1="${y(e.yA)}" x2="${x(e.xA)}" y2="${y(Y)}" stroke="${ORANGE}" stroke-dasharray="3 3"/>
        <line x1="${x(e.xA)}" y1="${y(e.yA)}" x2="${x(X)}" y2="${y(e.yA)}" stroke="${ORANGE}" stroke-dasharray="3 3"/>`;
    }
    s += `<circle cx="${x(ax)}" cy="${y(ay)}" r="4.5" fill="#333"/><text x="${x(ax) + 7}" y="${y(ay) + 14}" font-size="12" font-weight="700">E</text>`;
    // legend
    s += `<text x="${L}" y="${H - 4}" font-size="10" fill="#555">E: endowments${level >= 6 ? " · W: equilibrium" : ""}</text>`;
    if (level >= 7) s += `<text x="${W - 4}" y="${12}" font-size="10" text-anchor="end"><tspan fill="${BLUE}">— A</tspan> <tspan fill="${ORANGE}">— B</tspan></text>`;
    return s + `</svg>`;
  }

  function showHint() {
    const pos = position(); if (pos.done) return;
    const step = pos.ex.key + pos.i;
    ui.hint = step; render();
    S.updateDoc("ans/" + pid, { lobby: lobby(), ["h." + step]: true });
  }
  // The first answer is saved straight away (so the dashboard sees it); "Next" just moves on.
  function pick(key) {
    const pos = position(); if (pos.done || pos.r[pos.ex.key + pos.i]) return;
    const s = pos.steps[pos.i], o = s.options.find((x) => x.key === key), step = pos.ex.key + pos.i;
    ui.picked = { step, key };
    render();
    S.updateDoc("ans/" + pid, { lobby: lobby(), ["r." + step]: { ok: o.correct, tag: o.tag, key, t: Date.now(), nx: false } });
  }
  async function next() {
    const pos = position(); if (pos.done) return;
    const step = pos.ex.key + pos.i;
    if (!pos.r[step]) return;
    await S.updateDoc("ans/" + pid, { ["r." + step + ".nx"]: true });
    ui.picked = null; ui.hint = null; window.scrollTo(0, 0); render();
  }
})();
