---
name: RN nested modal stacking order (domino)
description: How overlapping React Native Modals stack in the domino app and how to make a confirmation appear on top
---

# React Native modal stacking order

In this Expo/RN app, multiple sibling `<Modal>` components stack by **render order in the JSX tree**: a modal declared later renders on top of one declared earlier. There is no z-index control for `<Modal>`.

**Rule:** a confirmation/secondary modal that must appear over another modal (e.g. the "delete previous game" confirm over the "Anteriores"/history modal) must be declared AFTER that modal in the JSX, not before.

**Why:** the delete-game confirm originally rendered before the history modal and appeared *behind* it. Reordering it after the history modal fixed it.

**How to apply:** when adding any new confirm/sub-modal that opens from within another modal, place its `<Modal>` block after the parent modal's closing tag in `artifacts/domino/app/index.tsx`.
