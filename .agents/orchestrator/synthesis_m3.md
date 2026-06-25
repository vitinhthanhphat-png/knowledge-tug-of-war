# Synthesis Report — Milestone 3: Local Storage & Web Crypto API

This report aggregates the findings and implementation design proposed by Explorers 1, 2, and 3 for Milestone 3.

## 1. Local Storage Integration & State Sync
* **Storage Key**: `const STORAGE_KEY = 'knowledge_tug_of_war_questions';`
* **On Mount**: Check `localStorage` for questions. If found and non-empty, use them to initialize the XState machine. Otherwise, fall back to `defaultQuestions` (provided by the Custom Element attribute) and immediately save them to `localStorage` to cache them.
* **Mount Overwrite Prevention**: Implement an `isFirstMountRef` inside the dynamic attribute tracking effect to prevent resetting the state to `defaultQuestions` if cached questions were loaded from `localStorage`.
* **Reactive Cache Updates**: Add a side-effect hook in Preact that writes to `localStorage` whenever `state.context.questions` changes in the actor.

## 2. Web Crypto API & Resilient Fallback Hashing (`crypto.ts`)
* **Context Protection**: Web Crypto's `crypto.subtle` is unavailable in non-secure HTTP contexts.
* **Robust Check**: Implement a check for `crypto.subtle` availability. If absent or throws an error, use a pure JS SHA-256 fallback algorithm.
* **Defensive Hashing**:
  * Normalize arguments (`answer` and `salt` default to empty strings if null/undefined) to avoid hashing `"undefined"` or `"null"`.
  * Perform case-insensitive comparisons on the generated hash vs `expectedHash` to support uppercase hex inputs from external JSON sources.

## 3. Toggleable Admin Panel UI & Safe JSON Import/Export
* **Layout Isolation**: Implement an Admin Panel modal that mounts **outside** the 16:9 scaled canvas. This prevents the admin forms and logs from scaling down to an unreadable size on mobile viewports.
* **Admin Toggle**: A small gear button in the game's footer toggles the Admin panel state.
* **FileReader Security**: Restrict file size to 500KB. Handle `onerror` and `onabort` gracefully.
* **Schema & Cryptographic Validation**:
  * Validate JSON format (must be a non-empty array of objects).
  * Validate fields: `id` (non-empty string), `question` (non-empty string), `options` (array of exactly 4 non-empty strings), `answer_hash` (64-char hex string), and `salt` (optional string).
  * Run a cryptographic check: ensure **exactly one option** hashes to `answer_hash` using the specified `salt`. Reject and display detailed logs if zero or multiple options match.
* **Admin Panel Tabs**:
  * **Question List**: View current questions, add custom questions (generating hashes/salts automatically), and delete questions.
  * **Import/Export**: Import JSON (with validation) and export current questions.
  * **Hash Helper**: A utility to generate SHA-256 hashes and salts manually for custom questions.

## 4. 16:9 Scaling Coordination
* Prepare the container layout for Milestone 4 using a standard `ResizeObserver` scaler hook to letterbox the game container while the Admin Panel overlay remains natively scaled at 1.

---

## Verification Plan
1. **Compilation**: Run `npm run build` to ensure there are no compilation or typescript errors.
2. **Persistence**: Import questions, refresh the browser (F5), and verify the imported questions persist in UI and Local Storage.
3. **HTTP Fallback simulation**: Override `crypto.subtle = undefined` in browser console and verify answer submission and correctness validation still work without error.
4. **Invalid JSON Handling**: Attempt to import files with incorrect types, wrong option arrays, or invalid hashes, and verify the UI shows detailed warnings in the validation log.
