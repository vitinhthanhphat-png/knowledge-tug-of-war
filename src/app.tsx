import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { createActor } from 'xstate';
import { tugOfWarMachine } from './state-machine';
import { verifyAnswer, hashAnswer } from './crypto';
import gameBg from './assets/game_background_v3.png';
import avatarTeam1 from './assets/avatar_team1.png';
import avatarTeam2 from './assets/avatar_team2.png';
import victoryTrophy from './assets/victory_trophy.png';

import { 
  Question, 
  ValidationError, 
  SAFE_DEFAULT_QUESTIONS, 
  sanitizeQuestions, 
  getInitialQuestions, 
  validateQuestionsJSON,
  STORAGE_KEY
} from './questions';

export type { Question, ValidationError };
export { 
  SAFE_DEFAULT_QUESTIONS, 
  sanitizeQuestions, 
  getInitialQuestions, 
  validateQuestionsJSON,
  STORAGE_KEY
};

interface AppProps {
  theme: string;
  defaultQuestions: Question[];
  host: HTMLElement;
  validationError?: string | null;
}

// Aspect ratio scaler hook
export function useAspectRatioScaler(targetWidth = 1920, targetHeight = 1080) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const calculateScale = () => {
      const parent = el.parentElement;
      if (!parent) return;

      const parentWidth = parent.clientWidth;
      const parentHeight = parent.clientHeight || window.innerHeight;

      const scaleX = parentWidth / targetWidth;
      const scaleY = parentHeight / targetHeight;
      
      const newScale = Math.min(scaleX, scaleY);
      setScale(newScale || 1);
    };

    calculateScale();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && el.parentElement) {
      resizeObserver = new ResizeObserver(calculateScale);
      resizeObserver.observe(el.parentElement);
    }

    window.addEventListener('resize', calculateScale);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', calculateScale);
    };
  }, [targetWidth, targetHeight]);

  return { containerRef, scale };
}

// Audio context setup and synthesizers
let audioCtx: AudioContext | null = null;

const initAudio = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioCtx = new AudioContextClass();
  return audioCtx;
};

const resumeAudioContext = (): AudioContext | null => {
  const ctx = initAudio();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch((err) => console.warn('Failed to resume AudioContext:', err));
  }
  return ctx;
};

const playBuzzSound = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gainNode = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(160, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.4);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, ctx.currentTime);
  filter.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.4);

  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.4);
};

const playTickSound = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05);

  gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.08);
};

const playCorrectSound = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + index * 0.08);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + index * 0.08 + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + index * 0.08 + 0.4);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now + index * 0.08);
    osc.stop(now + index * 0.08 + 0.4);
  });
};

const playWrongSound = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gainNode = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.5);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, ctx.currentTime);
  filter.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.5);

  gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.5);
};

const playPullRopeSound = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.4;

  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noiseNode = ctx.createBufferSource();
  noiseNode.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.setValueAtTime(6, now);
  filter.frequency.setValueAtTime(300, now);
  filter.frequency.exponentialRampToValueAtTime(1000, now + 0.15);
  filter.frequency.exponentialRampToValueAtTime(400, now + duration);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.25, now + 0.08);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

  noiseNode.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  noiseNode.start(now);
  noiseNode.stop(now + duration);
};


export function App({ defaultQuestions, host, validationError: propValidationError }: AppProps) {
  const isFirstMountRef = useRef(true);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640 || window.innerHeight < 600);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-resume AudioContext on first player interaction (click or keydown)
  useEffect(() => {
    const unlockAudio = () => {
      const ctx = initAudio();
      if (ctx) {
        ctx.resume().then(() => {
          if (ctx.state === 'running') {
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
          }
        }).catch((err) => console.warn('Failed to resume AudioContext:', err));
      }
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);


  // Custom useActor subscription logic to keep dependencies minimal
  const actor = useMemo(() => {
    const initialQuestions = getInitialQuestions(defaultQuestions);
    // Write back defaultQuestions immediately if we fell back and it is not empty
    if (defaultQuestions && defaultQuestions.length > 0) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(initialQuestions));
        }
      } catch (err) {
        console.error('Failed to save fallback questions to localStorage:', err);
      }
    }
    return createActor(tugOfWarMachine, {
      input: { questions: initialQuestions }
    }).start();
  }, []);

  const [state, setState] = useState(() => actor.getSnapshot());
  const prevStateRef = useRef<string>('');
  const isSubmittingRef = useRef(false);
  const hasBuzzedRef = useRef(false);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(propValidationError || null);

  useEffect(() => {
    if (propValidationError) {
      setValidationError(propValidationError);
    }
  }, [propValidationError]);

  useEffect(() => {
    const subscription = actor.subscribe((nextState) => {
      // Synchronously track state changes
      if (nextState.value === 'waiting_buzz' && prevStateRef.current !== 'waiting_buzz') {
        roundStartTimeRef.current = Date.now();
        hasBuzzedRef.current = false;
      }
      prevStateRef.current = nextState.value as string;
      setState(nextState);

      // Handle validation errors from the state machine
      if (nextState.context.importError) {
        setValidationError(nextState.context.importError);
        host.dispatchEvent(new CustomEvent('questions-invalid', {
          detail: { error: nextState.context.importError },
          bubbles: true,
          composed: true
        }));
      }
    });
    return () => {
      subscription.unsubscribe();
      actor.stop();
    };
  }, [actor, host]);

  const send = actor.send;

  // Handle validation checking and state updates for invalid configuration
  useEffect(() => {
    let hasError = false;
    let errorMsg = "";

    // 1. Validate defaultQuestions
    if (defaultQuestions && defaultQuestions.length > 0) {
      try {
        const sanitized = sanitizeQuestions(defaultQuestions);
        send({ type: 'IMPORT_QUESTIONS', questions: sanitized });
      } catch (err) {
        hasError = true;
        errorMsg = err instanceof Error ? err.message : String(err);
      }
    }

    // 2. Validate localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const sanitized = sanitizeQuestions(parsed);
        send({ type: 'IMPORT_QUESTIONS', questions: sanitized });
      }
    } catch (err) {
      hasError = true;
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    if (hasError) {
      setValidationError(errorMsg);
      // Load safe default question set
      send({ type: 'IMPORT_QUESTIONS', questions: SAFE_DEFAULT_QUESTIONS });
      // Dispatch custom DOM event
      host.dispatchEvent(new CustomEvent('questions-invalid', {
        detail: { error: errorMsg },
        bubbles: true,
        composed: true
      }));
    } else {
      setValidationError(null);
    }
  }, [defaultQuestions, host, send]);

  // Track dynamic attribute changes from host element
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      const currentQuestions = actor.getSnapshot().context.questions;
      if (currentQuestions.length === 0 && defaultQuestions && defaultQuestions.length > 0) {
        try {
          const sanitized = sanitizeQuestions(defaultQuestions);
          send({ type: 'IMPORT_QUESTIONS', questions: sanitized });
        } catch (err) {
          // Handled by validation check useEffect
        }
      }
    } else {
      if (defaultQuestions && defaultQuestions.length > 0) {
        try {
          const sanitized = sanitizeQuestions(defaultQuestions);
          send({ type: 'IMPORT_QUESTIONS', questions: sanitized });
        } catch (err) {
          // Handled by validation check useEffect
        }
      }
    }
  }, [defaultQuestions, send, actor]);

  // Reactive sync of questions back to Local Storage
  useEffect(() => {
    const currentQuestions = state.context.questions;
    if (currentQuestions) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentQuestions));
      } catch (e) {
        console.error('Failed to save questions to Local Storage:', e);
      }
    }
  }, [state.context.questions]);

  // Admin Panel states
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'import' | 'hash'>('questions');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // New question form state
  const [newQText, setNewQText] = useState('');
  const [newQOptions, setNewQOptions] = useState(['', '', '', '']);
  const [newQCorrectIdx, setNewQCorrectIdx] = useState(0);
  const [newQSalt, setNewQSalt] = useState('');

  // For Hash Utility Tool
  const [hashInput, setHashInput] = useState('');
  const [hashSaltInput, setHashSaltInput] = useState('');
  const [generatedHash, setGeneratedHash] = useState('');

  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const roundStartTimeRef = useRef<number>(0);
  const prevScoresRef = useRef(state.context.score);

  // Reset selected option index on new round or reset
  useEffect(() => {
    if (state.value === 'waiting_buzz' || state.value === 'idle') {
      setSelectedOptionIndex(null);
    }
  }, [state.value]);

  // Pre-calculate correct option index asynchronously when question changes
  useEffect(() => {
    const findCorrectOption = async () => {
      const questions = state.context.questions;
      const currentIndex = state.context.currentQuestionIndex;
      const currentQuestion = questions[currentIndex];
      if (!currentQuestion) {
        setCorrectOptionIndex(null);
        return;
      }
      for (let i = 0; i < currentQuestion.options.length; i++) {
        const isCorrect = await verifyAnswer(
          currentQuestion.options[i],
          currentQuestion.salt || '',
          currentQuestion.answer_hash
        );
        if (isCorrect) {
          setCorrectOptionIndex(i);
          break;
        }
      }
    };
    findCorrectOption();
  }, [state.context.currentQuestionIndex, state.context.questions]);

  // Bind window event listeners for buzzing in waiting_buzz state
  useEffect(() => {
    if (state.value !== 'waiting_buzz') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      // Ignore keys when targeting input controls
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling page on space
        if (hasBuzzedRef.current) return;
        const elapsed = Date.now() - roundStartTimeRef.current;
        if (elapsed >= 500) {
          hasBuzzedRef.current = true;
          console.log("BUZZ team1");
          send({ type: 'BUZZ', team: 'team1' });
        }
      } else if (e.code === 'Enter') {
        if (hasBuzzedRef.current) return;
        const elapsed = Date.now() - roundStartTimeRef.current;
        if (elapsed >= 500) {
          hasBuzzedRef.current = true;
          console.log("BUZZ team2");
          send({ type: 'BUZZ', team: 'team2' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.value, send]);

  // Timer interval for answering state
  useEffect(() => {
    if (state.value !== 'answering') return;

    const interval = setInterval(() => {
      send({ type: 'TIMER_TICK' });
      playTickSound();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [state.value, send]);

  // Play audio hooks on key state transitions
  useEffect(() => {
    if (state.value === 'answering') {
      playBuzzSound();
    }
  }, [state.value]);

  // Play pull rope sound when score updates
  useEffect(() => {
    const currentScores = state.context.score;
    if (
      currentScores.team1 !== prevScoresRef.current.team1 ||
      currentScores.team2 !== prevScoresRef.current.team2
    ) {
      playPullRopeSound();
      prevScoresRef.current = currentScores;
    }
  }, [state.context.score]);

  const handleBuzzTap = (team: 'team1' | 'team2') => {
    const elapsed = Date.now() - roundStartTimeRef.current;
    if (elapsed >= 500) {
      console.log(`BUZZ ${team}`);
      send({ type: 'BUZZ', team });
    }
  };

  const handleOptionClick = async (optionText: string, index: number) => {
    if (isSubmittingRef.current) return;
    const currentSnapshot = actor.getSnapshot();
    if (currentSnapshot.value !== 'answering') return;

    console.log(`OPTION_CLICK ${optionText}`);
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSelectedOptionIndex(index);
    try {
      const questions = state.context.questions;
      const currentIndex = state.context.currentQuestionIndex;
      const currentQuestion = questions[currentIndex];
      const isCorrect = await verifyAnswer(optionText, currentQuestion.salt || '', currentQuestion.answer_hash);
      
      if (actor.getSnapshot().value !== 'answering') return;

      if (isCorrect) {
        playCorrectSound();
      } else {
        playWrongSound();
      }
      send({ type: 'SUBMIT_ANSWER', isCorrect });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSecureImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Guard: Max Size 500KB
      if (file.size > 500 * 1024) {
        setValidationErrors([{ index: -1, message: 'Kích thước file vượt quá giới hạn cho phép (500KB).' }]);
        return;
      }

      setIsValidating(true);
      setValidationErrors([]);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const result = await validateQuestionsJSON(text);
          
          if (result.isValid && result.questions) {
            send({ type: 'IMPORT_QUESTIONS', questions: result.questions });
            setValidationErrors([]);
            setValidationError(null);
            alert('Tải đề thi JSON thành công!');
          } else {
            const errorMsg = result.errors.map(err => err.message).join('; ');
            setValidationErrors(result.errors || []);
            setValidationError(errorMsg);
            send({ type: 'IMPORT_QUESTIONS', questions: SAFE_DEFAULT_QUESTIONS });
            host.dispatchEvent(new CustomEvent('questions-invalid', {
              detail: { error: errorMsg },
              bubbles: true,
              composed: true
            }));
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          setValidationErrors([{ index: -1, message: errorMsg }]);
          setValidationError(errorMsg);
          send({ type: 'IMPORT_QUESTIONS', questions: SAFE_DEFAULT_QUESTIONS });
          host.dispatchEvent(new CustomEvent('questions-invalid', {
            detail: { error: errorMsg },
            bubbles: true,
            composed: true
          }));
        } finally {
          setIsValidating(false);
        }
      };

      reader.onerror = () => {
        setValidationErrors([{ index: -1, message: 'Lỗi FileReader khi đọc file.' }]);
        setIsValidating(false);
      };

      reader.onabort = () => {
        setValidationErrors([{ index: -1, message: 'FileReader đã bị hủy bỏ.' }]);
        setIsValidating(false);
      };

      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportJSON = () => {
    if (!state.context.questions || state.context.questions.length === 0) {
      alert('Không có câu hỏi nào để xuất.');
      return;
    }
    const blob = new Blob([JSON.stringify(state.context.questions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddQuestion = async (e: Event) => {
    e.preventDefault();
    if (isAddingQuestion) return;
    if (!newQText.trim() || newQOptions.some(o => !o.trim())) {
      alert('Vui lòng điền đầy đủ câu hỏi và 4 đáp án.');
      return;
    }
    
    setIsAddingQuestion(true);
    try {
      const salt = newQSalt.trim() || Math.random().toString(36).substring(2, 10);
      const correctText = newQOptions[newQCorrectIdx];
      const answer_hash = await hashAnswer(correctText, salt);

      const newQuestion: Question = {
        id: `q_${Date.now()}`,
        question: newQText.trim(),
        options: newQOptions.map(o => o.trim()),
        answer_hash,
        salt
      };

      const updatedQuestions = [...state.context.questions, newQuestion];
      send({ type: 'IMPORT_QUESTIONS', questions: updatedQuestions });
      
      // Reset form
      setNewQText('');
      setNewQOptions(['', '', '', '']);
      setNewQCorrectIdx(0);
      setNewQSalt('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingQuestion(false);
    }
  };

  const handleGenerateHash = async () => {
    if (!hashInput.trim()) {
      alert('Vui lòng nhập đáp án chính xác để tạo hash.');
      return;
    }
    const hash = await hashAnswer(hashInput.trim(), hashSaltInput.trim());
    setGeneratedHash(hash);
  };

  const currentQuestion = state.context.questions[state.context.currentQuestionIndex];
  const t1Percent = (state.context.score.team1 / 10) * 100;
  const t2Percent = (state.context.score.team2 / 10) * 100;

  const { containerRef, scale } = useAspectRatioScaler(1920, 1080);

  return (
    <div className="bg-black text-on-background min-h-screen flex items-center justify-center font-body-md overflow-hidden w-full relative">
      
      {/* Full Screen Background Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img alt="Background" className="w-full h-full object-cover opacity-80" src={gameBg} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30"></div>
      </div>

      <div 
        ref={containerRef}
        style={isMobile ? {
          width: '100%',
          minHeight: '100vh',
          position: 'relative'
        } : {
          width: '1920px',
          height: '1080px',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
        className={`aspect-video transition-all duration-300 overflow-hidden z-10 ${isMobile ? '' : ''}`}
      >

        {/* Center Fire Effect */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-orange-500 rounded-full fire-glow mix-blend-screen pointer-events-none z-10 origin-center"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-yellow-300 rounded-full fire-glow mix-blend-screen pointer-events-none z-10 origin-center" style={{ animationDelay: '0.5s' }}></div>

        {/* Start Screen (Idle State) */}
        {state.value === 'idle' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
            <h1 className="font-display-force text-6xl md:text-8xl text-white uppercase tracking-tighter mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] text-center px-4">
              Knowledge Tug of War
            </h1>
            <p className="text-white/80 font-body-md text-xl md:text-2xl mb-12 font-bold tracking-widest">CUỘC CHIẾN TRI THỨC ĐỈNH CAO</p>
            
            <div className="flex flex-col gap-6 items-center">
              {state.context.questions.length > 0 ? (
                <button 
                  onClick={() => send({ type: 'START_GAME' })}
                  className="px-12 py-5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-full font-bold font-headline-lg text-2xl tracking-wider shadow-[0_0_30px_rgba(34,197,94,0.6)] hover:shadow-[0_0_50px_rgba(34,197,94,0.9)] hover:scale-105 transition-all duration-300 border-2 border-green-300"
                >
                  BẮT ĐẦU CHƠI
                </button>
              ) : (
                <div className="text-yellow-400 font-bold mb-4 bg-black/50 px-6 py-2 rounded-full backdrop-blur-md border border-yellow-400/30">Vui lòng mở Admin để Import đề thi!</div>
              )}
              
              <div className="flex gap-4 mt-6">
                <button 
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen().catch(() => {});
                    } else {
                      document.exitFullscreen().catch(() => {});
                    }
                  }}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white rounded-xl font-bold font-body-md transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">fullscreen</span>
                  FULLSCREEN
                </button>
                <button 
                  onClick={() => { setValidationErrors([]); setIsAdminOpen(true); }}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white rounded-xl font-bold font-body-md transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">settings</span>
                  ADMIN
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Screen Edge Glow (Validation Error) */}
        {validationError && (
          <div className="absolute top-16 left-6 right-6 bg-[#7f1d1d]/90 backdrop-blur-md text-red-200 px-4 py-3 rounded-xl border border-red-500/30 flex items-center justify-between gap-3 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-2">
              <span className="text-red-400 font-bold">⚠️ Dữ liệu câu hỏi lỗi:</span>
              <span className="text-xs">{validationError} (Tự động tải bộ câu hỏi mặc định)</span>
            </div>
            <button 
              onClick={() => setValidationError(null)}
              className="text-red-400 hover:text-white font-bold text-lg leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* HUD Top */}
        {state.value !== 'idle' && (
          <header className="absolute top-0 left-0 right-0 z-30 flex justify-between items-start px-xl py-lg w-full">
            {/* Team 1 (Left) */}
            <div className="flex flex-col items-start gap-sm">
              <div className={`glass-panel px-lg py-md rounded-xl border-2 ${state.context.activeTeam === 'team1' ? 'border-primary-container glow-pulse' : 'border-surface-dim fade-inactive'} flex flex-col items-center gap-xs bg-white/80 transition-all duration-300 relative`}>
                <img src={avatarTeam1} alt="Team 1" className="w-[80px] h-[80px] object-contain drop-shadow-[0_0_15px_rgba(34,197,94,0.6)] mix-blend-multiply" />
                <span className="font-headline-lg text-headline-lg text-primary">Đội 1 (Trái)</span>
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                  <span className="font-body-md font-bold text-on-surface">Lực kéo: {state.context.score.team1 * 10} Lực</span>
                </div>
              </div>
              {!isMobile && (
                <div className="bg-primary/90 text-white px-md py-xs rounded-lg shadow-lg mt-2">
                  <span className="font-key-hint text-key-hint uppercase tracking-widest">Space</span>
                </div>
              )}
            </div>

            {/* Center Title */}
            <div className="flex flex-col items-center justify-center glass-panel px-xl py-sm rounded-full shadow-lg bg-white/70">
              <h1 className="font-display-force text-headline-lg text-primary uppercase tracking-tighter">Knowledge Tug of War</h1>
              <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-variant/80 px-md py-xs rounded-full mt-1">Vòng {state.context.currentQuestionIndex + 1} / {state.context.questions.length}</span>
              <button 
                onClick={() => { setValidationErrors([]); setIsAdminOpen(true); }}
                className="mt-2 text-xs text-neutral-500 hover:text-neutral-800 underline uppercase tracking-wider font-bold"
              >
                ⚙️ Admin
              </button>
            </div>

            {/* Team 2 (Right) */}
            <div className="flex flex-col items-end gap-sm">
              <div className={`glass-panel px-lg py-md rounded-xl border-2 ${state.context.activeTeam === 'team2' ? 'border-secondary-container glow-pulse' : 'border-surface-dim fade-inactive'} flex flex-col items-center gap-xs bg-white/80 shadow-md transition-all duration-300 relative`}>
                <img src={avatarTeam2} alt="Team 2" className="w-[80px] h-[80px] object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.6)] mix-blend-multiply" />
                <span className="font-headline-lg text-headline-lg text-secondary">Đội 2 (Phải)</span>
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                  <span className="font-body-md font-bold text-on-surface">Lực kéo: {state.context.score.team2 * 10} Lực</span>
                </div>
              </div>
              {!isMobile && (
                <div className="bg-secondary/90 text-white px-md py-xs rounded-lg shadow-lg mt-2">
                  <span className="font-key-hint text-key-hint uppercase tracking-widest">Enter</span>
                </div>
              )}
            </div>
          </header>
        )}

        {/* Main Arena (Center) */}
        {state.value !== 'idle' && (
          <main className="absolute inset-0 z-20 flex items-center justify-center px-lg">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-px h-[40%] border-l-2 border-dashed border-white/30"></div>
            
            <div className="glass-panel p-lg rounded-2xl shadow-2xl border border-white/50 max-w-4xl w-full z-20 flex flex-col items-center gap-md bg-white/90">
              {state.value === 'ended' ? (
                 <div className="flex flex-col items-center text-center w-full">
                   <img src={victoryTrophy} alt="Trophy" className="w-[120px] h-[120px] object-contain drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] mix-blend-multiply mb-4" />
                   <h2 className="text-3xl font-display-force font-bold text-on-surface mb-2 uppercase">
                     KẾT THÚC TRẬN ĐẤU
                   </h2>
                   <div className="text-2xl font-headline-lg font-black my-4 text-orange-500 animate-bounce">
                     {state.context.score.team1 > state.context.score.team2 ? (
                       '🏆 ĐỘI 1 CHIẾN THẮNG CHUNG CUỘC! 🏆'
                     ) : state.context.score.team2 > state.context.score.team1 ? (
                       '🏆 ĐỘI 2 CHIẾN THẮNG CHUNG CUỘC! 🏆'
                     ) : (
                       '🤝 HÒA CHUNG CUỘC! 🤝'
                     )}
                   </div>
                   <button
                      onClick={() => send({ type: 'RESET' })}
                      className="px-8 py-3 mt-4 bg-primary text-white rounded-lg font-bold font-headline-lg tracking-wider hover:-translate-y-1 shadow-md transition-all duration-150 active:translate-y-0"
                    >
                      CHƠI LẠI
                    </button>
                 </div>
              ) : (
              <>
                <div className="w-full flex items-center gap-lg">
                  {state.value === 'answering' ? (
                    <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center bg-surface/90 rounded-full border-4 border-error-container shadow-inner">
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" fill="none" r="45" stroke="var(--color-surface-variant)" strokeWidth="8"></circle>
                        <circle 
                          className="transition-all duration-1000 linear" 
                          cx="50" cy="50" fill="none" r="45" stroke="var(--color-error)" 
                          strokeDasharray="283" 
                          strokeDashoffset={283 - (state.context.timer / 5) * 283} 
                          strokeWidth="8"
                        ></circle>
                      </svg>
                      <span className="font-display-force text-headline-lg text-error relative z-10">
                        0{state.context.timer}
                      </span>
                    </div>
                  ) : (
                    <div className="relative w-20 h-20 flex-shrink-0 flex flex-col items-center justify-center bg-surface/90 rounded-full border-4 border-surface-variant shadow-inner">
                      <span className="font-label-caps text-xs text-on-surface-variant">Round</span>
                      <span className="font-display-force text-2xl text-on-surface relative z-10">{state.context.currentQuestionIndex + 1}</span>
                    </div>
                  )}

                  <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
                    <span className="text-primary mr-sm">Câu {state.context.currentQuestionIndex + 1}: </span>
                    {currentQuestion ? currentQuestion.question : ""}
                  </h2>
                </div>

                {state.value === 'waiting_buzz' && (
                  <div className="text-orange-600 font-headline-lg font-bold text-sm tracking-widest uppercase animate-pulse my-2 text-center w-full">
                    ⚡ {isMobile ? 'NHẤN NÚT ĐẬP ĐỂ GIÀNH QUYỀN TRẢ LỜI!' : 'ĐẬP CHUÔNG ĐỂ GIÀNH QUYỀN TRẢ LỜI! (SPACE / ENTER)'} ⚡
                  </div>
                )}
                
                {state.value === 'result' && (
                   <div className="font-headline-lg font-bold text-sm tracking-widest uppercase flex flex-col items-center gap-2 my-2 text-center w-full">
                      {state.context.lastResult === 'correct' ? (
                        <span className="text-green-600">
                          🎉 ĐỘI {state.context.activeTeam === 'team1' ? '1' : '2'} TRẢ LỜI ĐÚNG! (+1 điểm / Đối thủ -1)
                        </span>
                      ) : state.context.lastResult === 'incorrect' ? (
                        <span className="text-red-600">
                          ❌ ĐỘI {state.context.activeTeam === 'team1' ? '1' : '2'} TRẢ LỜI SAI! (-1 điểm / Đối thủ +1)
                        </span>
                      ) : (
                        <span className="text-red-600">
                          ⏰ HẾT GIỜ TRẢ LỜI! Đội {state.context.activeTeam === 'team1' ? '1' : '2'} bị phạt (-1 điểm / Đối thủ +1)
                        </span>
                      )}
                      <button
                        onClick={() => send({ type: 'NEXT_QUESTION' })}
                        className="mt-2 text-sm text-neutral-500 hover:text-neutral-800 underline uppercase tracking-wider font-bold"
                      >
                        Tiếp tục &rarr;
                      </button>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-md w-full mt-4">
                  {(currentQuestion?.options || []).map((opt, i) => {
                    const isAnswering = state.value === 'answering';
                    const isResult = state.value === 'result';
                    
                    let btnClass = "answer-btn relative p-lg rounded-xl border-2 flex items-center justify-center group bg-surface/90 backdrop-blur-sm transition-all duration-200 min-h-[80px]";
                    let disabled = true;
                    
                    if (isAnswering) {
                      disabled = isSubmitting;
                      btnClass += " border-surface-variant hover:border-primary hover:bg-white cursor-pointer hover:-translate-y-1 shadow-sm";
                    } else if (isResult) {
                      disabled = true;
                      if (i === correctOptionIndex) {
                        btnClass += " bg-green-100 border-green-500 text-green-800 shadow-[0_0_15px_rgba(34,197,94,0.3)]";
                      } else if (i === selectedOptionIndex) {
                        btnClass += " bg-red-100 border-red-500 text-red-800 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
                      } else {
                        btnClass += " border-surface-variant opacity-50";
                      }
                    } else {
                      disabled = true;
                      btnClass += " border-surface-variant opacity-50 cursor-not-allowed";
                    }
                    
                    return (
                      <button 
                        key={i} 
                        className={btnClass}
                        disabled={disabled}
                        onClick={() => handleOptionClick(opt, i)}
                      >
                        <div className={`absolute top-sm left-sm font-label-caps w-8 h-8 flex items-center justify-center rounded-lg ${isResult && i === correctOptionIndex ? 'bg-green-500 text-white' : isResult && i === selectedOptionIndex ? 'bg-red-500 text-white' : 'bg-surface-variant text-on-surface-variant'}`}>
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className="font-headline-lg text-headline-lg-mobile text-on-surface text-center w-full block ml-2">
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isMobile && state.value === 'waiting_buzz' && (
                  <div className="flex gap-4 w-full mt-6 z-20">
                    <button
                      onClick={() => handleBuzzTap('team1')}
                      className="flex-1 py-6 bg-primary text-white font-display-force font-black text-lg tracking-wider rounded-xl shadow-lg border-b-[6px] border-green-800 hover:-translate-y-1 active:translate-y-[2px] active:border-b-[2px] transition-all duration-100 flex items-center justify-center"
                    >
                      🟢 ĐỘI 1 ĐẬP
                    </button>
                    <button
                      onClick={() => handleBuzzTap('team2')}
                      className="flex-1 py-6 bg-secondary text-white font-display-force font-black text-lg tracking-wider rounded-xl shadow-lg border-b-[6px] border-blue-800 hover:-translate-y-1 active:translate-y-[2px] active:border-b-[2px] transition-all duration-100 flex items-center justify-center"
                    >
                      🔵 ĐỘI 2 ĐẬP
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          </main>
        )}

        {/* Fiery Progress Bar (Bottom) */}
        {state.value !== 'idle' && (
          <footer className="absolute bottom-0 left-0 right-0 z-40 pb-xl px-xl flex flex-col items-center">
          <div className="w-full max-w-4xl relative h-10 bg-black/40 rounded-full overflow-visible border-4 border-white/20 backdrop-blur-sm flex items-center fiery-progress-glow">
            {/* Green Progress Filling for Team 1 */}
            <div 
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-green-800 via-green-500 to-green-400 rounded-l-full transition-all duration-700 ease-out" 
              style={{ width: `${t1Percent}%`, boxShadow: state.context.score.team1 >= 8 ? '0 0 15px rgba(34,197,94,0.8)' : 'none' }}>
            </div>
            {/* Blue Progress Filling for Team 2 */}
            <div 
              className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-blue-900 via-blue-600 to-blue-400 rounded-r-full transition-all duration-700 ease-out" 
              style={{ width: `${t2Percent}%`, boxShadow: state.context.score.team2 >= 8 ? '0 0 15px rgba(33,112,228,0.8)' : 'none' }}>
            </div>
            
            {/* Centered Marker with Flame Icon */}
            <div 
              className="absolute top-1/2 z-50 transition-all duration-700 ease-out"
              style={{ left: `calc(${t1Percent}%)`, transform: 'translate(-50%, -50%)' }}
            >
              <div className="relative flex items-center justify-center">
                <div className="absolute w-20 h-20 bg-orange-500 rounded-full blur-2xl opacity-60 animate-pulse"></div>
                <div className="w-16 h-16 bg-gradient-to-t from-red-600 to-yellow-400 rounded-full border-4 border-white shadow-2xl flex items-center justify-center flame-icon-glow">
                  <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-between w-full max-w-4xl mt-sm px-md">
            <span className="font-label-caps text-white" style={{textShadow: '0 2px 4px rgba(0,0,0,0.8)'}}>Sức mạnh Đội 1 {state.context.score.team1 >= 8 && '🔥'}</span>
            <span className="font-label-caps text-white" style={{textShadow: '0 2px 4px rgba(0,0,0,0.8)'}}>{state.context.score.team2 >= 8 && '🔥'} Sức mạnh Đội 2</span>
          </div>
        </footer>
        )}
      </div>

      {/* 2. Admin Panel Overlay - MOUNTED OUTSIDE THE 16:9 CANVAS (Native Scale) */}
      {isAdminOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 transition-all duration-300">
          <div className="bg-white rounded-2xl border-2 border-neutral-200 w-full max-w-3xl max-h-[90%] flex flex-col overflow-hidden shadow-2xl text-neutral-900">
            
            {/* Header */}
            <div className="flex justify-between items-center bg-neutral-100 p-4 border-b border-neutral-200">
              <h3 className="font-display font-bold text-lg text-neutral-800 flex items-center gap-2">
                ⚙️ Bảng Điều Khiển Admin
              </h3>
              <button 
                onClick={() => setIsAdminOpen(false)}
                className="text-neutral-500 hover:text-neutral-800 font-bold text-xl px-2"
              >
                &times;
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-neutral-200 bg-neutral-50">
              <button 
                onClick={() => setActiveTab('questions')}
                className={`flex-1 py-2.5 font-display text-sm font-bold border-b-2 transition-all ${activeTab === 'questions' ? 'border-green-600 text-green-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
              >
                Danh sách câu hỏi ({state.context.questions.length})
              </button>
              <button 
                onClick={() => setActiveTab('import')}
                className={`flex-1 py-2.5 font-display text-sm font-bold border-b-2 transition-all ${activeTab === 'import' ? 'border-green-600 text-green-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
              >
                Import / Export JSON
              </button>
              <button 
                onClick={() => setActiveTab('hash')}
                className={`flex-1 py-2.5 font-display text-sm font-bold border-b-2 transition-all ${activeTab === 'hash' ? 'border-green-600 text-green-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
              >
                Tiện ích Tạo Hash
              </button>
            </div>

            {/* Body Content */}
            <div className="flex-1 overflow-y-auto p-6 text-sm">
              
              {/* Tab 1: Questions list & Add Form */}
              {activeTab === 'questions' && (
                <div className="space-y-6">
                  {/* Form to Add Question */}
                  <form onSubmit={handleAddQuestion} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-4">
                    <h4 className="font-display font-bold text-neutral-800">Thêm câu hỏi mới</h4>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-neutral-600">Câu hỏi</label>
                      <input 
                        type="text" 
                        value={newQText} 
                        onChange={e => setNewQText((e.target as HTMLInputElement).value)}
                        placeholder="Nhập câu hỏi..." 
                        className="w-full p-2 border border-neutral-300 rounded bg-white text-neutral-900"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {newQOptions.map((opt, idx) => (
                        <div key={idx} className="space-y-1">
                          <label className="block text-xs font-bold text-neutral-600">Đáp án {String.fromCharCode(65 + idx)}</label>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="radio" 
                              name="correct_option" 
                              checked={newQCorrectIdx === idx}
                              onChange={() => setNewQCorrectIdx(idx)}
                              title="Đánh dấu đây là đáp án ĐÚNG"
                            />
                            <input 
                              type="text" 
                              value={opt} 
                              onChange={e => {
                                const opts = [...newQOptions];
                                opts[idx] = (e.target as HTMLInputElement).value;
                                setNewQOptions(opts);
                              }}
                              placeholder={`Đáp án ${String.fromCharCode(65 + idx)}...`} 
                              className="flex-1 p-2 border border-neutral-300 rounded bg-white text-neutral-900"
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-neutral-600">Salt (tùy chọn - tự sinh nếu bỏ trống)</label>
                        <input 
                          type="text" 
                          value={newQSalt} 
                          onChange={e => setNewQSalt((e.target as HTMLInputElement).value)}
                          placeholder="Chuỗi salt ngẫu nhiên..." 
                          className="w-full p-2 border border-neutral-300 rounded bg-white text-neutral-900"
                        />
                      </div>
                      <div className="flex items-end">
                        <button 
                          type="submit"
                          disabled={isAddingQuestion}
                          className="w-full py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {isAddingQuestion ? 'Đang xử lý...' : '+ Lưu câu hỏi'}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Question List Table */}
                  <div className="space-y-3">
                    <h4 className="font-display font-bold text-neutral-800">Danh sách câu hỏi hiện tại</h4>
                    {state.context.questions.length === 0 ? (
                      <p className="text-neutral-500 italic">Chưa có câu hỏi nào được nạp.</p>
                    ) : (
                      <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white max-h-60 overflow-y-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="bg-neutral-50">
                              <th className="p-3 text-xs font-bold text-neutral-600 border-b border-neutral-200">ID</th>
                              <th className="p-3 text-xs font-bold text-neutral-600 border-b border-neutral-200">Câu hỏi</th>
                              <th className="p-3 text-xs font-bold text-neutral-600 border-b border-neutral-200">Salt</th>
                              <th className="p-3 text-xs font-bold text-neutral-600 border-b border-neutral-200">Hành động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {state.context.questions.map((q, idx) => (
                              <tr key={q.id || idx} className="hover:bg-neutral-50">
                                <td className="p-3 font-mono text-xs border-b border-neutral-200">{q.id}</td>
                                <td className="p-3 border-b border-neutral-200 max-w-xs truncate">{q.question}</td>
                                <td className="p-3 font-mono text-xs text-neutral-500 border-b border-neutral-200">{q.salt || '-'}</td>
                                <td className="p-3 border-b border-neutral-200">
                                  <button 
                                    onClick={() => {
                                      const updated = state.context.questions.filter((_, qIdx) => qIdx !== idx);
                                      send({ type: 'IMPORT_QUESTIONS', questions: updated });
                                    }}
                                    className="text-red-600 hover:text-red-800 font-bold hover:underline"
                                  >
                                    Xóa
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Import / Export */}
              {activeTab === 'import' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Import Zone */}
                    <div className="bg-neutral-50 p-6 rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-center">
                      <p className="font-bold text-neutral-800 mb-2">Tải lên đề thi mới</p>
                      <p className="text-xs text-neutral-500 mb-4">Hỗ trợ file JSON cấu trúc kéo co dưới 500KB</p>
                      
                      <button 
                        onClick={handleSecureImportJSON}
                        disabled={isValidating}
                        className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {isValidating ? 'Đang kiểm tra băm...' : 'Chọn file JSON'}
                      </button>
                    </div>

                    {/* Export Zone */}
                    <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-200 flex flex-col items-center justify-center text-center">
                      <p className="font-bold text-neutral-800 mb-2">Xuất đề thi hiện tại</p>
                      <p className="text-xs text-neutral-500 mb-4">Tải về danh sách câu hỏi hiện tại dưới dạng file JSON</p>
                      
                      <button 
                        onClick={handleExportJSON}
                        disabled={state.context.questions.length === 0}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        Tải file JSON xuống
                      </button>
                    </div>
                  </div>

                  {/* Validation Errors Log */}
                  {validationErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-red-700 text-sm">Phát hiện lỗi định dạng / bảo mật trong file JSON:</p>
                      <ul className="list-disc pl-5 text-xs text-red-600 space-y-1">
                        {validationErrors.map((err, idx) => (
                          <li key={idx}>{err.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Hash Helper */}
              {activeTab === 'hash' && (
                <div className="space-y-4">
                  <p className="text-neutral-600 text-xs">Công cụ tạo mã hóa SHA-256 dùng để viết sẵn câu hỏi trong các trình soạn thảo text bên ngoài.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-neutral-600">Đáp án chính xác</label>
                      <input 
                        type="text" 
                        value={hashInput} 
                        onChange={e => setHashInput((e.target as HTMLInputElement).value)}
                        placeholder="Ví dụ: 4" 
                        className="w-full p-2 border border-neutral-300 rounded bg-white text-neutral-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-neutral-600">Salt</label>
                      <input 
                        type="text" 
                        value={hashSaltInput} 
                        onChange={e => setHashSaltInput((e.target as HTMLInputElement).value)}
                        placeholder="Ví dụ: my-salt" 
                        className="w-full p-2 border border-neutral-300 rounded bg-white text-neutral-900"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={handleGenerateHash}
                      className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition-colors"
                    >
                      Tạo Hash SHA-256
                    </button>
                    <button 
                      onClick={() => {
                        const rand = Math.random().toString(36).substring(2, 10);
                        setHashSaltInput(rand);
                      }}
                      className="px-4 py-2 bg-neutral-200 text-neutral-800 rounded font-bold hover:bg-neutral-300 transition-colors"
                    >
                      Tạo Salt ngẫu nhiên
                    </button>
                  </div>

                  {generatedHash && (
                    <div className="space-y-1 pt-2">
                      <label className="block text-xs font-bold text-neutral-600">Kết quả hash (Copy vào trường "answer_hash"):</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={generatedHash} 
                          className="flex-1 p-2 bg-neutral-100 font-mono text-xs border border-neutral-300 rounded"
                        />
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(generatedHash);
                            alert('Đã copy hash!');
                          }}
                          className="px-3 py-1 bg-neutral-800 text-white rounded text-xs hover:bg-black font-bold"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer Reset button inside Admin Panel */}
            <div className="bg-neutral-50 p-4 border-t border-neutral-200 flex justify-between">
              <button 
                onClick={() => {
                  if (confirm('Bạn có chắc chắn muốn cài lại điểm số về mặc định?')) {
                    send({ type: 'RESET' });
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors text-xs"
              >
                Reset Điểm & Trận Đấu
              </button>
              <button 
                onClick={() => setIsAdminOpen(false)}
                className="px-4 py-2 bg-neutral-800 text-white rounded-lg font-bold hover:bg-neutral-900 transition-colors text-xs"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
