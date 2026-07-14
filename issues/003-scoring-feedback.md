# 🎯 Issue 003 – Scoring & Feedback System

**Title**: Implement Score Tracking and Feedback (sound + LED)

**Description**:
- As a child, I want points to increase when I hit a target so that I can see my progress.
- As a child, I want audio and visual feedback for hits/misses so that I understand the outcome.
- Technical tasks:
  1. Maintain a `score` atom in ClojureScript.
  2. Increment `score` on a successful hit.
  3. Play a short “hit” sound (e.g., `new Audio('hit.wav').play()`) on success.
  4. Play a “miss” sound on failure.
  5. Display the current score on the UI (large numeric overlay).
  6. Show a temporary LED pattern on the micro:bit for hit (e.g., fill all pixels briefly) and a different pattern for miss.

**Acceptance Criteria**:
- Score increments correctly and persists across rounds.
- Appropriate sound plays and stops after 1 s.
- micro:bit displays distinct patterns for hit vs. miss.

**Priority**: Medium
**Labels**: `feature`, `scoring`, `feedback`
**Assignee**: @gameplay