# 🎯 Issue 001 – Hand‑Tracking Integration

**Title**: Add MediaPipe Hand Tracking to Capture Hand Direction

**Description**:
- As a user, I want the web app to detect my hand pose via the webcam so that the micro:bit can receive directional data.
- Technical tasks:
  1. Include `@mediapipe/hands` library via CDN.
  2. Initialize MediaPipe Hands in the browser.
  3. Extract the angle between wrist and index fingertip.
  4. Send the angle (rounded to an integer) to the micro:bit using WebUSB.
  5. Treat the payload as a signed byte (`-128 .. +127`).

**Acceptance Criteria**:
- Hand tracking works after clicking “Start”.
- Direction updates at ~10 Hz.
- micro:bit LED matrix reflects the direction (e.g., arrow pointing left/right/up/down).

**Priority**: High
**Labels**: `feature`, `hand-tracking`
**Assignee**: @developer