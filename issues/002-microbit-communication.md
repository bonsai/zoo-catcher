# 🎯 Issue 002 – Micro:bit Communication

**Title**: Implement WebUSB Communication Between Browser and micro:bit

**Description**:
- As a developer, I need to transmit the hand‑direction byte from the web page to the micro:bit over WebUSB so that the LED matrix can be updated in real time.
- Technical tasks:
  1. Detect micro:bit device using `navigator.usb`.
  2. Open the device, claim the first endpoint.
  3. Send a `Uint8Array([direction])` whenever the direction changes.
  4. Handle reconnection if the device is unplugged.
  5. Provide fallback mock mode when WebUSB is unavailable.

**Acceptance Criteria**:
- micro:bit receives a byte every 100 ms matching the direction value shown in the console.
- LED matrix updates accordingly (e.g., display a simple arrow or gradient).

**Priority**: High
**Labels**: `feature`, `microbit`, `webusb`
**Assignee**: @frontend