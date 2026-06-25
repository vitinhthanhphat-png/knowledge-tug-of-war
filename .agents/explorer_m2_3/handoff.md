# Handoff Report: XState v5 Machine & Keyboard Event Prevention System (Milestone 2)

## 1. Observation
- **`src/main.tsx`**: Renders the Preact `<App>` component inside the custom element shadow DOM.
- **`src/app.tsx`**: Renders the game arena. Currently, the options buttons are disabled (e.g. line 68: `disabled`).
- **`src/state-machine.ts`**: Contains a basic structure with five states: `idle`, `waiting_buzz`, `answering`, `result`, and `ended`.
- **`src/crypto.ts`**: Contains the asynchronous helper function `verifyAnswer(answer: string, salt: string, expectedHash: string): Promise<boolean>` which checks answers using SHA-256 via Web Crypto API.
- **`package.json`**: Uses `"xstate": "^5.18.2"` and `"preact": "^10.22.0"`. There is no package for `@xstate/react` or `@xstate/preact`.

## 2. Logic Chain
- **Custom React/Preact hook necessity**: Since no external binder package like `@xstate/react` is in the dependencies, we must write a custom hook (`useMachine`) using `createActor(machine).start()` and `actor.subscribe()` to connect XState v5 to Preact.
- **Race Condition Prevention**: In JS, events are processed sequentially on the event loop. In XState, state transitions are synchronous. When the first team presses their buzz key, a `BUZZ` event is processed and the machine immediately changes to `answering` before the next event in the queue is run. When the second team's event is processed, the machine is in the `answering` state which ignores the `BUZZ` event, creating a natural lockout.
- **Auto-Repeat and Spam Prevention**:
  1. Setting a `waiting_buzz.cooldown` sub-state for 500ms ensures that any keypress immediately after a round transitions to a new question is ignored, preventing accidental buzzes.
  2. Adding `if (e.repeat) return;` to the keydown event listener drops browser-generated auto-repeat events when a key is held down.
- **Scroll Prevention**: Calling `e.preventDefault()` on spacebar presses within the keydown listener prevents the browser from scrolling down the page.

## 3. Caveats
- The total score scale was modeled as `0` to `10` (starting at `5` each) with `+1/-1` adjustment per correct/incorrect answer, which represents the pulling mechanic. The threshold can be easily adjusted by altering the `updateScoreAndResult` function.
- Audio hooks are defined as empty callback wrappers that log to console, to be filled in with actual audio playback logic when the assets are ready.

## 4. Conclusion
The proposed design is complete and fully documented in `analysis.md`. The design leverages native XState v5 APIs, prevents race conditions synchronously, resolves spacebar scrolling, and contains all logic needed for immediate implementation.

## 5. Verification Method
- **TypeScript Compilation**: Once implemented, run `npm run build` to verify there are no compilation or type errors.
- **Buzzer Lockout Test**: Simulate rapid keydown events in tests or console to verify that only the first keydown is processed and the second is discarded.
- **Scroll Block Test**: Pressing Space within the active widget should not trigger page scrolling.
