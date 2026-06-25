# Project: Knowledge Tug of War Web Component

## Architecture
The application is structured as a self-contained Custom HTML Element (Web Component) wrapper enclosing a Preact reactive app. 
- State management: Managed by XState v5 (Finite State Machine).
- Styles: Shadow DOM encapsulation using Vite cssCodeSplit disabled or manually injecting bundled CSS as a style tag into the custom element's shadow root.
- Inter-module communication:
  - FSM controls state transitions and updates context.
  - Event listeners capture player inputs (Space / Enter) with strict event prevention (`e.preventDefault()`).
  - Web Crypto API validates answers by hashing user answers and comparing them with SHA-256 hashes loaded from JSON configuration.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Project Initialization & Build System Setup | Setup Vite + Preact + Tailwind CSS, configure Custom Element bundle, verify shadow DOM CSS bundling. | None | DONE |
| M2 | State Machine Logic (XState FSM) | Build FSM with states: idle, waiting_buzz, answering, result, ended. Keyboard event handlers with Space/Enter race protection. | M1 | DONE |
| M3 | Local Storage & Web Crypto API | Implement JSON Import/Export with FileReader/Blob. Answer verification with Web Crypto SHA-256 + salt. | M1 | DONE |
| M4 | Core Game UI, CSS Animations & Audio | Style with Kinetic Academy theme. Responsive 16:9 scale. Pull rope visualization, glow effects, fire bar, and sound hooks. | M2, M3 | DONE |
| M5 | Web Component Bundling & Hardening | Final bundling (`npm run build`), HTML page test integration, adversarial tests (input spamming, incorrect schema inputs). | M4 | DONE |

## Interface Contracts
### Web Component Definition
- Tag Name: `<knowledge-tug-of-war>`
- Attributes:
  - `theme`: default "kinetic-academy"
  - `default-questions`: JSON string (optional fallback question set)

### JSON Question Format
```json
[
  {
    "id": "q1",
    "question": "What is 2 + 2?",
    "options": ["3", "4", "5", "6"],
    "answer_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", // SHA-256 hash of (correct_option + salt)
    "salt": "optional-salt-if-stored-per-question"
  }
]
```

### State Machine Context
```typescript
interface TugOfWarContext {
  questions: Question[];
  currentQuestionIndex: number;
  timer: number;
  score: { team1: number; team2: number };
  activeTeam: 'team1' | 'team2' | null;
  buzzWinner: 'team1' | 'team2' | null;
  importError: string | null;
}
```

## Code Layout
The target repository should be configured as:
- `src/`
  - `main.tsx` - Custom element entry and mounting point
  - `app.tsx` - Root Preact component
  - `state-machine.ts` - XState FSM definition
  - `crypto.ts` - Web Crypto API utility helper
  - `components/` - Sub-components (Arena, AdminPanel, HUD, ProgressBar)
  - `styles/` - Tailwind configuration and input CSS
  - `assets/` - Image/Audio assets (e.g. background image)
- `tailwind.config.js`
- `vite.config.ts`
- `package.json`
