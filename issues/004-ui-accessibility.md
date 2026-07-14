# 🎯 Issue 004 – UI Polish & Accessibility

**Title**: Improve UI readability and accessibility

**Description**:
- As a user with visual impairments, I need larger text and high‑contrast colors so that I can read instructions easily.
- As a user with hearing impairments, I need visual cues instead of (or in addition to) sounds so that I can understand feedback.
- Technical tasks:
  1. Increase all instructional text to at least 18 pt and switch to a dyslexia‑friendly font.
  2. Ensure color contrast ≥ 4.5:1 for normal text and ≥ 3:1 for large text (WCAG AA compliance).
  3. Replace audio‑only feedback with multimodal signals:
     - **Hit**: flash the micro:bit LED matrix green and display a large “✅” overlay for 0.3 s.
     - **Miss**: flash the micro:bit LED matrix red and display a large “✖️” overlay for 0.5 s.
     - Add a visual “miss” animation on the web page (e.g., brief red border around the score).
  4. Add a “Skip Audio” toggle to mute/unmute sound effects.
  5. Add ARIA labels and keyboard focus indicators to all interactive elements for screen‑reader and keyboard navigation.

**Acceptance Criteria**:
- All on‑screen instructions meet WCAG AA contrast requirements.
- Keyboard users can tab through buttons and hear focus outlines; pressing `Enter` activates them.
- Hit and miss events are communicated via both visual cues on the micro:bit and a visual overlay on the page; optional sound can be disabled.
- The “Skip Audio” toggle works and persists across sessions.

**Priority**: Medium
**Labels**: `accessibility`, `ui`
**Assignee**: @design