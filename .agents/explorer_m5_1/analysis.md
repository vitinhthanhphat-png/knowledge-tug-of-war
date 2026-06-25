# Milestone 5 Analysis Report: Web Component Bundling & Hardening

**Milestone:** Milestone 5 (Web Component Bundling & Hardening)  
**Target Project:** Knowledge Tug of War Web Component  
**Investigator:** explorer_m5_1  
**Date:** 2026-06-25  

---

## 1. Bundling Configuration & Style Injection Review

### 1.1 Vite Configuration (`vite.config.ts`)
The current Vite build settings are tailored for generating a single-file library:
- **Build Target & Entry**: Entry is `src/main.tsx`, built into a single IIFE bundle (`dist/knowledge-tug-of-war.js`) with the global name `KnowledgeTugOfWar`.
- **CSS Handling**: `cssCodeSplit: false` prevents splitting CSS into a separate file.
- **Inlining Limit**: `assetsInlineLimit: 10485760` (10MB) ensures that all assets, including icons and images (like `game_background_1782358874419.png`), are inlined as base64 data URIs. This guarantees that the entire component is self-contained in a single JavaScript file.
- **Aliases**: Resolves `react` and `react-dom` to `preact/compat` to minimize bundle size.

### 1.2 Mounting Logic (`src/main.tsx`)
The custom element `knowledge-tug-of-war` is registered automatically upon loading:
- **Shadow Root**: Attaches an open Shadow DOM (`this.attachShadow({ mode: 'open' })`) to isolate the component's internals and styles from the host document.
- **Style Injection**: Imports stylesheet text using the `?inline` query parameter:
  ```typescript
  import styles from './styles/index.css?inline';
  ```
  Vite pre-processes Tailwind CSS and PostCSS rules, outputting the compiled stylesheet as a string. During element mount (`connectedCallback`), the component dynamically creates a `<style>` element, assigns its `textContent` to the string, and appends it directly to the Shadow Root.
- **Rendering**: Instantiates the Preact root inside a wrapper `div` (`this.mountPoint`) within the Shadow DOM:
  ```typescript
  render(<App theme={theme} defaultQuestions={defaultQuestions} host={this} />, this.mountPoint);
  ```

### 1.3 Stylistic Isolation Assessment & Font Loading Caveat
- **Robustness**: The CSS isolation is highly robust. Scoped Tailwind utility classes and animations do not bleed out to the host document, nor do host document style sheets affect the web component's layout.
- **Font Caveat**: The stylesheet references `'Plus Jakarta Sans'` as the primary font-family. However, the font file is neither bundled nor loaded externally. If the host page does not load `'Plus Jakarta Sans'`, the component silently falls back to `system-ui`.
  - *Recommendation*: Document the font requirement in the integration guide, or embed the WOFF2 font directly using `@font-face` and base64 data URIs in `src/styles/index.css` (since the 10MB inlining limit easily permits it).

---

## 2. Integration & Embed Verification (`dist-test.html`)

### 2.1 Embedding Configuration
The clean test page `dist-test.html` shows how the component is embedded in a static environment:
- **Custom Tag**: `<knowledge-tug-of-war>` is mounted with the attributes `theme` and `default-questions`.
- **Script Injection**: A single `<script src="./dist/knowledge-tug-of-war.js"></script>` registers and mounts the web component. No CSS link tags are required.

### 2.2 Secure Context Constraints & Crypto Fallback
- **Vulnerability**: The Web Crypto API (`window.crypto.subtle`) is only available in secure contexts (`https://` or `localhost`). If users test the web component locally via the `file://` protocol or in an insecure HTTP environment, `crypto.subtle` is `undefined`.
- **Mitigation Check**: The codebase contains a pure JavaScript fallback in `src/crypto.ts` (`sha256Fallback`) that executes automatically if Web Crypto is unavailable.
  - This ensures that local testing of `dist-test.html` (e.g. by opening it directly in a browser) does not crash during answer hashing/verification.

---

## 3. Adversarial Hardening Strategies

### 3.1 JSON Question Schema Resiliency

#### The Issue
In `src/main.tsx`, `default-questions` is parsed using `JSON.parse` and passed directly as a prop to the `App` component. In `src/app.tsx`, the `App` component retrieves this list and starts the XState machine actor.
If a developer inputs malformed JSON structure (e.g. `default-questions='{"invalid": "format"}'` or missing the `options` array in one of the question items), the application will crash during render/state execution:
- Attempting to index `questions[currentQuestionIndex]` where `questions` is an object.
- Accessing `currentQuestion.options.length` where `options` is `undefined` (throwing a `TypeError`).

#### Hardening Strategy
Implement a synchronous schema validator helper `sanitizeQuestions` to clean, validate, and structure the input questions immediately when reading the attribute or retrieving them from `localStorage`:

```typescript
export function sanitizeQuestions(raw: any): Question[] {
  if (!Array.isArray(raw)) {
    console.error('Invalid questions: raw data is not an array');
    return [];
  }
  const clean: Question[] = [];
  const sha256HexRegex = /^[a-fA-F0-9]{64}$/;

  for (let i = 0; i < raw.length; i++) {
    const q = raw[i];
    if (!q || typeof q !== 'object') continue;
    
    const id = typeof q.id === 'string' && q.id.trim() ? q.id.trim() : `q_${i}_${Date.now()}`;
    const question = typeof q.question === 'string' && q.question.trim() ? q.question.trim() : '';
    if (!question) continue;

    if (!Array.isArray(q.options) || q.options.length !== 4) continue;
    const cleanOptions = q.options.map((opt: any) => typeof opt === 'string' ? opt.trim() : '');
    if (cleanOptions.some(opt => !opt)) continue;

    const answer_hash = typeof q.answer_hash === 'string' && sha256HexRegex.test(q.answer_hash.trim())
      ? q.answer_hash.trim()
      : '';
    if (!answer_hash) continue;

    const salt = typeof q.salt === 'string' ? q.salt.trim() : undefined;

    clean.push({
      id,
      question,
      options: cleanOptions,
      answer_hash,
      salt
    });
  }
  return clean;
}
```

Integration points:
1. In `src/main.tsx`:
   ```typescript
   defaultQuestions = sanitizeQuestions(JSON.parse(rawQuestions));
   ```
2. In `src/app.tsx` inside `getInitialQuestions`:
   ```typescript
   const parsed = JSON.parse(saved);
   return sanitizeQuestions(parsed);
   ```

---

### 3.2 Input Spamming Resiliency (Space/Enter & Buzz/Option Clicks)

#### The Issue
1. **Asynchronous State Updates**: When clicking options, the component verifies hashes asynchronously:
   ```typescript
   const handleOptionClick = async (optionText: string, index: number) => {
     if (isSubmitting) return;
     setIsSubmitting(true);
     const isCorrect = await verifyAnswer(...);
     ...
     send({ type: 'SUBMIT_ANSWER', isCorrect });
   };
   ```
   Because `verifyAnswer` is asynchronous (yielding to the event loop) and `setIsSubmitting(true)` triggers a re-render asynchronously, a user can click multiple options in the same tick of the event loop. This leads to duplicate `SUBMIT_ANSWER` dispatches and multiple triggerings of sound effects (`playCorrectSound()`).
2. **Keyboard Event Queueing**: If a user spams Space or Enter during round transitions, key event handlers might fire multiple `BUZZ` events before the Preact component updates the state and removes the keydown listeners.

#### Hardening Strategy
1. **Ref-based Option Lock**:
   Introduce a synchronous reference (`useRef`) to immediately block execution inside the click handler:
   ```typescript
   const isSubmittingRef = useRef(false);
   const handleOptionClick = async (optionText: string, index: number) => {
     if (isSubmittingRef.current) return;
     isSubmittingRef.current = true;
     setIsSubmitting(true); // For UI styling
     try {
       const questions = state.context.questions;
       const currentIndex = state.context.currentQuestionIndex;
       const currentQuestion = questions[currentIndex];
       const isCorrect = await verifyAnswer(optionText, currentQuestion.salt || '', currentQuestion.answer_hash);
       
       // Guard against state changes occurring in the background
       if (actor.getSnapshot().value === 'answering') {
         if (isCorrect) playCorrectSound();
         else playWrongSound();
         send({ type: 'SUBMIT_ANSWER', isCorrect });
       }
     } finally {
       isSubmittingRef.current = false;
       setIsSubmitting(false);
     }
   };
   ```

2. **Ref-based Buzz Lock**:
   Introduce a synchronous ref lock to ensure only one Buzz can be initiated per round, ignoring all spam keydowns or rapid taps:
   ```typescript
   const hasBuzzedRef = useRef(false);

   useEffect(() => {
     if (state.value === 'waiting_buzz') {
       roundStartTimeRef.current = Date.now();
       hasBuzzedRef.current = false; // Reset lock for the new round
     }
   }, [state.value]);

   const handleKeyDown = (e: KeyboardEvent) => {
     if (e.repeat) return;
     if (hasBuzzedRef.current) return;
     
     // Determine team and trigger BUZZ...
     const elapsed = Date.now() - roundStartTimeRef.current;
     if (elapsed >= 500) {
       hasBuzzedRef.current = true; // Lock immediately
       send({ type: 'BUZZ', team });
     }
   };
   ```

---

## 4. AG Kit Pre-deploy Verification Script Review

We reviewed the scripts in `.agents/scripts/` and identified the following bugs:

### 4.1 Bug in `verify_all.py` (NameError)
- **Observation**:
  In `verify_all.py` line 315, inside the verification execution loop, we see:
  ```python
  results.append(result)
  ```
  However, the `results` list is **never initialized** in the `main()` function scope. Running `verify_all.py` will crash immediately with a `NameError: name 'results' is not defined`.
- **Recommended Fix**:
  Add `results = []` at line 295 of `verify_all.py`, right before the verification suite loop starts:
  ```python
  start_time = datetime.now()
  # Detect agent directory dynamically (default to .agents if exists, fallback to .agent)
  agent_dir_name = ".agents" if (project_path / ".agents").exists() else ".agents"
  
  results = [] # Add this line to fix the NameError
  
  # Run all verification categories
  for suite in VERIFICATION_SUITE:
  ```

### 4.2 Redundant Directory Checks in `checklist.py`, `verify_all.py`, and `auto_preview.py`
- **Observation**:
  Across multiple scripts, the agent directory detection logic is redundant.
  - `checklist.py` (line 189):
    ```python
    agent_dir_name = ".agents" if (project_path / ".agents").exists() else ".agents"
    ```
  - `verify_all.py` (line 293):
    ```python
    agent_dir_name = ".agents" if (project_path / ".agents").exists() else ".agents"
    ```
  - `auto_preview.py` (line 23):
    ```python
    AGENT_DIR = Path(".agents") if Path(".agents").exists() else Path(".agents")
    ```
  This redundancy returns `".agents"` in both branches, making the dynamic check useless. If a project folder is named `.agent` (singular), the fallback fails and the script will crash or fail to find configuration folders.
- **Recommended Fix**:
  Change the fallback branch to the singular folder name:
  - In `checklist.py` & `verify_all.py`:
    ```python
    agent_dir_name = ".agents" if (project_path / ".agents").exists() else ".agent"
    ```
  - In `auto_preview.py`:
    ```python
    AGENT_DIR = Path(".agents") if Path(".agents").exists() else Path(".agent")
    ```

---

## 5. Implementation Action Plan

For the subsequent implementation agent, we recommend executing the following steps:

1. **Bug fixes in Pre-deploy Scripts**:
   - Initialize `results = []` in `verify_all.py` (line 295).
   - Fix the redundant ternary statements in `checklist.py`, `verify_all.py`, and `auto_preview.py` to allow singular `.agent` directory support.
2. **Web Component Robustness**:
   - Write the `sanitizeQuestions` function in `src/app.tsx` and integrate it to filter out malformed data from `default-questions` and `localStorage` imports.
   - Refactor `handleOptionClick` using `isSubmittingRef` to prevent async click race conditions.
   - Refactor `handleKeyDown` and `handleBuzzTap` using `hasBuzzedRef` to block key tapping/spamming.
3. **Embed Verification**:
   - Add detailed comments or documentation in `dist-test.html` describing the Web Crypto secure context requirement and the automatic fallback in insecure contexts.
