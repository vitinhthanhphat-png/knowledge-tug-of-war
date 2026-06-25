# Analysis: XState v5 Machine & Keyboard Event Prevention System (Milestone 2)

## 1. Overview
This document presents the detailed design and architectural blueprints for the XState (v5) state machine and the keyboard event prevention system for Milestone 2 of the *Knowledge Tug of War (Kéo Co Kiến Thức)* game widget. It is designed to be fully compatible with Preact, lightweight, and zero-database.

---

## 2. XState (v5) Machine Design

The state machine manages the core game flow, transitioning through states: waiting for question imports, active gameplay, player buzzing, question answering, round results, and the end game.

### 2.1 Context Structure
The machine maintains the following context structure:

```typescript
export interface TugOfWarContext {
  questions: Question[];
  currentQuestionIndex: number;
  timer: number;
  score: { team1: number; team2: number };
  activeTeam: 'team1' | 'team2' | null;
  buzzWinner: 'team1' | 'team2' | null;
  lastResult: {
    correct: boolean;
    team: 'team1' | 'team2';
    answeredOptionIndex: number | null;
    timedOut: boolean;
  } | null;
  importError: string | null;
}
```
*Note: The score starts at `{ team1: 5, team2: 5 }`. In a Tug of War, the score represents pulling force: if a team answers correctly, they pull (their score +1, other team's score -1). If they answer incorrectly or time out, they slip (their score -1, other team's score +1). The game ends when either team reaches `10` (win) or `0` (loss).*

### 2.2 Event Definitions
```typescript
export type TugOfWarEvent =
  | { type: 'IMPORT_QUESTIONS'; questions: Question[] }
  | { type: 'IMPORT_ERROR'; error: string }
  | { type: 'START_GAME' }
  | { type: 'BUZZ'; team: 'team1' | 'team2' }
  | { type: 'SUBMIT_ANSWER'; answerIndex: number; isCorrect: boolean }
  | { type: 'TIMER_TICK' }
  | { type: 'RESET' };
```

### 2.3 State Chart & Transitions
The machine defines five main states:

1. **`idle`**: Waiting for questions to be loaded and game start.
   - `IMPORT_QUESTIONS`: Save questions to context.
   - `START_GAME`: Guard: questions list is not empty. Target: `waiting_buzz`. Actions: Reset score (`{ team1: 5, team2: 5 }`), index, timer, and lastResult.
2. **`waiting_buzz`**: Wait for a team to buzz.
   - Hierarchical structure:
     - **`cooldown`**: A 500ms delay state upon entering to ignore initial key spam.
     - **`active`**: Listens for the `BUZZ` event.
   - `BUZZ`: Target: `answering`. Actions: Set `activeTeam` and `buzzWinner` in context.
   - `RESET`: Target: `idle`.
3. **`answering`**: The buzzing team has 5 seconds to answer.
   - Invokes a timer callback that dispatches `TIMER_TICK` every second.
   - `TIMER_TICK`:
     - Guard: `timer > 1`. Actions: Decrement `timer`.
     - Else: Target `result`. Actions: Set `timer` to 0, run `handleTimeout` (active team score -1, other team +1).
   - `SUBMIT_ANSWER`: Target: `result`. Actions: run `handleAnswerSubmission` (update scores and lastResult).
   - `RESET`: Target: `idle`.
4. **`result`**: Shows correct/incorrect feedback and updated scores for 2 seconds.
   - Invokes a 2-second delay.
   - After 2000ms:
     - Guard 1 (Game Over): `score.team1 >= 10 || score.team2 >= 10 || currentQuestionIndex >= questions.length - 1`. Target: `ended`.
     - Guard 2 (Next Question): Target: `waiting_buzz`. Actions: Increment `currentQuestionIndex`, reset `timer` to 5, reset `activeTeam` and `buzzWinner` to `null`.
   - `RESET`: Target: `idle`.
5. **`ended`**: Display the winner and a "Play Again" button.
   - `RESET`: Target: `idle`.

---

## 3. Keyboard Event Prevention System

### 3.1 Race Condition Prevention
To prevent race conditions when both teams press keys nearly simultaneously:
- **Synchronous State Transition**: The XState machine processes event transitions synchronously. When Team 1's `Space` key event is processed, the machine changes state from `waiting_buzz.active` to `answering` *within the same call stack*.
- **State Lockout**: When Team 2's `Enter` key event is processed immediately after, the machine is already in the `answering` state. Because the `answering` state does not define a handler for the `BUZZ` event, the event is safely discarded, guaranteeing an instant, race-free lockout.

### 3.2 Space Key Scroll Prevention
- Pressing `Space` normally triggers page scrolling in web browsers. If the game widget is embedded inside a long WordPress or Next.js page, this results in poor UX.
- To prevent this, the keyboard listener calls `e.preventDefault()` on the `Space` key event. This blocks the browser's default scroll behavior.

### 3.3 Anti-Spamming Mechanisms
1. **Auto-Repeat Block**: Holding down a key triggers repeated `keydown` events in JS. We check `if (e.repeat) return;` at the beginning of the listener to immediately drop all repeated triggers.
2. **Round Transition Cooldown**: When a round ends and the game transitions back to `waiting_buzz`, players who were spamming keys in the previous round might accidentally buzz in. By starting in a `waiting_buzz.cooldown` state for 500ms where `BUZZ` is ignored, we ensure players must react to the new question deliberately.

---

## 4. Architectural Blueprints

### 4.1 State Machine Code Blueprint (`src/state-machine.ts`)

```typescript
import { createMachine, assign, fromCallback } from 'xstate';
import { Question } from './app';

export interface TugOfWarContext {
  questions: Question[];
  currentQuestionIndex: number;
  timer: number;
  score: { team1: number; team2: number };
  activeTeam: 'team1' | 'team2' | null;
  buzzWinner: 'team1' | 'team2' | null;
  lastResult: {
    correct: boolean;
    team: 'team1' | 'team2';
    answeredOptionIndex: number | null;
    timedOut: boolean;
  } | null;
  importError: string | null;
}

export type TugOfWarEvent =
  | { type: 'IMPORT_QUESTIONS'; questions: Question[] }
  | { type: 'IMPORT_ERROR'; error: string }
  | { type: 'START_GAME' }
  | { type: 'BUZZ'; team: 'team1' | 'team2' }
  | { type: 'SUBMIT_ANSWER'; answerIndex: number; isCorrect: boolean }
  | { type: 'TIMER_TICK' }
  | { type: 'RESET' };

// Actor for managing the 5-second countdown timer
const timerCallback = fromCallback(({ sendBack }) => {
  const interval = setInterval(() => {
    sendBack({ type: 'TIMER_TICK' });
  }, 1000);
  return () => clearInterval(interval);
});

// Helper for scoring updates
const updateScoreAndResult = (context: TugOfWarContext, isCorrect: boolean, answerIndex: number | null, timedOut: boolean) => {
  const activeTeam = context.activeTeam;
  if (!activeTeam) return {};

  const scoreChange = isCorrect ? 1 : -1;
  let t1 = context.score.team1;
  let t2 = context.score.team2;

  if (activeTeam === 'team1') {
    t1 = Math.max(0, Math.min(10, t1 + scoreChange));
    t2 = Math.max(0, Math.min(10, t2 - scoreChange));
  } else {
    t2 = Math.max(0, Math.min(10, t2 + scoreChange));
    t1 = Math.max(0, Math.min(10, t1 - scoreChange));
  }

  return {
    score: { team1: t1, team2: t2 },
    lastResult: {
      correct: isCorrect,
      team: activeTeam,
      answeredOptionIndex: answerIndex,
      timedOut
    }
  };
};

export const tugOfWarMachine = createMachine({
  id: 'tugOfWar',
  types: {} as {
    context: TugOfWarContext;
    events: TugOfWarEvent;
  },
  context: ({ input }: { input?: { questions?: Question[] } }) => ({
    questions: input?.questions || [],
    currentQuestionIndex: 0,
    timer: 5,
    score: { team1: 5, team2: 5 },
    activeTeam: null,
    buzzWinner: null,
    lastResult: null,
    importError: null,
  }),
  actors: {
    timerCallback
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        IMPORT_QUESTIONS: {
          actions: assign({
            questions: ({ event }) => event.questions,
            importError: null
          })
        },
        IMPORT_ERROR: {
          actions: assign({
            importError: ({ event }) => event.error
          })
        },
        START_GAME: {
          guard: ({ context }) => context.questions.length > 0,
          target: 'waiting_buzz',
          actions: assign({
            currentQuestionIndex: 0,
            score: { team1: 5, team2: 5 },
            activeTeam: null,
            buzzWinner: null,
            timer: 5,
            lastResult: null
          })
        }
      }
    },
    waiting_buzz: {
      initial: 'cooldown',
      states: {
        cooldown: {
          after: {
            500: 'active'
          }
        },
        active: {
          on: {
            BUZZ: {
              target: '#tugOfWar.answering',
              actions: assign({
                activeTeam: ({ event }) => event.team,
                buzzWinner: ({ event }) => event.team
              })
            }
          }
        }
      }
    },
    answering: {
      invoke: {
        id: 'countdown',
        src: 'timerCallback'
      },
      on: {
        TIMER_TICK: [
          {
            guard: ({ context }) => context.timer > 1,
            actions: assign({
              timer: ({ context }) => context.timer - 1
            })
          },
          {
            target: 'result',
            actions: [
              assign({ timer: 0 }),
              assign(({ context }) => updateScoreAndResult(context, false, null, true))
            ]
          }
        ],
        SUBMIT_ANSWER: {
          target: 'result',
          actions: assign(({ context, event }) => 
            updateScoreAndResult(context, event.isCorrect, event.answerIndex, false)
          )
        }
      }
    },
    result: {
      after: {
        2000: [
          {
            guard: ({ context }) => 
              context.score.team1 >= 10 || 
              context.score.team2 >= 10 || 
              context.currentQuestionIndex >= context.questions.length - 1,
            target: 'ended'
          },
          {
            target: 'waiting_buzz',
            actions: assign({
              currentQuestionIndex: ({ context }) => context.currentQuestionIndex + 1,
              activeTeam: null,
              buzzWinner: null,
              timer: 5,
              lastResult: null
            })
          }
        ]
      }
    },
    ended: {}
  },
  on: {
    RESET: {
      target: '.idle',
      actions: assign({
        currentQuestionIndex: 0,
        score: { team1: 5, team2: 5 },
        activeTeam: null,
        buzzWinner: null,
        timer: 5,
        lastResult: null,
        importError: null
      })
    }
  }
});
```

### 4.2 Integration Hook (`src/hooks/useMachine.ts`)
Since the project uses Preact and does not import external libraries like `@xstate/preact`, we can create a lightweight hook to manage actor lifecycle and subscribe to state changes.

```typescript
import { createActor, Actor, StateFrom, EventFrom } from 'xstate';
import { useState, useEffect, useMemo } from 'preact/hooks';

export function useMachine<TMachine extends import('xstate').AnyStateMachine>(
  machine: TMachine
) {
  const actor = useMemo(() => createActor(machine).start(), [machine]);
  const [state, setState] = useState<StateFrom<TMachine>>(actor.getSnapshot());

  useEffect(() => {
    const subscription = actor.subscribe((nextState) => {
      setState(nextState as StateFrom<TMachine>);
    });
    return () => {
      subscription.unsubscribe();
      actor.stop();
    };
  }, [actor]);

  return [state, actor.send, actor] as const;
}
```

### 4.3 Preact Component Integration Blueprint (`src/app.tsx`)

This draft shows how the Preact component hooks into the machine, sets up the keyboard listeners, and manages answer checks.

```typescript
import { useEffect } from 'preact/hooks';
import { useMachine } from './hooks/useMachine';
import { tugOfWarMachine } from './state-machine';
import { verifyAnswer } from './crypto';

// Audio placeholders (to be mapped by user later)
const playBuzzSound = () => console.log('🔊 Buzz!');
const playTickSound = () => console.log('🔊 Tick!');
const playCorrectSound = () => console.log('🔊 Correct!');
const playWrongSound = () => console.log('🔊 Wrong!');
const playPullRopeSound = () => console.log('🔊 Pull!');

export function App({ theme, defaultQuestions }) {
  const [state, send] = useMachine(tugOfWarMachine);
  const { questions, currentQuestionIndex, timer, score, activeTeam, lastResult } = state.context;
  const currentQuestion = questions[currentQuestionIndex];

  // 1. Sync default questions from Custom Element attributes
  useEffect(() => {
    if (defaultQuestions && defaultQuestions.length > 0) {
      send({ type: 'IMPORT_QUESTIONS', questions: defaultQuestions });
    }
  }, [defaultQuestions, send]);

  // 2. Keyboard Event Listeners for Buzzing
  useEffect(() => {
    // Only intercept keyboard events if the game is active (not idle/ended)
    if (state.matches('idle') || state.matches('ended')) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent holding down key spam
      if (e.repeat) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault(); // Stop scrolling on space
        if (state.matches('waiting_buzz.active')) {
          send({ type: 'BUZZ', team: 'team1' });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (state.matches('waiting_buzz.active')) {
          send({ type: 'BUZZ', team: 'team2' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.value, send]);

  // 3. Audio Effect Hooks
  useEffect(() => {
    if (state.matches('answering')) {
      playBuzzSound();
    }
  }, [activeTeam]);

  useEffect(() => {
    if (state.matches('answering') && timer > 0) {
      playTickSound();
    }
  }, [timer]);

  useEffect(() => {
    if (state.matches('result') && lastResult) {
      if (lastResult.correct) {
        playCorrectSound();
        playPullRopeSound();
      } else {
        playWrongSound();
      }
    }
  }, [state.value]);

  // 4. Handle Option Selection
  const handleOptionClick = async (optionIndex: number) => {
    if (!state.matches('answering') || !currentQuestion) return;

    const answer = currentQuestion.options[optionIndex];
    const salt = currentQuestion.salt || '';
    const hash = currentQuestion.answer_hash;

    const isCorrect = await verifyAnswer(answer, salt, hash);
    send({ type: 'SUBMIT_ANSWER', answerIndex: optionIndex, isCorrect });
  };

  return (
    <div className={`w-full min-h-[500px] flex flex-col justify-between p-6 bg-surface text-on-surface rounded-2xl border-2 border-surface-dim ${activeTeam === 'team1' ? 'shadow-team1-glow' : activeTeam === 'team2' ? 'shadow-team2-glow' : ''}`}>
      {/* HUD Area */}
      <header className="flex justify-between items-center w-full border-b-2 border-surface-dim pb-4">
        <div>
          <span className="text-xs text-primary font-bold">TEAM 1 (SPACE)</span>
          <div className="text-3xl font-bold">{score.team1}</div>
        </div>
        <div className="flex flex-col items-center">
          <span className="px-4 py-1.5 bg-surface-dim rounded-full text-sm font-bold">
            {state.matches('idle') ? 'WAITING START' : `ROUND ${currentQuestionIndex + 1}`}
          </span>
          {state.matches('answering') && (
            <span className="text-accent-glow text-xl font-bold animate-pulse mt-1">
              ⏳ {timer}s
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs text-secondary font-bold">TEAM 2 (ENTER)</span>
          <div className="text-3xl font-bold">{score.team2}</div>
        </div>
      </header>

      {/* Main Game Arena */}
      <main className="flex-1 flex flex-col justify-center items-center my-6">
        {state.matches('idle') && (
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4">Chào mừng đến với Kéo Co Kiến Thức!</h2>
            {questions.length > 0 ? (
              <button 
                onClick={() => send({ type: 'START_GAME' })} 
                className="px-6 py-3 bg-primary text-white rounded-xl font-bold"
              >
                BẮT ĐẦU CHƠI
              </button>
            ) : (
              <p className="text-sm text-on-surface-muted">Vui lòng import câu hỏi để bắt đầu.</p>
            )}
          </div>
        )}

        {(state.matches('waiting_buzz') || state.matches('answering') || state.matches('result')) && currentQuestion && (
          <div className="text-center w-full max-w-2xl">
            <div className="bg-white p-6 rounded-xl border-2 border-surface-dim mb-6 shadow-sm">
              <h2 className="text-xl font-bold">{currentQuestion.question}</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              {currentQuestion.options.map((opt, i) => {
                const isSelected = lastResult?.answeredOptionIndex === i;
                const isAnswering = state.matches('answering');
                const isResult = state.matches('result');

                let btnClass = "p-5 border-2 border-surface-dim rounded-lg font-bold text-left relative transition-all ";
                if (isAnswering) {
                  btnClass += "bg-white hover:border-primary cursor-pointer";
                } else if (isResult) {
                  if (isSelected) {
                    btnClass += lastResult.correct ? "bg-green-100 border-green-500 text-green-700" : "bg-red-100 border-red-500 text-red-700";
                  } else {
                    btnClass += "bg-gray-50 opacity-60 cursor-not-allowed";
                  }
                } else {
                  btnClass += "bg-white opacity-50 cursor-not-allowed";
                }

                return (
                  <button 
                    key={i} 
                    className={btnClass}
                    disabled={!isAnswering}
                    onClick={() => handleOptionClick(i)}
                  >
                    <span className="text-xs uppercase bg-surface-dim text-on-surface px-2 py-0.5 rounded mr-3">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {state.matches('waiting_buzz') && (
              <div className="mt-4 text-sm font-bold text-primary animate-pulse">
                {state.matches('waiting_buzz.cooldown') ? 'CHUẨN BỊ...' : 'ĐẬP CHUÔNG ĐỂ GIÀNH QUYỀN TRẢ LỜI!'}
              </div>
            )}

            {state.matches('result') && lastResult && (
              <div className="mt-4 text-lg font-bold">
                {lastResult.correct 
                  ? `🎉 ĐỘI ${lastResult.team.toUpperCase()} Trả Lời ĐÚNG! (+1 Lực Kéo)`
                  : lastResult.timedOut
                    ? `⏰ Hết giờ! ĐỘI ${lastResult.team.toUpperCase()} không trả lời kịp. (-1 Lực Kéo)`
                    : `❌ ĐỘI ${lastResult.team.toUpperCase()} Trả Lời SAI! (-1 Lực Kéo)`
                }
              </div>
            )}
          </div>
        )}

        {state.matches('ended') && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">TRÒ CHƠI KẾT THÚC!</h2>
            <div className="text-xl font-bold text-accent-glow mb-6">
              👑 ĐỘI {score.team1 > score.team2 ? '1' : '2'} CHIẾN THẮNG! 👑
            </div>
            <button 
              onClick={() => send({ type: 'RESET' })} 
              className="px-6 py-3 bg-secondary text-white rounded-xl font-bold"
            >
              CHƠI LẠI
            </button>
          </div>
        )}
      </main>

      {/* Tug of War Visual element */}
      <div className="w-full my-4">
        <div className="flex justify-between items-center mb-2 px-1 text-xs font-bold">
          <span>Lực Kéo Đội 1</span>
          <span>Lực Kéo Đội 2</span>
        </div>
        <div className="w-full bg-surface-dim h-8 rounded-full overflow-hidden relative border-2 border-surface-dim box-border">
          {/* Ribbon position based on scores (0 - 10 scale) */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-accent-glow rotate-45 z-10 transition-all duration-500 ease-out"
            style={{ left: `${(score.team1 / 10) * 100}%` }}
          ></div>
          <div className="w-full h-full flex">
            <div 
              className="bg-primary transition-all duration-500 ease-out border-r border-white"
              style={{ width: `${(score.team1 / 10) * 100}%` }}
            ></div>
            <div 
              className="bg-secondary transition-all duration-500 ease-out"
              style={{ width: `${(score.team2 / 10) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 5. Answers to Specific Design Requirements

1. **Race Condition Prevention:** Fully resolved by XState's synchronous state transition. The first event changes the state immediately, rendering subsequent buzzes inactive.
2. **Space Key Scroll Prevention:** Implemented by listening to window keydown events, filtering for `' '`/`'Space'`, and invoking `e.preventDefault()`.
3. **Anti-Spamming:** Check `e.repeat` for browser key auto-repeat, and use a 500ms hierarchically-designed `waiting_buzz.cooldown` sub-state in XState for round transitions.
4. **Lightweight Preact Binding:** Implemented custom hook `useMachine` that uses native Preact hooks, avoiding unnecessary dependencies.
