# Aggregated Explorer Findings — Milestone 2

## Subagent Results Summary
- 3 completed (Explorer 4, 5, 6), 0 failed
- 100% consensus on:
  - FSM structure with states: `idle`, `waiting_buzz`, `answering`, `result`, `ended`.
  - Storing state context with scores (Team 1 starts at 5, Team 2 starts at 5, total = 10).
  - Preventing page scrolls with `e.preventDefault()` on `Space`.
  - Discarding repeat keys with `e.repeat`.
  - Eliminating race conditions using XState's atomic state transitions (the first player to buzz transitions the state to `answering`, which has no `BUZZ` handler, automatically ignoring the other player's synchronous buzz).
  - Injecting a custom `useActor` hook in `app.tsx` or using standard subscription logic to keep the bundle small, without using `@xstate/preact`.

## Aggregated Findings

### 1. State Machine Blueprint (`src/state-machine.ts`)
- Use XState v5. Define `TugOfWarContext` and `TugOfWarEvent` types.
- States:
  - `idle`: Waits for questions to be imported, click "Start" transitions to `waiting_buzz`.
  - `waiting_buzz`: Sets `activeTeam` and `buzzWinner` to `null`. Awaiting `BUZZ` event with the team ID.
  - `answering`: Highlights the buzzing team, displays a timer (counts down from 5 or 10 seconds). LISTENS to `SUBMIT_ANSWER` (isCorrect: boolean) and `TIMER_TICK`.
  - `result`: Updates the score (correct -> active team +1 / opponent -1; incorrect/timeout -> active team -1 / opponent +1). After a 2-second timeout (or user click "Next"), transitions to `waiting_buzz` or `ended`.
  - `ended`: Displays the final winner (or "Draw" if scores are tied and questions are exhausted). Allows reset.

### 2. Event-based Lockout & Race Condition Mitigation
- Since Javascript is single-threaded, the browser's event queue processes key events sequentially.
- When the first event (e.g. Space) fires, the handler triggers `send({ type: 'BUZZ', team: 'team1' })`. The actor transitions synchronously to the `answering` state.
- If the second event (e.g. Enter) fires immediately afterwards, the actor is already in the `answering` state. The `answering` state has no event handler for `BUZZ`, so the event is ignored, achieving absolute lockout.

### 3. Keyboard Protection Layers
- **Repeat prevention**: Discard keydown if `e.repeat` is true.
- **Scroll prevention**: If `e.code === 'Space'`, execute `e.preventDefault()`.
- **Keyboard target restriction**: Ignore keys if `e.target` is an input, textarea, or contenteditable.
- **Inter-round cooldown**: Store `roundStartTime = Date.now()` upon entering `waiting_buzz`. If current time is less than `roundStartTime + 500ms`, ignore the buzz event.

## Per-Subagent Status
- **Explorer 4**: Completed (Conversation ID: `540128de-f85c-4cb1-9785-aa1acf1868f7`)
- **Explorer 5**: Completed (Conversation ID: `7b3ede06-a10c-4def-a426-34272964828a`)
- **Explorer 6**: Completed (Conversation ID: `c24208dd-bfa6-48a8-a501-542a302f8164`)
