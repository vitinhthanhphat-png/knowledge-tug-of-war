# Synthesis Report — Milestone 5: Web Component Bundling & Hardening

This report aggregates the production bundling, Shadow DOM lifecycle fixes, input hardening, and automated E2E verification test suite requirements for Milestone 5.

## 1. Shadow DOM Lifecycle & Mounting Fixes (`src/main.tsx`)
*   **Reconnection Duplication Prevention**:
    - *Issue*: In `connectedCallback()`, the stylesheet and mount point are appended blindly. If the element is detached and re-attached (e.g., during DOM reflow or SPA route transitions), it duplicates the style tag and mount point container inside the Shadow Root.
    - *Fix*: Check if `this.shadow.querySelector('style')` and the mount point container already exist before creating and appending them.
*   **Programmatic Property Binding**:
    - *Issue*: Serializing large JSON configurations into the HTML `default-questions` attribute is fragile and prone to single-quote syntax truncation.
    - *Fix*: Add a getter/setter pair for `defaultQuestions` on the custom element class (`KnowledgeTugOfWarElement`). This allows host pages to programmatically assign questions directly as an array:
      ```typescript
      get defaultQuestions() {
        return this._questions;
      }
      set defaultQuestions(val) {
        this._questions = val;
        this.renderApp();
      }
      ```

## 2. Adversarial Input & Schema Hardening (`src/app.tsx`)
*   **JSON Schema Validation & Sanitization**:
    - *Requirement*: Create a robust, synchronous helper `sanitizeQuestions(data: any): Question[]` that takes the parsed JSON and validates:
      1. It is a non-empty array.
      2. Each question has a valid `id`, `question`, `options` (array of strings, length >= 2), `answer_hash`, and optionally `salt`.
      3. Filter out items with empty or duplicate IDs.
      4. Ensure every question has at least one option that when hashed, matches the target `answer_hash` (cryptographic integrity check).
    - *Action*: If the imported JSON is empty or fails validation, trigger `IMPORT_QUESTIONS_FAILURE` with a localized schema error message, preventing application crash.
*   **Key/Click Input Spam Protection**:
    - *Issue*: Clicks or keystrokes (Space/Enter) triggered in rapid succession (faster than state transitions and render cycles) cause duplicate state transitions, double buzz-ins, or overlapping audio effects.
    - *Fix*: Implement ref-based locks (`useRef(false)`) inside Option Button clicks and keyboard buzz event handlers to discard input if a submit/transition is already in progress.
*   **Async Admin Panel Race Protection**:
    - *Issue*: Click handlers that run async functions (such as `handleAddQuestion` calling `hashAnswer`) can be clicked multiple times in parallel, reading stale questions array state.
    - *Fix*: Introduce a loading lock state (`isAddingQuestion`) to disable the save button and ignore duplicate clicks while the hash is being calculated.

## 3. Pre-deploy Python Script Corrections
*   **verify_all.py NameError Bug**:
    - *Fix*: Initialize `results = []` at the beginning of the `main()` function in `.agents/scripts/verify_all.py` (before loop iterations) to prevent the `NameError: name 'results' is not defined` crash.
*   **Mismatched Fallback Logic**:
    - *Fix*: Modify directory detection inside `.agents/scripts/checklist.py` and `verify_all.py` from:
      `agent_dir_name = ".agents" if (project_path / ".agents").exists() else ".agents"`
      to:
      `agent_dir_name = ".agents" if (project_path / ".agents").exists() else ".agent"`
    - Make the `--url` argument in `verify_all.py` optional (or have a default fallback) to permit local script dry-runs.

## 4. E2E Playwright Verification Test Suite (`tests/verify-m5.py`)
*   **Test Cases**:
    1. **Bundle Validation**: Verify `dist/knowledge-tug-of-war.js` exists and is < 1200 KB.
    2. **Dynamic Mount**: Load a blank page, inject the compiled bundle, programmatically append the custom element, assert style element attachment, and cleanly unmount.
    3. **Gameplay Loop**: Verify buzz-in, timer ticking, option answering, rope pull background shift, and audio mock call capturing.
    4. **Admin Panel Modals**: Verify toggle unscaled overlay placement, JSON export matching schema, and import schema checks.
    5. **Hardening Scenarios**: Test key spamming rejection, block upload of files >500KB, reject malformed JSON files, and simulate a secure-context exception (undefined `crypto.subtle`) to verify JS fallback validation.

---

## Verification Plan
1. **Compilation Check**: Run `npm run build` to compile custom element and inject inlined styles.
2. **Execute verify-m5.py**: Run `python tests/verify-m5.py` and check `tests/m5_verification_summary.json` for 100% success.
3. **Execute Pre-deploy Suite**: Run `python .agents/scripts/verify_all.py .` to ensure the repaired automation framework executes cleanly.
