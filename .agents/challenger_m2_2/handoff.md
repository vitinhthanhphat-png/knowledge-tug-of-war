# Verification Report — Challenger 2 (Milestone 2)

## 1. Observation
- **Target Bundle**: `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\dist\knowledge-tug-of-war.js`
- **Sandbox File**: `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\dist-test.html`
- **FSM Transitions Implementation**:
  - Found in `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\src\state-machine.ts` defining states: `idle`, `waiting_buzz`, `answering`, `result`, `ended`.
- **Keyboard Handling Logic**:
  - Found in `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\src\app.tsx` lines 102–137.
  - Verbatim keyboard check on target element:
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
  - Cooldown timing check:
    ```typescript
    const elapsed = Date.now() - roundStartTimeRef.current;
    if (elapsed >= 500) {
      send({ type: 'BUZZ', team: 'team1' });
    }
    ```
  - Space scroll prevention:
    ```typescript
    if (e.code === 'Space') {
      e.preventDefault();
    ```

- **Verification Script execution output**:
  - Verified FSM transitions: `idle -> waiting_buzz -> answering -> result -> waiting_buzz -> ended` (All Pass).
  - Verified Keyboard Lockout: Space locks out synchronous Enter, and Enter locks out synchronous Space (All Pass).
  - Verified Input Fields: Keydown is ignored inside inputs/textareas (Pass).
  - Verified Space Scroll Prevention: Space default is prevented (Pass).
  - Verified Cooldown: Buzz before 500ms is ignored, buzz after 500ms is accepted (Pass).

## 2. Logic Chain
1. **FSM Transitions**:
   - The test script loaded `dist-test.html`, injected dynamic questions, clicked `BẮT ĐẦU CHƠI`, verified the transition from `idle` to `waiting_buzz` state.
   - It triggered `Space` (Team 1) and `Enter` (Team 2) to successfully transition to `answering` state.
   - It clicked correct and incorrect options to verify transition to `result` state.
   - It verified auto-advance/click advance to the next round (state `waiting_buzz` again).
   - It verified transition to `ended` state when questions are exhausted.
   - All assertions passed, proving FSM correctness.

2. **Synchronous Lockout**:
   - Since the XState machine handles events synchronously, the first event processed transitions the state from `waiting_buzz` to `answering`.
   - The keyboard listener in Preact is only active when `state.value === 'waiting_buzz'`. Thus, as soon as one player triggers `BUZZ`, the state transitions to `answering`, the component re-renders, and the event listener is unregistered in the `useEffect` cleanup.
   - This was empirically verified by synchronously dispatching `Space` and `Enter` keydown events on `window`. When `Space` was dispatched first, `activeTeam` was verified to be `team1` and `Enter` had no effect. When `Enter` was dispatched first, `activeTeam` was verified to be `team2` and `Space` had no effect.

3. **Input Exclusions & Scroll Prevention**:
   - Dispatching `Space` or `Enter` inside a focused `<input>` element did not trigger `BUZZ` (the game remained in `waiting_buzz`).
   - The `Space` key event on `window` was confirmed to call `e.preventDefault()`, setting `e.defaultPrevented` to `true`.

4. **500ms Cooldown**:
   - Dispatching keydown events at 100ms after entering the round was ignored (state remained `waiting_buzz`).
   - Dispatching keydown events after 800ms successfully transitioned the state to `answering`.

## 3. Caveats
- The 500ms cooldown was verified using local system timing. If client clock manipulation occurs, it could bypass the cooldown, but this is a client-side web widget so the impact is low.
- The input exclusion logic relies on `e.target`. If inputs are nested within shadow roots of other components, `e.target` is retargeted to the shadow host, which would bypass the check.

## 4. Conclusion
The Milestone 2 build output functions correctly according to all requirements:
1. FSM transitions are robust and match specification.
2. Synchronous keyboard lockout works flawlessly because of XState's synchronous transitions and Preact's conditional listener registry.
3. Input elements are excluded from keyboard events and Space scrolling is prevented on the parent page.
4. Cooldown window of 500ms correctly discards premature buzzes.

## 5. Verification Method
To run the verification script independently:
1. Ensure python and playwright are installed.
2. Run the command:
   ```bash
   python "d:\AI APP\DauTruongKienThuc\Requirement\.agents\challenger_m2_2\verify_m2.py"
   ```
3. Inspect `d:\AI APP\DauTruongKienThuc\Requirement\.agents\challenger_m2_2\verification_log.json` to verify all test cases are marked `"passed"`.
4. Inspect screenshots in `d:\AI APP\DauTruongKienThuc\Requirement\.agents\challenger_m2_2\screenshots\` showing each step of the FSM transitions.

---

## Adversarial Review / Challenge Report

**Overall risk assessment**: LOW

### Challenges

#### [Low] Challenge 1: Input Exclusions inside Nested Shadow DOMs
- **Assumption challenged**: `e.target` is sufficient to identify inputs/textareas.
- **Attack scenario**: If the widget is integrated on a page containing other Web Components, or if a text input is added inside a nested Shadow DOM in this widget, typing Space/Enter inside that input will trigger a buzz because `e.target` will point to the shadow host rather than the nested input element.
- **Blast radius**: Low. Can result in inadvertent buzzes while users type inside inputs that are nested in shadow roots.
- **Mitigation**: Change `e.target` check in `app.tsx` to:
  ```typescript
  const target = (e.composedPath ? e.composedPath()[0] : e.target) as HTMLElement;
  ```

#### [Low] Challenge 2: Cooldown Window relies on `Date.now()`
- **Assumption challenged**: System clock is stable.
- **Attack scenario**: If the local system clock changes or experiences drift during the game round, the elapsed time check could yield incorrect negative values or fail to allow buzzes.
- **Blast radius**: Low. Only affects the client browser session.
- **Mitigation**: Use `performance.now()` which provides a monotonic sub-millisecond clock unaffected by system clock adjustments.
