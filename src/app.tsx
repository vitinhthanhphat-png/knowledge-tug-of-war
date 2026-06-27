import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { createActor } from 'xstate';
import { tugOfWarMachine } from './state-machine';
import { verifyAnswer } from './crypto';
import gameBg from './assets/game_background_v3.png';
import avatarTeam1 from './assets/avatar_team1.png';
import avatarTeam2 from './assets/avatar_team2.png';
import victoryTrophy from './assets/victory_trophy.png';
import team1Pulling from './assets/team_green_pulling.png';
import team2Pulling from './assets/team_blue_pulling.png';

import { parseExcelToQuestions } from './excel';
import sndCorrect1 from './assets/sounds/tra-loi-dung-01.mp3';
import sndCorrect2 from './assets/sounds/tra-loi-dung-02.mp3';
import sndCorrect3 from './assets/sounds/tra-loi-dung-03.mp3';
import sndWrong1 from './assets/sounds/thua-01.mp3';
import sndWrong2 from './assets/sounds/thua-02.mp3';
import sndVictory1 from './assets/sounds/chien-thang-01.mp3';
import sndVictory2 from './assets/sounds/chien-thang-02.mp3';
import sndVictory3 from './assets/sounds/chien-thang-03.mp3';

const correctSounds = [sndCorrect1, sndCorrect2, sndCorrect3];
const wrongSounds = [sndWrong1, sndWrong2];
const victorySounds = [sndVictory1, sndVictory2, sndVictory3];

const playRandomCorrectVocal = () => {
    const snd = correctSounds[Math.floor(Math.random() * correctSounds.length)];
    const audio = new Audio(snd);
    audio.play().catch(e => console.log('Audio play failed:', e));
};

const playRandomWrongVocal = () => {
    const snd = wrongSounds[Math.floor(Math.random() * wrongSounds.length)];
    const audio = new Audio(snd);
    audio.play().catch(e => console.log('Audio play failed:', e));
};

const playRandomVictoryVocal = () => {
    const snd = victorySounds[Math.floor(Math.random() * victorySounds.length)];
    const audio = new Audio(snd);
    audio.play().catch(e => console.log('Audio play failed:', e));
};

import confetti from 'canvas-confetti';

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

export let isBgmMuted = false;

let bgmBuffer: AudioBuffer | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmGain: GainNode | null = null;

let inGameBuffer: AudioBuffer | null = null;
let inGameSource: AudioBufferSourceNode | null = null;
let inGameGain: GainNode | null = null;

export const toggleBgmMute = () => {
  isBgmMuted = !isBgmMuted;
  if (bgmGain) {
    bgmGain.gain.value = isBgmMuted ? 0 : 0.4;
  }
  if (inGameGain) {
    inGameGain.gain.value = isBgmMuted ? 0 : 0.4;
  }
};

const resumeAudioContext = (): AudioContext | null => {
  const ctx = initAudio();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch((err) => console.warn('Failed to resume AudioContext:', err));
  }
  return ctx;
};

let isBgmIntendedToPlay = false;
let isInGameIntendedToPlay = false;

let bgmLoadPromise: Promise<AudioBuffer | null> | null = null;
const loadBgmBuffer = async (ctx: AudioContext) => {
  if (bgmBuffer) return bgmBuffer;
  if (bgmLoadPromise) return bgmLoadPromise;
  bgmLoadPromise = (async () => {
    try {
      const response = await fetch('./audio/Three_Seconds_Left.mp3');
      const arrayBuffer = await response.arrayBuffer();
      bgmBuffer = await ctx.decodeAudioData(arrayBuffer);
      return bgmBuffer;
    } catch (err) {
      console.error("Failed to load BGM:", err);
      return null;
    }
  })();
  return bgmLoadPromise;
};

let inGameLoadPromise: Promise<AudioBuffer | null> | null = null;
const loadInGameBuffer = async (ctx: AudioContext) => {
  if (inGameBuffer) return inGameBuffer;
  if (inGameLoadPromise) return inGameLoadPromise;
  inGameLoadPromise = (async () => {
    try {
      const response = await fetch('./audio/Three_Seconds_Remaining.mp3');
      const arrayBuffer = await response.arrayBuffer();
      inGameBuffer = await ctx.decodeAudioData(arrayBuffer);
      return inGameBuffer;
    } catch (err) {
      console.error("Failed to load in-game BGM:", err);
      return null;
    }
  })();
  return inGameLoadPromise;
};

export const stopStartScreenMusic = () => {
  isBgmIntendedToPlay = false;
  if (bgmSource) {
    try { bgmSource.stop(); } catch (e) {}
    bgmSource = null;
  }
};

export const stopInGameMusic = () => {
  isInGameIntendedToPlay = false;
  if (inGameSource) {
    try { inGameSource.stop(); } catch (e) {}
    inGameSource = null;
  }
};

export const playStartScreenMusic = async () => {
  isBgmIntendedToPlay = true;
  if (bgmSource) return; // already playing
  const ctx = initAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => {});
  }
  const buffer = await loadBgmBuffer(ctx);
  if (!buffer) return;

  if (bgmSource || !isBgmIntendedToPlay) return; // check again after async
  bgmGain = ctx.createGain();
  bgmGain.gain.value = isBgmMuted ? 0 : 0.4;
  bgmGain.connect(ctx.destination);

  bgmSource = ctx.createBufferSource();
  bgmSource.buffer = buffer;
  bgmSource.loop = true;
  bgmSource.connect(bgmGain);
  bgmSource.start();
};

export const playInGameMusic = async () => {
  isInGameIntendedToPlay = true;
  if (inGameSource) return; // already playing
  const ctx = initAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => {});
  }
  const buffer = await loadInGameBuffer(ctx);
  if (!buffer) return;

  if (inGameSource || !isInGameIntendedToPlay) return; // check again after async
  inGameGain = ctx.createGain();
  inGameGain.gain.value = isBgmMuted ? 0 : 0.4;
  inGameGain.connect(ctx.destination);

  inGameSource = ctx.createBufferSource();
  inGameSource.buffer = buffer;
  inGameSource.loop = true;
  inGameSource.connect(inGameGain);
  inGameSource.start();
};

const playBuzzSound = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  // A bright "Ding" chime for gaining the right to answer
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'sine';
  
  // Two frequencies for a bell-like chime
  osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
  osc2.frequency.setValueAtTime(1760, ctx.currentTime); // A6
  
  gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + 0.6);
  osc2.stop(ctx.currentTime + 0.6);
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

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + index * 0.1);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + index * 0.1 + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + index * 0.1 + 0.5);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now + index * 0.1);
    osc.stop(now + index * 0.1 + 0.5);
  });
};

const playCrowdBooSound = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  const bufferSize = ctx.sampleRate * 2.0;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(600, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(150, now + 1.5);
  
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.2);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
  
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  
  noiseSource.start(now);
  
  const voices = 5;
  for (let i = 0; i < voices; i++) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = i % 2 === 0 ? 'triangle' : 'sawtooth';
    const baseFreq = 150 + Math.random() * 50;
    
    osc.frequency.setValueAtTime(baseFreq * 1.2, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 1.5);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.1, now + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 1.5);
  }
};

const playWrongSound = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gainNode = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.8);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.8);

  gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.8);
};

const playFireworkSound = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Sharp pop
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1000, now);
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
  
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0, now);
  oscGain.gain.linearRampToValueAtTime(1.0, now + 0.01);
  oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
  
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);

  const bufferSize = Math.floor(ctx.sampleRate * 0.3);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 2; // Increase noise amplitude
  }
  
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1000;
  
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(1.0, now + 0.02);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  
  noiseSource.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  
  noiseSource.start(now);
  noiseSource.stop(now + 0.3);
};

const playVictorySound = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const notes = [
    { freq: 261.63, time: 0, dur: 0.2 },
    { freq: 261.63, time: 0.2, dur: 0.2 },
    { freq: 261.63, time: 0.4, dur: 0.2 },
    { freq: 415.30, time: 0.6, dur: 0.6 },
    { freq: 349.23, time: 1.2, dur: 0.4 },
    { freq: 311.13, time: 1.6, dur: 0.2 },
    { freq: 349.23, time: 1.8, dur: 0.2 },
    { freq: 392.00, time: 2.0, dur: 1.0 },
  ];

  notes.forEach((note) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(note.freq, now + note.time);
    
    gainNode.gain.setValueAtTime(0, now + note.time);
    gainNode.gain.linearRampToValueAtTime(0.2, now + note.time + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + note.time + note.dur);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now + note.time);
    osc.stop(now + note.time + note.dur);
  });

  const bufferSize = ctx.sampleRate * 4.0;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(1000, now);
  noiseFilter.frequency.linearRampToValueAtTime(2000, now + 2);
  
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.4, now + 1);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 4);
  
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  
  noiseSource.start(now);
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


const playWarningBeep = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);

  gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.2);
};

const playTimeoutHorn = () => {
  const ctx = resumeAudioContext();
  if (!ctx) return;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'square';
  
  // Dissonant frequencies for a harsh buzzer sound
  osc1.frequency.setValueAtTime(150, ctx.currentTime);
  osc2.frequency.setValueAtTime(155, ctx.currentTime);

  gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + 0.8);
  osc2.stop(ctx.currentTime + 0.8);
};

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

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

  const [validationError, setValidationError] = useState<string | null>(propValidationError || null);
  const [customDatasets, setCustomDatasets] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('knowledgeTugOfWar_customDatasets');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse customDatasets from localStorage", e);
    }
    return [];
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTopicTab, setActiveTopicTab] = useState<'builtin' | 'custom'>('builtin');
  const [muted, setMuted] = useState(isBgmMuted);

  useEffect(() => {
    try {
      localStorage.setItem('knowledgeTugOfWar_customDatasets', JSON.stringify(customDatasets));
    } catch (e) {
      console.error("Failed to save customDatasets to localStorage", e);
    }
  }, [customDatasets]);

  // Settings Modal States
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<any | null>(null);
  const [gameSettings, setGameSettings] = useState({
    questionCount: 10,
    shuffleQuestions: true,
    shuffleOptions: true,
    buzzTime: 10
  });

  const [builtInDatasets, setBuiltInDatasets] = useState<any[]>([]);
  const [datasetError, setDatasetError] = useState<string | null>(null);

  useEffect(() => {
    fetch('./datasets/index.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => setBuiltInDatasets(data))
      .catch(err => {
        console.error('Failed to fetch built-in datasets:', err);
        setDatasetError('Lỗi tải danh sách bộ đề. Đảm bảo bạn đang chạy web qua HTTP/HTTPS (không mở trực tiếp file html) và thư mục datasets tồn tại.');
      });
  }, []);

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

  // Auto-resume AudioContext on first player interaction (click or keydown)
  useEffect(() => {
    const unlockAudio = () => {
      const ctx = initAudio();
      if (ctx) {
        ctx.resume().then(() => {
          if (ctx.state === 'running') {
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            
            // If unlocked on idle screen, trigger BGM
            if (actor.getSnapshot().value === 'idle') {
              playStartScreenMusic();
            }
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
  }, [actor]);

  // Manage BGM according to state changes
  useEffect(() => {
    if (state.value === 'idle') {
      playStartScreenMusic();
      stopInGameMusic();
    } else if (state.value === 'ended') {
      stopStartScreenMusic();
      stopInGameMusic();
    } else {
      stopStartScreenMusic();
      playInGameMusic();
    }
  }, [state.value]);

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

  // Modal and validation states
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);


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
          playBuzzSound();
          send({ type: 'BUZZ', team: 'team1' });
        }
      } else if (e.code === 'Enter') {
        if (hasBuzzedRef.current) return;
        const elapsed = Date.now() - roundStartTimeRef.current;
        if (elapsed >= 500) {
          hasBuzzedRef.current = true;
          console.log("BUZZ team2");
          playBuzzSound();
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

    return () => clearInterval(interval);
  }, [state.value, send]);

  // Timer interval for waiting_buzz state
  useEffect(() => {
    if (state.value !== 'waiting_buzz') return;

    const interval = setInterval(() => {
      send({ type: 'BUZZ_TIMER_TICK' });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.value, send]);

  // Play audio hooks on key state transitions
  useEffect(() => {
    if (state.value === 'timeout_reveal') {
      playTimeoutHorn();
    }
  }, [state.value]);

  // Play sounds for buzz timer countdown
  useEffect(() => {
    if (state.value === 'waiting_buzz' && state.context.buzzTimer < state.context.baseBuzzTime) {
      const remaining = state.context.buzzTimer;
      if (remaining > 3) {
        playTickSound();
      } else if (remaining > 0 && remaining <= 3) {
        playWarningBeep();
      }
    }
  }, [state.context.buzzTimer, state.value, state.context.baseBuzzTime]);

  // Victory animation and sound
  useEffect(() => {
    if (state.value === 'ended') {
      playVictorySound();
      playRandomVictoryVocal();
      
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      playFireworkSound();

      const interval = setInterval(function() {
        const particleCount = 50;
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: Math.random(), y: Math.random() - 0.2 } }));
      }, 250);
      
      return () => {
        clearInterval(interval);
      };
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
      playBuzzSound();
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
        playRandomCorrectVocal();
      } else {
        playWrongSound();
        playCrowdBooSound();
        playRandomWrongVocal();
      }
      send({ type: 'SUBMIT_ANSWER', isCorrect });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handleExcelImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    input.onchange = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        alert('Kích thước file Excel vượt quá giới hạn cho phép (2MB).');
        return;
      }

      try {
        const questions = await parseExcelToQuestions(file);
        
        const defaultName = file.name.replace(/\.[^/.]+$/, "");
        let customName = window.prompt("Nhập tên chủ đề cho bộ câu hỏi này:", defaultName);
        if (customName === null) {
            // User cancelled
            return;
        }
        customName = customName.trim() || defaultName;

        setCustomDatasets(prev => [...prev, {
            id: `custom_excel_${Date.now()}`,
            name: customName,
            icon: '📊',
            data: questions
        }]);

        // Still import to state so it's ready, but don't auto-start
        send({ type: 'IMPORT_QUESTIONS', questions });
        setValidationError(null);
        alert('Tải đề thi Excel thành công! Vui lòng chọn chủ đề vừa tạo trong danh sách.');

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setValidationError(errorMsg);
        send({ type: 'IMPORT_QUESTIONS', questions: SAFE_DEFAULT_QUESTIONS });
        host.dispatchEvent(new CustomEvent('questions-invalid', {
          detail: { error: errorMsg },
          bubbles: true,
          composed: true
        }));
        alert(`Lỗi khi tải file Excel: ${errorMsg}`);
      }
    };
    input.click();
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

      {/* Global Controls */}
      <div className="absolute top-6 right-6 z-[100] flex flex-col items-center gap-3">
        <button
          onClick={() => {
            toggleBgmMute();
            setMuted(isBgmMuted);
          }}
          className="w-12 h-12 flex items-center justify-center bg-black/40 text-white rounded-full hover:bg-black/60 backdrop-blur-md transition-all border border-white/20 shadow-lg pointer-events-auto"
          title={muted ? "Bật âm thanh" : "Tắt âm thanh"}
        >
          <span className="material-symbols-outlined text-[26px]">
            {muted ? 'volume_off' : 'volume_up'}
          </span>
        </button>
        
        <button 
          onClick={() => {
            if (confirm('Bạn có chắc chắn muốn cài lại điểm số về mặc định?')) {
              send({ type: 'RESET' });
            }
          }}
          title="Cài lại điểm số (Reset)"
          className="w-10 h-10 flex items-center justify-center bg-neutral-800/80 text-white rounded-full hover:bg-neutral-900 transition-colors backdrop-blur-md border border-white/20 shadow-lg pointer-events-auto"
        >
          <span className="material-symbols-outlined text-[20px]">refresh</span>
        </button>
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
        className={`aspect-video transition-all duration-300 overflow-visible z-10 ${isMobile ? '' : ''}`}
      >

        {/* Center Fire Effect */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-orange-500 rounded-full fire-glow mix-blend-screen pointer-events-none z-10 origin-center"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-yellow-300 rounded-full fire-glow mix-blend-screen pointer-events-none z-10 origin-center" style={{ animationDelay: '0.5s' }}></div>

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
              <div className={`relative rounded-[16px] p-[4px] overflow-hidden transition-all duration-300 ${state.context.activeTeam === 'team1' ? 'shadow-[0_0_40px_rgba(34,197,94,0.8)] scale-110 z-50' : state.context.activeTeam ? 'shadow-sm opacity-60 scale-95 grayscale-[50%]' : 'shadow-md opacity-100 scale-100'}`}>
                {state.context.activeTeam === 'team1' && (
                  <div className="absolute inset-[-150%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg,transparent_0_70%,#22c55e_100%)] z-0" />
                )}
                <div className={`glass-panel px-lg py-md rounded-xl border-2 ${state.context.activeTeam === 'team1' ? 'border-primary-container/0 glow-pulse bg-green-100/95' : state.context.activeTeam ? 'border-surface-dim fade-inactive bg-white/60' : 'border-surface-dim bg-white/95'} flex flex-col items-center gap-xs relative z-10 w-full h-full`}>
                  <img src={avatarTeam1} alt="Team 1" className="w-[80px] h-[80px] object-contain drop-shadow-[0_0_15px_rgba(34,197,94,0.6)] mix-blend-multiply" />
                  <span className="font-headline-lg text-headline-lg text-primary">Đội 1 (Trái)</span>
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                    <span className="font-body-lg font-bold text-on-surface whitespace-nowrap">
                      Lực kéo: <span className="text-3xl font-black text-primary drop-shadow-sm mx-1">{state.context.score.team1 * 10}</span> Lực
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleBuzzTap('team1')}
                disabled={state.value !== 'waiting_buzz'}
                className={`px-xl py-sm rounded-2xl transition-all mt-4 border-2 pointer-events-auto group flex items-center justify-center gap-2 ${
                  state.value === 'waiting_buzz'
                    ? 'bg-primary text-white border-white/20 shadow-[0_6px_0_#15803d,0_10px_20px_rgba(0,0,0,0.4)] hover:-translate-y-1 hover:shadow-[0_8px_0_#15803d,0_15px_25px_rgba(0,0,0,0.5)] active:translate-y-[6px] active:shadow-[0_0px_0_#15803d,0_5px_10px_rgba(0,0,0,0.4)]'
                    : 'bg-neutral-400 text-neutral-100 border-neutral-500 shadow-none opacity-80 cursor-not-allowed translate-y-[6px]'
                }`}
              >
                {state.value !== 'waiting_buzz' && <span className="material-symbols-outlined text-[24px]">lock</span>}
                <span className={`font-display-force font-black text-2xl uppercase tracking-widest ${state.value === 'waiting_buzz' ? 'drop-shadow-md group-active:drop-shadow-none' : ''}`}>SPACE</span>
              </button>
              
              <div className="mt-8 animate-pull-left transform origin-bottom flex justify-center w-full pointer-events-none relative -left-12 md:-left-20 lg:-left-28 xl:-left-32">
                <img src={team1Pulling} alt="Team 1 Pulling" className="w-[640px] max-w-none object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]" />
              </div>
            </div>

            {/* Center Title & Timer */}
            <div className="flex flex-col items-center justify-start gap-4">
              <div className="flex flex-col items-center justify-center glass-panel px-xl py-sm rounded-full shadow-lg bg-white/90">
                <h1 className="font-display-force text-headline-lg text-primary uppercase tracking-tighter">Knowledge Tug of War</h1>
                <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-variant/80 px-md py-xs rounded-full mt-1">Vòng {state.context.currentQuestionIndex + 1} / {state.context.questions.length}</span>
              </div>

              {state.value === 'waiting_buzz' && state.context.baseBuzzTime > 0 && (
                <div className="relative mt-2 z-40 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                  <div className="relative w-32 h-32 flex items-center justify-center bg-black/40 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.6)] border border-white/20 backdrop-blur-md">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                      <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="transparent" />
                      <circle 
                        cx="64" cy="64" r="56" 
                        stroke={state.context.buzzTimer <= 3 ? '#ef4444' : '#3b82f6'} 
                        strokeWidth="8" fill="transparent" 
                        strokeDasharray="351.9" 
                        strokeDashoffset={351.9 - (351.9 * state.context.buzzTimer) / state.context.baseBuzzTime} 
                        className="transition-all duration-1000 ease-linear drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" 
                      />
                    </svg>
                    <span className={`absolute font-display-force font-black text-6xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] ${state.context.buzzTimer <= 3 ? 'text-red-500 animate-ping' : 'text-white'}`}>
                      {state.context.buzzTimer}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Team 2 (Right) */}
            <div className="flex flex-col items-end gap-sm">
              <div className={`relative rounded-[16px] p-[4px] overflow-hidden transition-all duration-300 ${state.context.activeTeam === 'team2' ? 'shadow-[0_0_40px_rgba(249,115,22,0.8)] scale-110 z-50' : state.context.activeTeam ? 'shadow-sm opacity-60 scale-95 grayscale-[50%]' : 'shadow-md opacity-100 scale-100'}`}>
                {state.context.activeTeam === 'team2' && (
                  <div className="absolute inset-[-150%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg,transparent_0_70%,#f97316_100%)] z-0" />
                )}
                <div className={`glass-panel px-lg py-md rounded-xl border-2 ${state.context.activeTeam === 'team2' ? 'border-secondary-container/0 glow-pulse bg-orange-100/95' : state.context.activeTeam ? 'border-surface-dim fade-inactive bg-white/60' : 'border-surface-dim bg-white/95'} flex flex-col items-center gap-xs relative z-10 w-full h-full`}>
                  <img src={avatarTeam2} alt="Team 2" className="w-[80px] h-[80px] object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.6)] mix-blend-multiply" />
                  <span className="font-headline-lg text-headline-lg text-secondary">Đội 2 (Phải)</span>
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                    <span className="font-body-lg font-bold text-on-surface whitespace-nowrap">
                      Lực kéo: <span className="text-3xl font-black text-secondary drop-shadow-sm mx-1">{state.context.score.team2 * 10}</span> Lực
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleBuzzTap('team2')}
                disabled={state.value !== 'waiting_buzz'}
                className={`px-xl py-sm rounded-2xl transition-all mt-4 border-2 pointer-events-auto group flex items-center justify-center gap-2 ${
                  state.value === 'waiting_buzz'
                    ? 'bg-secondary text-white border-white/20 shadow-[0_6px_0_#c2410c,0_10px_20px_rgba(0,0,0,0.4)] hover:-translate-y-1 hover:shadow-[0_8px_0_#c2410c,0_15px_25px_rgba(0,0,0,0.5)] active:translate-y-[6px] active:shadow-[0_0px_0_#c2410c,0_5px_10px_rgba(0,0,0,0.4)]'
                    : 'bg-neutral-400 text-neutral-100 border-neutral-500 shadow-none opacity-80 cursor-not-allowed translate-y-[6px]'
                }`}
              >
                {state.value !== 'waiting_buzz' && <span className="material-symbols-outlined text-[24px]">lock</span>}
                <span className={`font-display-force font-black text-2xl uppercase tracking-widest ${state.value === 'waiting_buzz' ? 'drop-shadow-md group-active:drop-shadow-none' : ''}`}>ENTER</span>
              </button>

              <div className="mt-8 animate-pull-right transform origin-bottom flex justify-center w-full pointer-events-none relative -right-12 md:-right-20 lg:-right-28 xl:-right-32">
                <img src={team2Pulling} alt="Team 2 Pulling" className="w-[640px] max-w-none object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] -scale-x-100" />
              </div>
            </div>
          </header>
        )}

        {/* Main Arena (Center) */}
        {state.value !== 'idle' && (
          <main className="absolute inset-0 z-40 flex items-center justify-center px-lg pointer-events-none">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-px h-[40%] border-l-2 border-dashed border-white/30"></div>
            
            <div className="glass-panel p-lg rounded-2xl shadow-2xl border border-white/50 max-w-4xl w-full flex flex-col items-center gap-md bg-white/90 pointer-events-auto max-h-[85vh] overflow-y-auto">
              {state.value === 'ended' ? (
                 <div className="flex flex-col items-center text-center w-full">
                   <div className="relative flex justify-center items-center">
                     <div className="absolute w-[200px] h-[200px] bg-yellow-400 rounded-full blur-[60px] opacity-80 animate-pulse"></div>
                     <img src={victoryTrophy} alt="Trophy" className="w-[180px] h-[180px] object-contain drop-shadow-[0_0_30px_rgba(250,204,21,1)] mix-blend-multiply mb-4 relative z-10 animate-bounce" />
                   </div>
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
                
                {(state.value === 'result' || state.value === 'timeout_reveal') && (
                   <div className="font-headline-lg font-bold text-sm tracking-widest uppercase flex flex-col items-center gap-2 my-2 text-center w-full relative z-50">
                      {state.value === 'timeout_reveal' ? (
                        <span className="text-red-600 bg-red-100 px-4 py-2 rounded-lg border border-red-300 relative z-50">
                          ⏰ HẾT GIỜ! KHÔNG ĐỘI NÀO GIÀNH QUYỀN TRẢ LỜI
                        </span>
                      ) : state.context.lastResult === 'correct' ? (
                        <span className="text-green-600 relative z-50">
                          🎉 ĐỘI {state.context.activeTeam === 'team1' ? '1' : '2'} TRẢ LỜI ĐÚNG! (+1 điểm / Đối thủ -1)
                        </span>
                      ) : state.context.lastResult === 'incorrect' ? (
                        <span className="text-red-600 relative z-50">
                          ❌ ĐỘI {state.context.activeTeam === 'team1' ? '1' : '2'} TRẢ LỜI SAI! (-1 điểm / Đối thủ +1)
                        </span>
                      ) : (
                        <span className="text-red-600 relative z-50">
                          ⏰ HẾT GIỜ TRẢ LỜI! Đội {state.context.activeTeam === 'team1' ? '1' : '2'} bị phạt (-1 điểm / Đối thủ +1)
                        </span>
                      )}
                      <button
                        onClick={() => send({ type: 'NEXT_QUESTION' })}
                        className="mt-2 px-6 py-2 bg-neutral-800 text-white hover:bg-black rounded-lg shadow-md uppercase tracking-wider font-bold transition-all hover:scale-105 active:scale-95 pointer-events-auto relative z-50"
                      >
                        Câu Tiếp theo &rarr;
                      </button>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-md w-full mt-4">
                  {(currentQuestion?.options || []).map((opt, i) => {
                    const isAnswering = state.value === 'answering';
                    const isResult = state.value === 'result';
                    const isTimeoutReveal = state.value === 'timeout_reveal';
                    
                    let btnClass = "answer-btn relative p-lg rounded-xl border-2 flex items-center justify-center group bg-surface/90 backdrop-blur-sm transition-all duration-200 min-h-[80px]";
                    let disabled = true;
                    
                    if (isAnswering) {
                      disabled = isSubmitting;
                      btnClass += " border-surface-variant hover:border-primary hover:bg-white cursor-pointer hover:-translate-y-1 shadow-sm";
                    } else if (isResult || isTimeoutReveal) {
                      disabled = true;
                      if (i === correctOptionIndex) {
                        btnClass += " bg-green-100 border-green-500 text-green-800 shadow-[0_0_15px_rgba(34,197,94,0.3)]";
                      } else if (isResult && i === selectedOptionIndex) {
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
                        <div className={`absolute top-sm left-sm font-label-caps w-8 h-8 flex items-center justify-center rounded-lg ${(isResult || isTimeoutReveal) && i === correctOptionIndex ? 'bg-green-500 text-white' : isResult && i === selectedOptionIndex ? 'bg-red-500 text-white' : 'bg-surface-variant text-on-surface-variant'}`}>
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

        {/* ----------------- Settings Modal ----------------- */}
      {isSettingsModalOpen && selectedDataset && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-6 transition-all duration-300">
          <div className="bg-white rounded-2xl border-2 border-neutral-200 w-full max-w-lg shadow-2xl text-neutral-900 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center bg-neutral-100 p-4 border-b border-neutral-200">
              <h3 className="font-display font-bold text-xl text-neutral-800 flex items-center gap-2">
                ⚙️ Tùy chỉnh trò chơi
              </h3>
              <button 
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  setIsTopicModalOpen(true);
                }}
                className="text-neutral-500 hover:text-neutral-800 font-bold text-2xl px-2 leading-none"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-bold text-blue-900 mb-1">Chủ đề: {selectedDataset.name}</p>
                <p className="text-sm text-blue-700">Tổng số câu hỏi: {selectedDataset.data.length}</p>
              </div>

              {/* Number of Questions Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-neutral-700">Số lượng câu hỏi tham gia:</label>
                  <span className="font-bold text-lg text-blue-600">{gameSettings.questionCount}</span>
                </div>
                <input 
                  type="range" 
                  min={Math.min(10, selectedDataset.data.length)} 
                  max={selectedDataset.data.length} 
                  value={gameSettings.questionCount}
                  onChange={(e) => setGameSettings(prev => ({...prev, questionCount: parseInt((e.target as HTMLInputElement).value)}))}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-neutral-500 font-medium">
                  <span>{Math.min(10, selectedDataset.data.length)}</span>
                  <span>{selectedDataset.data.length}</span>
                </div>
              </div>

              {/* Buzz Timer Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-neutral-700">Thời gian giành quyền (giây):</label>
                  <span className="font-bold text-lg text-orange-600">{gameSettings.buzzTime}s</span>
                </div>
                <input 
                  type="range" 
                  min={3} 
                  max={30} 
                  value={gameSettings.buzzTime}
                  onChange={(e) => setGameSettings(prev => ({...prev, buzzTime: parseInt((e.target as HTMLInputElement).value)}))}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-neutral-500 font-medium">
                  <span>3s</span>
                  <span>30s</span>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-4">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <div className="font-bold text-neutral-700 group-hover:text-blue-600 transition-colors">Trộn thứ tự câu hỏi</div>
                    <div className="text-xs text-neutral-500">Các câu hỏi sẽ xuất hiện ngẫu nhiên</div>
                  </div>
                  <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${gameSettings.shuffleQuestions ? 'bg-blue-600' : 'bg-neutral-300'}`}>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={gameSettings.shuffleQuestions} 
                      onChange={(e) => setGameSettings(prev => ({...prev, shuffleQuestions: (e.target as HTMLInputElement).checked}))} 
                    />
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${gameSettings.shuffleQuestions ? 'translate-x-6' : ''}`}></div>
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <div className="font-bold text-neutral-700 group-hover:text-blue-600 transition-colors">Trộn vị trí đáp án (A,B,C,D)</div>
                    <div className="text-xs text-neutral-500">Hoán đổi ngẫu nhiên các lựa chọn trong mỗi câu</div>
                  </div>
                  <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${gameSettings.shuffleOptions ? 'bg-blue-600' : 'bg-neutral-300'}`}>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={gameSettings.shuffleOptions} 
                      onChange={(e) => setGameSettings(prev => ({...prev, shuffleOptions: (e.target as HTMLInputElement).checked}))} 
                    />
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${gameSettings.shuffleOptions ? 'translate-x-6' : ''}`}></div>
                  </div>
                </label>
              </div>

              <button 
                onClick={() => {
                  let finalQuestions = [...selectedDataset.data] as Question[];
                  if (gameSettings.shuffleQuestions) {
                    finalQuestions = shuffleArray(finalQuestions);
                  }
                  
                  finalQuestions = finalQuestions.slice(0, gameSettings.questionCount);
                  
                  if (gameSettings.shuffleOptions) {
                    finalQuestions = finalQuestions.map(q => ({
                      ...q,
                      options: shuffleArray(q.options)
                    }));
                  }

                  send({ type: 'IMPORT_QUESTIONS', questions: finalQuestions });
                  setIsSettingsModalOpen(false);
                  send({ type: 'START_GAME', buzzTime: gameSettings.buzzTime });
                }}
                className="mt-4 w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold font-display text-xl uppercase tracking-wider shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                Bắt đầu Chiến! 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Screen (Idle State) - MOUNTED OUTSIDE THE 16:9 CANVAS */}
        {state.value === 'idle' && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md overflow-hidden">
            
            {/* Background Rope for Tug of War effect */}
            <div className="absolute bottom-[20%] md:bottom-[25%] left-0 right-0 h-4 bg-gradient-to-r from-green-500 via-orange-500 to-blue-500 opacity-20 shadow-[0_0_15px_rgba(255,255,255,0.1)]"></div>
            
            {/* Team 1 Character */}
            <div className="absolute bottom-[-5%] left-[-5%] md:left-5 lg:left-20 animate-pull-left z-0 opacity-90 hover:opacity-100 transition-opacity pointer-events-none">
               <img src="./team_green_pulling.png?v=13" alt="Team 1" className="h-[250px] md:h-[400px] lg:h-[550px] object-contain drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]" />
            </div>

            {/* Team 2 Character */}
            <div className="absolute bottom-[-5%] right-[-5%] md:right-5 lg:right-20 animate-pull-right z-0 opacity-90 hover:opacity-100 transition-opacity pointer-events-none">
               <img src="./team_blue_pulling.png?v=13" alt="Team 2" className="h-[250px] md:h-[400px] lg:h-[550px] object-contain drop-shadow-[0_0_20px_rgba(33,112,228,0.5)] scale-x-[-1]" />
            </div>

            {/* Foreground Content */}
            <div className="z-10 flex flex-col items-center justify-center w-full h-full pb-10">
              <h1 className="font-display-force text-6xl md:text-8xl text-white uppercase tracking-tighter mb-4 text-center px-4 animate-glow animate-float">
                Knowledge Tug of War
              </h1>
              <p className="text-white/80 font-body-md text-xl md:text-2xl mb-12 font-bold tracking-widest text-center px-4">CUỘC CHIẾN TRI THỨC ĐỈNH CAO</p>
              
              <div className="flex flex-col gap-6 items-center">
                <div className="animate-urgent-heartbeat">
                  <button 
                    onClick={() => setIsTopicModalOpen(true)}
                    className="px-14 py-6 bg-gradient-to-b from-green-400 to-green-600 text-white rounded-xl font-black font-display-force text-4xl tracking-widest shadow-[0_10px_0_rgb(20,83,45),0_20px_30px_rgba(0,0,0,0.5)] border-2 border-green-300 active:shadow-[0_0px_0_rgb(20,83,45),0_0px_0_rgba(0,0,0,0.5)] active:translate-y-[10px] hover:brightness-110 transition-all duration-100 uppercase"
                  >
                    BẮT ĐẦU CHƠI
                  </button>
                </div>
                
                <div className="flex gap-4 mt-6">
                  <button 
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => {});
                      } else {
                        document.exitFullscreen().catch(() => {});
                      }
                    }}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white rounded-lg font-bold font-body-md transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined">fullscreen</span>
                    FULLSCREEN
                  </button>
                  <button 
                    onClick={() => setIsRulesModalOpen(true)}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white rounded-lg font-bold font-body-md transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined">menu_book</span>
                    HƯỚNG DẪN
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* 2. Topic Selection Modal - MOUNTED OUTSIDE THE 16:9 CANVAS */}
      {isTopicModalOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-6 transition-all duration-300">
          <div className="bg-white rounded-lg border-2 border-neutral-200 w-full max-w-4xl max-h-[90%] flex flex-col overflow-hidden shadow-2xl text-neutral-900">
            {/* Header */}
            <div className="flex flex-col bg-neutral-100 p-4 border-b border-neutral-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display font-bold text-xl text-neutral-800 flex items-center gap-2">
                  📚 Chọn Chủ Đề
                </h3>
                <div className="flex items-center gap-4">
                  <a 
                    href="./template_dautruongkienthuc.xlsx" 
                    download
                    className="text-sm font-semibold text-neutral-500 underline hover:text-neutral-700"
                  >
                    Tải file mẫu
                  </a>
                  <button
                    onClick={() => handleExcelImport()}
                    className="px-4 py-2 bg-green-100 text-green-700 border border-green-300 rounded-md hover:bg-green-600 hover:text-white transition-colors font-bold text-sm flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">upload_file</span>
                    Tải lên Excel
                  </button>
                  <button 
                    onClick={() => setIsTopicModalOpen(false)}
                    className="text-neutral-500 hover:text-neutral-800 font-bold text-2xl px-2 leading-none ml-2"
                  >
                    &times;
                  </button>
                </div>
              </div>
              <div className="w-full relative mt-4 px-2">
                 <div className="absolute inset-y-0 left-2 w-10 flex items-center justify-center pointer-events-none">
                    <span className="material-symbols-outlined text-neutral-400 text-[22px]">search</span>
                 </div>
                 <input
                    type="text"
                    placeholder="Tìm kiếm bộ đề..."
                    value={searchQuery}
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white text-neutral-900 rounded-md border border-neutral-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-body-md shadow-sm"
                 />
              </div>

              {/* Tabs */}
              <div className="flex gap-6 mt-6 px-2">
                <button
                  className={`pb-3 font-bold text-sm transition-colors relative flex items-center gap-2 ${activeTopicTab === 'builtin' ? 'text-blue-600' : 'text-neutral-500 hover:text-neutral-700'}`}
                  onClick={() => setActiveTopicTab('builtin')}
                >
                  <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                  BỘ ĐỀ HỆ THỐNG
                  {activeTopicTab === 'builtin' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-lg"></div>}
                </button>
                <button
                  className={`pb-3 font-bold text-sm transition-colors relative flex items-center gap-2 ${activeTopicTab === 'custom' ? 'text-green-600' : 'text-neutral-500 hover:text-neutral-700'}`}
                  onClick={() => setActiveTopicTab('custom')}
                >
                  <span className="material-symbols-outlined text-[18px]">folder_special</span>
                  BỘ ĐỀ CỦA BẠN {customDatasets.length > 0 && `(${customDatasets.length})`}
                  {activeTopicTab === 'custom' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-600 rounded-t-lg"></div>}
                </button>
              </div>
            </div>
            {/* Body Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-neutral-50/50">
              {datasetError && (
                <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-center font-bold">
                  ⚠️ {datasetError}
                </div>
              )}
              <div className="flex flex-col gap-3">
                
                {/* Built-in Datasets */}
                {activeTopicTab === 'builtin' && (
                  <>
                    {builtInDatasets.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())).map(dataset => (
                      <div
                        key={dataset.id}
                        className="flex items-center justify-between p-4 bg-white border border-neutral-200 rounded-md hover:border-blue-300 hover:shadow-md transition-all group"
                      >
                        <div 
                           className="flex items-center gap-4 flex-1 cursor-pointer"
                           onClick={() => {
                              if (!dataset.data) {
                                fetch(`./datasets/${dataset.file}`)
                                  .then(res => res.json())
                                  .then(data => {
                                    const fullDataset = { ...dataset, data };
                                    setSelectedDataset(fullDataset);
                                    setGameSettings({
                                      questionCount: data.length,
                                      shuffleQuestions: true,
                                      shuffleOptions: true,
                                      buzzTime: 10
                                    });
                                    setIsSettingsModalOpen(true);
                                    setIsTopicModalOpen(false);
                                  })
                                  .catch(() => alert("Không thể tải bộ đề này!"));
                              } else {
                                setSelectedDataset(dataset);
                                setGameSettings({
                                  questionCount: dataset.data.length,
                                  shuffleQuestions: true,
                                  shuffleOptions: true,
                                  buzzTime: 10
                                });
                                setIsSettingsModalOpen(true);
                                setIsTopicModalOpen(false);
                              }
                           }}
                        >
                           <div className="w-12 h-12 flex items-center justify-center bg-blue-50 text-blue-500 rounded-lg text-2xl group-hover:scale-110 transition-transform">
                              {(dataset as any).icon || '📘'}
                           </div>
                           <div>
                              <h5 className="font-bold text-lg text-neutral-800 group-hover:text-blue-600 transition-colors">{dataset.name}</h5>
                              <p className="text-sm text-neutral-500">{dataset.description || (dataset.data ? `${dataset.data.length} câu hỏi` : '')}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2 pl-4 border-l border-neutral-100">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!dataset.data) {
                                  fetch(`./datasets/${dataset.file}`)
                                    .then(res => res.json())
                                    .then(data => {
                                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `${dataset.name}.json`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    })
                                    .catch(() => alert("Không thể tải file!"));
                                } else {
                                  const blob = new Blob([JSON.stringify(dataset.data, null, 2)], { type: 'application/json' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${dataset.name}.json`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }
                              }}
                              className="px-4 py-2 bg-neutral-50 text-neutral-600 rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-2 text-sm font-semibold"
                              title="Tải xuống file JSON"
                            >
                              <span className="material-symbols-outlined text-[18px]">download</span>
                              Tải JSON
                            </button>
                        </div>
                      </div>
                    ))}
                    {builtInDatasets.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                        <p className="text-neutral-400 text-center py-4 italic">Không tìm thấy bộ đề phù hợp.</p>
                    )}
                  </>
                )}

                {/* Custom Datasets (Only show if exists) */}
                {activeTopicTab === 'custom' && (
                  <>
                      {customDatasets.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())).map(dataset => (
                        <div
                          key={dataset.id}
                          className="flex items-center justify-between p-4 bg-white border border-green-200 rounded-md hover:border-green-400 hover:shadow-md transition-all group"
                        >
                          <div 
                             className="flex items-center gap-4 flex-1 cursor-pointer"
                             onClick={() => {
                                setSelectedDataset(dataset);
                                setGameSettings({
                                  questionCount: dataset.data.length,
                                  shuffleQuestions: true,
                                  shuffleOptions: true,
                                  buzzTime: 10
                                });
                                setIsSettingsModalOpen(true);
                                setIsTopicModalOpen(false);
                             }}
                          >
                             <div className="w-12 h-12 flex items-center justify-center bg-green-50 text-green-500 rounded-lg text-2xl group-hover:scale-110 transition-transform">
                                {(dataset as any).icon || '📊'}
                             </div>
                             <div>
                                <h5 className="font-bold text-lg text-neutral-800 group-hover:text-green-600 transition-colors">{dataset.name}</h5>
                                <p className="text-sm text-neutral-500">{dataset.data ? `${dataset.data.length} câu hỏi` : ''}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-2 pl-4 border-l border-neutral-100">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const blob = new Blob([JSON.stringify(dataset.data, null, 2)], { type: 'application/json' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${dataset.name}.json`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="px-4 py-2 bg-neutral-50 text-neutral-600 rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-2 text-sm font-semibold"
                                title="Tải xuống file JSON"
                              >
                                <span className="material-symbols-outlined text-[18px]">download</span>
                                Tải JSON
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Bạn có chắc chắn muốn xoá bộ đề "${dataset.name}" không?`)) {
                                    setCustomDatasets(prev => prev.filter(d => d.id !== dataset.id));
                                  }
                                }}
                                className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                                title="Xoá bộ đề này"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                          </div>
                        </div>
                      ))}
                      {customDatasets.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 text-neutral-400">
                             <span className="material-symbols-outlined text-4xl mb-2 opacity-50">folder_off</span>
                             <p className="italic">Chưa có bộ đề nào của riêng bạn.</p>
                             <button
                               onClick={() => handleExcelImport()}
                               className="mt-4 px-4 py-2 text-sm font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition-colors"
                             >
                               + Tải lên ngay
                             </button>
                          </div>
                      )}
                  </>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Game Rules Modal - MOUNTED OUTSIDE THE 16:9 CANVAS */}
      {isRulesModalOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-6 transition-all duration-300">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative max-h-[90vh] flex flex-col border border-white/20">
            <h2 className="text-2xl font-black mb-6 text-center font-display-force uppercase text-green-700 tracking-wider">
              Luật Chơi (Game Rules)
            </h2>
            
            <div className="text-left space-y-4 overflow-y-auto p-2 font-body-md text-neutral-700 flex-1">
              <div className="bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm">
                <h3 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined">flag</span>
                  Mục tiêu (Objective)
                </h3>
                <p>Trả lời đúng câu hỏi để kéo cờ về phía đội mình. Đội nào kéo cờ qua vạch chiến thắng trước sẽ giành phần thắng.</p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
                <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined">touch_app</span>
                  Cách trả lời (How to Answer)
                </h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Đọc kỹ câu hỏi hiển thị trên màn hình.</li>
                  <li>Chọn đáp án đúng từ các lựa chọn có sẵn.</li>
                </ul>
              </div>

              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 shadow-sm">
                <h3 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined">swap_horiz</span>
                  Cơ chế Kéo Co (Mechanics)
                </h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong className="text-green-600">Trả lời đúng:</strong> Cộng điểm cho đội, kéo cờ về phía đội mình một nhịp.</li>
                  <li><strong className="text-red-600">Trả lời sai:</strong> Không kéo được dây, tạo cơ hội cho đội bạn phản công.</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm">
                <h3 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined">emoji_events</span>
                  Điều kiện thắng (Winning)
                </h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Trò chơi kết thúc khi một đội kéo cờ hoàn toàn về phía mình (điểm tuyệt đối).</li>
                  <li>Nếu hết câu hỏi mà chưa bên nào kéo được về đích: đội có cờ nằm nghiêng về phía mình nhiều hơn sẽ thắng (hoặc <strong>Hòa</strong> nếu cờ ở giữa).</li>
                </ul>
              </div>
            </div>

            <button 
              className="mt-6 w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition font-black uppercase shadow-[0_5px_0_rgb(20,83,45)] active:shadow-[0_0px_0_rgb(20,83,45)] active:translate-y-[5px] text-lg tracking-widest"
              onClick={() => setIsRulesModalOpen(false)}
            >
              Đã Hiểu (Close)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
