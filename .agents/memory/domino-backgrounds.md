---
name: Domino app backgrounds
description: How the Dominó app renders themed SVG backgrounds plus an optional user gallery photo, and why persisted theme ids / photo URIs must be reconciled on load
---

# Domino background themes

The Dominó app (`artifacts/domino`) renders its background in `DominoBackground.tsx`, keyed off `bgTheme` (persisted in AsyncStorage `domino_game_v3`).

- Default: geometric SVG domino patterns (`react-native-svg`), theme ids `scatter`/`diagonal`/`grid`/`radial`/`giant`. (An earlier attempt to use bundled photo PNGs was reverted — the user disliked the sizing/"desktop mode" look.)
- Optional: a user-chosen photo from the device gallery. When `bgTheme === "custom"` AND `customBgUri` is set, render an `ImageBackground` (uri) with a dark overlay; otherwise render the SVG.

**Rule — normalize persisted theme ids.** `bgTheme` is an enum-like value. Whenever ids are renamed/removed, normalize on hydration AND in the setter (`normalizeBgTheme` in `GameContext.tsx`), falling back to a valid default. `custom` is a valid id only meaningful alongside a `customBgUri`.

**Rule — reconcile custom theme with its payload on hydration.** If a returning user has `bgTheme:"custom"` but no usable `customBgUri`, force `bgTheme` back to `scatter` on load. A "custom" theme without an image is a logically inconsistent state.

**Rule — persist gallery photos durably, not the raw picker URI.** `expo-image-picker` returns temporary cache URIs (iOS/Android) that can be evicted, so a persisted picker URI may point to a dead file after restart. Copy the picked image into app-scoped storage via `expo-file-system`'s `new File(uri).copy(new File(Paths.document, name))` and persist *that* uri. Skip the copy on web (Platform.OS === "web"; blob/data URIs, won't survive reload anyway). Delete the copied file when the user removes/replaces the photo.

**Rule — gallery permission flow is platform-aware.** Only call `requestMediaLibraryPermissionsAsync()` on native; web doesn't need it and the denied message ("phone settings") would be wrong there. Use `mediaTypes: ["images"]` (new array API, not the deprecated `MediaTypeOptions`).

**Why:** When ids were once changed without normalization, returning users had a stale persisted id and the settings picker showed no active chip — inconsistent UX. The durable-storage and hydration-reconcile rules exist so a chosen background actually survives app restarts instead of silently vanishing.
