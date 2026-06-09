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

## Allied-team matchmaking rule

Teams that share the same (trimmed, case-insensitive, non-empty) team name are
"allies" and must never be paired against each other. Matchmaking
(`generateMatches` → `findPairing` backtracking) applies constraints in tiers:
1) no ally pairs AND no prior-round rematch, 2) no ally pairs, 3) any pairing.

**Why:** users run multiple teams under one club name (e.g. two "Parrilla"
teams) and expect club-vs-club, never club-vs-itself.

**How to apply:** tier 3 only fires when avoiding allies is mathematically
impossible (one name held by > half the teams). Normal pair-based setups are
always solvable. Manual `swapTeamSlots` is intentionally NOT constrained — it's a
deliberate user override.

## Start-time ally feasibility gate

`allyPairingFeasible(teams)` = largest same-name group size ≤ `ceil(N/2)` (empty
names are wildcards, not a shared group). This is the exact necessary/sufficient
condition for a round-1 pairing with no same-name opponents and at most one bye.
`startTournament` refuses to start when infeasible; Setup exposes `startFeasible`
to disable the Start button and show `startBlockedAllies` (es/en).

**Why:** bulk-add ("add N pairs per club") makes many same-name teams common, so a
lopsided setup (one club > half the teams) would force allies to meet in round 1.

**How to apply:** gate ONLY round-1 start, never later rounds — the end-game
(only allies left) legitimately needs same-name matches to crown one champion, so
`generateMatches` keeps its tier-3 fallback for in-tournament rounds.
