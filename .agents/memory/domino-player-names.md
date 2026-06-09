---
name: Domino default player name translation
description: How default casilla names stay localized across language switches
---

Default casilla names are STORED as Spanish literals ("Casa"/"Visitante"/`Jugador N`) and translated at DISPLAY time, never migrated in storage.

`translatePlayerName(name, lang)` (in `constants/translations.ts`) maps the known defaults in EITHER language to the current `lang`, and returns any other string unchanged.

**Why:** lets the UI flip es↔en instantly without rewriting stored state, and preserves custom names the user typed. Saving an unchanged default in English ("House") still re-translates because the map is bidirectional.

**How to apply:** any NEW place that renders a player/casilla name MUST wrap it in `translatePlayerName(p.name, lang)` — otherwise that site won't localize on language switch. Edge case: a user who literally types a default name will see it auto-translated (accepted limitation of value-based matching).
