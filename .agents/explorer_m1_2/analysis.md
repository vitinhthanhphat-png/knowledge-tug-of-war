# Analysis: Vite + Preact + Tailwind CSS Web Component Setup

## Executive Summary
This analysis details the setup and configuration of a self-contained, single-file Web Component (`<knowledge-tug-of-war>`) using Vite, Preact, Tailwind CSS, and XState. We establish a robust system to encapsulate Tailwind CSS styles inside the Shadow DOM using Vite's inline CSS injection and provide the complete configuration templates ready for implementation.

---

## 1. Requirement & Style Alignment

By reviewing `PROJECT.md`, `brandkit.md`, and the "Fiery Bar Edition" `code.html`, we map the design requirements to the implementation:
1. **Aspect Ratio Enforcement**: The layout enforces a strict 16:9 aspect ratio (`aspect-16-9-wrapper`) and scales responsively to the screen bounds. Since it's mounted inside a Custom Element, the host element container should be styled to hold and resize the component safely.
2. **Kinetic Academy Brand colors**: Team 1 (Left) uses Primary Vibrant Green (`#22c55e`), Team 2 (Right) uses Secondary Bold Blue (`#2170e4`) or Tertiary Bold Red (`#b91a24`). The Action highlighting uses Cam lửa (`#f97316`) and Accent Glow (`#22c55e` / `#4ae176`).
3. **Typography**: Titles and display scores use **Space Grotesk** for a mechanical/technical feel, while body text and questions use **Plus Jakarta Sans** for readability.
4. **UX Psychology Application**:
   - *Fitts' Law*: Large touch-target answer buttons (A, B, C, D) and offset mechanical keys (Space/Enter) ensure quick reaction times.
   - *Goal Gradient Effect*: The bottom prominent "Fiery Progress Bar" with central flame marker acts as a visceral momentum goal indicator for players.
   - *Doherty Threshold*: Custom element wraps shadow root directly; CSS transitions and glows (such as `.glow-pulse` and `.flame-icon-glow`) will trigger under <100ms.

---

## 2. Proposed Directory Layout

For Milestone 1, we establish a clean layout separating styles, assets, components, and configurations:

```text
knowledge-tug-of-war/
├── dist/                          # Production build output folder
│   ├── knowledge-tug-of-war.js    # Single-file bundled custom element
│   └── demo.html                  # Local demo testing the production bundle
├── src/
│   ├── assets/                    # Static assets
│   │   └── game_background.png    # Background image (inlined as base64)
│   ├── components/                # Modular Preact components
│   │   ├── AdminPanel.tsx         # JSON Import/Export and settings panel
│   │   ├── Arena.tsx              # Midfield tug-of-war rope and visual
│   │   ├── HUD.tsx                # Scores, team status, round counts, and buzz indicators
│   │   └── ProgressBar.tsx        # Central fiery rope progress bar
│   ├── styles/
│   │   └── index.css              # Tailwind CSS directives + custom classes
│   ├── app.tsx                    # Root Preact component holding global state/FSM
│   ├── crypto.ts                  # Web Crypto SHA-256 validation helpers
│   ├── main.tsx                   # Custom Element entry and mounting point
│   ├── state-machine.ts           # XState FSM configuration
│   └── vite-env.d.ts              # TypeScript module declarations for ?inline imports
├── index.html                     # Vite development entry point
├── package.json                   # Build dependencies and scripts
├── postcss.config.js              # PostCSS tailwind configuration
├── tailwind.config.js             # Tailwind CSS configuration mapping design guidelines
├── tsconfig.json                  # TypeScript compilation rules
└── vite.config.ts                 # Vite bundle configuration
```

---

## 3. Shadow DOM CSS Encapsulation (Vite Inline CSS Injection)

To ensure the Custom Element is styled correctly without bleeding out to the parent page or letting parent styles bleed in, we utilize Shadow DOM encapsulation.

### The Bundling Problem & Solution
Standard CSS injection (e.g. inserting styles into the host `<head>`) fails because elements inside a Shadow Root are isolated from external styles.
- **Solution (Vite `?inline` imports)**: We use Vite's built-in inline loader to import the compiled CSS as a raw string:
  ```typescript
  import tailwindStyles from './styles/index.css?inline';
  ```
- **Injection Mechanism**: When the Custom Element mounts (`connectedCallback`), we create a `<style>` tag, set its content to `tailwindStyles`, and append it directly into the `shadowRoot`. This scopes all Tailwind classes exclusively to our custom element.
- **External Asset Loading (Fonts)**: Since font files cannot be easily inlined without inflating the JS size significantly, we dynamically inject `<link>` preconnect and stylesheet tags for Google Fonts (`Space Grotesk`, `Plus Jakarta Sans`) and Material Symbols directly into the host document `<head>` during `connectedCallback`.

---

## 4. Configuration Files

### `package.json`
```json
{
  "name": "knowledge-tug-of-war",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "preact": "^10.22.0",
    "xstate": "^5.18.2",
    "@xstate/preact": "^4.0.0"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.8.2",
    "typescript": "^5.4.5",
    "vite": "^5.3.1",
    "tailwindcss": "^3.4.4",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "terser": "^5.31.1"
  }
}
```

### `vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  build: {
    // Force assets (images, sound effects) under 1MB to inline as Base64.
    // This guarantees a single-file distribution bundle.
    assetsInlineLimit: 1000000,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/main.tsx'),
      name: 'KnowledgeTugOfWar',
      formats: ['iife'], // immediately invoked function expression for browser script inclusion
      fileName: () => 'knowledge-tug-of-war.js',
    },
    rollupOptions: {
      external: [],
      output: {
        assetFileNames: '[name].[ext]',
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
```

### `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme Colors matching stitch_knowledge_tug_of_war/kinetic_academy/DESIGN.md
        "surface": '#f9f9ff',
        "surface-dim": '#cfdaf2',
        "surface-bright": '#f9f9ff',
        "surface-container-lowest": '#ffffff',
        "surface-container-low": '#f0f3ff',
        "surface-container": '#e7eeff',
        "surface-container-high": '#dee8ff',
        "surface-container-highest": '#d8e3fb',
        "on-surface": '#111c2d',
        "on-surface-variant": '#3d4a3d',
        "inverse-surface": '#263143',
        "inverse-on-surface": '#ecf1ff',
        "outline": '#6d7b6c',
        "outline-variant": '#bccbb9',
        "surface-tint": '#006e2f',
        "primary": '#006e2f',
        "on-primary": '#ffffff',
        "primary-container": '#22c55e',
        "on-primary-container": '#004b1e',
        "inverse-primary": '#4ae176',
        "secondary": '#0058be',
        "on-secondary": '#ffffff',
        "secondary-container": '#2170e4',
        "on-secondary-container": '#fefcff',
        "tertiary": '#b91a24',
        "on-tertiary": '#ffffff',
        "tertiary-container": '#ff8a83',
        "on-tertiary-container": '#860011',
        "error": '#ba1a1a',
        "on-error": '#ffffff',
        "error-container": '#ffdad6',
        "on-error-container": '#93000a',
        "primary-fixed": '#6bff8f',
        "primary-fixed-dim": '#4ae176',
        "on-primary-fixed": '#002109',
        "on-primary-fixed-variant": '#005321',
        "secondary-fixed": '#d8e2ff',
        "secondary-fixed-dim": '#adc6ff',
        "on-secondary-fixed": '#001a42',
        "on-secondary-fixed-variant": '#004395',
        "tertiary-fixed": '#ffdad7',
        "tertiary-fixed-dim": '#ffb3ad',
        "on-tertiary-fixed": '#410004',
        "on-tertiary-fixed-variant": '#930013',
        "background": '#f9f9ff',
        "on-background": '#111c2d',
        "surface-variant": '#d8e3fb',
      },
      borderRadius: {
        "sm": "0.25rem",
        "DEFAULT": "0.5rem",
        "md": "0.75rem",
        "lg": "1rem",
        "xl": "1.5rem",
        "full": "9999px"
      },
      spacing: {
        "unit": "4px",
        "xs": "4px",
        "sm": "8px",
        "md": "16px",
        "lg": "24px",
        "xl": "48px",
        "meter-height": "32px",
        "container-max": "1200px"
      },
      fontFamily: {
        "display-force": ["'Space Grotesk'", "sans-serif"],
        "headline-lg": ["'Plus Jakarta Sans'", "sans-serif"],
        "headline-lg-mobile": ["'Plus Jakarta Sans'", "sans-serif"],
        "body-md": ["'Plus Jakarta Sans'", "sans-serif"],
        "label-caps": ["'Space Grotesk'", "sans-serif"],
        "key-hint": ["'Space Grotesk'", "sans-serif"],
      },
    },
  },
  plugins: [],
}
```

### `index.html` (Vite Local Development Entry)
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Knowledge Tug of War (Local Dev)</title>
  </head>
  <body class="bg-slate-900 text-white min-h-screen flex items-center justify-center m-0">
    <div class="w-full max-w-[1200px] border-2 border-slate-700 rounded-xl overflow-hidden shadow-2xl bg-black">
      <!-- Instantiate custom element for dev -->
      <knowledge-tug-of-war theme="kinetic-academy"></knowledge-tug-of-war>
    </div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `dist/demo.html` (Production Script Tag Test Page)
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Knowledge Tug of War (Production Test)</title>
    <!-- Include the single bundle file -->
    <script src="./knowledge-tug-of-war.js"></script>
    <style>
      body {
        margin: 0;
        background-color: #0f172a;
        color: #f8fafc;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .wrapper {
        width: 100%;
        max-width: 1200px;
        box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5);
        border-radius: 12px;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <knowledge-tug-of-war theme="kinetic-academy"></knowledge-tug-of-war>
    </div>
  </body>
</html>
```

### `postcss.config.js`
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### `src/vite-env.d.ts`
```typescript
/// <reference types="vite/client" />

declare module '*?inline' {
  const content: string;
  export default content;
}
```

---

## 5. Draft Custom Element Wrapper Code (`src/main.tsx`)

This is the mounting script that encapsulates the Preact application in the Shadow DOM and feeds reactive properties:

```typescript
import { render } from 'preact';
import { App } from './app';
import tailwindStyles from './styles/index.css?inline';

const FONT_LINKS = [
  { id: 'google-preconnect-1', rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { id: 'google-preconnect-2', rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
  {
    id: 'ktow-fonts',
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Space+Grotesk:wght@300..700&display=swap',
  },
  {
    id: 'ktow-icons',
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
  },
];

function injectRequiredFonts() {
  if (document.getElementById('ktow-fonts')) return;
  const fragment = document.createDocumentFragment();
  FONT_LINKS.forEach((font) => {
    const link = document.createElement('link');
    link.id = font.id;
    link.rel = font.rel;
    link.href = font.href;
    if (font.crossorigin !== undefined) {
      link.setAttribute('crossorigin', font.crossorigin);
    }
    fragment.appendChild(link);
  });
  document.head.appendChild(fragment);
}

class KnowledgeTugOfWarElement extends HTMLElement {
  private mountPoint: HTMLDivElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['theme', 'default-questions'];
  }

  connectedCallback() {
    injectRequiredFonts();

    // Attach Tailwind CSS in Shadow DOM
    const styleTag = document.createElement('style');
    styleTag.textContent = tailwindStyles;
    this.shadowRoot!.appendChild(styleTag);

    // Create wrapper root
    this.mountPoint = document.createElement('div');
    this.mountPoint.id = 'ktow-app-mount';
    this.mountPoint.style.width = '100%';
    this.mountPoint.style.height = '100%';
    this.shadowRoot!.appendChild(this.mountPoint);

    this.renderApp();
  }

  attributeChangedCallback() {
    this.renderApp();
  }

  disconnectedCallback() {
    if (this.mountPoint) {
      render(null, this.mountPoint);
      this.mountPoint = null;
    }
  }

  private renderApp() {
    if (!this.mountPoint) return;
    const theme = this.getAttribute('theme') || 'kinetic-academy';
    const defaultQuestions = this.getAttribute('default-questions') || '';

    render(
      <App theme={theme} defaultQuestions={defaultQuestions} />,
      this.mountPoint
    );
  }
}

const TAG_NAME = 'knowledge-tug-of-war';
if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, KnowledgeTugOfWarElement);
}
```

---

## 6. Preact Initial App component (`src/app.tsx`)

```typescript
import { useState } from 'preact/hooks';

interface AppProps {
  theme: string;
  defaultQuestions: string;
}

export function App({ theme, defaultQuestions }: AppProps) {
  const [clickCount, setClickCount] = useState(0);

  return (
    <div className={`aspect-16-9-wrapper bg-surface text-on-background relative overflow-hidden flex flex-col items-center justify-center p-lg ${theme}`}>
      {/* 3D Glassmorphism Panel */}
      <div className="glass-panel p-xl rounded-2xl border border-white/40 max-w-lg w-full text-center z-10 flex flex-col gap-md items-center shadow-2xl">
        <h1 className="font-display-force text-headline-lg text-primary tracking-tighter uppercase">
          Kéo Co Kiến Thức
        </h1>
        <p className="font-body-md text-on-surface-variant max-w-sm">
          Vite + Preact + Tailwind CSS Shadow DOM Web Component initialized. Theme: <span className="font-bold text-secondary">{theme}</span>
        </p>
        
        {/* Interactive mechanical key test */}
        <button 
          onClick={() => setClickCount(c => c + 1)}
          className="mechanical-key bg-primary text-white font-key-hint uppercase tracking-wider px-lg py-md rounded-lg shadow-lg border-b-4 border-primary-fixed-dim hover:brightness-110 active:scale-95 transition-all"
        >
          Tapped {clickCount} Times
        </button>

        {/* Dynamic Fire Progress Bar indicator */}
        <div className="w-full relative h-6 bg-black/20 rounded-full mt-md overflow-hidden border border-white/20">
          <div className="absolute left-0 top-0 bottom-0 bg-primary-container" style={{ width: '50%' }}></div>
          <div className="absolute right-0 top-0 bottom-0 bg-secondary-container" style={{ width: '50%' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center border-2 border-white flame-icon-glow">
            <span className="material-symbols-outlined text-white text-md">local_fire_department</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Tailwind Base Styles sheet (`src/styles/index.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom design styles copied from stitch_knowledge_tug_of_war */
.aspect-16-9-wrapper {
  aspect-ratio: 16 / 9;
  width: 100%;
  max-width: 100vw;
  max-height: 100vh;
  margin: auto;
  position: relative;
  overflow: hidden;
}

.accent_glow {
  box-shadow: 0 0 12px var(--color-primary-container);
  border-color: var(--color-primary-container);
}
.glow-pulse {
  animation: pulseGlow 1s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes pulseGlow {
  from { box-shadow: 0 0 10px #22c55e, inset 0 0 4px #22c55e; border-color: #22c55e; }
  to { box-shadow: 0 0 30px #4ae176, inset 0 0 12px #4ae176; border-color: #4ae176; }
}

.fire-glow {
  animation: firePulse 2s infinite alternate;
}
@keyframes firePulse {
  0% { opacity: 0.6; transform: scale(1) translate(-50%, -50%); filter: blur(60px); }
  50% { opacity: 0.8; transform: scale(1.1) translate(-45%, -45%); filter: blur(70px); }
  100% { opacity: 0.5; transform: scale(0.95) translate(-52%, -48%); filter: blur(50px); }
}

.fiery-progress-glow {
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.6), inset 0 0 10px rgba(239, 68, 68, 0.4);
}

.mechanical-key {
  border-bottom-width: 4px;
  transform: translateY(0);
  transition: all 0.1s ease;
}
.mechanical-key:active {
  border-bottom-width: 0px;
  transform: translateY(4px);
}

.answer-btn {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.answer-btn:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.glass-panel {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.fade-inactive {
  opacity: 0.6;
  filter: grayscale(20%);
}

.flame-icon-glow {
  filter: drop-shadow(0 0 8px #f97316) drop-shadow(0 0 16px #ef4444);
  animation: flameFlicker 0.2s infinite alternate;
}
@keyframes flameFlicker {
  from { transform: scale(1); }
  to { transform: scale(1.05); }
}
