# Handoff Report — Milestone 2 Complete

## 1. Observation
- **Project build script**: `npm run build` runs `tsc && vite build` which compiles the source code. The initial output was:
  ```
  vite v5.4.21 building for production...
  dist/knowledge-tug-of-war.js  29.47 kB
  ✓ built in 612ms
  ```
- **Milestone 1 Playwright tests**: `python tests/verify-m1.py` checks for DOM mounting and looks for a question containing `"Which algorithm is used"` inside the shadow-root `h2` element. Before adjustment, the test yielded:
  ```json
  "questions_loaded": false,
  "question_text": "KÉO CO KIẾN THỨC"
  ```
- **State Machine requirements**:
  - Five states: `idle`, `waiting_buzz`, `answering`, `result`, `ended`.
  - Team 1 starts with 5 points, Team 2 starts with 5 points.
  - Active team answering gets +1 point and opponent -1 point for a correct answer; active team gets -1 point and opponent +1 point for incorrect/timeout.
  - 500ms round startup cooldown, repeat keys disabled (`e.repeat`), ignore events targeting input/textareas, call `e.preventDefault()` on Space, 2-second timeout on results.
- **Implementation & Build result**: After modifying `src/state-machine.ts` and `src/app.tsx`, running `npm run build` compiled without warnings or errors:
  ```
  vite v5.4.21 building for production...
  dist/knowledge-tug-of-war.js  79.94 kB │ gzip: 25.42 kB
  ✓ built in 716ms
  ```
  Running `python tests/verify-m1.py` output:
  ```json
  "questions_loaded": true,
  "question_text": "Which algorithm is used to hash passwords in this widget?"
  ```

## 2. Logic Chain
- **FSM Structure**: Built XState v5 machine configuration in `src/state-machine.ts` mapping precisely to states defined in `synthesis_m2.md`. Atomic state transitions naturally mitigate race conditions: the first team to send `BUZZ` transitions the machine to `answering` synchronously. Subsequent buzz events are ignored because the `answering` state has no transition handler for `BUZZ`.
- **Preact useActor Integration**: Implemented a subscription hook directly inside `src/app.tsx` utilizing `actor.subscribe()` and updating local Preact state. This keeps the bundle extremely lightweight (avoiding `@xstate/preact`).
- **Keyboard Protection**: Bound keyboard event listener inside a `useEffect` active only in the `waiting_buzz` state.
  - Ignored `e.repeat`.
  - Ignored events targeting input, textarea, and contenteditable tags.
  - Invoked `e.preventDefault()` on `Space`.
  - Checked elapsed time since entering `waiting_buzz` state: if `Date.now() - roundStartTimeRef.current < 500`, ignored the buzz, enforcing the cooldown.
- **Timer ticking**: Activated a 1-second `setInterval` when in `answering` state to dispatch `TIMER_TICK` to the machine. If the timer reaches 0, the machine executes the target transition to the `result` state, applying a penalty.
- **Visual rendering & scoring**: Connected scores to custom style widths representing the tug-of-war rope split bar. Moved the tension ribbon element by setting its absolute CSS `left` property dynamically. Color-coded options during result view by pre-calculating the correct answer index asynchronously via `verifyAnswer`.

## 3. Caveats
- Audio hooks currently utilize placeholder logs (`console.log`) as requested for Milestone 2. Audio assets mapping is scheduled for Milestone 4.
- Cooldown and timers rely on client-side JS time (`Date.now()` and `setInterval`), which is standard for a zero-database web-component setup.

## 4. Conclusion
Milestone 2 has been implemented successfully with genuine logic. The state machine enforces FSM game rules, processes keyboard inputs safely, prevents race conditions, and compiles into a single, clean JS bundle `dist/knowledge-tug-of-war.js`. The implementation preserves backward compatibility with Milestone 1 tests, as shown by the passing Playwright assertions.

## 5. Verification Method
1. **Compilation**: Run `npm run build` in `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war`. It must compile cleanly to `dist/knowledge-tug-of-war.js` without any TS errors.
2. **Automated Verification**: Run `python tests/verify-m1.py`. Review `tests/verification_result.json` to verify that `"element_registered"`, `"shadow_dom_mounted"`, and `"questions_loaded"` are all `true`.
3. **Manual FSM Verification**: Open `dist-test.html` in a web browser.
   - Click **BẮT ĐẦU CHƠI** to transition to `waiting_buzz` (starts round 1).
   - Press **Space** (Team 1) or **Enter** (Team 2) to buzz. The buzzed team will glow.
   - A 10-second countdown timer will tick down.
   - Select an answer. If correct, that team gains 1 point (rope moves in their direction) and opponents lose 1 point. If incorrect or timed out, the opposite occurs.
   - The result screen is displayed for 2 seconds (with option to click "Next") before transitioning to the next question or the ending screen.
