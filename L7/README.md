# Week 7: be the market (a Walrasian auctioneer)

Every phone is a trader in an exchange economy with two goods, apples and bread (bread is the numeraire: £1 a loaf).

- **Bakers** (about half the phones): own 12 loaves and no apples; utility x^½ y^½ (spend half their income on apples).
- **Orchard owners**: own 3 apples and no bread; utility x^⅓ y^⅔ (spend a third on apples, so they always keep 1 apple).

The lecturer is the auctioneer. On the dashboard: type a price for apples → **Open round**. Each phone shows the trader's income at that price (the value of what she owns), and a slider for how many apples to end up with; bread is the money left over, and a "happiness" meter (utility × 10) shows how good the bundle is. Students send an order (they can change it until the round closes). **Close round** shows apples wanted vs available, excess demand for apples and for bread, the Walras' law check (p × z_apples + z_bread = 0) and a suggested next price (price × wanted / available). Repeat 3–5 rounds, then **Reveal equilibrium**: the price that clears the market for the class's actual mix of types, p* = 3 × Bakers / Orchard owners (3 with equal numbers; Bakers then end with 2 apples and 6 loaves, Orchard owners with 1 apple and 6 loaves), with the price path on a chart.

Suggested opening price £1 (big excess demand). About 5 minutes. Parameters: `js/common.js`. Data: `sessions/L7/tr/*` ({lobby, type, r: {r1: {p, x, y}}}); round summaries in the session document (`hist`).

Demo mode (`?demo=1`): "+ 16 simulated students" adds traders; while a round is open they answer automatically (best bundle ± 20%).
