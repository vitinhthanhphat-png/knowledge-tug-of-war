# Handoff Report - Explorer 2 for Milestone 2

Last visited: 2026-06-25T04:04:10Z

## 1. Observation
We have inspected the project workspace located at `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war`.

Specific files and contents observed:
*   **`package.json`**:
    *   Line 13 shows dependency: `"xstate": "^5.18.2"`. No `@xstate/react` or `@xstate/preact` is present in dependencies.
*   **`src/crypto.ts`**:
    *   Lines 26-29:
        ```typescript
        export async function verifyAnswer(answer: string, salt: string, expectedHash: string): Promise<boolean> {
          const hash = await hashAnswer(answer, salt);
          return hash === expectedHash;
        }
        ```
*   **`src/state-machine.ts`**:
    *   Lines 23-81 define a stub XState machine named `tugOfWarMachine` with basic states (`idle`, `waiting_buzz`, `answering`, `result`, `ended`) and events (`IMPORT_QUESTIONS`, `START_GAME`, `BUZZ`, `SUBMIT_ANSWER`, `TIMEOUT`, `NEXT_QUESTION`, `RESET`).
*   **`src/app.tsx`**:
    *   Line 17: `export function App({ theme, defaultQuestions }: AppProps)`
    *   Lines 27-28 and 41-42 document the team key assignments: Team 1 uses `SPACE`, Team 2 uses `ENTER`.

## 2. Logic Chain
1. **XState Version Compatibility**: From `package.json`, we confirmed that `xstate` is v5 (`^5.18.2`). The state machine design must strictly adhere to XState v5 syntax (e.g., passing `input` to context generator, using `fromCallback` for interval actor, and putting implementations like `actors` directly at the root of the machine setup instead of a second options parameter).
2. **Minimalist Integration**: Since `@xstate/react` or `@xstate/preact` are not installed, we conclude that the integration must be done using the core `xstate` package. We designed the integration using `createActor(machine)` and `actor.subscribe` inside a Preact `useEffect` hook, keeping the codebase lightweight and avoiding external dependencies.
3. **Race Condition Prevention**: In a multi-player hotkey environment, race conditions are a critical issue. By defining an atomic state machine, the first `BUZZ` event transitions the state from `waiting_buzz` to `answering` synchronously. Once in `answering`, the `BUZZ` event is no longer listened to, naturally locking out the slower player instantaneously without UI-level state checks.
4. **Key Spamming and holding prevention**:
    *   A player holding a key down causes the browser to emit continuous `keydown` events. Checking `e.repeat === true` lets us ignore repeated events.
    *   By scoping the keyboard listener so that it only dispatches events if `state.matches('waiting_buzz')` is true, we prevent keyboard spamming from affecting the machine in other states (`idle`, `answering`, `result`, `ended`).
5. **Page Scroll Prevention**: Pressing Space scrolls the parent page. Calling `e.preventDefault()` inside the keydown listener solves this. By conditionally calling `e.preventDefault()` only when `state.matches('waiting_buzz')` is true, we preserve parent page usability when the game is idle or ended.
6. **Symmetric Tug of War Scoring**: Starting at 5 vs 5, a correct answer pulls the rope by +1 force to the active team and -1 to the other team (total remaining 10). An incorrect answer or timeout does the opposite (-1 to active, +1 to other). The game ends when either team reaches 10 points (which means the other team is at 0) or the questions are exhausted.

## 3. Caveats
- The state machine design assumes that the audio feedback (`playBuzzSound`, `playTickSound`, etc.) is managed via callbacks hookable within the Preact component's `useEffect` or lifecycle methods, as specified in the PRD, rather than embedded inside XState actions. This keeps the machine pure and decoupled from DOM/Audio APIs.
- The 2-second delay in the `result` state before transitioning to `waiting_buzz` or `ended` is implemented using XState's built-in `after: { 2000: ... }` transition. This requires the actor scheduler to run continuously.

## 4. Conclusion
We have provided a complete architectural design and code blueprint for the XState v5 machine and the keyboard event prevention system. The design solves the core gameplay loop, prevents race conditions, blocks key repeats/spamming, and safely handles Space key page scrolling. All findings have been written to `analysis.md` in the agent's folder.

## 5. Verification Method
1. Inspect `analysis.md` inside `d:\AI APP\DauTruongKienThuc\Requirement\.agents\explorer_m2_2\analysis.md` to ensure all tasks are fully covered.
2. The implementation of this design in the next milestone can be verified by running the project build command:
   ```bash
   npm run build
   ```
   and executing the test verification script if available.
3. Validate that `state-machine.ts` uses XState v5 features correctly (`fromCallback` for the timer actor, and single-object configuration for `createMachine`).
