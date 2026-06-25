# Milestone 1 Setup Review & Handoff Report

## 1. Observation

### Project Configurations
We examined the configuration files inside `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war`:
- `package.json` line 8: `"build": "tsc && vite build"` and lines 11-22 containing Preact, Tailwind CSS, Autoprefixer, PostCSS, XState, and TypeScript dependencies.
- `vite.config.ts` lines 6-23 configures Vite build output in library/iife mode:
  ```typescript
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 10485760,
    sourcemap: false,
    emptyOutDir: true,
    lib: {
      entry: 'src/main.tsx',
      name: 'KnowledgeTugOfWar',
      formats: ['iife'],
      fileName: () => 'knowledge-tug-of-war.js',
    },
    rollupOptions: {
      external: [],
      output: {
        extend: true
      }
    }
  }
  ```
- `tsconfig.json` lines 15-16 specifies:
  ```json
  "jsx": "react-jsx",
  "jsxImportSource": "preact",
  ```
- `tailwind.config.js` lines 3-6:
  ```javascript
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  ```
- `postcss.config.js` lines 1-7:
  ```javascript
  export default {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  }
  ```

### Style & Shadow DOM Injection
In `src/main.tsx` lines 3, 19-21, and 68-70:
```typescript
import styles from './styles/index.css?inline';
...
connectedCallback() {
  const styleTag = document.createElement('style');
  styleTag.textContent = styles;
  this.shadow.appendChild(styleTag);
...
if (!customElements.get('knowledge-tug-of-war')) {
  customElements.define('knowledge-tug-of-war', KnowledgeTugOfWarElement);
}
```

### Preact App Structure
In `src/app.tsx` lines 17-21, we observed a standard Preact functional component:
```typescript
export function App({ theme, defaultQuestions }: AppProps) {
  const [questions] = useState<Question[]>(defaultQuestions);
  
  return (
    <div className="w-full min-h-[500px] flex flex-col justify-between bg-surface text-on-surface font-body select-none p-6 rounded-2xl border-2 border-surface-dim box-border">
```

### Build Execution and Output File Verification
We ran the command `npm run build` inside `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war`.
The command executed successfully with the following output:
```
vite v5.4.21 building for production...
transforming...
✓ 6 modules transformed.
rendering chunks...
computing gzip size...
dist/knowledge-tug-of-war.js  29.47 kB │ gzip: 10.02 kB
✓ built in 629ms
```
Lister results for `dist/` showed exactly one file:
- `dist/knowledge-tug-of-war.js` (29,514 bytes)
- Zero `.css` files.

---

## 2. Logic Chain

1. **Config Integrity**: The configurations in `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, and `postcss.config.js` correspond to a modern Vite + Preact + Tailwind CSS bundle pipeline. Specifying Preact JSX runtime in `tsconfig.json` ensures typings and compilation mapping work correctly, and the aliases in `vite.config.ts` map React packages to Preact compatibility layers.
2. **Tailwind Shadow DOM Integration**: The `?inline` query suffix is used on the CSS import statement. Vite processes this import by passing it through PostCSS (which processes `@tailwind` directives using Tailwind's scanner), compiles it to plain CSS, and returns the result as a string rather than emitting a separate `.css` bundle. This string is then successfully injected via a `<style>` tag into the shadow DOM inside the Web Component's `connectedCallback`.
3. **Single File Requirement**: The library build config (`formats: ['iife']` and `cssCodeSplit: false`) bundles all JS and compiled CSS string into a single compiled script `knowledge-tug-of-war.js` inside the `dist` directory. Our build test confirmed that only `dist/knowledge-tug-of-war.js` was created and zero separate `.css` files were emitted.
4. **App Correctness**: The Preact structure in `src/app.tsx` and `src/main.tsx` correctly handles custom element attributes (`theme`, `default-questions`) and propagates them down to the Preact sub-tree, providing proper cleanup in `disconnectedCallback`.

---

## 3. Caveats

- **Web Crypto Context**: Web Crypto API (`crypto.subtle`) is strictly restricted to secure contexts (HTTPS or localhost). If the custom element is loaded on an insecure HTTP context, the `crypto.subtle` property will be `undefined`, causing runtime exceptions when attempting to hash or verify answers.
- **Font Dependency**: Custom Google Fonts (`Plus Jakarta Sans` and `Space Grotesk`) are referenced in `index.html` via `<link>` tags. If a third-party application imports the custom element JS bundle directly (e.g. `dist-test.html`), it must manually load these fonts, otherwise, rendering will fall back to system fonts.

---

## 4. Conclusion

The Vite + Preact + Tailwind CSS project setup for Milestone 1 is **correct, complete, and robust**. It satisfies the requirement of emitting a single compiled JavaScript file bundle with zero separate CSS files, and correctly injects Tailwind styling directly into the Web Component's Shadow DOM. 

**Review Verdict**: **APPROVE**

---

## 5. Verification Method

To independently verify the build output:
1. Navigate to the project directory: `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war`
2. Run the build command:
   ```bash
   npm run build
   ```
3. Inspect the `dist` directory using a lister tool:
   - Ensure `dist/knowledge-tug-of-war.js` is generated.
   - Confirm that no `.css` files exist in the `dist` folder.
4. Invalidation condition: If the build fails or any `.css` file is outputted to the `dist` folder, the build pipeline setup is invalid.

---

# Quality Review Summary

**Verdict**: **APPROVE**

## Verified Claims
- **Single JS Bundle and 0 CSS files** → verified via build and directory listing → **PASS**
- **Tailwind style shadow DOM injection** → verified via checking `src/main.tsx` and examining the bundled JS output `dist/knowledge-tug-of-war.js` containing `Wt` style string and `connectedCallback` element injection → **PASS**
- **Attributes binding** → verified via `attributeChangedCallback` and attribute parsing in `src/main.tsx` → **PASS**

## Coverage Gaps
- **Crypto Secure Context Check** — risk level: Low/Medium (may cause widget failures if hosted on plain HTTP non-localhost hosts) — recommendation: Add safety check in `crypto.ts` for secure contexts and fallback appropriately if `crypto.subtle` is undefined.

---

# Adversarial Challenge Summary

**Overall risk assessment**: **LOW**

## Challenges

### [Medium] Challenge 1: Secure Context Dependency of Web Crypto API
- **Assumption challenged**: Assumes `crypto.subtle` is always available.
- **Attack scenario**: Deploying the widget on a public non-HTTPS website (plain HTTP).
- **Blast radius**: The widget crashes with a TypeError: Cannot read properties of undefined (reading 'digest') when users attempt to submit or verify answers.
- **Mitigation**: Implement a check `window.isSecureContext` or `!!crypto.subtle` and fallback to a lightweight pure JS SHA-256 implementation if secure context is not available.

### [Low] Challenge 2: Styling Degrades Due to External Fonts Load
- **Assumption challenged**: Assumes host websites will load the custom fonts.
- **Attack scenario**: Embedding the widget in an external landing page via `dist/knowledge-tug-of-war.js` without copying fonts `<link>` tags.
- **Blast radius**: UI falls back to standard sans-serif font, leading to minor visual style deviations from the original design.
- **Mitigation**: Add `@import url(...)` for the fonts at the top of `src/styles/index.css` so that the fonts are loaded dynamically inside the shadow DOM itself.
