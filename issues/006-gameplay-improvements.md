# 🎯 Issue 006 – Gameplay Loop Improvements

**Title**: Add rounds, scoring, combo, and high‑score loop to the flashlight game

**Description**:
- As a child, I want the game to have a clear start and end so that I feel a sense of completion and want to play again.
- As a child, I want to catch animals that I spot with the flashlight so that I get points for my skill and speed.
- As a child, I want the game to get more challenging over time so that I stay engaged and motivated.
- Current state: the flashlight game (`public/index.html`) only lets the player light the screen for 5 s and watch animals move. There is no way to catch, no score, no time limit, and no game‑over state.
- Technical tasks:
  1. **Game states**: add a start screen (title + “Start” button), an in‑play state, and a game‑over screen (final score + “Play again”).
  2. **Timed rounds**: each round lasts 60 s; show a countdown timer in the corner and end the round at 0.
  3. **Catch mechanic**: clicking a visible animal (within the flashlight radius) catches it. On catch, hide the animal, increment the score, show a brief ✅/＋100 effect, and play a short catch sound.
  4. **Escape mechanic**: an animal that stays lit for more than ~3 s without being caught escapes and disappears (optional: with a small “escape” sound or ✖️ flash).
  5. **Combo multiplier**: consecutive catches within a short window (e.g., 5 s) build a combo that multiplies points (×1, ×2, ×3…); the combo resets when a catch is missed, an animal escapes, or time runs out.
  6. **Rare bonus animals**: add a rare golden animal (🐺 / 🦄) that appears occasionally and is worth 5× points, giving the player a reason to keep searching.
  7. **Difficulty scaling**: as time progresses or score grows, increase animal movement speed and the number of animals on screen (e.g., from 4 to 8).
  8. **High score**: persist the best score in `localStorage` and show it on the start and game‑over screens.
  9. **Game‑over feedback**: show final score, best score, and the number of animals caught on the game‑over screen.

**Acceptance Criteria**:
- The player can start, play, and finish a round, then play again without reloading the page.
- Catching a visible animal increases the score and shows immediate visual (and optional audio) feedback.
- A 60‑second timer is visible and the round ends with a game‑over screen.
- Combo, rare animals, and difficulty scaling work and are communicated to the player.
- Best score persists across sessions via `localStorage`.
- The game remains playable with a mouse and degrades gracefully on touch (tap = click).

**Priority**: High
**Labels**: `gameplay`, `scoring`, `feature`, `game-loop`
**Assignee**: @gameplay
