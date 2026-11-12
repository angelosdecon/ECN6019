# Week 8: two games on your phone

1. **Guess ⅔ of the average** (whole class, two rounds). Every phone picks a whole number from 0 to 100; the winner is the phone closest to two thirds of the class average. Each phone gets a fun name ("Golden Otter #42") so the winner can be announced. Round results are frozen when the dashboard moves to the results step and are shown on the phones (average, target, winning number, own number; winners see a trophy). The "What game theory predicts" step shows the ladder 100 → 66.7 → 44.4 → … → 0, the class averages of both rounds and the share who picked 0 in round 2.
2. **Spot the equilibrium** (self-paced). Each phone gets its own six payoff matrices (generated from the phone id, payoffs 0–9, no ties in best responses): a dilemma with dominant strategies, a 2×2 with one equilibrium, a 2×2 with two, a 2×2 with none, a 3×3 with one (where the cell best for both is not an equilibrium) and a 3×3 with two. Students tap every pure-strategy Nash equilibrium (or "none") and press Check: one try, then the matrix shows the best responses underlined and the equilibria shaded, and says who would switch from any wrongly chosen cell. The dashboard shows % right first time per game and the most common mistake (said "none" but there is one; found one where there is none; missed an equilibrium; picked the cell best for both; only one player best-responding).

Dashboard steps (Next/Back or arrow keys): Join → Round 1 open → Round 1 results → Round 2 open → Round 2 results → What game theory predicts → Spot the equilibrium (live) → Results → End. The exercise stays open on the phones after the "Spot" step.

Data: `sessions/L8/pl/*` ({lobby, name, g: {r1, r2}, s: {k0..k5: {ok, tag, sel, type, nx}}}); round results in the session document (`res`).

Demo mode (`?demo=1`): "+ 16 simulated students" adds players (with guesses for the rounds already opened, and answers to some games).
