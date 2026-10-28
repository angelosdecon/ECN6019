// Week 5 student page: each phone runs a street-food stall. It follows the dashboard.
(function () {
  const S = window.Store, B = window.BL, cfg = window.BIASLAB_CONFIG || {};
  const view = document.getElementById("view");
  document.getElementById("modname").textContent = (cfg.moduleName || "") + (S.demo ? " · demo mode" : "");

  const idStore = S.demo ? sessionStorage : localStorage;
  const ID_KEY = "ecn-pid-" + S.root;
  let pid = idStore.getItem(ID_KEY);
  if (!pid) { pid = B.newId(); idStore.setItem(ID_KEY, pid); }
  const T = B.typeOf(pid), NAME = B.nameOf(pid);

  // Reload after the phone has been asleep (live connections do not always resume).
  let hiddenAt = null;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 3000) location.reload();
    hiddenAt = null;
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });
  window.addEventListener("online", () => location.reload());

  const st = { state: null, player: undefined, firm: null };
  const ui = { round: null, q: null, phaseSeen: {} };
  let lastSig = "";

  S.onDoc("", (d) => { st.state = d; register(); render(); });
  S.onDoc("players/" + pid, (d) => { st.player = d; register(); render(); });
  S.onDoc("firm/" + pid, (d) => { st.firm = d; render(); });

  function register() {
    const lobby = st.state && st.state.lobby;
    if (!lobby || st.player === undefined) return;
    if (st.player && st.player.lobby === lobby) return;
    if (register.pending === lobby) return;
    register.pending = lobby;
    setTimeout(() => S.setDoc("players/" + pid, { lobby, joinedAt: Date.now(), type: T.key }, true), S.demo ? Math.random() * 1500 : 0);
  }

  // ---------------- helpers ----------------
  const R = (n) => B.ROUNDS[n - 1];
  const myFirm = () => (st.firm && st.state && st.firm.lobby === st.state.lobby ? st.firm : null);
  const myQ = (n) => { const f = myFirm(); return f && f.q && f.q["r" + n] != null ? f.q["r" + n] : null; };
  // Price of round n: fixed, or set by the dashboard when the market round closes.
  function priceOf(n) {
    const r = R(n); if (!r) return null;
    if (r.price != null) return r.price;
    const m = st.state && st.state.market && st.state.market["r" + n];
    return m ? m.p : null;
  }
  function profitOf(n) { const q = myQ(n), p = priceOf(n); if (p == null) return null; return B.profit(T, q == null ? 0 : q, p, R(n).rentMult); }
  function totalUpTo(n) { let s = 0; for (let k = 1; k <= n; k++) { const v = profitOf(k); if (v != null) s += v; } return s; }
  const lastPrice = (n) => B.hintPrice(n, priceOf);

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
  const timerHtml = () => `<div class="small muted center">Time left: <span id="timer" class="timer">…</span></div>`;

  const stallBadge = () => `<span class="badge" style="background:${T.colour}">${T.icon} ${NAME}</span>`;
  function costTable(rentMult, hi) {
    let rows = "";
    for (let k = 1; k <= B.MAXQ; k++) rows += `<tr class="${hi === k ? "me" : ""}"><td>Tray ${k}</td><td class="num">£${B.extraCost(T, k)}</td><td class="num">£${B.cost(T, k, rentMult)}</td></tr>`;
    return `<table class="mini"><tr><th></th><th class="num">Extra cost of this tray</th><th class="num">Total cost (incl. rent)</th></tr>${rows}</table>`;
  }

  // ---------------- render ----------------
  function render() {
    const s = st.state;
    let sig, html;
    if (!s || !s.lobby) { sig = "wait"; html = `<h2>Welcome</h2><div class="rule"></div><p>Waiting for the lecturer to open the session…</p>`; }
    else if (s.game === "stall") [sig, html] = renderStall(s);
    else if (s.game === "end") { sig = "end"; html = `<h2>Thanks for playing</h2><div class="rule"></div><p>You can close this page.</p>`; }
    else { sig = "lobby"; html = `<h2>You're in!</h2><div class="rule"></div><p>You will run your own street-food stall:</p><p>${stallBadge()}</p><p>Keep this page open. It changes by itself when the game starts.</p><p class="muted small">Anonymous, not graded.</p>`; }
    const status = document.getElementById("status");
    if (!status.dataset.ready) {
      status.dataset.ready = "1";
      status.innerHTML = '<a href="#" id="reload" style="color:var(--blue)">Not updating? Tap here</a>';
      document.getElementById("reload").onclick = (e) => { e.preventDefault(); location.reload(); };
    }
    if (sig === lastSig) return;
    lastSig = sig; view.innerHTML = html; bind(s);
  }

  function renderStall(s) {
    const n = s.round;
    const head = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">${stallBadge()}${n ? `<span class="pill">Day ${n} of ${B.ROUNDS.length}</span>` : ""}</div>`;

    if (s.phase === "intro") {
      return ["intro", `${head}<h2 style="margin-top:14px">Run your own stall</h2><div class="rule"></div>
        <p>You sell <b>${T.food}</b> by the tray in a busy street market. Each day you choose <b>how many trays to bring</b> (0 = stay closed).</p>
        <div class="card soft"><b>Your costs</b><ul>
          <li><b>Rent: £${T.rent} a day</b>, paid <b>even if you stay closed</b>.</li>
          <li>Ingredients and staff: each extra tray costs more than the last (see the table).</li></ul>
          <b>Profit</b> = price × trays − total cost. Biggest total profit over ${B.ROUNDS.length} days wins.</div>
        ${costTable(1)}
        <p class="muted small">You are a small stall: you cannot change the market price.</p>`];
    }

    if (s.phase === "choose") {
      const r = R(n), mine = myQ(n), fixed = r.price != null;
      if (ui.round !== n) { ui.round = n; ui.q = mine != null ? mine : null; }
      const q = ui.q;
      const rent = T.rent * r.rentMult;
      let preview = "";
      if (q != null && fixed) {
        const rev = r.price * q, c = B.cost(T, q, r.rentMult), pr = rev - c;
        preview = `<div class="card soft"><table class="mini">
          <tr><td>Sales: £${r.price} × ${q}</td><td class="num">${B.money(rev)}</td></tr>
          <tr><td>Rent</td><td class="num">−£${rent}</td></tr>
          <tr><td>Ingredients and staff</td><td class="num">−£${B.varCost(T, q)}</td></tr>
          <tr class="me"><td>Profit today</td><td class="num" style="color:${pr >= 0 ? "var(--ok)" : "var(--warn)"}">${B.money(pr)}</td></tr></table></div>`;
      } else if (q != null) {
        const lp = lastPrice(n);
        preview = `<div class="card soft small">You bring <b>${q}</b> tray${q === 1 ? "" : "s"}. Your costs today: <b>£${B.cost(T, q, r.rentMult)}</b> (incl. rent £${rent}).${lp != null ? ` If the price were ${B.gbp(lp)} again, you would make <b>${B.money(B.profit(T, q, lp, r.rentMult))}</b>.` : ""}</div>`;
      }
      const priceBox = fixed
        ? `<div class="kpis"><div class="kpi"><div class="v">£${r.price}</div><div class="l">price per tray today</div></div><div class="kpi"><div class="v">£${rent}</div><div class="l">rent today${r.rentMult > 1 ? " (doubled)" : ""}</div></div></div>`
        : `<div class="kpis"><div class="kpi"><div class="v">?</div><div class="l">today's price: set by everyone's trays${lastPrice(n) != null ? `<br>${n > 4 ? "yesterday" : "a normal day"}: ${B.gbp(lastPrice(n))}` : ""}</div></div><div class="kpi"><div class="v">£${rent}</div><div class="l">rent today</div></div></div>`;
      const btns = Array.from({ length: B.MAXQ + 1 }, (_, v) => `<button data-q="${v}" style="${q === v ? "background:var(--blue);color:#fff;border-color:var(--blue)" : ""}">${v === 0 ? "Close" : v}</button>`).join("");
      return ["choose-" + n + "-" + q + "-" + mine + "-" + s.phaseId + "-" + lastPrice(n), `${head}
        <h2 style="margin-top:14px">${r.title}</h2><div class="rule"></div>
        <p>${r.note}</p>${priceBox}
        <p><b>How many trays do you bring?</b></p>
        <div class="quick">${btns}</div>
        ${preview}
        <button class="primary big full" id="submit" ${q == null || q === mine ? "disabled" : ""}>${mine != null ? "Change my choice" : "Submit"}</button>
        ${mine != null ? `<p class="center" style="color:var(--ok)"><b>Submitted: ${mine === 0 ? "closed" : mine + " trays"}.</b> You can change it until the day closes.</p>` : ""}
        ${timerHtml()}
        <details style="margin-top:10px"><summary class="small">Your cost table</summary>${costTable(r.rentMult, q)}</details>`];
    }

    if (s.phase === "results") {
      const r = R(n), p = priceOf(n), q = myQ(n);
      if (p == null) return ["res-wait-" + n, `${head}<h2 style="margin-top:14px">Day ${n}</h2><div class="rule"></div><p>Waiting for the market to close…</p>`];
      const qq = q == null ? 0 : q, pr = B.profit(T, qq, p, r.rentMult);
      const best = B.bestQ(T, p), bestPr = B.profit(T, best, p, r.rentMult);
      const rank = s.ranks && s.ranks.by && s.ranks.by[pid];
      return ["res-" + n + "-" + qq + "-" + p + "-" + JSON.stringify(rank || null), `${head}
        <h2 style="margin-top:14px">Day ${n}: ${r.title}</h2><div class="rule"></div>
        <div class="kpis"><div class="kpi"><div class="v">${B.gbp(p)}</div><div class="l">price</div></div>
        <div class="kpi"><div class="v" style="color:${pr >= 0 ? "var(--ok)" : "var(--warn)"}">${B.money(pr)}</div><div class="l">your profit (${q == null ? "no answer: closed" : qq === 0 ? "closed" : qq + " trays"})</div></div></div>
        <div class="card soft">At ${B.gbp(p)}, the best choice was <b>${best === 0 ? "to close" : best + " trays"}</b> (profit ${B.money(bestPr)}): keep adding trays while the <b>extra cost of a tray is no more than the price</b>.</div>
        <p>Total so far: <b>${B.money(totalUpTo(n))}</b>${rank ? ` · rank <b>${rank.rank}</b> of ${rank.of}` : ""}</p>
        <p class="muted small">Look at the screen.</p>`];
    }

    if (s.phase === "final") {
      const rank = s.ranks && s.ranks.by && s.ranks.by[pid];
      return ["final-" + JSON.stringify(rank || null) + totalUpTo(B.ROUNDS.length), `${head}<h2 style="margin-top:14px">Market closed</h2><div class="rule"></div>
        <div class="kpis"><div class="kpi"><div class="v">${B.money(totalUpTo(B.ROUNDS.length))}</div><div class="l">your total profit</div></div>
        ${rank ? `<div class="kpi"><div class="v">${rank.rank}</div><div class="l">your rank of ${rank.of}</div></div>` : ""}</div>
        <p>Look at the screen for the leaderboard.</p>`];
    }
    return ["other", `<p>Look at the screen.</p>`];
  }

  function bind(s) {
    if (!(s && s.game === "stall" && s.phase === "choose")) return;
    view.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { ui.q = Number(b.dataset.q); render(); }));
    const btn = document.getElementById("submit");
    btn.onclick = () => {
      btn.disabled = true;
      const n = s.round, f = myFirm();
      if (f) S.updateDoc("firm/" + pid, { ["q.r" + n]: ui.q });
      else S.setDoc("firm/" + pid, { lobby: s.lobby, type: T.key, q: { ["r" + n]: ui.q } });
    };
  }
})();
