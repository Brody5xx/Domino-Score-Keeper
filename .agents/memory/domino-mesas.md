---
name: Domino mesas grouping invariant
description: How the optional "mesa" (table) grouping coexists with the flat player-count selector in the domino app
---

# Mesa grouping invariant

The domino app keeps the flat player-count selector (2–8) AND an optional "mesas" grouping (0 = off/flat, 1–4 mesas, each mesa = exactly 2 casillas/players).

**Rule:** when `mesas > 0`, `players.length` must equal `mesas * 2`. To hold this, ANY mutation of the player set resets `mesas` to 0: `setPlayerCount`, `addPlayer`, and `removePlayer` all set `mesas: 0`. Only `setMesas(n>=1)` resizes players to `n*2`; `setMesas(0)` just disables grouping and leaves players untouched.

**Why:** the grouped render indexes `players[i*2]`/`players[i*2+1]` for `i in 0..mesas-1`. If the invariant breaks, extra players become invisible or mesas render with empty slots. Resetting mesas on any player mutation is simpler and safer than self-healing in render.

**How to apply:** if you add any new code path that changes the players array, set `mesas: 0` in that update too (unless it deliberately keeps `length === mesas*2`).
