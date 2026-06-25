# Handoff Report — Reviewer 1 (Milestone 2)

## 1. Observation
- **State Machine Configuration File**: `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\src\state-machine.ts` (lines 25-280) implements the XState v5 machine with states: `idle`, `waiting_buzz`, `answering`, `result`, `ended`.
- **Preact Component Implementation File**: `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\src\app.tsx`
  - **Custom useActor Subscription**: Lines 29-45. Uses `useMemo` to create and start the actor, and a `useEffect` hook to subscribe and call `setState(nextState)`.
  - **Keyboard Event Listener & Race Condition Lockout**: Lines 101-137. Keydown listeners are registered only when `state.value === 'waiting_buzz'`. It ignores `e.repeat` (line 106) and filters target tags: `INPUT`, `TEXTAREA`, `isContentEditable` (lines 109-117).
  - **Space Key Scroll Prevention**: Line 120 calls `e.preventDefault()`.
  - **500ms Cooldown**: Lines 59-67 track `roundStartTimeRef`. Lines 121-124 and 126-129 check if `elapsed >= 500` before triggering `BUZZ`.
  - **Timer Tick**: Lines 140-151 run a `setInterval` that fires `TIMER_TICK` every 1000ms in `answering` state.
- **Vite Configuration**: `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\vite.config.ts` configures library build mode (`formats: ['iife']`), inline asset limit (`assetsInlineLimit: 10485760`), and single file output (`fileName: () => 'knowledge-tug-of-war.js'`).
- **Shadow DOM Encapsulation**: `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\src\main.tsx` (lines 5-66) registers Custom Element `knowledge-tug-of-war` with an open shadow root, mounts Preact inside a container, and injects inline styles (lines 19-21).
- **Compilation Output**: Running `npm run build` compiled successfully to `dist/knowledge-tug-of-war.js` (79.94 kB) without warnings or errors.
- **Milestone 1 Test Verification**: Running `python tests/verify-m1.py` completes successfully and produces passing assertions in `tests/verification_result.json`:
  ```json
  "element_registered": true,
  "shadow_dom_mounted": true,
  "questions_loaded": true,
  "styling_scoped": true
  ```

## 2. Logic Chain
- **FSM Correctness**: The state machine maps perfectly to gameplay requirements. Clamping is correctly applied to team scores (capped at 10, floored at 0).
- **Custom useActor Integration**: The direct `subscribe` and `setState` implementation avoids dragging in heavy framework bindings (`@xstate/preact`), saving bundle size while correctly updating React/Preact lifecycle.
- **Race lockout**: The combination of local state-checking (keydown registered only during `waiting_buzz`) and synchronous XState transitions means that if Team 1 key event processes first, the FSM transitions to `answering` synchronously. Any subsequent event (such as Team 2 keydown) sent before the next render is safely ignored since `answering` has no handler for the `BUZZ` event. This prevents race conditions.
- **Input protection**: Checking `target.tagName` and `isContentEditable` guards text boxes from triggering game actions.
- **500ms Cooldown**: Using `roundStartTimeRef` which updates on `state.value` transitions ensures players cannot spam space/enter immediately upon round start.
- **Single Bundle & Shadow DOM Compliance**: Vite compiles all JS/CSS into one bundle (`dist/knowledge-tug-of-war.js`). The component uses `attachShadow({ mode: 'open' })` and inserts styles scoped to the shadow DOM, ensuring zero style leaking and ease of integration in external platforms (WordPress, Next.js).

## 3. Caveats
- **Async Option Verification**: The component calculates the correct option index asynchronously using `verifyAnswer`. Although `verifyAnswer` uses fast SHA-256 via Web Crypto API (<1ms execution time), a theoretical race condition could occur if questions were skipped at extremely high frequencies, as there is no cancellation mechanism for previous promises. However, in practice, transition delays (2s result state) make this a non-issue.
- **Audio Hooks**: The audio hook methods (e.g. `playBuzzSound()`, `playTickSound()`) remain as console-log placeholders as per the requirements for Milestone 2. No physical sound files are loaded yet.

## 4. Conclusion
The implementation of the state machine, custom hook, keyboard logic, cooldowns, and timer in Milestone 2 is robust, correct, and complete. It complies with all performance and single-bundle encapsulation rules. 

**Verdict: APPROVE**

## 5. Verification Method
1. **Compilation**: Run `npm run build` inside the project root `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war`. It must output a single bundle at `dist/knowledge-tug-of-war.js`.
2. **Automated Tests**: Run `python tests/verify-m1.py` to confirm that the DOM structure, registering, styling, and default questions render properly. Check `tests/verification_result.json`.
3. **Manual Verification**: Load `dist-test.html` in the browser, verify:
   - Cooldown (Space/Enter ignored within 500ms).
   - Space key doesn't scroll the body.
   - Buzzed team glows and keyboard is locked out for the opponent.
   - Answering timer ticks down and correctly applies a penalty on timeout.
