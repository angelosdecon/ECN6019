// Week 7 student page: "Be the market". Each phone is a trader (a Baker or an Orchard owner).
// When the auctioneer opens a round at a price, the trader picks a bundle on her budget line and sends her order.
(function () {
  const S = window.Store, B = window.BL, cfg = window.BIASLAB_CONFIG || {};
  const view = document.getElementById("view");
  document.getElementById("modname").textContent = (cfg.moduleName || "") + (S.demo ? " · demo mode" : "");

  const idStore = S.demo ? sessionStorage : localStorage;
  const ID_KEY = "ecn-pid-" + S.root;
  let pid = idStore.getItem(ID_KEY);
  if (!pid) { pid = B.newId(); idStore.setItem(ID_KEY, pid); }
  const T = B.typeOf(pid);

  let hiddenAt = null;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 3000) location.reload();
    hiddenAt = null;
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });

  const st = { state: null, mine: undefined };
  const ui = { x: null, round: null, sending: false };
  S.onDoc("", (d) => { st.state = d; register(); render(); });
  S.onDoc("tr/" + pid, (d) => { st.mine = d; register(); render(); });

  const lobby = () => st.state && st.state.lobby;
  const mine = () => (st.mine && st.mine.lobby === lobby() ? st.mine : null);
  const rk = (r) => "r" + r;

  function register() {
    if (!lobby() || st.mine === undefined) return;
    if (mine() || register.pending === lobby()) return;
    register.pending = lobby();
    S.setDoc("tr/" + pid, { lobby: lobby(), type: T.key, joinedAt: Date.now(), r: {} });
  }

  const pl = (v, one, many) => B.num(v, 2) + " " + (Math.abs(v - 1) < 1e-9 ? one : many || one + "s");
  const typeCard = () => `<div class="card soft"><div style="font-size:22px"><span style="font-size:30px">${T.icon}</span> You are a <b style="color:${T.color}">${T.name}</b></div>
    <p>${T.owns}<br>${T.likes}</p></div>`;

  let lastSig = "";
  function render() {
    const s = st.state;
    let sig, html;
    if (!lobby()) { sig = "wait"; html = `<h2>Welcome</h2><div class="rule"></div><p>Waiting for the lecturer to open the session…</p>`; }
    else if (s.phase === "lobby") {
      sig = "lobby" + lobby();
      html = `<h2>You're in</h2><div class="rule"></div>${typeCard()}
        <p>I am the <b>auctioneer</b>. I will call out a price for apples (a loaf of bread always costs £1). At that price, you choose what to buy and sell.</p>
        <p class="muted small">Keep this page open. The first round starts soon.</p>`;
    } else if (s.phase === "round") {
      const r = s.round, p = s.price, sent = mine() && mine().r && mine().r[rk(r)];
      if (s.open) {
        if (ui.round !== r) { ui.round = r; ui.x = sent ? sent.x : Math.min(T.wx, B.income(T, p) / p); }
        sig = "open" + r + "|" + (sent ? "s" + sent.x : "n") + (ui.sending ? "w" : "");
        html = roundOpen(r, p, sent);
      } else {
        const h = (s.hist || []).find((e) => e.r === r);
        sig = "closed" + r + (h ? "h" : "") + (sent ? "s" : "");
        html = roundClosed(r, p, sent, h);
      }
    } else if (s.phase === "reveal") {
      sig = "reveal" + (s.eq ? s.eq.p : "");
      html = reveal(s);
    } else {
      sig = "end"; html = `<h2>Thank you</h2><div class="rule"></div><p>The market found its price. Look up at the screen.</p>`;
    }
    if (sig === lastSig) return;
    lastSig = sig; view.innerHTML = html;
    wire();
  }

  function roundOpen(r, p, sent) {
    const m = B.income(T, p), max = Math.floor((m / p) / B.STEP + 1e-9) * B.STEP;
    return `<div class="small muted">Round ${r}</div>
      <div class="pricebox">1 apple costs <b>${B.money(p)}</b><span class="small muted"> · a loaf of bread £1</span></div>
      <div class="card soft small"><span style="font-size:20px">${T.icon}</span> <b>${T.name}</b>: ${T.owns} ${T.likes}<br>
        At this price your things are worth <b>${B.money(m)}</b>${T.wx ? ` (${T.wx} apples × ${B.money(p)})` : ` (${T.wy} loaves × £1)`}.</div>
      <p style="margin-bottom:4px"><b>How many apples do you want to end up with?</b> Bread is whatever money is left.</p>
      <input type="range" id="sx" min="0" max="${B.num(max, 1)}" step="${B.STEP}" value="${B.num(Math.min(ui.x, max), 1)}">
      <div class="bundle">
        <div><div class="v" id="vx"></div><div class="l">apples 🍎</div></div>
        <div><div class="v" id="vy"></div><div class="l">loaves 🍞</div></div>
        <div><div class="v" id="vu" style="color:var(--ok)"></div><div class="l">happiness</div></div>
      </div>
      <div class="meter"><span id="um"></span></div>
      <p class="small center" id="trade"></p>
      <button class="primary full big" id="send" ${ui.sending ? "disabled" : ""}>${sent ? "Update my order" : "Send my order"}</button>
      <p class="small muted center" id="sentnote">${sent ? `✓ Order sent: ${B.num(sent.x, 1)} apples, ${B.num(sent.y, 1)} loaves. You can change it until the round closes.` : "Move the slider to make yourself as happy as you can, then send."}</p>`;
  }

  // Update the numbers as the slider moves (without redrawing the page).
  function wire() {
    const sx = document.getElementById("sx");
    if (sx) {
      const s = st.state, p = s.price, m = B.income(T, p);
      const umax = B.points(T, B.best(T, p).x, B.best(T, p).y);
      const show = () => {
        const x = Number(sx.value), y = Math.max(0, m - p * x);
        ui.x = x;
        document.getElementById("vx").textContent = B.num(x, 1);
        document.getElementById("vy").textContent = B.num(y, 1);
        const u = B.points(T, x, y);
        document.getElementById("vu").textContent = B.num(u, 1);
        document.getElementById("um").style.width = Math.min(100, (100 * u) / Math.max(umax, 0.1)) + "%";
        const dx = x - T.wx, dy = y - T.wy;
        document.getElementById("trade").innerHTML = Math.abs(dx) < 1e-9 ? "No trade: you keep what you own." :
          dx > 0 ? `You <b>buy ${B.num(dx, 1)} apples</b> and pay with <b>${B.num(-dy, 1)} loaves</b>.`
                 : `You <b>sell ${B.num(-dx, 1)} apples</b> for <b>${B.num(dy, 1)} loaves</b>.`;
      };
      sx.oninput = show; show();
    }
    const send = document.getElementById("send");
    if (send) send.onclick = async () => {
      const s = st.state; if (!s || s.phase !== "round" || !s.open) return;
      const p = s.price, m = B.income(T, p), x = Number(document.getElementById("sx").value), y = Math.max(0, m - p * x);
      ui.sending = true; render();
      await S.updateDoc("tr/" + pid, { lobby: lobby(), type: T.key, ["r." + rk(s.round)]: { p, x, y, t: Date.now() } });
      ui.sending = false; lastSig = ""; render();
    };
  }

  function roundClosed(r, p, sent, h) {
    let market = "";
    if (h) {
      const dir = Math.abs(h.zx) < 0.05 * Math.max(1, h.avail) ? `<b>That's (almost) it: the apple market clears.</b>` :
        h.zx > 0 ? `More apples wanted than there are: <b>excess demand</b>. The price of apples should <b>rise</b>.`
                 : `Fewer apples wanted than there are: <b>excess supply</b>. The price of apples should <b>fall</b>.`;
      market = `<div class="card"><b>The market at ${B.money(p)}</b>
        <p>Apples wanted: <b>${B.num(h.want, 1)}</b> · apples available: <b>${B.num(h.avail, 1)}</b></p><p>${dir}</p></div>`;
    }
    const me = sent ? `<p>You ordered <b>${B.num(sent.x, 1)} apples</b> and <b>${B.num(sent.y, 1)} loaves</b> (happiness ${B.num(B.points(T, sent.x, sent.y), 1)}).</p>`
                    : `<p class="muted">You did not send an order this round.</p>`;
    return `<div class="small muted">Round ${r} · closed</div><h2>Look at the screen</h2><div class="rule"></div>${me}${market}
      <p class="small muted">The auctioneer will call a new price.</p>`;
  }

  function reveal(s) {
    const eq = s.eq; if (!eq || !eq.p) return `<h2>The equilibrium</h2><div class="rule"></div><p>Look at the screen.</p>`;
    const b = B.best(T, eq.p), u0 = B.points(T, T.wx, T.wy), u1 = B.points(T, b.x, b.y);
    const dx = b.x - T.wx;
    return `<h2>The equilibrium price: ${B.money(eq.p)}</h2><div class="rule"></div>
      <div class="card soft"><span style="font-size:22px">${T.icon}</span> As a <b>${T.name}</b>, your best choice at ${B.money(eq.p)} is
        <b>${pl(b.x, "apple")}</b> and <b>${pl(b.y, "loaf", "loaves")}</b>: you ${dx > 0 ? "buy " + pl(dx, "apple") : "sell " + pl(-dx, "apple")}.</div>
      <p>Happiness: <b>${B.num(u0, 1)}</b> with what you owned → <b>${B.num(u1, 1)}</b> after trade. Trade makes both types better off.</p>
      <p class="small muted">At this price everyone's best choice adds up to exactly the apples (and bread) that exist: a Walrasian equilibrium.</p>`;
  }
})();
