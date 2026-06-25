# Milestone 2: XState (v5) Machine & Keyboard Event Prevention System Design

## 1. Executive Summary
This document provides the complete architectural design and code blueprints for Milestone 2 of the **Knowledge Tug of War** game. It addresses two primary objectives:
1. Designing a robust state machine using **XState v5** to manage the lifecycle of the game (idle, waiting_buzz, answering, result, ended).
2. Implementing a race-condition-free keyboard event prevention system for Team 1 (Space key) and Team 2 (Enter key) with page scroll prevention (`e.preventDefault()`), auto-repeat filtering (`e.repeat`), and inter-round cooldowns.

---

## 2. Current Codebase Review (Milestone 1)
Based on our read-only analysis of the codebase created in Milestone 1:
- **`src/main.tsx`**: Defines the custom Web Component (`<knowledge-tug-of-war>`), mounts the Preact app inside a Shadow Root, and propagates attributes like `theme` and `default-questions`.
- **`src/app.tsx`**: Renders the UI layout including the HUD (scores), Main Arena (question and option grid), Tug of War visual bar (split container), and Control Footer (JSON Import/Export).
- **`src/state-machine.ts`**: Contains a basic stub machine with skeleton transitions and context.
- **`src/crypto.ts`**: Contains asynchronous SHA-256 hashing functions (`hashAnswer` and `verifyAnswer`) to verify correctness of selected options against salts and hashes.

---

## 3. XState (v5) Machine Design

We design a comprehensive **XState v5** machine to govern the entire gameplay. XState v5 uses the `types` property to define context and event shapes and uses the updated `assign` syntax.

### 3.1 Context Structure
```typescript
export interface TugOfWarContext {
  questions: Question[];              // Loaded quiz database
  currentQuestionIndex: number;      // Current active question index (0-indexed)
  timer: number;                     // Answering countdown timer (seconds)
  score: { team1: number; team2: number }; // Dynamic tug of war scores (start: 5-5)
  activeTeam: 'team1' | 'team2' | null;   // The team that buzzed and is answering
  buzzWinner: 'team1' | 'team2' | null;   // The team that won the buzz in the current round
  importError: string | null;        // Stores question validation/import errors
}
```

### 3.2 State Definitions
- **`idle`**: The initial game state. Waiting for questions to be loaded and the host to click "Start Game".
- **`waiting_buzz`**: The question is revealed. The game waits for Team 1 (Space) or Team 2 (Enter) to buzz.
- **`answering`**: A team has buzzed successfully and has a limited time (e.g., 10 seconds) to submit an answer.
- **`result`**: The answer correctness or timeout is shown. The tension bar updates. The host can transition to the next question.
- **`ended`**: The game is over. One team has reached the victory condition (score of 10 for one team, or 0 for the other) or questions are exhausted. Displays the winner.

### 3.3 Event Transitions
- `IMPORT_QUESTIONS`: Parses and validates JSON questions. Available in `idle` state.
- `START_GAME`: Starts the game. Moves to `waiting_buzz` state if questions exist.
- `BUZZ`: Triggered by keyboard events. Sets the active team and transitions to `answering`.
- `SUBMIT_ANSWER`: Triggered when an answer is selected. Compares correctness, updates the scores, and transitions to `result`.
- `TIMER_TICK`: Triggered every second in `answering`. Decrements the countdown. If timer reaches 0, transitions to `result` (timeout/failure).
- `NEXT_QUESTION`: Moves to the next question or transitions to `ended` if victory conditions are met.
- `RESET`: Clears the game state and returns to `idle`.

---

## 4. Keyboard Listener & Race Condition Prevention Design

In multiplayer games sharing a single keyboard, a key concern is **race conditions**: what happens if both players press their buttons at the exact same microsecond?

### 4.1 Synchronous Lockout Mechanics
1. **Single-Threaded Event Loop**: JavaScript is single-threaded. Although two key presses might seem simultaneous to a human, the browser's hardware/OS-level keyboard polling rates serialize them. One event is always pushed onto the JS call stack first.
2. **State Machine Transition**: When the first keydown handler executes, it immediately calls `actor.send({ type: 'BUZZ', team: ... })`.
3. **Synchronous Transition**: XState v5 processes events and transitions states synchronously. The machine immediately moves from `waiting_buzz` to `answering` during the same execution thread.
4. **Listener Tear-down**: In the Preact component, the keyboard listener is bound inside a `useEffect` that depends on the state value (`state.value === 'waiting_buzz'`). The instant the state changes, the hook's cleanup function executes, calling `window.removeEventListener(...)`.
5. **Lockout Guarantee**: When the second player's keydown event is popped from the task queue and processed, the event listener is already removed, ensuring they are completely locked out.

### 4.2 Page Scroll Prevention
When a player presses the **Space** key, the browser's default behavior is to scroll the page down. This is prevented by intercepting the event and calling `e.preventDefault()`, but **only** for the Space key and **only** during active game states:
```typescript
if (e.code === 'Space') {
  e.preventDefault(); // Prevents parent page scrolling
}
```

### 4.3 Debouncing/Throttling & Anti-Spam Layers
To prevent keyboard spamming from breaking the game, we implement four layers of protection:
- **Layer 1: Auto-Repeat Filtering**: Browsers fire continuous `keydown` events when a key is held down. We reject these by checking `e.repeat`:
  ```typescript
  if (e.repeat) return; // Discard auto-repeat events
  ```
- **Layer 2: Active State Checking**: The listener is only attached when `state.value === 'waiting_buzz'`. Keypresses in other states are ignored.
- **Layer 3: Inter-Round Cooldown**: When a round transitions back to `waiting_buzz`, players might still be pressing or tapping keys from the previous round, leading to instant "accidental" buzzes. We enforce a `500ms` lockout delay from the time the round starts before allowing any buzzes:
  ```typescript
  const cooldown = 500; // ms
  if (Date.now() - roundStartTime < cooldown) return;
  ```
- **Layer 4: Input Field Exclusion**: If the user is typing in a JSON import text box, game keys must be disabled:
  ```typescript
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }
  ```

---

## 5. Implementation Blueprints

### 5.1 `src/state-machine.ts` Blueprint (XState v5)
Below is the robust XState v5 state machine configuration.

```typescript
import { createMachine, assign } from 'xstate';
import { Question } from './app';

export interface TugOfWarContext {
  questions: Question[];
  currentQuestionIndex: number;
  timer: number;
  score: { team1: number; team2: number };
  activeTeam: 'team1' | 'team2' | null;
  buzzWinner: 'team1' | 'team2' | null;
  importError: string | null;
}

export type TugOfWarEvent =
  | { type: 'IMPORT_QUESTIONS'; questions: Question[] }
  | { type: 'START_GAME' }
  | { type: 'BUZZ'; team: 'team1' | 'team2' }
  | { type: 'SUBMIT_ANSWER'; isCorrect: boolean }
  | { type: 'TIMER_TICK' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'RESET' };

const INITIAL_SCORE = 5;
const MAX_SCORE = 10;
const MIN_SCORE = 0;
const ANSWER_TIME_LIMIT = 10; // seconds

export const tugOfWarMachine = createMachine({
  types: {} as {
    context: TugOfWarContext;
    events: TugOfWarEvent;
  },
  id: 'tugOfWar',
  initial: 'idle',
  context: {
    questions: [],
    currentQuestionIndex: 0,
    timer: ANSWER_TIME_LIMIT,
    score: { team1: INITIAL_SCORE, team2: INITIAL_SCORE },
    activeTeam: null,
    buzzWinner: null,
    importError: null,
  },
  states: {
    idle: {
      on: {
        IMPORT_QUESTIONS: {
          actions: assign(({ event }) => {
            const questions = event.questions;
            if (!Array.isArray(questions) || questions.length === 0) {
              return { importError: 'Invalid questions format or empty list.' };
            }
            // Basic validation
            for (const q of questions) {
              if (!q.id || !q.question || !Array.isArray(q.options) || q.options.length < 2 || !q.answer_hash) {
                return { importError: 'Invalid question fields found.' };
              }
            }
            return { questions, importError: null };
          }),
        },
        START_GAME: {
          guard: ({ context }) => context.questions.length > 0,
          target: 'waiting_buzz',
          actions: assign({
            currentQuestionIndex: 0,
            score: { team1: INITIAL_SCORE, team2: INITIAL_SCORE },
            activeTeam: null,
            buzzWinner: null,
          }),
        },
      },
    },
    waiting_buzz: {
      entry: assign({
        activeTeam: null,
        buzzWinner: null,
        timer: ANSWER_TIME_LIMIT,
      }),
      on: {
        BUZZ: {
          target: 'answering',
          actions: assign(({ event }) => ({
            activeTeam: event.team,
            buzzWinner: event.team,
          })),
        },
        RESET: {
          target: 'idle',
        },
      },
    },
    answering: {
      on: {
        TIMER_TICK: [
          {
            guard: ({ context }) => context.timer <= 1,
            target: 'result',
            actions: assign(({ context }) => {
              // Timeout: Answering team loses 1, opponent gains 1
              const active = context.activeTeam;
              const nextScore = { ...context.score };
              if (active === 'team1') {
                nextScore.team1 = Math.max(MIN_SCORE, nextScore.team1 - 1);
                nextScore.team2 = Math.min(MAX_SCORE, nextScore.team2 + 1);
              } else if (active === 'team2') {
                nextScore.team2 = Math.max(MIN_SCORE, nextScore.team2 - 1);
                nextScore.team1 = Math.min(MAX_SCORE, nextScore.team1 + 1);
              }
              return { timer: 0, score: nextScore };
            }),
          },
          {
            actions: assign({
              timer: ({ context }) => context.timer - 1,
            }),
          },
        ],
        SUBMIT_ANSWER: {
          target: 'result',
          actions: assign(({ context, event }) => {
            const isCorrect = event.isCorrect;
            const active = context.activeTeam;
            const nextScore = { ...context.score };

            if (isCorrect) {
              // Correct: Answering team gets +1, opponent gets -1
              if (active === 'team1') {
                nextScore.team1 = Math.min(MAX_SCORE, nextScore.team1 + 1);
                nextScore.team2 = Math.max(MIN_SCORE, nextScore.team2 - 1);
              } else if (active === 'team2') {
                nextScore.team2 = Math.min(MAX_SCORE, nextScore.team2 + 1);
                nextScore.team1 = Math.max(MIN_SCORE, nextScore.team1 - 1);
              }
            } else {
              // Incorrect: Answering team gets -1, opponent gets +1
              if (active === 'team1') {
                nextScore.team1 = Math.max(MIN_SCORE, nextScore.team1 - 1);
                nextScore.team2 = Math.min(MAX_SCORE, nextScore.team2 + 1);
              } else if (active === 'team2') {
                nextScore.team2 = Math.max(MIN_SCORE, nextScore.team2 - 1);
                nextScore.team1 = Math.min(MAX_SCORE, nextScore.team1 + 1);
              }
            }
            return { score: nextScore };
          }),
        },
        RESET: {
          target: 'idle',
        },
      },
    },
    result: {
      on: {
        NEXT_QUESTION: [
          {
            // Game ends if score limits are hit or questions exhausted
            guard: ({ context }) =>
              context.score.team1 >= MAX_SCORE ||
              context.score.team2 >= MAX_SCORE ||
              context.score.team1 <= MIN_SCORE ||
              context.score.team2 <= MIN_SCORE ||
              context.currentQuestionIndex >= context.questions.length - 1,
            target: 'ended',
          },
          {
            target: 'waiting_buzz',
            actions: assign({
              currentQuestionIndex: ({ context }) => context.currentQuestionIndex + 1,
            }),
          },
        ],
        RESET: {
          target: 'idle',
        },
      },
    },
    ended: {
      on: {
        RESET: {
          target: 'idle',
        },
      },
    },
  },
});
```

---

### 5.2 Hooking Preact into XState v5
To connect the Preact component to our state machine without external UI library dependencies (like `@xstate/react` or `@xstate/preact`), we write a clean, lightweight custom hook in the view layer.

#### 5.2.1 Custom `useActor` Hook
This hook runs inside `src/app.tsx` or a custom hook file:
```typescript
import { useEffect, useState } from 'preact/hooks';
import { createActor, AnyStateMachine, StateFrom, ActorRefFrom } from 'xstate';

export function useActor<TMachine extends AnyStateMachine>(machine: TMachine) {
  const [actor] = useState(() => createActor(machine));
  const [state, setState] = useState(() => actor.getSnapshot());

  useEffect(() => {
    actor.start();
    const subscription = actor.subscribe((nextState) => {
      setState(nextState);
    });
    return () => {
      subscription.unsubscribe();
      actor.stop();
    };
  }, [actor]);

  return [state, actor.send.bind(actor), actor] as const;
}
```

#### 5.2.2 Integration in `src/app.tsx`
Below is a sketch showing how `App` utilizes the state and manages the keyboard and timer listeners:

```typescript
import { useEffect, useState } from 'preact/hooks';
import { tugOfWarMachine } from './state-machine';
import { useActor } from './hooks/useActor'; // or declared inline
import { verifyAnswer } from './crypto';

export function App({ theme, defaultQuestions }: AppProps) {
  const [state, send] = useActor(tugOfWarMachine);
  const { questions, currentQuestionIndex, timer, score, activeTeam, buzzWinner } = state.context;
  
  // Track when waiting_buzz starts to enforce the 500ms anti-spam lockout
  const [roundStartTime, setRoundStartTime] = useState(0);

  useEffect(() => {
    if (state.value === 'waiting_buzz') {
      setRoundStartTime(Date.now());
    }
  }, [state.value]);

  // 1. Keyboard Event Listener (Active only in waiting_buzz state)
  useEffect(() => {
    if (state.value !== 'waiting_buzz') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore repeat events (holding down key)
      if (e.repeat) return;

      // Ignore when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Enforce inter-round cooldown
      const elapsed = Date.now() - roundStartTime;
      if (elapsed < 500) return;

      if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scrolling
        send({ type: 'BUZZ', team: 'team1' });
      } else if (e.code === 'Enter') {
        send({ type: 'BUZZ', team: 'team2' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.value, roundStartTime, send]);

  // 2. Timer Tick (Active only in answering state)
  useEffect(() => {
    if (state.value !== 'answering') return;

    const interval = setInterval(() => {
      send({ type: 'TIMER_TICK' });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.value, send]);

  // 3. Answer Verification handler (async)
  const handleSelectOption = async (option: string) => {
    if (state.value !== 'answering') return;
    
    const question = questions[currentQuestionIndex];
    const isCorrect = await verifyAnswer(option, question.salt || '', question.answer_hash);
    
    send({ type: 'SUBMIT_ANSWER', isCorrect });
  };

  // Rendering conditions based on state.value...
  // - state.value === 'idle': render import screen & start button
  // - state.value === 'waiting_buzz': show current question, options disabled, display "Press Space/Enter to Buzz"
  // - state.value === 'answering': options enabled, timer ticking, highlight activeTeam
  // - state.value === 'result': show correct/incorrect outcome, next button
  // - state.value === 'ended': show victory screen and winner (team1 or team2)
}
```

---

## 6. Verification and Testing Strategy
Since the state machine and keyboard logic are fully event-driven, they can be tested independently of the browser DOM environment:
1. **Unit Testing the Machine**:
   - Write tests using Vitest or Jest.
   - Run transitions programmatically: `actor.send({ type: 'BUZZ', team: 'team1' })`.
   - Verify states and contexts without waiting for real time (e.g., dispatching multiple `TIMER_TICK` events to verify timeout transitions).
2. **Lockout Verification**:
   - Programmatically dispatch two synchronous actions to the actor to prove that after `BUZZ` is processed, subsequent `BUZZ` events are ignored:
     ```typescript
     actor.send({ type: 'BUZZ', team: 'team1' });
     actor.send({ type: 'BUZZ', team: 'team2' });
     expect(actor.getSnapshot().context.activeTeam).toBe('team1');
     ```
3. **Keyboard Listener Simulation**:
   - Fire synthetic `KeyboardEvent` objects targeting the window and assert that `send` is invoked with the expected payloads.
