---
name: Domino tournament mode architecture
description: Why tournament state is isolated from the regular two-team game state in the domino app
---

# Domino "Modo Torneo"

Tournament mode in `artifacts/domino` runs as a parallel feature inside the Mesas
screen (`app/index.tsx`), toggled by an award icon in the top bar. It does NOT
reuse the regular game (Casa/Visitante) state.

**Rule:** keep tournament state fully separate from `GameContext`.
- Tournament lives in its own `TournamentContext` with AsyncStorage key
  `domino_tournament_v1` (regular game uses its own key).
- `index.tsx` conditionally renders `<Tournament/>` vs the normal mesa content
  via `tournamentActive` from `useTournament()`.

**Why:** the two modes have incompatible data shapes (2 fixed teams vs N teams
with lives/rounds/byes) and must persist independently so toggling never clobbers
an in-progress game on either side.

**How to apply:** when adding cross-cutting features (themes, search, history),
wire them into both contexts separately rather than trying to unify the state.
