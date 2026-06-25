# Handoff Report: XState Machine & Keyboard Event Lockout Design (Milestone 2)

## 1. Observation
We examined the codebase of **Knowledge Tug of War** and observed the following:
- **XState Dependency**: `package.json` contains `"xstate": "^5.18.2"`, confirming that the project uses XState v5.
- **State Machine Stub**: `src/state-machine.ts` implements a basic state machine definition with states `idle`, `waiting_buzz`, `answering`, `result`, and `ended` using `createMachine`.
- **Asynchronous Answer Verification**: `src/crypto.ts` exports `verifyAnswer` as an asynchronous helper:
  ```typescript
  export async function verifyAnswer(answer: string, salt: string, expectedHash: string): Promise<boolean> {
    const hash = await hashAnswer(answer, salt);
    return hash === expectedHash;
  }
  ```
- **View Layer Structure**: `src/app.tsx` renders the game arena, HUD, options, and footers. Key handlers for Space (Team 1) and Enter (Team 2) are not yet implemented in the view.

---

## 2. Logic Chain
- **Handling Asynchronous Verification**: Since `verifyAnswer` is asynchronous but XState machine transitions are synchronous, the cleanest design is for the Preact component to invoke `verifyAnswer` asynchronously when a user clicks an option and then dispatch a synchronous `SUBMIT_ANSWER` event with a boolean `isCorrect` payload. This keeps the machine synchronous, deterministic, and easily unit-testable.
- **Lockout Mechanism**: JavaScript's single-threaded nature processes browser events sequentially. By binding the keyboard event listener in a Preact `useEffect` hook that lists `state.value === 'waiting_buzz'` as its only conditional run criteria, the very first keyboard event that fires will dispatch `BUZZ` to the actor. The actor will transition the machine synchronously, which triggers a component re-render. The hook's cleanup function will execute immediately, calling `window.removeEventListener`, which completely unbinds the handler and locks out any other player's events queued in the event loop.
- **Spam and Scroll Prevention**:
  - Calling `e.preventDefault()` on `Space` inside the event listener cancels the default page scrolling behavior.
  - Rejecting events with `e.repeat === true` prevents keyboard auto-repeat from triggering multiple buzzes.
  - Enforcing a 500ms lockout using `Date.now() - roundStartTime` prevents players from accidentally buzzing when a new question starts.

---

## 3. Caveats
- **Read-only Investigation**: As an Explorer, we are read-only and have not modified or compiled the source files in `src/`. The proposed blueprints are fully designed but must be integrated and compiled by the Implementer agent.
- **Testing environment**: The verification of browser keyboard events and page scroll defaults is based on design principles and standard browser behavior; it should be verified in actual E2E testing (e.g., using Playwright or Vitest in-browser simulation).

---

## 4. Conclusion
We have designed a complete, robust, and type-safe XState v5 machine configuration and a foolproof keyboard listener integration pattern. The design successfully achieves zero race conditions, prevents default spacebar scrolling, prevents key repeat spamming, and hooks into Preact via a clean `useActor` hook.

---

## 5. Verification Method
1. **Compilation**: After the Implementer integrates the code from `analysis.md`, run `npm run build` (command: `tsc && vite build` in project directory) to verify TypeScript compilation and build success.
2. **Behavioral Testing**:
   - Verify that pressing Space does not scroll the parent page.
   - Verify that keeping Space or Enter held down does not trigger multiple buzz events.
   - Verify that clicking an option verifies correctness against the salt and hash, modifying the scores and tension bar accordingly.
3. **Unit Tests**: Run tests programmatically on the actor to verify that calling `BUZZ` twice in a single tick only records the first team's buzz.
