# Analysis Report: Project Setup and Build System Design (Milestone 1)

## 1. Summary of Findings
This analysis report designs the setup of the Vite + Preact + Tailwind CSS project for the **Knowledge Tug of War** interactive EdTech widget.
To meet the user request of a **zero-database, lightweight, single-file Custom Element (`<knowledge-tug-of-war>`)**, we propose an **Inlined CSS injection strategy** within a Shadow DOM. 

By disabling Vite's default CSS output and utilizing Vite's `?inline` query suffix for the main stylesheet, we can import the compiled Tailwind CSS stylesheet as a raw string and inject it directly into the Custom Element's Shadow Root inside a `<style>` tag. Combined with Vite's **Library Mode (IIFE format)** and a high `assetsInlineLimit`, the build output compiles down to a **single self-executing JavaScript file** (e.g. `knowledge-tug-of-war.js`) containing all markup, behavior, styling, base64-encoded assets (sound effects, graphics), and libraries.

---

## 2. Proposed Directory Layout (Milestone 1)
For Milestone 1 (Project Setup & Build Initialization), the codebase is organized as follows:

```
knowledge-tug-of-war/
├── .gitignore
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── postcss.config.js
├── tailwind.config.js
├── index.html                  # Dev sandbox & integration test file
└── src/
    ├── vite-env.d.ts           # TS declaration for ?inline imports and assets
    ├── main.tsx                # Custom Element Wrapper & Mount point
    ├── app.tsx                 # Root Preact App
    ├── state-machine.ts        # XState FSM template
    ├── crypto.ts               # Web Crypto SHA-256 placeholder
    ├── styles/
    │   └── index.css           # Tailwind directives & global resets
    ├── assets/                 # Graphics and sound assets (will be inlined)
    │   ├── images/
    │   └── audio/
    └── components/             # Reusable game views (placeholders for M1)
        ├── Arena.tsx
        ├── AdminPanel.tsx
        ├── HUD.tsx
        └── ProgressBar.tsx
```

---

## 3. CSS Encapsulation Strategy: Shadow DOM & Inline Injection
In a standard Vite project, CSS is compiled into a standalone file (e.g., `style.css`) or injected dynamically into the host page's `<head>`. Neither approach works for a Shadow DOM because the Shadow Root encapsulates style scopes, isolating internal elements from external styles and preventing internal styles from leaking out.

To solve this for `<knowledge-tug-of-war>`:
1. **Tailwind Processing**: Tailwind CSS styles (including Preflight/Resets, utility classes, and custom components) are processed by PostCSS/Autoprefixer.
2. **Inline Import in Vite**: In `src/main.tsx`, we import the processed CSS using Vite's `?inline` query suffix:
   ```typescript
   import styles from './styles/index.css?inline';
   ```
   This signals Vite to skip generating an external CSS chunk and return the final processed CSS compiled string instead.
3. **Shadow DOM Injection**: In the Custom Element constructor, we attach a Shadow Root in `open` mode. Upon component connection (`connectedCallback`), we programmatically create a `<style>` element, write the `styles` string to it, and append it to the Shadow Root.
4. **Resets / Preflight Isolation**: Since Tailwind's Preflight (resetting margins, box-sizing, typography default styles) is loaded inside the Shadow Root, it operates only on the elements rendered inside `<knowledge-tug-of-war>`. It does not affect any styles on the host WordPress or Next.js page, achieving perfect style isolation.
5. **Dynamic Fonts**: Because external web fonts (e.g. Google Fonts) imported via `@import` inside a Shadow DOM stylesheet can trigger FOUT (Flash of Unstyled Text) or rendering delays, we load the required fonts in the host page (sandbox `index.html`) using standard `<link>` tags, while retaining an `@import` fallback inside `index.css`.

---

## 4. Configuration Files

### 4.1. `package.json`
Specifies minimal, lightweight dependencies. We pin Preact and XState v5 as core runtimes, and Tailwind CSS/PostCSS as build devDependencies.

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
    "xstate": "^5.14.0"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.8.2",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.5",
    "vite": "^5.2.11"
  }
}
```

### 4.2. `vite.config.ts`
Enforces a single-file IIFE build output. We set `assetsInlineLimit` to 10MB to guarantee that all assets (such as `.mp3` audio files and background images) are compiled into the JavaScript file as Base64 data URIs. We use `cssCodeSplit: false` as an extra safeguard.

```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    // Compile directly to a single bundle format
    lib: {
      entry: 'src/main.tsx',
      name: 'KnowledgeTugOfWar',
      formats: ['iife'],
      fileName: () => 'knowledge-tug-of-war.js',
    },
    rollupOptions: {
      // Inline all dependencies so the custom element is entirely self-sufficient
      external: [],
      output: {
        manualChunks: undefined,
        extend: true,
      },
    },
    // Inline assets (images, audio) as Base64 if they are under 10MB
    assetsInlineLimit: 10485760,
    cssCodeSplit: false,
    emptyOutDir: true,
    sourcemap: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  }
});
```

### 4.3. `postcss.config.js`
Hooking up Autoprefixer and Tailwind CSS into the CSS compile chain.

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### 4.4. `tailwind.config.js`
Specifies design tokens derived from the project specs and `DESIGN.md`. Uses a rounded-lg (1rem) border-radius for buttons and custom color keys representing Team 1 (Green), Team 2 (Blue), Tension/Alerts (Red), and interactive Accent Glow (Orange/Yellow).

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
        // Kinetic Academy theme tokens
        surface: {
          DEFAULT: '#f9f9ff',
          dim: '#cfdaf2',
          bright: '#f9f9ff',
          lowest: '#ffffff',
          low: '#f0f3ff',
          container: '#e7eeff',
          high: '#dee8ff',
          highest: '#d8e3fb',
        },
        'on-surface': '#111c2d',
        'on-surface-variant': '#3d4a3d',
        'inverse-surface': '#263143',
        'inverse-on-surface': '#ecf1ff',
        outline: {
          DEFAULT: '#6d7b6c',
          variant: '#bccbb9',
        },
        primary: {
          DEFAULT: '#006e2f',
          container: '#22c55e', // Team 1 (Green)
        },
        secondary: {
          DEFAULT: '#0058be',
          container: '#2170e4', // Team 2 (Blue)
        },
        tertiary: {
          DEFAULT: '#b91a24',
          container: '#ff8a83', // Team 2 alternate/Tension (Red)
        },
        'accent-glow': '#f97316', // Highlight/Action (Orange)
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        lg: '1rem',
      },
    },
  },
  plugins: [],
}
```

### 4.5. `tsconfig.json`
Configures Preact's modern JSX transform and handles bundling mode.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
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
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### 4.6. `tsconfig.node.json`
TypeScript config targeting the Node build tools.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

### 4.7. `index.html` (Sandbox / Integration Test Page)
The dev/sandbox file loads external typography assets in the main head so the system caches them, uses the custom element directly in the body, and links the TypeScript wrapper source so the hot-reloading dev server runs natively.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Knowledge Tug of War Sandbox</title>
  
  <!-- Load fonts in host for performance and caching -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen flex flex-col items-center justify-center p-4">
  
  <div class="w-full max-w-5xl bg-white rounded-2xl shadow-xl p-8">
    <h1 class="text-3xl font-bold mb-6 text-center text-slate-800">
      EdTech Interactive Sandbox
    </h1>
    
    <!-- Custom HTML Web Component -->
    <knowledge-tug-of-war 
      theme="kinetic-academy"
      default-questions='[{"id":"q1","question":"Which algorithm is used to hash passwords in this widget?","options":["MD5","SHA-256","Bcrypt","AES"],"answer_hash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","salt":"my-salt-1"}]'
    ></knowledge-tug-of-war>
  </div>

  <!-- Vite entrypoint for local dev server -->
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

---

## 5. Implementation Drafts

### 5.1. `src/vite-env.d.ts`
Enables importing files using `?inline` and resolves other asset types without TS errors.

```typescript
/// <reference types="vite/client" />

declare module '*?inline' {
  const content: string;
  export default content;
}
```

### 5.2. `src/styles/index.css`
Tailwind initialization directives along with custom resets scoped to the custom element host.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:host {
  display: block;
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  box-sizing: border-box;
}

/* Base resets scoped to Shadow DOM */
*, *::before, *::after {
  box-sizing: inherit;
}

/* Mechanical key layout offset helper */
.key-3d-active {
  transform: translateY(2px);
  border-bottom-width: 2px !important;
}

/* Custom glow animation classes using theme variables */
.glow-team1 {
  box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
  border-color: #22c55e;
}

.glow-team2 {
  box-shadow: 0 0 15px rgba(33, 112, 228, 0.4);
  border-color: #2170e4;
}
```

### 5.3. `src/main.tsx` (Custom Element Wrapper)
We wrap Preact using standard Web Component interfaces. This handles the Shadow DOM instantiation, compiles CSS string injection, processes attribute mapping for `theme` and `default-questions`, and triggers React-like render cycles when attributes change.

```tsx
import { render } from 'preact';
import { App } from './app';
import styles from './styles/index.css?inline';

class KnowledgeTugOfWarElement extends HTMLElement {
  private mountPoint: HTMLDivElement | null = null;
  private shadow: ShadowRoot;

  static get observedAttributes() {
    return ['theme', 'default-questions'];
  }

  constructor() {
    super();
    // 1. Instantiate the shadow root (open mode allows inspection)
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // 2. Inject Tailwind and custom CSS styles into shadow root
    const styleTag = document.createElement('style');
    styleTag.textContent = styles;
    this.shadow.appendChild(styleTag);

    // 3. Create mount target for Preact application
    this.mountPoint = document.createElement('div');
    this.mountPoint.className = 'w-full h-full relative overflow-hidden';
    this.shadow.appendChild(this.mountPoint);

    // 4. Perform initial Preact render
    this.renderApp();
  }

  disconnectedCallback() {
    // Clean up Preact VDOM tree to prevent memory leaks
    if (this.mountPoint) {
      render(null, this.mountPoint);
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue && this.mountPoint) {
      // Re-render when config attributes change
      this.renderApp();
    }
  }

  private renderApp() {
    if (!this.mountPoint) return;

    const theme = this.getAttribute('theme') || 'kinetic-academy';
    const rawQuestions = this.getAttribute('default-questions');
    
    let defaultQuestions = [];
    if (rawQuestions) {
      try {
        defaultQuestions = JSON.parse(rawQuestions);
      } catch (err) {
        console.error('Failed to parse default-questions attribute:', err);
      }
    }

    render(
      <App 
        theme={theme} 
        defaultQuestions={defaultQuestions} 
        host={this} 
      />, 
      this.mountPoint
    );
  }
}

// Register the custom element if it is not already defined
if (!customElements.get('knowledge-tug-of-war')) {
  customElements.define('knowledge-tug-of-war', KnowledgeTugOfWarElement);
}
```

### 5.4. `src/app.tsx` (Preact App Entrypoint)
Renders a container utilizing the tailwind theme classes.

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
  host: HTMLElement;
}

export function App({ theme, defaultQuestions }: AppProps) {
  const [questions] = useState<Question[]>(defaultQuestions);
  
  return (
    <div className={`p-6 min-h-[400px] flex flex-col justify-between rounded-2xl bg-surface border-2 border-outline-variant text-on-surface`}>
      {/* Header HUD */}
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-bold font-display rounded-full bg-primary/20 text-primary">
            TEAM 1 (SPACE)
          </span>
          <span className="font-display font-bold text-lg">0</span>
        </div>
        
        <div className="text-center">
          <h2 className="text-sm font-semibold font-body text-on-surface-variant">
            Theme: <span className="font-mono">{theme}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-lg">0</span>
          <span className="px-3 py-1 text-xs font-bold font-display rounded-full bg-secondary/20 text-secondary">
            TEAM 2 (ENTER)
          </span>
        </div>
      </header>

      {/* Main Arena Area (Placeholder layout) */}
      <main className="flex-1 flex flex-col items-center justify-center text-center my-4">
        {questions.length > 0 ? (
          <div className="w-full max-w-xl">
            <h3 className="text-xl font-bold font-body mb-4">
              {questions[0].question}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {questions[0].options.map((opt, i) => (
                <button 
                  key={i}
                  disabled
                  className="p-4 rounded-lg bg-surface-container border border-outline/30 text-on-surface/50 font-body text-left cursor-not-allowed"
                >
                  <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-on-surface-variant font-body">
              No questions imported yet. Please upload a JSON quiz sheet.
            </p>
            <div className="mt-4 flex gap-2 justify-center">
              <button className="px-4 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-container transition">
                Import JSON
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Tug of War Visualizer line placeholder */}
      <footer className="mt-6">
        <div className="w-full h-4 bg-surface-dim rounded-full overflow-hidden relative border border-outline-variant">
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-red-600 z-10 animate-pulse"></div>
          <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-primary-container"></div>
          <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-secondary-container"></div>
        </div>
      </footer>
    </div>
  );
}
```

---

## 6. Verification Plan
To independently verify that the build configuration, style encapsulation, and single-file bundling are functional:

1. **Local Install & Run Dev Sandbox**:
   ```bash
   npm install
   npm run dev
   ```
   Open `http://localhost:5173`. Inspect with Chrome DevTools. Check that `<knowledge-tug-of-war>` has a `#shadow-root (open)` node, that the `<style>` tag is present, and that styling is applied correctly. Change styles in DevTools to confirm styles inside shadow root do not affect the sandbox outer container, and that tailwind utility classes work.

2. **Run Library Build**:
   ```bash
   npm run build
   ```
   Verify that a single file is outputted in the `dist` directory: `dist/knowledge-tug-of-war.js`. Confirm that **no `.css` files are generated** in `dist`.

3. **Verify Pure Integration Test**:
   Create a standalone static html file `dist-test.html` loading the build:
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <title>Static Build Verification</title>
   </head>
   <body style="background: #333;">
     <!-- Mount custom element -->
     <knowledge-tug-of-war theme="kinetic-academy"></knowledge-tug-of-war>
     
     <!-- Load single file JS bundle directly -->
     <script src="./dist/knowledge-tug-of-war.js"></script>
   </body>
   </html>
   ```
   Open it directly in a browser. It should render the widget styled correctly with Tailwind, fully self-contained without needing internet access (except for external font files if not cached). Verify that the stylesheet is embedded directly inside the custom element Shadow DOM.
