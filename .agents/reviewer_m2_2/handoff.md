# Handoff Report - Reviewer 2 (Milestone 2)

## 1. Observation

### File Paths & Code Review
- **XState v5 Configuration (`src/state-machine.ts`):**
  - Confirmed the use of XState v5 `createMachine` (line 25) and `assign` (lines 47, 56, etc.) to configure FSM states, actions, events, and guards.
  - Initial state is `'idle'` (line 27).
  - Context includes `questions`, `currentQuestionIndex`, `timer`, `score` (initialized to `{ team1: 5, team2: 5 }`), `activeTeam`, `buzzWinner`, `importError`, and `lastResult` (lines 33-42).
  - Transition guard on `START_GAME` ensures game only starts when questions exist: `guard: ({ context }) => context.questions.length > 0` (line 54).
  - Zero-sum tug-of-war score calculation is correctly clamped using `Math.max(0, Math.min(10, t1Score))` and `t2Score = 10 - t1Score` (lines 132-133, 163-164, 189-190).
  - Timer tick transitions contain a conditional guard for decrementing vs transitioning to result:
    ```typescript
    TIMER_TICK: [
      {
        guard: ({ context }) => context.timer > 1,
        actions: assign(({ context }) => ({
          timer: context.timer - 1,
        })),
      },
      {
        target: 'result',
        actions: assign(({ context }) => { ... }),
      }
    ]
    ```

- **App Component & Keyboard Logic (`src/app.tsx`):**
  - Custom `useActor` is implemented using `useMemo` (lines 29-33) to initialize and start the actor on mount, and a `useEffect` subscription (lines 37-45) to set local state.
  - Cooldown timer state is tracked via `roundStartTimeRef` (line 59) which resets whenever state value becomes `'waiting_buzz'` (lines 63-67).
  - Keydown event listener is dynamically registered inside a `useEffect` only when `state.value === 'waiting_buzz'` (lines 102-137).
  - Prevent-default logic exists for the Space key:
    ```typescript
    if (e.code === 'Space') {
      e.preventDefault(); // Prevent scrolling page on space
      ...
    }
    ```
  - Input control exclusions are implemented:
    ```typescript
    const target = e.target as HTMLElement;
    if (
      target &&
      (target.tagName === 'INPUT' ||
       target.tagName === 'TEXTAREA' ||
       target.isContentEditable)
    ) {
      return;
    }
    ```
  - Startup cooldown (500ms) is verified on buzz events:
    ```typescript
    const elapsed = Date.now() - roundStartTimeRef.current;
    if (elapsed >= 500) {
      send({ type: 'BUZZ', team: 'team1' });
    }
    ```
  - Timer interval runs only when state is `'answering'`, dispatching `'TIMER_TICK'` every 1000ms (lines 140-151).

- **Encapsulation & Packaging (`src/main.tsx` & `vite.config.ts`):**
  - `connectedCallback` in `src/main.tsx` attaches a Shadow Root (`attachShadow({ mode: 'open' })`) (line 15).
  - CSS is imported with `?inline` and appended directly into a `<style>` tag inside the shadow root (lines 19-21).
  - `vite.config.ts` configures `lib` mode with `formats: ['iife']` to output a single bundle named `knowledge-tug-of-war.js` (lines 11-16) and disables CSS code splitting (line 7).

### Build Execution
- Ran command: `npm run build`
- Result: Completed successfully, compiling all assets into `dist/knowledge-tug-of-war.js` (79.94 kB) without warnings or errors.

### Automation Testing
- Ran command: `python tests/verify-m1.py`
- Result: Passed successfully, generating screenshots and verification reports confirming registration, mounting, and styling are correct.

---

## 2. Logic Chain

1. **State Machine Correctness:** Because the zero-sum clamping logic strictly enforces `t2Score = 10 - t1Score` with bounds of `[0, 10]`, it guarantees that the tension indicator cannot exceed 100% or fall below 0% and always sums to 10 points. 
2. **Keyboard Event Safety:** Because the event listener is registered ONLY when `state.value === 'waiting_buzz'` and cleaned up immediately when the state transitions (due to the `[state.value, send]` dependency array in the `useEffect`), a team can only buzz in when allowed. Even if multiple keypresses are registered within the same tick before the listener is unmounted, XState's FSM ignores the `BUZZ` event in the `answering` state, preventing race conditions or double-buzzes.
3. **Scrolling & Input Prevention:** Because `e.preventDefault()` is executed on `'Space'`, browser scrolling is avoided. Because the input control checks filter out `INPUT`, `TEXTAREA`, and `isContentEditable` target tags, typing in text boxes (e.g. searching/configuring) does not trigger accidental gameplay events.
4. **Compilation & Packaging Integrity:** Because Vite is configured to build in `lib` mode (iife) with `cssCodeSplit: false`, all CSS styles, Preact framework code, and XState state machines compile down to a single standalone JavaScript file. Because the custom element registers `attachShadow` and injects the CSS inline, styling is completely scoped, conforming to the encapsulation requirements.

---

## 3. Caveats

- **`useMemo` for Actor Creation:** The custom hook starts the actor inside a `useMemo` block. In some frameworks (React/Preact), `useMemo` isn't strictly guaranteed to run exactly once and could be recalculated, leading to starting redundant actor instances. While it works correctly here, a lazy `useRef` initialization would be slightly more robust.
- **Import Validation:** The `handleImportJSON` parsing checks if the parsed object is an array, but doesn't deep-validate properties (e.g., presence of `answer_hash` or `options`). However, the rendering uses optional chaining, and comparing a non-existent hash returns a graceful `false`, preventing UI crashes.

---

## 4. Conclusion

**Verdict: APPROVE**

The codebase meets all functional, structural, and performance constraints set for Milestone 2:
- Correct and robust XState v5 state machine with zero-sum clamping.
- Leak-free and lockout-safe keyboard buzz event listener.
- Space key scroll prevention and input focus safety.
- 500ms startup cooldown on new questions.
- Accurate timer ticks and penalty management.
- Clean compilation into a single, Shadow DOM encapsulated JS bundle.

---

## 5. Verification Method

To independently verify the builds and check the logic:
1. **Compilation Check:**
   ```bash
   npm run build
   ```
   Ensure the output compiles cleanly to `dist/knowledge-tug-of-war.js` without error messages.
2. **Playwright Integration Checks:**
   ```bash
   python tests/verify-m1.py
   ```
   Verify that `tests/verification_result.json` shows `"element_registered": true`, `"shadow_dom_mounted": true`, and `"styling_scoped": true`.
3. **Manual Validation:**
   Open `dist-test.html` in a web browser. Verify that pressing `Space` doesn't scroll the page, and that pressing keys triggers buzzing only after a 500ms delay.
