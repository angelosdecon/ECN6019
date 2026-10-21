# ECN6019 – class games

Live classroom games for Microeconomic Analysis I. Students play on their phones; the lecturer runs each game from a dashboard on the projector.

## Folders

- `shared/` – used by every week: Firebase settings and passcode (`config.js`), styles, data code and libraries. **Paste the Firebase settings here once.**
- `L4/` – Week 4: public goods game and "Fake a coin".
  - Students: `https://<username>.github.io/ECN6019/L4/`
  - Dashboard: `https://<username>.github.io/ECN6019/L4/dashboard.html`
- `L5/`, `L6/`, … – later weeks, added the same way. Each week's folder keeps its own data (the folder name is the data key), so weeks never mix.
- `index.html` – a simple landing page linking the weeks (add a line when you add a week).
- `firestore.rules` – paste into Firebase once (Firestore → Rules).

## One-time setup

1. **GitHub Pages:** Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
2. **Firebase** (free Spark plan): console.firebase.google.com → create a project → Build → Firestore Database → Create database (europe-west2, production mode) → Rules tab: paste `firestore.rules` → Publish.
3. Project settings (gear) → General → Your apps → `</>` → register a web app → copy the `firebaseConfig` values into `shared/config.js` (pencil icon on GitHub, commit).

Until step 3 is done the pages run in **demo mode** (red flag on the dashboard): everything works inside one browser only, and the dashboard has a "+ 16 simulated students" button for rehearsing.

## In class

Open the week's dashboard (passcode in `shared/config.js`), show the QR, then use Next/Back or the arrow keys. **New session** makes every phone re-join and leaves earlier answers out of the results.

Game rules for each week are at the top of `Lx/js/common.js`.
