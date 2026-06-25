# Milestone 1 Architectural Analysis: Project Setup & Custom Element Bundling

This document provides a comprehensive blueprint for setting up the **Knowledge Tug of War** web component using Vite, Preact, and Tailwind CSS. The design focuses on compiling the entire application (logic, view, and scoped styles) into a single, self-contained JavaScript bundle, rendering as the `<knowledge-tug-of-war>` custom element.

---

## 1. Requirements Synthesis & Scope

Based on the review of the project specification documents (`PROJECT.md`, `brandkit.md`, `DESIGN.md`, and `prd_project.md`), the core constraints for Milestone 1 are:

1. **Self-Contained Bundle**: The build output must be a single, lightweight `.js` file, containing all markup (Preact), state-machine logic (XState), utility classes (Crypto), assets (fonts/base64 inline resources), and CSS styles.
2. **Encapsulated Styles**: The component must use the Shadow DOM (`{ mode: 'open' }`) to guarantee style isolation. Tailwind CSS rules must be fully scoped to the element and must not pollute the global styles of host pages (WordPress, Next.js, etc.) or be affected by them.
3. **No External Stylesheet Links**: The widget cannot rely on a separate `<link rel="stylesheet">` tag loaded on the host page. CSS must be programmatically injected into the Shadow DOM.
4. **Branding Alignment**: The styling structure must support the Kinetic Academy brand guidelines (Playful 3D/Claymorphism, Glassmorphic surfaces, green/blue team split, Space Grotesk display fonts, and Plus Jakarta Sans body fonts).

---

## 2. Directory Layout & File Structure

For Milestone 1 and onwards, the `knowledge-tug-of-war` directory should follow this clean structure:

```text
knowledge-tug-of-war/
├── dist/                          # Build output directory
│   └── knowledge-tug-of-war.js    # Compiled single-file Web Component
├── public/                        # Static assets (copy to dist but won't be used if inlined)
├── src/
│   ├── assets/                    # Local images/audio files (under inline asset limit)
│   ├── components/                # Modular Preact components
│   │   ├── AdminPanel.tsx         # Question importing/exporting controls
│   │   ├── Arena.tsx              # Central tug-of-war rope & answer layout
│   │   ├── HUD.tsx                # Scores, team keys (Space/Enter), and timer display
│   │   └── ProgressBar.tsx        # Dynamic split progress bar with central glow ribbon
│   │   └── ui/                    # Reusable Tailwind 3D tactile elements
│   ├── styles/
│   │   └── tailwind.css           # Tailwind base style entry
│   ├── app.tsx                    # Root Preact application component
│   ├── crypto.ts                  # Web Crypto SHA-256 validation helper
│   ├── main.tsx                   # Web Component Custom Element entry & mounting point
│   ├── state-machine.ts           # XState v5 Finite State Machine configuration
│   └── vite-env.d.ts              # Vite types (e.g. *.css?inline)
├── index.html                     # Dev-mode test environment (harness)
├── package.json                   # Project dependencies and run scripts
├── postcss.config.js              # PostCSS configuration for Tailwind
├── tailwind.config.js             # Tailwind CSS tokens & content configuration
├── tsconfig.json                  # TypeScript compiler settings
└── vite.config.ts                 # Custom Vite library build configurations
```

---

## 3. Shadow DOM CSS Encapsulation Strategy

The primary challenge of combining Tailwind CSS with Shadow DOM is that Tailwind relies on global stylesheets, whereas Shadow DOM isolates styles. 

### The Solution: Vite `?inline` Style Injection
1. **Compilation**: Vite's PostCSS plugin processes `src/styles/tailwind.css` using the rules in `tailwind.config.js` to compile the final set of Tailwind utility classes.
2. **Inlining**: By appending the `?inline` query suffix to the CSS import statement (e.g., `import styles from './styles/tailwind.css?inline'`), Vite is instructed to compile the CSS file and return its output as a raw JavaScript string rather than generating an external file or inserting a `<style>` tag into the host page's `<head>`.
3. **Shadow DOM Injection**: In our custom element wrapper class (`src/main.tsx`), we create a `<style>` element, assign the imported CSS string to its `textContent`, and append it to the Shadow Root. Since this style tag resides inside the Shadow DOM, the browser automatically limits its scope to the Custom Element's boundaries.

```
+-------------------------------------------------------------------------+
| Vite Build Pipeline                                                     |
| tailwind.css --> Tailwind/PostCSS Parser --> Inlined CSS String         |
+-------------------------------------------------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------------+
| Web Component Shadow Root (DOM)                                         |
|  +-------------------------------------------------------------------+  |
|  | <style>                                                           |  |
|  |   /* Encapsulated Tailwind CSS Rules */                            |  |
|  | </style>                                                          |  |
|  |                                                                   |  |
|  | <div id="app-root">                                               |  |
|  |   <!-- Preact Render Tree -->                                     |  |
|  | </div>                                                            |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 4. Configuration Boilerplates & Environment Files

### `package.json`
Specifies Preact, XState v5, and standard Vite-Tailwind development tooling.

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
    "xstate": "^5.18.2"
  },
  "devDependencies": {
    "@preact/preset-vite": "^4.9.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.5",
    "vite": "^5.3.1"
  }
}
```

### `vite.config.ts`
Configures Vite to build the project as a library with an Immediately Invoked Function Expression (IIFE) output, forcing all components, CSS, and resources into a single file.

```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    // Disable CSS code splitting so that no standalone CSS files are written
    cssCodeSplit: false,
    
    // Set a very high inline threshold so that all audio/image assets are packed into the bundle as base64 URLs
    assetsInlineLimit: 100000000, 
    
    sourcemap: false,
    
    // Target Library output
    lib: {
      entry: 'src/main.tsx',
      name: 'KnowledgeTugOfWar',
      formats: ['iife'],
      fileName: () => 'knowledge-tug-of-war.js',
    },
    
    rollupOptions: {
      external: [], // Force bundling of all dependencies (Preact, XState)
      output: {
        extend: true
      }
    }
  },
  resolve: {
    alias: {
      // Alias React to Preact for compatibility with external components if needed
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    }
  }
});
```

### `tailwind.config.js`
Tailwind theme styling tokens designed to enforce the Kinetic Academy brand guidelines.

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kinetic: {
          surface: '#f9f9ff',
          surfaceDim: '#cfdaf2',
          surfaceBright: '#f9f9ff',
          onSurface: '#111c2d',
          primary: '#006e2f',
          primaryContainer: '#22c55e',       // Team 1 Green
          onPrimaryContainer: '#004b1e',
          secondary: '#0058be',
          secondaryContainer: '#2170e4',     // Team 2 Blue
          tertiary: '#b91a24',               // Team 2 Red (Alternate)
          accentGlow: '#f97316',             // Interactive Fire/Countdown orange
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'sans-serif']
      },
      borderRadius: {
        lg: '1rem',
        xl: '1.5rem',
      }
    },
  },
  plugins: [],
}
```

### `postcss.config.js`
Standard configuration file directing PostCSS to process Tailwind rules.

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### `src/styles/tailwind.css`
Appends Google Font definitions at the root before compiling utilities.

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=Space+Grotesk:wght@300..700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Additional Scoped Classes */
.glassmorphism-surface {
  background: rgba(249, 249, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

### `src/vite-env.d.ts`
Enables module type-checking for raw CSS string imports.

```typescript
/// <reference types="vite/client" />

declare module '*?inline' {
  const content: string;
  export default content;
}
```

---

## 5. Component Setup & Mounting Wrapper

### `src/main.tsx` (Custom Element Mount Wrapper)
Defines the standard custom element wrapper class. This handles initial state creation, attribute mapping (`theme`, `default-questions`), Shadow Root compilation, and garbage collection when the element is removed.

```tsx
import { render } from 'preact';
import App from './app';
import styles from './styles/tailwind.css?inline';

class KnowledgeTugOfWarElement extends HTMLElement {
  private mountPoint: HTMLDivElement | null = null;

  static get observedAttributes() {
    return ['theme', 'default-questions'];
  }

  constructor() {
    super();
    // Attach the Shadow DOM to encapsulate markup and style
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // 1. Inject compiled scoped styles into the Shadow DOM
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    this.shadowRoot!.appendChild(styleEl);

    // 2. Setup mount point for the Preact app
    this.mountPoint = document.createElement('div');
    this.mountPoint.setAttribute('id', 'app-root');
    this.mountPoint.className = 'w-full h-full';
    this.shadowRoot!.appendChild(this.mountPoint);

    // 3. Render the Preact component
    this.renderApp();
  }

  disconnectedCallback() {
    // Unmount to avoid memory leaks when component is destroyed
    if (this.mountPoint) {
      render(null, this.mountPoint);
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue && this.mountPoint) {
      this.renderApp();
    }
  }

  private renderApp() {
    if (!this.mountPoint) return;

    const theme = this.getAttribute('theme') || 'kinetic-academy';
    const defaultQuestionsRaw = this.getAttribute('default-questions');
    let defaultQuestions = [];

    if (defaultQuestionsRaw) {
      try {
        defaultQuestions = JSON.parse(defaultQuestionsRaw);
      } catch (e) {
        console.error('Failed to parse default-questions attribute JSON:', e);
      }
    }

    render(
      <App 
        theme={theme} 
        defaultQuestions={defaultQuestions} 
      />, 
      this.mountPoint
    );
  }
}

if (!customElements.get('knowledge-tug-of-war')) {
  customElements.define('knowledge-tug-of-war', KnowledgeTugOfWarElement);
}
```

### `src/app.tsx` (Preact Base Layout Draft)
A skeletal implementation structure mapping out the layout zones (HUD, Arena, Progress bar, footer actions) in compliance with the design requirements.

```tsx
import { useState } from 'preact/hooks';

interface Question {
  id: string;
  question: string;
  options: string[];
  answer_hash: string;
  salt?: string;
}

interface AppProps {
  theme: string;
  defaultQuestions: Question[];
}

export default function App({ theme, defaultQuestions }: AppProps) {
  const [questions] = useState<Question[]>(defaultQuestions);

  return (
    <div className="w-full h-full min-h-[500px] flex flex-col justify-between bg-kinetic-surface text-kinetic-onSurface font-body select-none p-6 rounded-xl border-2 border-kinetic-surfaceDim glassmorphism-surface box-border">
      
      {/* 1. HUD Area (Scores & Player Hotkeys) */}
      <header className="flex justify-between items-center w-full border-b-2 border-kinetic-surfaceDim pb-4">
        <div className="flex flex-col items-start">
          <span className="text-xs text-kinetic-primary font-display font-extrabold tracking-widest uppercase">TEAM 1 (SPACE)</span>
          <span className="text-3xl font-display font-bold text-kinetic-primaryContainer mt-1">0</span>
        </div>
        
        <div className="flex flex-col items-center">
          <span className="font-display font-bold text-kinetic-accentGlow px-4 py-1.5 bg-kinetic-surfaceDim rounded-full text-sm tracking-widest">ROUND 1</span>
        </div>
        
        <div className="flex flex-col items-end">
          <span className="text-xs text-kinetic-secondary font-display font-extrabold tracking-widest uppercase">TEAM 2 (ENTER)</span>
          <span className="text-3xl font-display font-bold text-kinetic-secondaryContainer mt-1">0</span>
        </div>
      </header>

      {/* 2. Main Game Arena (Question Box & Answer Grid) */}
      <main className="flex-1 flex flex-col justify-center items-center my-6">
        <div className="text-center w-full max-w-2xl">
          <div className="bg-white p-6 rounded-lg border-2 border-kinetic-surfaceDim mb-6">
            <h2 className="text-xl font-body font-bold m-0 leading-normal">
              {questions.length > 0 
                ? questions[0].question 
                : "Vui lòng Import đề thi JSON để bắt đầu chơi Kéo Co Kiến Thức!"
              }
            </h2>
          </div>
          
          {/* Options Grid (Answers Disabled in WAITING_BUZZ State) */}
          <div className="grid grid-cols-2 gap-4 w-full">
            {(questions[0]?.options || ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"]).map((opt, i) => (
              <button 
                key={i} 
                className="p-5 border-2 border-kinetic-surfaceDim rounded-lg font-body font-bold text-base bg-white hover:-translate-y-0.5 transition-transform duration-200 cursor-not-allowed opacity-50 text-left relative overflow-hidden"
                disabled
              >
                <span className="text-xs uppercase bg-kinetic-surfaceDim text-kinetic-onSurface px-2 py-0.5 rounded mr-3">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* 3. Tug of War Visual Element (Dynamic split bar with central ribbon mark) */}
      <div className="w-full my-4">
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-xs font-bold text-kinetic-primary">Lực Kéo Đội 1</span>
          <span className="text-xs font-bold text-kinetic-secondary">Lực Kéo Đội 2</span>
        </div>
        <div className="w-full bg-kinetic-surfaceDim h-8 rounded-full overflow-hidden relative border-2 border-kinetic-surfaceDim box-border">
          {/* Central Tension Marker Ribbon */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-kinetic-accentGlow rotate-45 z-10 animate-pulse"></div>
          {/* Strength Bar Indicator */}
          <div className="w-full h-full flex">
            {/* Dynamic width applied via style or state */}
            <div className="w-1/2 bg-kinetic-primaryContainer transition-all duration-500 ease-out border-r border-white"></div>
            <div className="w-1/2 bg-kinetic-secondaryContainer transition-all duration-500 ease-out"></div>
          </div>
        </div>
      </div>

      {/* 4. Controls Dashboard (JSON Operations & Theme indicator) */}
      <footer className="flex justify-between items-center text-xs border-t-2 border-kinetic-surfaceDim pt-4">
        <span className="font-display font-extrabold tracking-wider text-kinetic-onSurface">THEME: {theme.toUpperCase()}</span>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-kinetic-primary text-white rounded-lg font-bold font-display tracking-wider hover:-translate-y-0.5 transition-transform duration-150">
            IMPORT JSON
          </button>
          <button className="px-4 py-2 bg-kinetic-secondary text-white rounded-lg font-bold font-display tracking-wider hover:-translate-y-0.5 transition-transform duration-150">
            EXPORT JSON
          </button>
        </div>
      </footer>
    </div>
  );
}
```

### `index.html` (Test Harness File)
Loads our custom element entry module for zero-compilation local testing inside a standard HTML structure.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Knowledge Tug of War - Web Component Test harness</title>
  <style>
    body {
      background-color: #ecf1ff;
      margin: 0;
      padding: 40px;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .wrapper {
      width: 100%;
      max-width: 960px;
      margin-top: 20px;
    }
    h1 {
      margin: 0 0 10px 0;
      color: #111c2d;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    p {
      margin: 0 0 20px 0;
      color: #3d4a3d;
      font-size: 14px;
    }
  </style>
</head>
<body>

  <h1>Đấu Trường Kéo Co Kiến Thức</h1>
  <p>Vite + Preact + Tailwind Shadow DOM Web Component</p>

  <div class="wrapper">
    <!-- Mounting element with theme configuration and a sample question -->
    <knowledge-tug-of-war 
      theme="kinetic-academy"
      default-questions='[
        {
          "id": "q1",
          "question": "Phím bấm nào giúp Đội 1 Đập Chuông giành quyền trả lời?",
          "options": ["Phím SPACE (Dấu cách)", "Phím ENTER (Xuống dòng)", "Phím ESC", "Phím BACKSPACE"],
          "answer_hash": "b28795c643bf7e21a48c66804a9198647614d9b62649b34ca495991b7852b855",
          "salt": "kinetic-secret-salt"
        }
      ]'
    ></knowledge-tug-of-war>
  </div>

  <!-- Entry point script for dev server loading -->
  <script type="module" src="/src/main.tsx"></script>

</body>
</html>
```

---

## 6. Key Decisions & Rationale

1. **Vanilla Custom Element Class over `preact-custom-element`**: Using a standard `HTMLElement` class to register `<knowledge-tug-of-war>` is safer. It has zero dependencies, works reliably across Preact upgrades, provides clean hook interception for attributes changes (`attributeChangedCallback`), and ensures predictable teardown (`disconnectedCallback`).
2. **Google Font Inclusion inside style block**: Since fonts are loaded via `@import` at the top of our inlined stylesheet, the browser fetches typography only when the Web Component mounts. This isolates the aesthetic layout within host pages that might have different default font settings.
3. **Rollup asset bundling configurations**: Setting `assetsInlineLimit: 100000000` instructs Vite to bundle all assets (such as logo SVG/PNG images and sound files) directly into the JS bundle as base64 data URLs. This eliminates the risk of relative pathing errors or network request failures on different host setups (e.g. WordPress file storage paths).
