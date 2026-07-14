# 🎯 Issue 005 – Catch‑Animal Gameplay

**Title**: Replace “Shoot” mechanic with “Catch” mechanic

**Description**:
- As a child, I want to *catch* a virtual animal by aligning my hand direction and pressing the “catch” button, instead of “shooting” a target.
- Technical tasks:
  1. Rename the hit‑function to `catch-animal!` and fire it on **Button B**.
  2. Accept a hand‑direction tolerance of ±30° as a successful catch.
  3. On success: increment `score`, flash the micro:bit green, show a ✅ emoji, and play a “catch” sound.
  4. On miss: keep the animal on screen until it is caught or a timeout (e.g., 5 s) expires.
  5. Update the UI to show the live score (large numeric overlay).

**Acceptance Criteria**:
- Pressing Button B triggers `catch-animal!`.
- When the hand direction matches the animal’s direction within the tolerance, the score increments and the visual + audio feedback runs.
- The micro:bit displays a green flash / smiley for a successful catch and a red flash / frown for a missed attempt (optional).
- Score is visible on the webpage in real time.

**Priority**: High  
**Labels**: `gameplay`, `catch`, `hand-tracking`  
**Assignee**: @gameplay