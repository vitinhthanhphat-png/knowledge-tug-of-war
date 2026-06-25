## 2026-06-25T04:04:21Z

You are the Worker for Milestone 2.
Working directory: d:\AI APP\DauTruongKienThuc\Requirement\.agents\worker_m2\
Project working directory: D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war

Objective:
Implement Milestone 2: State Machine Logic (XState FSM) and keyboard event listeners inside the `knowledge-tug-of-war` project.

Tasks:
1. Implement the complete XState v5 state machine in `src/state-machine.ts` using the design outlined in `.agents/orchestrator/synthesis_m2.md`.
2. Update `src/app.tsx` to:
   - Connect Preact to the XState machine via a custom `useActor` hook (to keep dependencies minimal).
   - Bind window-level event listeners for keyboard events when the game is in `waiting_buzz` state.
   - Mitigate race conditions synchronously by immediately dispatching a `BUZZ` event with the team ID.
   - Call `e.preventDefault()` on Space to prevent browser scrolling.
   - Ignore repeat events (`e.repeat`), ignore events targeting input/textarea controls, and enforce a 500ms round startup cooldown before buzzing is enabled.
   - Run a timer interval sending `TIMER_TICK` to the state machine once per second when in `answering` state.
   - Render layout elements dynamically for each state (`idle`, `waiting_buzz`, `answering`, `result`, `ended`) so that state transitions can be checked. Use `verifyAnswer` from `src/crypto.ts` to validate responses.
3. Run `npm run build` to verify that the project compiles cleanly to a single JS bundle `dist/knowledge-tug-of-war.js` without any errors or warnings.
4. Verify code layout, and check that no separate `.css` files are written.
5. Create a handoff report at `d:\AI APP\DauTruongKienThuc\Requirement\.agents\worker_m2\handoff.md` detailing the implemented code, files edited, build logs, and test actions.
6. Once complete, notify the Project Orchestrator (Conversation ID: 111ca960-f1cd-4a10-a1ae-3824f6b57c28) with the path to your handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Skills references (you may read these files if needed):
- clean-code: d:\AI APP\DauTruongKienThuc\Requirement\.agents\skills\clean-code\SKILL.md
- verify-changes: d:\AI APP\DauTruongKienThuc\Requirement\.agents\skills\verify-changes\SKILL.md
