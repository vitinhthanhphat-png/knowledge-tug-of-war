import { createMachine, assign } from 'xstate';
import { Question, sanitizeQuestions, SAFE_DEFAULT_QUESTIONS } from './questions';

export interface TugOfWarContext {
  questions: Question[];
  currentQuestionIndex: number;
  timer: number;
  score: { team1: number; team2: number };
  activeTeam: 'team1' | 'team2' | null;
  buzzWinner: 'team1' | 'team2' | null;
  importError: string | null;
  lastResult?: 'correct' | 'incorrect' | 'timeout' | null;
}

export type TugOfWarEvent =
  | { type: 'IMPORT_QUESTIONS'; questions: Question[] }
  | { type: 'START_GAME' }
  | { type: 'BUZZ'; team: 'team1' | 'team2' }
  | { type: 'SUBMIT_ANSWER'; isCorrect: boolean }
  | { type: 'TIMER_TICK' }
  | { type: 'TIMEOUT' }
  | { type: 'NEXT_QUESTION' }
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
    score: { team1: 5, team2: 5 },
    activeTeam: null,
    buzzWinner: null,
    importError: null,
    lastResult: null,
  }),
  on: {
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
          actions: assign({
            currentQuestionIndex: 0,
            timer: 10,
            score: { team1: 5, team2: 5 },
            activeTeam: null,
            buzzWinner: null,
            importError: null,
            lastResult: null,
          }),
        },
      },
    },
    waiting_buzz: {
      entry: assign({
        activeTeam: null,
        buzzWinner: null,
        timer: 10,
      }),
      on: {
        BUZZ: {
          target: 'answering',
          actions: assign(({ event }) => ({
            activeTeam: event.team,
            buzzWinner: event.team,
            timer: 10,
          })),
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
            
            let t1Score = context.score.team1;
            let t2Score = context.score.team2;
            
            if (active === 'team1') {
              if (isCorrect) {
                t1Score += 1;
                t2Score -= 1;
              } else {
                t1Score -= 1;
                t2Score += 1;
              }
            } else if (active === 'team2') {
              if (isCorrect) {
                t2Score += 1;
                t1Score -= 1;
              } else {
                t2Score -= 1;
                t1Score += 1;
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
              let t1Score = context.score.team1;
              let t2Score = context.score.team2;
              
              if (active === 'team1') {
                t1Score -= 1;
                t2Score += 1;
              } else if (active === 'team2') {
                t2Score -= 1;
                t1Score += 1;
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
            let t1Score = context.score.team1;
            let t2Score = context.score.team2;
            
            if (active === 'team1') {
              t1Score -= 1;
              t2Score += 1;
            } else if (active === 'team2') {
              t2Score -= 1;
              t1Score += 1;
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
          })),
        },
      },
    },
    result: {
      after: {
        2000: [
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
            })),
          },
        ],
      },
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
            })),
          },
        ],
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
            score: { team1: 5, team2: 5 },
            activeTeam: null,
            buzzWinner: null,
            importError: null,
            lastResult: null,
          })),
        },
      },
    },
  },
});
