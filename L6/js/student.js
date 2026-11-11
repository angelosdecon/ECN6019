// Week 6 student page: a self-paced monopoly exercise with feedback after every step.
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
  const ui = { picked: null };   // option just picked on the current step (before the server echoes it)
  S.onDoc("", (d) => { st.state = d; register(); render(); });
  S.onDoc("ans/" + pid, (d) => { st.mine = d; register(); render(); });

  const lobby = () => st.state && st.state.lobby;
  const open = () => st.state && ["work", "results", "end"].includes(st.state.phase);
  const mine = () => (st.mine && st.mine.lobby === lobby() ? st.mine : null);

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
    else if (!open()) { sig = "lobby" + lobby(); html = `<h2>You're in</h2><div class="rule"></div><p>Keep this page open. The exercise starts when the lecturer opens it.</p><div class="card soft small">A monopoly, step by step: after each answer you see straight away whether it is right, and why.</div>`; }
    else {
      const pos = position();
      if (pos.done) {
        const m = score(pos.r, "m", 6), l = score(pos.r, "l", 4);
        sig = "done" + m.ok + l.ok;
        html = `<h2>Well done!</h2><div class="rule"></div>
          <div class="card soft"><p><b>Monopoly:</b> ${m.ok} / 6 right first time</p><p><b>Long-run equilibrium:</b> ${l.ok} / 4 right first time</p></div>
          <p class="muted">Look up at the screen for how the class did. The worked examples are in the lecture notes.</p>`;
      } else {
        const { ex, steps, i, r } = pos, s = steps[i], saved = r[ex.key + i];
        const picked = saved ? { key: saved.key } : ui.picked && ui.picked.step === ex.key + i ? ui.picked : null;
        sig = ex.key + i + (picked ? picked.key : "");
        const sc = score(r, ex.key, steps.length);
        const dots = steps.map((_, k) => { const a = r[ex.key + k] && r[ex.key + k].nx ? r[ex.key + k] : null; return `<span class="chip ${a ? (a.ok ? "okc" : "noc") : k === i ? "cur" : "empty"}">${a ? (a.ok ? "✓" : "✗") : k + 1}</span>`; }).join("");
        let body = `<div class="small muted">${ex.title} · step ${i + 1} of ${steps.length}</div>
          <h2 style="margin-top:4px">${s.title}</h2><div class="rule"></div>
          <div class="card soft small">${steps[0].intro}${i ? `<div class="known"><b>What we know so far</b><ul>${steps.slice(0, i).map((x) => `<li>${x.fact}</li>`).join("")}</ul></div>` : ""}</div>
          ${ex.key === "m" ? monoGraph(B.monoSet(pid), i + (picked ? 1 : 0)) : ""}
          <p>${s.q}</p>`;
        if (!picked) {
          body += `<div class="opts">${s.options.map((o) => `<button class="opt" data-k="${o.key}">${o.label}</button>`).join("")}</div>`;
        } else {
          const o = s.options.find((x) => x.key === picked.key), right = s.options.find((x) => x.correct);
          body += `<div class="opts">${s.options.map((x) => `<button class="opt ${x.correct ? "right" : x.key === o.key ? "wrong" : "dim"}" disabled>${x.label}</button>`).join("")}</div>
            <div class="card ${o.correct ? "okcard" : "nocard"}"><b>${o.correct ? "✓ Right." : "✗ Not quite. The answer is " + right.label + "."}</b>
            ${!o.correct && s.tips && s.tips[o.tag] ? `<p>${s.tips[o.tag]}</p>` : ""}<p>${s.why}</p></div>
            <button class="primary full" id="next">${i + 1 < steps.length ? "Next step ▶" : ex.key === "m" ? "Bonus exercise ▶" : "Finish ▶"}</button>`;
        }
        html = `<div class="seq">${dots}</div>${body}<p class="small muted center">${sc.ok} right so far</p>`;
      }
    }
    if (sig === lastSig) return;
    lastSig = sig; view.innerHTML = html;
    view.querySelectorAll(".opt[data-k]").forEach((b) => (b.onclick = () => pick(b.dataset.k)));
    const nx = document.getElementById("next"); if (nx) nx.onclick = next;
  }

  // The monopoly diagram, drawn to scale with the student's own numbers.
  // It fills in as the steps are completed: MR, then Q_m, P_m, the profit rectangle and the deadweight-loss triangle.
  function monoGraph(set, level) {
    const { a, b, c } = set, Qd = a / b, Q = (a - c) / (2 * b), P = (a + c) / 2, Qc = (a - c) / b;
    const W = 320, H = 246, L = 34, T = 14, R = 300, Bt = 200;
    const x = (q) => L + (q / (Qd * 1.08)) * (R - L), y = (p) => Bt - (p / (a * 1.08)) * (Bt - T);
    const n = (v) => B.num(v), BLUE = "#3333b3", ORANGE = "#d9711f", GREY = "#9a9a9a";
    let s = `<svg viewBox="0 0 ${W} ${H}" class="mgraph" role="img" aria-label="Monopoly diagram">`;
    if (level >= 4) s += `<rect x="${x(0)}" y="${y(P)}" width="${x(Q) - x(0)}" height="${y(c) - y(P)}" fill="#2e9e5b" opacity="0.22"/>
      <rect x="${L}" y="${H - 12}" width="10" height="10" fill="#2e9e5b" opacity="0.35"/><text x="${L + 14}" y="${H - 3}" font-size="11" fill="#1e6b3d">profit £${n((P - c) * Q)}</text>`;
    if (level >= 5) s += `<polygon points="${x(Q)},${y(P)} ${x(Q)},${y(c)} ${x(Qc)},${y(c)}" fill="#c0392b" opacity="0.25"/>
      <rect x="${L + 120}" y="${H - 12}" width="10" height="10" fill="#c0392b" opacity="0.4"/><text x="${L + 134}" y="${H - 3}" font-size="11" fill="#a02b1f">deadweight loss £${n(0.5 * (P - c) * (Qc - Q))}</text>`;
    s += `<line x1="${L}" y1="${Bt}" x2="${R + 10}" y2="${Bt}" stroke="#333"/><line x1="${L}" y1="${Bt}" x2="${L}" y2="${T - 6}" stroke="#333"/>
      <text x="${R + 10}" y="${Bt + 14}" font-size="11" text-anchor="end">Q</text><text x="${L - 6}" y="${T - 2}" font-size="11" text-anchor="end">P</text>
      <line x1="${x(0)}" y1="${y(a)}" x2="${x(Qd)}" y2="${y(0)}" stroke="${GREY}" stroke-width="2.5"/>
      <text x="${x(Qd) - 4}" y="${y(0) - 6}" font-size="11" text-anchor="end" fill="#666">D</text>
      <line x1="${L}" y1="${y(c)}" x2="${R}" y2="${y(c)}" stroke="${BLUE}" stroke-width="2"/>
      <text x="${R}" y="${y(c) - 5}" font-size="11" text-anchor="end" fill="${BLUE}">MC = AC</text>
      <text x="${L - 4}" y="${y(c) + 4}" font-size="10" text-anchor="end">${c}</text>
      <text x="${L - 4}" y="${y(a) + 4}" font-size="10" text-anchor="end">${a}</text>`;
    if (level >= 1) s += `<line x1="${x(0)}" y1="${y(a)}" x2="${x(Qd / 2)}" y2="${y(0)}" stroke="${ORANGE}" stroke-width="2"/>
      <text x="${x(Qd / 2) + 4}" y="${y(0) - 6}" font-size="11" fill="${ORANGE}">MR</text>`;
    if (level >= 2) s += `<line x1="${x(Q)}" y1="${y(c)}" x2="${x(Q)}" y2="${Bt}" stroke="#777" stroke-dasharray="3 3"/>
      <circle cx="${x(Q)}" cy="${y(c)}" r="3.5" fill="${ORANGE}"/><text x="${x(Q)}" y="${Bt + 13}" font-size="10" text-anchor="middle">Q<tspan font-size="8" dy="2">m</tspan><tspan dy="-2"> = ${n(Q)}</tspan></text>`;
    if (level >= 3) s += `<line x1="${L}" y1="${y(P)}" x2="${x(Q)}" y2="${y(P)}" stroke="#777" stroke-dasharray="3 3"/><line x1="${x(Q)}" y1="${y(P)}" x2="${x(Q)}" y2="${y(c)}" stroke="#777" stroke-dasharray="3 3"/>
      <circle cx="${x(Q)}" cy="${y(P)}" r="3.5" fill="${BLUE}"/><text x="${L - 4}" y="${y(P) + 4}" font-size="10" text-anchor="end" font-weight="700">${n(P)}</text>`;
    if (level >= 5) s += `<line x1="${x(Qc)}" y1="${y(c)}" x2="${x(Qc)}" y2="${Bt}" stroke="#777" stroke-dasharray="3 3"/>
      <text x="${x(Qc) + (x(Qc) - x(Q) < 55 ? 14 : 0)}" y="${Bt + (x(Qc) - x(Q) < 55 ? 25 : 13)}" font-size="10" text-anchor="middle">Q<tspan font-size="8" dy="2">c</tspan><tspan dy="-2"> = ${n(Qc)}</tspan></text>`;
    return s + `</svg>`;
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
    ui.picked = null; window.scrollTo(0, 0); render();
  }
})();
