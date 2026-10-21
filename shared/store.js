// Shared document store.
// Live: Cloud Firestore (free Spark plan, no limit on simultaneous students).
// Demo: a local copy shared between tabs of one browser (no setup needed).
//
// Paths are relative to the session document  sessions/<root>.
//   doc(""): the session state            doc("players/p1"): one player
//   col("players"): all players
(function () {
  const cfg = window.BIASLAB_CONFIG || {};
  const fb = cfg.firebase || {};
  const forceDemo = /[?&]demo=1/.test(location.search);
  const DEMO = forceDemo || !fb.apiKey || /^PASTE/.test(fb.apiKey) || !fb.projectId;
  // Each week's folder (L4, L5, ...) keeps its own data: the folder name is the data key.
  const segsPath = location.pathname.split("/").filter(Boolean);
  const folder = segsPath.length && /\./.test(segsPath[segsPath.length - 1]) ? segsPath[segsPath.length - 2] : segsPath[segsPath.length - 1];
  const ROOT = cfg.root || folder || "games";
  const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  const segs = (p) => String(p || "").split("/").filter(Boolean);

  let api;
  if (!DEMO) {
    firebase.initializeApp(fb);
    const fs = firebase.firestore();
    const base = fs.collection("sessions").doc(ROOT);
    const dref = (p) => (segs(p).length ? base.collection(segs(p)[0]).doc(segs(p)[1]) : base);
    const cref = (p) => base.collection(segs(p)[0]);
    api = {
      demo: false,
      setDoc: (p, data, merge) => dref(p).set(clone(data), { merge: !!merge }),
      updateDoc: (p, fields) => dref(p).set(nest(fields), { merge: true }),
      getDoc: (p) => dref(p).get().then((s) => (s.exists ? s.data() : null)),
      deleteDoc: (p) => dref(p).delete(),
      onDoc: (p, cb) => dref(p).onSnapshot((s) => cb(s.exists ? s.data() : null), (e) => console.error(e)),
      getCol: (p) => cref(p).get().then((q) => q.docs.map((d) => ({ id: d.id, data: d.data() }))),
      onCol: (p, cb) => cref(p).onSnapshot((q) => cb(q.docs.map((d) => ({ id: d.id, data: d.data() }))), (e) => console.error(e)),
      batchSet: async (items) => {
        for (let i = 0; i < items.length; i += 400) {
          const batch = fs.batch();
          for (const [p, data, merge] of items.slice(i, i + 400)) batch.set(dref(p), clone(data), { merge: !!merge });
          await batch.commit();
        }
      },
      clearCol: async (p) => {
        const q = await cref(p).get();
        let batch = fs.batch(), n = 0;
        for (const d of q.docs) { batch.delete(d.ref); if (++n % 400 === 0) { await batch.commit(); batch = fs.batch(); } }
        await batch.commit();
      }
    };
  } else {
    const KEY = "ecn-demo-" + ROOT;
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(KEY) : null;
    const listeners = [];
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    const keyOf = (p) => segs(p).join("/");
    const colOf = (k) => (k.includes("/") ? k.split("/")[0] : null);
    const notify = () => {
      const t = load();
      for (const l of listeners.slice()) {
        let v;
        if (l.kind === "doc") v = t[l.key] === undefined ? null : t[l.key];
        else v = Object.keys(t).filter((k) => colOf(k) === l.key).sort().map((k) => ({ id: k.split("/")[1], data: t[k] }));
        const s = JSON.stringify(v);
        if (s !== l.last) { l.last = s; l.cb(clone(v)); }
      }
    };
    let pending = false;
    const save = (t) => {
      localStorage.setItem(KEY, JSON.stringify(t));
      if (channel) channel.postMessage(1);
      if (!pending) { pending = true; setTimeout(() => { pending = false; notify(); }, 0); }
    };
    if (channel) channel.onmessage = notify;
    window.addEventListener("storage", (e) => { if (e.key === KEY) notify(); });
    const merge = (a, b) => {
      if (b == null || typeof b !== "object" || Array.isArray(b)) return b;
      const o = a && typeof a === "object" && !Array.isArray(a) ? Object.assign({}, a) : {};
      for (const k of Object.keys(b)) o[k] = merge(o[k], b[k]);
      return o;
    };
    const listen = (kind, p, cb) => {
      const l = { kind, key: keyOf(p), cb, last: undefined };
      listeners.push(l); setTimeout(notify, 0);
      return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
    };
    api = {
      demo: true,
      setDoc: async (p, data, m) => { const t = load(); t[keyOf(p)] = m ? merge(t[keyOf(p)], clone(data)) : clone(data); save(t); },
      updateDoc: async (p, fields) => { const t = load(); t[keyOf(p)] = merge(t[keyOf(p)], nest(fields)); save(t); },
      getDoc: async (p) => clone(load()[keyOf(p)] === undefined ? null : load()[keyOf(p)]),
      deleteDoc: async (p) => { const t = load(); delete t[keyOf(p)]; save(t); },
      onDoc: (p, cb) => listen("doc", p, cb),
      getCol: async (p) => Object.entries(load()).filter(([k]) => colOf(k) === keyOf(p)).map(([k, v]) => ({ id: k.split("/")[1], data: clone(v) })),
      onCol: (p, cb) => listen("col", p, cb),
      batchSet: async (items) => { const t = load(); for (const [p, data, m] of items) t[keyOf(p)] = m ? merge(t[keyOf(p)], clone(data)) : clone(data); save(t); },
      clearCol: async (p) => { const t = load(); for (const k of Object.keys(t)) if (colOf(k) === keyOf(p)) delete t[k]; save(t); }
    };
  }

  // {"c.r1.p7": 5} -> {c: {r1: {p7: 5}}}  (used with merge, so other fields are kept)
  function nest(fields) {
    const out = {};
    for (const [path, v] of Object.entries(fields)) {
      const ks = path.split("."); let o = out;
      for (let i = 0; i < ks.length - 1; i++) { o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; }
      o[ks[ks.length - 1]] = clone(v);
    }
    return out;
  }

  api.root = ROOT;
  window.Store = api;
})();
