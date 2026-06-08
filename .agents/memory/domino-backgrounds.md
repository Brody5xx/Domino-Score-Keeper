---
name: Domino app backgrounds
description: How the Dominó app renders its themed backgrounds and why persisted theme ids must be normalized
---

# Domino background themes

The Dominó app (`artifacts/domino`) uses realistic photographic backgrounds (bundled PNGs in `assets/backgrounds/`) rendered via `ImageBackground` in `DominoBackground.tsx`, keyed off `bgTheme`. Each theme has a dark overlay; the player cards and history container are translucent (rgba) so the photo shows through.

**Rule:** `bgTheme` is a persisted enum-like value in AsyncStorage (`domino_game_v3`). Whenever theme ids are renamed/removed, normalize on hydration AND in the setter (`normalizeBgTheme` in `GameContext.tsx`) — falling back to a valid default.

**Why:** When ids were changed from geometric SVG names (scatter/diagonal/...) to photo names (whiskey/wood/chain/marble/neon), returning users had a stale persisted id. Render fell back fine, but the settings picker showed no active chip — inconsistent UX. Normalizing on load fixes the chip highlight and prevents invalid values persisting.
