## 2026-06-25T04:34:41Z

Implement Milestone 5 (Web Component Bundling & Hardening) for the Knowledge Tug of War Web Component.

### Core Tasks:

#### 1. Hardening in `knowledge-tug-of-war/src/app.tsx`
- **JSON Question Schema Validation & Resiliency**:
  - Implement a synchronous helper function `sanitizeQuestions(raw: any): Question[]` (either inside `src/app.tsx` or in a helper file) that validates the questions array format.
  - The validation must verify:
    - The raw input is an array.
    - Each question object contains: `id` (non-empty string or generated fallback), `question` (non-empty string), `options` (an array of exactly 4 strings, none of which are empty), and a valid hex SHA-256 `answer_hash` of 64 characters.
    - Clean whitespace and set safe fallbacks.
  - Integrate this `sanitizeQuestions` logic inside `getInitialQuestions()` (when reading from `localStorage`) and when processing question imports (`IMPORT_QUESTIONS` action).
  - Also validate `default-questions` in `src/main.tsx` using this sanitizer.
  - If validation fails or the resulting list is empty, display a non-breaking error banner inside the Shadow DOM (with a clean Kinetic Academy style) instead of crashing, and load a safe default question set.
  - Dispatch a custom DOM event `questions-invalid` to the host page if validation fails.
  
- **Click & Input Spam Protection**:
  - Refactor option button clicking inside `src/app.tsx` by introducing a Preact ref `isSubmittingRef = useRef(false)`. Check this ref synchronously at the start of `handleOptionClick` to block duplicate asynchronous hash checks.
  - Refactor keyboard event handling for the buzz key (`Space` / `Enter`) by introducing a `hasBuzzedRef = useRef(false)`. Synchronously check and set this ref to block rapid keyboard tapping or chatter.

#### 2. Fixing AG Kit Python Scripts
- **Fix `verify_all.py` (in `.agents/scripts/verify_all.py`)**:
  - Initialize the `results` list inside `main()` as `results = []` before the categories execution loop to resolve the `NameError`.
  - Fix the redundant ternary check: change `agent_dir_name = ".agents" if (project_path / ".agents").exists() else ".agents"` to fallback to `".agent"` (singular).
  - Add `encoding="utf-8"` in all `subprocess.run` calls.
- **Fix `checklist.py` (in `.agents/scripts/checklist.py`)**:
  - Fix the redundant ternary check: change `agent_dir_name = ".agents" if (project_path / ".agents").exists() else ".agent"`.
  - Add `encoding="utf-8"` in all `subprocess.run` calls.
- **Fix `auto_preview.py` (in `.agents/scripts/auto_preview.py`)**:
  - Correct line 23 fallback directory from `".agents"` to `".agent"`.

### Verification Tasks:
1. Compile the project with `npm run build` inside `knowledge-tug-of-war`.
2. Run the newly corrected checklist script to verify all core checks pass:
   ```bash
   python .agents/scripts/checklist.py .
   ```
3. Document the build and checklist output in your handoff report.
