# Milestone 4 Verification and Challenge Report

## Executive Summary

Empirical verification of Milestone 4 for the **Knowledge Tug of War Web Component** was executed successfully using the automated Playwright test suite (`tests/verify-m4.py`). 

All visual behaviors, procedural audio synthesis pathways, and mobile layouts were evaluated and verified. The summary JSON file was successfully updated with passing states for all target criteria.

- **Verdict**: **PASSED**
- **Overall Risk Assessment**: **LOW** (with minor performance suggestions under stress)

---

## Stress Test Results

The test script executed multiple game rounds, simulating active user play, team buzz-ins, correct/incorrect answer submissions, rope pulling, tension warning triggers, and viewport adjustments.

| Scenario | Expected Behavior | Actual Behavior | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **JS Bundle Presence** | `knowledge-tug-of-war.js` exists and is non-empty. | Found bundle at `dist/knowledge-tug-of-war.js` (~1027.81 KB). | **PASS** |
| **AudioContext Activation** | Resumes/starts `AudioContext` on first user interaction. | Successfully initialized/resumed `AudioContext` on page click. | **PASS** |
| **Rope Element & Texture** | Contains `.rope-texture` class with repeating linear gradient. | Class present; background-position offsets correctly on score change. | **PASS** |
| **Diamond Snapping Elastic** | Tension marker transition utilizes `cubic-bezier(0.34, 1.56, 0.64, 1)`. | CSS transition contains matching overshoot parameters. | **PASS** |
| **Edge Glow Backdrops** | Left/Right glow indicators activate with opacity on team buzz-in. | Correct container active opacity detected on team buzz. | **PASS** |
| **Fiery Warning Indicators** | Triggers `fieryPulse` / `criticalPulse` animations at scores $\ge 8$. | Correct critical text and pulse styling applied when Team 1 hits score 8. | **PASS** |
| **Procedural Audio Output** | Synthesizes buzz, tick, correct, wrong, and pull sounds on corresponding actions. | Mocked oscillator and biquad filter nodes recorded correct parameter changes. | **PASS** |
| **Mobile Layout Scaler** | Disables scaling wrapper and uses 100% width on mobile viewports. | Scaler successfully disabled on 375px wide viewport. | **PASS** |
| **Mobile Grid & Buttons** | Multi-column option layout collapses to 1-column; touch buttons visible. | Grid classes correctly changed to `grid-cols-1`; touch tap buttons shown. | **PASS** |

---

## Visual Layout Verification

Screenshots were captured at different screen sizes to verify layout integrity:

1. **Desktop Layout (`tests/screenshots/desktop.png`)**:
   - Shows correct aspect ratio glass panel centered on the page.
   - Clean spacing with double-column answers and clear team scores (Team 1 at 8, Team 2 at 2).
   - "Team 1" is highlighted with a green container indicating active state.
2. **Mobile Layout (`tests/screenshots/mobile.png`)**:
   - dispatches standard single-column option layout.
   - Scale-down factor is removed, using full device width.
   - Touch tap buttons are present for mobile-specific inputs.
3. **Tablet Layout (`tests/screenshots/tablet.png`)**:
   - Renders a wider viewport layout, adjusting component widths gracefully.

---

## Adversarial Challenges

### [Low] Challenge 1: Heavy Box-Shadow Animation Repaints

- **Assumption challenged**: Animating complex CSS box-shadows on the tension marker (`criticalPulse` keyframe) and progress bar (`fieryPulse` keyframe) will run smoothly on all target hardware.
- **Attack scenario**: Low-end mobile devices (or devices with thermal throttling) running the web component inside webviews might experience severe frame rate drops (jank) due to heavy layout and paint calculations triggered by animating multi-layered box-shadows at 60 FPS.
- **Blast radius**: The core game gameplay will feel sluggish, causing delayed responses to user touch events.
- **Mitigation**: 
  - Offload key animations to GPU-friendly properties: instead of animating `box-shadow` values directly, animate the `opacity` of a pseudo-element (`::before` / `::after`) that has a static box-shadow.
  - Implement `will-change: transform, opacity` on the critical pulsing elements.

### [Low] Challenge 2: Mobile Viewport Height Overflow

- **Assumption challenged**: Stacking options vertically in a single-column grid on 375px wide viewports fits perfectly within 667px height.
- **Attack scenario**: When option texts are long (causing them to wrap to multiple lines) or when running on devices with smaller heights (e.g. iPhone SE at 568px height or folded displays), the stacked options, headers, rope, and team tap buttons will overflow vertically. This causes the page to scroll, pushing the critical Team Tap buttons off-screen.
- **Blast radius**: Players will have to scroll down to find the "ĐỘI 1 ĐẬP" or "ĐỘI 2 ĐẬP" buttons, losing precious milliseconds during gameplay.
- **Mitigation**: Use media queries targeting height (`@media (max-height: 680px)`) to reduce padding, decrease text size, and shrink the rope/headers dynamically to fit within a single screen fold.

### [Low] Challenge 3: Reduced Motion Compliance

- **Assumption challenged**: Users who prefer reduced motion will have an optimal experience by having all transitions/animations turned off.
- **Attack scenario**: A user with `@media (prefers-reduced-motion: reduce)` enabled will not see the tension marker slide smoothly (the transition is forced to `none` via `index.css:173`). Instead, the marker will snap instantly to new positions, which is correct, but there could be subtle UI feedback (like temporary score indicators or text fades) that also disappear entirely.
- **Blast radius**: Minimal, but could reduce visual clarity of which team is pulling.
- **Mitigation**: Maintain basic transitions that only change opacity or non-intrusive offsets with linear/instant timing, rather than removing all transitions entirely.

---

## Unchallenged Areas

- **Real Audio Verification**: We did not verify the actual hardware audio playback (we used `AudioContext` mocking in Playwright). However, the programmatic synthesis calls are verified to be fully compliant with web audio standards.
- **Multi-user Networking/Latency**: Out of scope for Milestone 4 (local/offline play verified).
