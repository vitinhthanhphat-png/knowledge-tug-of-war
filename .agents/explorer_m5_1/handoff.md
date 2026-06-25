# Handoff Report: Web Component Bundling & Hardening (Milestone 5)

## 1. Observation

### Bundling Configuration & Output
- **Configuration File**: `knowledge-tug-of-war/vite.config.ts`
  - Bundles everything into a single-file library using Vite's library mode:
    ```typescript
    lib: {
      entry: 'src/main.tsx',
      name: 'KnowledgeTugOfWar',
      formats: ['iife'],
      fileName: () => 'knowledge-tug-of-war.js',
    }
    ```
  - Configures CSS bundling into the JS file: `cssCodeSplit: false`.
  - Configures asset inlining: `assetsInlineLimit: 10485760` (10 MB).
- **Bundle File**: `knowledge-tug-of-war/dist/knowledge-tug-of-war.js`
  - Output size: `1027.81 KB`.
  - Confirmed Base64 inlining of images: A search for `data:image/png;base64` returns matches, indicating the background image `src/assets/game_background_1782358874419.png` (size `700.6 KB`) is embedded.
- **Dependencies**: `package.json` uses Preact `^10.22.0` and XState `^5.18.2` as dependencies. PostCSS, Autoprefixer, TailwindCSS `^3.4.4` are devDependencies.

### Style & DOM Encapsulation
- **Mount Logic**: `knowledge-tug-of-war/src/main.tsx`
  - Registers the custom element with a guard:
    ```typescript
    if (!customElements.get('knowledge-tug-of-war')) {
      customElements.define('knowledge-tug-of-war', KnowledgeTugOfWarElement);
    }
    ```
  - Attaches an open Shadow Root and mounts Preact:
    ```typescript
    this.shadow = this.attachShadow({ mode: 'open' });
    this.mountPoint = document.createElement('div');
    this.shadow.appendChild(this.mountPoint);
    render(<App ... />, this.mountPoint);
    ```
  - Injects processed CSS dynamically:
    ```typescript
    import styles from './styles/index.css?inline';
    ...
    const styleTag = document.createElement('style');
    styleTag.textContent = styles;
    this.shadow.appendChild(styleTag);
    ```

### Assets, Audio, and Fonts
- **Assets Folder**: `src/assets` contains only `game_background_1782358874419.png` (`700,625` bytes).
- **Audio Logic**: `src/app.tsx` utilizes procedurally synthesized audio via the Web Audio API (e.g. `playBuzzSound()`, `playTickSound()`, `playCorrectSound()`, `playWrongSound()`, and `playPullRopeSound()` using oscillators, gain nodes, lowpass/bandpass filters, and noise buffers). There are no external audio file requests.
- **Audio Context Activation**: Auto-unlocks on user interaction (`click`/`keydown` listeners).
- **Font Styling**: CSS references `'Plus Jakarta Sans'` and `'Space Grotesk'`. However, these are not declared via `@font-face` or imported inside the CSS bundle.

### Static Sandbox & Test Verification
- **HTML Files**: `dist-test.html` and `index.html` define default questions:
  ```html
  default-questions='[{"id":"q1","question":"Which algorithm is used to hash passwords in this widget?","options":["MD5","SHA-256","Bcrypt","AES"],"answer_hash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","salt":"my-salt-1"}]'
  ```
- **Password Hash Audit**:
  - The SHA-256 hash in `dist-test.html` (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) is the hash of an empty string `""`.
  - The correct hash for answer `"SHA-256"` and salt `"my-salt-1"` (input string `"SHA-256my-salt-1"`) is `bcf0bd8e4703675ff11e92b2d545757efe64d34cc4779780f1520cdeae3db93e`.
- **E2E Test Bypass**: `tests/verify-m4.py` writes a temporary `valid_test_m4.json` file with valid hashes generated on the fly, logs into the Admin panel, and imports it. This bypasses the default broken question.

### Verification Scripts
- **Bug in `verify_all.py`**:
  - Line 315 calls `results.append(result)`. However, `results` is never initialized inside the `main()` function.
  - Verbatim runtime error: `NameError: name 'results' is not defined. Did you mean: 'result'?`
- **Emoji Encoding on Windows**:
  - Running either `verify_all.py` or `checklist.py` on Windows (using non-UTF-8 console page codes like CP1252) triggers:
    `UnicodeEncodeError: 'charmap' codec can't encode character '\U0001f680' in position 22: character maps to <undefined>`
- **Redundant Check**:
  - Both `verify_all.py` (line 293) and `checklist.py` (line 189) contain:
    `agent_dir_name = ".agents" if (project_path / ".agents").exists() else ".agents"` (redundant fallback).
- **SEO Check Failure**:
  - `checklist.py` fails on the SEO audit step because test pages (`index.html`, `dist-test.html`) lack `<meta name="description">` and Open Graph tags.

---

## 2. Logic Chain

### CSS & Style Encapsulation
1. Vite compiles CSS via `?inline` parameter to prevent emitting a separate `style.css` file.
2. Shadow DOM mounting with `mode: 'open'` isolates the component from the host DOM.
3. The custom element connected callback creates a `<style>` tag and sets `textContent` to the loaded CSS string.
4. **Conclusion**: Tailwind styles and custom base resets are successfully scoped inside the Shadow DOM, protecting the widget from host style pollution and preventing widget styles from breaking the host page.

### Asset Load Failures
1. Because the background image `game_background_1782358874419.png` is smaller than the 10 MB `assetsInlineLimit`, Vite compile inlines it as a Base64 data URL.
2. The Web Audio logic uses Web Audio API oscillators and buffers to procedurally generate sound instead of loading audio assets (e.g. `.mp3`).
3. **Conclusion**: There are no static file paths or external network requests for images or sounds. Hence, they are completely immune to asset loading path failures when embedded on foreign domains.
4. **Caveat**: Font files are not imported within the CSS. If the host page does not load `'Plus Jakarta Sans'`, the component falls back to system fonts.

### Broken Default Question
1. The `answer_hash` in `dist-test.html` is the hash of an empty string.
2. Hashing `"SHA-256"` + `"my-salt-1"` produces `bcf0bd8e4703675ff11e92b2d545757efe64d34cc4779780f1520cdeae3db93e`.
3. Clicking `"SHA-256"` verifies against the empty hash and evaluates as incorrect.
4. **Conclusion**: The default question is broken. The Playwright test script does not fail because it dynamically mocks this step by importing a valid question file (`valid_test_m4.json`) via the Admin Panel before simulating gameplay.

### Hardening Analysis
- **Key Spamming**:
  1. Space/Enter key presses check `e.repeat` to prevent continuous repeat actions.
  2. The state machine transitions synchronously from `waiting_buzz` to `answering` upon receiving a `BUZZ` event. Since `answering` has no `BUZZ` transition, subsequent spammed events are discarded.
  3. Cooldown is enforced via a 500ms time comparison check: `const elapsed = Date.now() - roundStartTimeRef.current; if (elapsed >= 500)`.
- **Option Double-Click (Vulnerability)**:
  1. `handleOptionClick` is async. It sets `isSubmitting = true` via Preact state.
  2. State updates in React are queued and do not reflect instantly on local execution variables. A rapid double-click in the same microtask bypasses the `if (isSubmitting) return;` block, triggering multiple parallel hashing requests and audio cues.
- **Malformed Input (Vulnerability)**:
  1. `default-questions` parsing does not run schema validation. It directly passes parsed content to state. A malformed JSON schema (e.g., missing options or wrong length) will crash the component on load.

---

## 3. Caveats
- **AudioContext Policies**: Web Audio API requires a user gesture. The current code robustly handles this on the host page via click/keydown, but browser-specific restrictions (like iOS Safari strict mode) could still block audio under edge conditions if user clicks directly on non-interactive shadow boundaries first.
- **Local Storage Caching**: The component reads questions from `localStorage` on init. Updates to the `default-questions` HTML attribute are ignored if cached questions exist. Developers must clear local storage or increment keys to force new default questions.

---

## 4. Conclusion
The production bundle builds a single, hardened JavaScript file that successfully encapsulates styling inside the Shadow DOM and embeds background assets. The procedural audio prevents asset resolution failures.

### Actionable Fixes

#### 1. Correct Default Question Hash
Update the `default-questions` attribute in `dist-test.html` and `index.html` with the correct SHA-256 hash for option `"SHA-256"` and salt `"my-salt-1"`:
- Old Hash: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- New Hash: `bcf0bd8e4703675ff11e92b2d545757efe64d34cc4779780f1520cdeae3db93e`

#### 2. Fix NameError in `verify_all.py`
Initialize `results = []` in the `main()` function of `verify_all.py` before the suite execution loop (approx. line 295):
```python
    results = []
    # Run all verification categories
    for suite in VERIFICATION_SUITE:
```

#### 3. Correct Redundant Agent Directory Resolution
Change the agent directory detection logic in both script runners to correctly fallback to `.agent` if `.agents` does not exist:
```python
    agent_dir_name = ".agents" if (project_path / ".agents").exists() else ".agent"
```

#### 4. Option Submission Hardening
Introduce a synchronous `useRef` lock in `src/app.tsx` inside the option click handler to prevent double-triggering async functions in a single render microtask:
```typescript
  const isSubmittingRef = useRef(false);
  ...
  const handleOptionClick = async (optionText: string, index: number) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      ...
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };
```

#### 5. Default Question Schema Validation
Invoke `validateQuestionsJSON` (or a synchronous validator) on initial load in `src/main.tsx` before rendering `App` to prevent invalid tag declarations from crashing the Preact root.

---

## 5. Verification Method

### 1. Test Verification Scripts
Execute the validation scripts on Windows by explicitly specifying UTF-8 encoding in PowerShell:
```powershell
# Set encoding and run checklist
$env:PYTHONIOENCODING='utf-8'
python .agents/scripts/checklist.py .

# Run verify_all.py and confirm it doesn't fail with NameError
python .agents/scripts/verify_all.py . --url http://localhost:3000
```
*Verification Success Condition*: Both scripts run, output progress, and `verify_all.py` fails ONLY on connection timeouts rather than throwing a python `NameError` or `UnicodeEncodeError`.

### 2. Sandbox Verification
1. Host `dist-test.html` using a static server:
   ```powershell
   npx serve .
   ```
2. Open `dist-test.html` in browser, buzz in, select the option `"SHA-256"`.
*Verification Success Condition*: Hashing evaluates correctly and logs a correct response (once the default question hash is updated to `bcf0bd8e4703675ff11e92b2d545757efe64d34cc4779780f1520cdeae3db93e`).
