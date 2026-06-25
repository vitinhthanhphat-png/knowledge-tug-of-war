# Handoff Report - Milestone 4: Audio Synthesizers via Web Audio API

## 1. Observation

- **Audio Placeholders in `src/app.tsx`**:
  Lines 191-196 in `src/app.tsx` define empty audio hook placeholders that print to the console instead of playing sounds:
  ```typescript
  // Audio hook placeholders
  const playBuzzSound = () => console.log('Audio: Buzz sound');
  const playTickSound = () => console.log('Audio: Tick sound');
  const playCorrectSound = () => console.log('Audio: Correct sound');
  const playWrongSound = () => console.log('Audio: Wrong sound');
  const playPullRopeSound = () => console.log('Audio: Pull rope sound');
  ```
- **Trigger Points for Audio Effects**:
  - `playTickSound()`: Triggered every 1 second during the `answering` state (Timer Tick interval, line 367).
  - `playBuzzSound()`: Triggered on transition into the `answering` state (someone buzzed in, line 378).
  - `playPullRopeSound()`: Triggered when team scores change (line 389).
  - `playCorrectSound()`: Triggered inside `handleOptionClick` when answer validation returns true (line 405).
  - `playWrongSound()`: Triggered inside `handleOptionClick` when answer validation returns false (line 407).
- **TypeScript & Environment Constraints**:
  - `package.json` specifies `"typescript": "^5.4.5"` with `"strict": true` (as verified in `tsconfig.json`).
  - No external packages are loaded for audio playback. Audio must be fully generated programmatically and dynamically using standard browser native `AudioContext` and web audio nodes.

---

## 2. Logic Chain

1. **AudioContext Support**: `AudioContext` and `webkitAudioContext` are native to all modern browsers (Chrome, Firefox, Safari, Edge). Checking `window.AudioContext || (window as any).webkitAudioContext` ensures broad support and graceful degradation (fail-safe) if the browser environment lacks Web Audio support (e.g. server-side rendering or isolated sandbox).
2. **Addressing Browser Autoplay Policy**:
   - Modern browsers block the `AudioContext` until a user gesture (such as `click` or `keydown`) happens.
   - If the context is created on page load, its state remains `suspended`.
   - To resolve this, we implement a lazy initialization helper `initAudio()` and a helper `resumeAudioContext()` that invokes `ctx.resume()` during user events.
   - Because state transitions in XState run reactively, the `useEffect` that plays sounds might execute in a microtask *outside* the synchronous call stack of the user gesture. To guarantee the `AudioContext` is unlocked, we add a temporary window listener (`click` and `keydown`) that executes `ctx.resume()` synchronously inside the user's initial interaction, then detaches itself once `ctx.state` is `'running'`.
3. **Sound Synthesizer Designs**:
   - **Buzz (retro arcade buzz)**: A lowpass-filtered sawtooth wave sweep from 160 Hz down to 90 Hz over 0.4 seconds. The sawtooth wave provides the classic retro arcade buzzy quality, while the lowpass filter cuts harsh high-frequency noise.
   - **Tick (woodblock click)**: A pure sine wave at 1200 Hz with a very rapid pitch decay to 600 Hz in 0.05 seconds, combined with an exponential gain decay (total duration 0.08 seconds). This simulates the wood block strike.
   - **Correct (upward major-chord chime)**: A series of four notes forming a C major chord (C5, E5, G5, C6) scheduled sequentially with a 0.08-second delay between notes. Using a triangle wave provides a warm 8-bit game console chime timbre.
   - **Wrong (descending thud/buzz)**: A low-pitched sawtooth sweep from 120 Hz down to 60 Hz over 0.5 seconds, processed through a lowpass filter sweeping down to 100 Hz. This yields a disappointing, heavy thud.
   - **Pull Rope (swooshing friction)**: A 0.4-second procedural white noise buffer generated programmatically. This noise is routed through a bandpass filter with a sharp frequency sweep (300 Hz -> 1000 Hz -> 400 Hz) and an amplitude envelope to simulate the wind swoosh/friction of a rope pull.

---

## 3. Caveats

- **Autoplay strictness on mobile WebView**: In some mobile app webviews, user gestures do not bubble up or require explicit button bindings. However, window-level bubbling listeners are highly compatible with standard browser configurations.
- **Node Garbage Collection**: Web Audio API nodes (Oscillators, BufferSources, GainNodes) are automatically cleaned up by the browser's garbage collector once they finish playing, so they do not leak memory.
- **TypeScript strict checking**: Using type assertion `(window as any).webkitAudioContext` is necessary to bypass compiler errors under `strict: true`.

---

## 4. Conclusion

We propose the following complete, self-contained, and compiler-compliant code blocks to replace the placeholder functions and hook the autoplay unlocker into `src/app.tsx`.

### Propose Replacement for lines 191-196 in `src/app.tsx`

```typescript
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
```

### Propose Insertion inside the `App` component body (right after line 199)

```typescript
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
```

---

## 5. Verification Method

1. **Static Analysis & Build Verification**:
   - Run compilation check using `npm run build` or `tsc --noEmit` inside the `knowledge-tug-of-war` workspace to confirm there are no syntax errors or unresolved symbols.
2. **Behavioral Testing**:
   - Serve the application in browser and interact with the elements.
   - Click anywhere on the screen or press the Space/Enter keys to verify that the `AudioContext` initializes and transitions to the `'running'` state without throwing errors.
   - Buzz in (e.g. press Space) and check that a low-pass sawtooth buzz plays.
   - Allow the countdown to tick down and check that the short woodblock wood click plays.
   - Submit a correct answer to hear the upward chime, and an incorrect one to hear the heavy buzz/thud.
   - Force a score change in the pull rope game to verify the swoosh/friction sound plays.
