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
          <div class="card soft small">${steps[0].intro}</div>
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
