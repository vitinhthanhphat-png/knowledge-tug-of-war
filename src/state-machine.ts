import { createMachine, assign } from 'xstate';
import { Question, sanitizeQuestions, SAFE_DEFAULT_QUESTIONS } from './questions';

export interface TugOfWarContext {
  questions: Question[];
  currentQuestionIndex: number;
  timer: number;
  buzzTimer: number;
  baseBuzzTime: number;
  score: { team1: number; team2: number };
  activeTeam: 'team1' | 'team2' | null;
  buzzWinner: 'team1' | 'team2' | null;
  importError: string | null;
  lastResult?: 'correct' | 'incorrect' | 'timeout' | null;
  isGoldenQuestion: boolean;
}

export type TugOfWarEvent =
  | { type: 'IMPORT_QUESTIONS'; questions: Question[] }
  | { type: 'START_GAME'; buzzTime?: number }
  | { type: 'BUZZ'; team: 'team1' | 'team2' }
  | { type: 'SUBMIT_ANSWER'; isCorrect: boolean }
  | { type: 'TIMER_TICK' }
  | { type: 'BUZZ_TIMER_TICK' }
  | { type: 'TIMEOUT' }
  | { type: 'TIMEOUT_BUZZ' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'TOGGLE_GOLDEN_QUESTION' }
  | { type: 'RESET' };

export const tugOfWarMachine = createMachine({
  id: 'tugOfWar',
  initial: 'idle',
  types: {} as {
    context: TugOfWarContext;
    events: TugOfWarEvent;
    input: { questions?: Question[] };
  },
  context: ({ input }) => ({
    questions: input?.questions || [],
    currentQuestionIndex: 0,
    timer: 10,
    buzzTimer: 10,
    baseBuzzTime: 10,
    score: { team1: 5, team2: 5 },
    activeTeam: null,
    buzzWinner: null,
    importError: null,
    lastResult: null,
    isGoldenQuestion: false,
  }),
  on: {
    TOGGLE_GOLDEN_QUESTION: {
      actions: assign(({ context }) => ({
        isGoldenQuestion: !context.isGoldenQuestion,
      })),
    },
    IMPORT_QUESTIONS: {
      target: '.idle',
      actions: assign(({ event }) => {
        try {
          const sanitized = sanitizeQuestions(event.questions);
          return {
            questions: sanitized,
            currentQuestionIndex: 0,
            score: { team1: 5, team2: 5 },
            activeTeam: null,
            buzzWinner: null,
            importError: null,
            lastResult: null,
          };
        } catch (err) {
          return {
            questions: SAFE_DEFAULT_QUESTIONS,
            currentQuestionIndex: 0,
            score: { team1: 5, team2: 5 },
            activeTeam: null,
            buzzWinner: null,
            importError: err instanceof Error ? err.message : String(err),
            lastResult: null,
          };
        }
      }),
    },
  },
  states: {
    idle: {
      on: {
        START_GAME: {
          guard: ({ context }) => context.questions.length > 0,
          target: 'waiting_buzz',
          actions: assign(({ event }) => {
            const newBaseBuzzTime = event.type === 'START_GAME' && event.buzzTime !== undefined ? event.buzzTime : 10;
            return {
              currentQuestionIndex: 0,
              timer: 10,
              baseBuzzTime: newBaseBuzzTime,
              buzzTimer: newBaseBuzzTime,
              score: { team1: 5, team2: 5 },
              activeTeam: null,
              buzzWinner: null,
              importError: null,
              lastResult: null,
              isGoldenQuestion: false,
            };
          }),
        },
      },
    },
    waiting_buzz: {
      entry: assign(({ context }) => ({
        activeTeam: null,
        buzzWinner: null,
        timer: 10,
        buzzTimer: context.baseBuzzTime,
      })),
      on: {
        BUZZ: {
          target: 'answering',
          actions: assign(({ event }) => ({
            activeTeam: event.team,
            buzzWinner: event.team,
            timer: 10,
          })),
        },
        BUZZ_TIMER_TICK: [
          {
            guard: ({ context }) => context.buzzTimer > 1,
            actions: assign(({ context }) => ({
              buzzTimer: context.buzzTimer - 1,
            })),
          },
          {
            target: 'timeout_reveal',
            actions: assign(() => ({
              buzzTimer: 0,
            })),
          },
        ],
        TIMEOUT_BUZZ: {
          target: 'timeout_reveal',
          actions: assign(() => ({
            buzzTimer: 0,
          })),
        },
        RESET: {
          target: 'idle',
          actions: assign(({ context }) => ({
            questions: context.questions,
            currentQuestionIndex: 0,
            timer: 10,
            buzzTimer: context.baseBuzzTime,
            score: { team1: 5, team2: 5 },
            activeTeam: null,
            buzzWinner: null,
            importError: null,
            lastResult: null,
          })),
        },
      },
    },
    answering: {
      on: {
        SUBMIT_ANSWER: {
          target: 'result',
          actions: assign(({ context, event }) => {
            const isCorrect = event.isCorrect;
            const active = context.activeTeam;
            const points = context.isGoldenQuestion ? 2 : 1;
            
            let t1Score = context.score.team1;
            let t2Score = context.score.team2;
            
            if (active === 'team1') {
              if (isCorrect) {
                t1Score += points;
                t2Score -= points;
              } else {
                t1Score -= points;
                t2Score += points;
              }
            } else if (active === 'team2') {
              if (isCorrect) {
                t2Score += points;
                t1Score -= points;
              } else {
                t2Score -= points;
                t1Score += points;
              }
            }
            
            t1Score = Math.max(0, Math.min(10, t1Score));
            t2Score = 10 - t1Score;
            
            return {
              score: { team1: t1Score, team2: t2Score },
              lastResult: isCorrect ? 'correct' : 'incorrect',
            };
          }),
        },
        TIMER_TICK: [
          {
            guard: ({ context }) => context.timer > 1,
            actions: assign(({ context }) => ({
              timer: context.timer - 1,
            })),
          },
          {
            target: 'result',
            actions: assign(({ context }) => {
              const active = context.activeTeam;
              const points = context.isGoldenQuestion ? 2 : 1;
              let t1Score = context.score.team1;
              let t2Score = context.score.team2;
              
              if (active === 'team1') {
                t1Score -= points;
                t2Score += points;
              } else if (active === 'team2') {
                t2Score -= points;
                t1Score += points;
              }
              
              t1Score = Math.max(0, Math.min(10, t1Score));
              t2Score = 10 - t1Score;
              
              return {
                timer: 0,
                score: { team1: t1Score, team2: t2Score },
                lastResult: 'timeout',
              };
            }),
          },
        ],
        TIMEOUT: {
          target: 'result',
          actions: assign(({ context }) => {
            const active = context.activeTeam;
            const points = context.isGoldenQuestion ? 2 : 1;
            let t1Score = context.score.team1;
            let t2Score = context.score.team2;
            
            if (active === 'team1') {
              t1Score -= points;
              t2Score += points;
            } else if (active === 'team2') {
              t2Score -= points;
              t1Score += points;
            }
            
            t1Score = Math.max(0, Math.min(10, t1Score));
            t2Score = 10 - t1Score;
            
            return {
              score: { team1: t1Score, team2: t2Score },
              lastResult: 'timeout',
            };
          }),
        },
        RESET: {
          target: 'idle',
          actions: assign(({ context }) => ({
            questions: context.questions,
            currentQuestionIndex: 0,
            timer: 10,
            score: { team1: 5, team2: 5 },
            activeTeam: null,
            buzzWinner: null,
            importError: null,
            lastResult: null,
            isGoldenQuestion: false,
          })),
        },
      },
    },
    timeout_reveal: {
      on: {
        NEXT_QUESTION: [
          {
            guard: ({ context }) => 
              context.score.team1 === 0 || 
              context.score.team1 === 10 || 
              context.currentQuestionIndex + 1 >= context.questions.length,
            target: 'ended',
          },
          {
            target: 'waiting_buzz',
            actions: assign(({ context }) => ({
              currentQuestionIndex: context.currentQuestionIndex + 1,
              isGoldenQuestion: context.currentQuestionIndex + 1 >= 9,
            })),
          },
        ],
        RESET: {
          target: 'idle',
          actions: assign(({ context }) => ({
            questions: context.questions,
            currentQuestionIndex: 0,
            timer: 10,
            buzzTimer: context.baseBuzzTime,
            score: { team1: 5, team2: 5 },
            activeTeam: null,
            buzzWinner: null,
            importError: null,
            lastResult: null,
            isGoldenQuestion: false,
          })),
        },
      },
    },
    result: {
      on: {
        NEXT_QUESTION: [
          {
            guard: ({ context }) => 
              context.score.team1 === 0 || 
              context.score.team1 === 10 || 
              context.currentQuestionIndex + 1 >= context.questions.length,
            target: 'ended',
          },
          {
            target: 'waiting_buzz',
            actions: assign(({ context }) => ({
              currentQuestionIndex: context.currentQuestionIndex + 1,
              isGoldenQuestion: context.currentQuestionIndex + 1 >= 9,
            })),
          },
        ],
        RESET: {
          target: 'idle',
          actions: assign(({ context }) => ({
            questions: context.questions,
            currentQuestionIndex: 0,
            timer: 10,
            buzzTimer: context.baseBuzzTime,
            score: { team1: 5, team2: 5 },
            activeTeam: null,
            buzzWinner: null,
            importError: null,
            lastResult: null,
            isGoldenQuestion: false,
          })),
        },
      },
    },
    ended: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign(({ context }) => ({
            questions: context.questions,
            currentQuestionIndex: 0,
            timer: 10,
            buzzTimer: context.baseBuzzTime,
            score: { team1: 5, team2: 5 },
            activeTeam: null,
            buzzWinner: null,
            importError: null,
            lastResult: null,
            isGoldenQuestion: false,
          })),
        },
      },
    },
  },
});
