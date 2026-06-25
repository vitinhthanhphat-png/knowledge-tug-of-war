# Handoff Report: Security & Hardening Analysis

## 1. Observation

### A. Input Spamming and Race Conditions in Option Selection
In `src/app.tsx`, the `handleOptionClick` function manages double-click prevention via `isSubmitting` React state:
```typescript
586:   const handleOptionClick = async (optionText: string, index: number) => {
587:     if (isSubmitting) return;
588:     setIsSubmitting(true);
...
594:       const isCorrect = await verifyAnswer(optionText, currentQuestion.salt || '', currentQuestion.answer_hash);
...
601:       send({ type: 'SUBMIT_ANSWER', isCorrect });
602:     } catch (err) {
603:       console.error(err);
604:     } finally {
605:       setIsSubmitting(false);
606:     }
607:   };
```
However, the state machine's transition to `result` is triggered synchronously inside `send(...)` but the React component's re-render is asynchronous. The `finally` block runs synchronously in the microtask immediately after `send(...)` completes, setting `isSubmitting` back to `false` *before* the Preact component actually re-renders to the `result` state and disables the buttons (lines 920-958).

### B. Input Spamming via Buzzer Keys
In `src/app.tsx`, the buzzer listener is bound in a `useEffect` dependent on `state.value`:
```typescript
509:   useEffect(() => {
510:     if (state.value !== 'waiting_buzz') return;
511: 
512:     const handleKeyDown = (e: KeyboardEvent) => {
...
528:         const elapsed = Date.now() - roundStartTimeRef.current;
529:         if (elapsed >= 500) {
530:           send({ type: 'BUZZ', team: 'team1' });
531:         }
```
The `roundStartTimeRef.current` is updated in a separate `useEffect` (lines 470-474):
```typescript
470:   useEffect(() => {
471:     if (state.value === 'waiting_buzz') {
472:       roundStartTimeRef.current = Date.now();
473:     }
474:   }, [state.value]);
```
Since React/Preact effects run after the render/paint cycle, if a user spams keys, they might trigger the `handleKeyDown` event handler before the `roundStartTimeRef` effect runs to update `roundStartTimeRef.current`. In this case, `roundStartTimeRef.current` holds the value from the previous round (or 0), which bypasses the 500ms cooldown.

### C. JSON Question Import Validation
In `src/app.tsx`, the validation logic inside `validateQuestionsJSON` performs cryptographic verification of the options against the answer hash in a sequential `for` loop:
```typescript
105:     if (!errors.some(e => e.index === i)) {
...
110:       for (const option of options) {
111:         const isMatch = await verifyAnswer(option, salt, q.answer_hash);
112:         if (isMatch) correctMatches++;
113:       }
```
Additionally, the UI only checks file size at `handleSecureImportJSON`:
```typescript
618:       if (file.size > 500 * 1024) {
```
There is no maximum size limit check inside `validateQuestionsJSON` itself. A 500KB JSON payload can hold more than 1,000 questions, meaning up to 4,000 sequential async cryptographic hash calculations will run on the main thread, potentially causing the browser tab to hang.

Furthermore:
- Duplicate question `id` values are not checked.
- Duplicate answer options are not checked.
- Extra keys or properties outside the expected schema are parsed and not rejected (although stripped during the mapping phase).

### D. XState Transitions and Locks
In `src/state-machine.ts`, the `IMPORT_QUESTIONS` event is handled in the `waiting_buzz` state:
```typescript
83:         IMPORT_QUESTIONS: {
84:           actions: assign(({ event }) => ({
85:             questions: event.questions,
86:           })),
87:         },
```
If new questions are imported while the game is active (in `waiting_buzz` state), the `currentQuestionIndex` remains unchanged. If the imported array is shorter than `currentQuestionIndex`, `questions[currentQuestionIndex]` will return `undefined`, causing UI rendering bugs or empty displays.

### E. Cryptographic Fallback
In `src/crypto.ts`, `hashAnswer` checks for Web Crypto Subtle:
```typescript
105:   // Guard Web Crypto Subtle check
106:   const hasSubtleCrypto = typeof globalThis !== 'undefined' &&
107:     globalThis.crypto &&
108:     typeof globalThis.crypto.subtle !== 'undefined' &&
109:     typeof globalThis.crypto.subtle.digest === 'function';
```
If Web Crypto is not supported, it correctly falls back to `sha256Fallback`. However, on line 102:
```typescript
102:   const encoder = new TextEncoder();
103:   const data = encoder.encode(cleanAnswer + cleanSalt);
```
`TextEncoder` is instantiated and used *before* the fallback is reached. In very old browser environments where `TextEncoder` is undefined, this throws a `ReferenceError` before it can fall back.

---

## 2. Logic Chain

1. **Option Double-Submission**: The synchronous nature of XState's transition compared to React's asynchronous render cycle creates a race window. Because `isSubmitting` is set to `false` in the microtask queue synchronously (via `finally` right after `send`), and the DOM is not yet updated to disable the option buttons, a user can successfully click options multiple times. This triggers duplicate verify calls and audio playbacks.
2. **Bypassable Cooldown**: Because `roundStartTimeRef` and the keydown event listener are updated via two separate post-render `useEffect` hooks, there is a race condition. If a keypress event is captured immediately after the state changes but before the effects execute, it will evaluate the cooldown using an old (or 0) timestamp, allowing the player to bypass the 500ms buzz cooldown.
3. **Denial of Service (DoS) in JSON Import**: 
   - A 500KB JSON payload is large enough to contain ~1,500 questions.
   - Sequential loops containing `await` force the JS event loop to yield on every single check. If the browser falls back to the synchronous `sha256Fallback` (e.g. in insecure HTTP contexts), it will run 6,000+ hashes completely blocking the main thread.
   - The lack of array length restrictions and parallel validation will cause browser freezing or crashes.
4. **Out-of-Bounds Crash**: Allowing imports during the active game (`waiting_buzz`) without clamping or resetting the index will result in accessing `undefined` in the questions array, breaking UI state.
5. **TextEncoder Reference Error**: Standard JS environments that do not support Web Crypto Subtle (like old mobile WebViews or legacy browsers) are also highly likely to lack `TextEncoder`. Since `TextEncoder` is initialized unconditionally, the fallback mechanism is defeated, and the app will crash with a `ReferenceError`.

---

## 3. Caveats
- The `TextEncoder` crash was not executed on a legacy device but is inferred from the standard MDN compatibility guidelines (where Web Crypto and TextEncoder support tables align, but legacy engines lack both).
- We assume standard single-threaded browser JS execution context.

---

## 4. Conclusion
The application is vulnerable to input spamming (resulting in double submissions and cooldown bypasses), browser freezing during large imports, out-of-bounds UI states on hot imports, and fallback failures in legacy browsers.

### Proposed Hardening Solutions:
1. **Option Selection Locking**:
   - Check the synchronous XState snapshot value before executing the click logic:
     ```typescript
     const currentSnapshot = actor.getSnapshot();
     if (isSubmitting || currentSnapshot.value !== 'answering') return;
     ```
2. **Guaranteed Cooldown Time**:
   - Update `roundStartTimeRef.current` synchronously inside the state machine's subscription callback rather than in a `useEffect` hook:
     ```typescript
     actor.subscribe((nextState) => {
       if (nextState.value === 'waiting_buzz' && state.value !== 'waiting_buzz') {
         roundStartTimeRef.current = Date.now();
       }
       setState(nextState);
     });
     ```
3. **JSON Import Security Hardening**:
   - Limit string length before parsing:
     ```typescript
     if (fileContent.length > 500 * 1024) throw new Error('File size exceeds 500KB');
     ```
   - Limit max questions to 50:
     ```typescript
     if (parsed.length > 50) throw new Error('Maximum questions limit (50) exceeded');
     ```
   - Enforce duplicate check for `id` values and `options` elements.
   - Optimize cryptographic checking using `Promise.all` to parallelize options hashing:
     ```typescript
     const results = await Promise.all(q.options.map(opt => verifyAnswer(opt, salt, q.answer_hash)));
     ```
   - Ban unknown keys on question objects.
4. **Transition Security**:
   - Prevent `IMPORT_QUESTIONS` when the game is not in the `idle` state, or force a reset to `idle` upon import.
5. **Robust Cryptographic Fallback**:
   - Implement a manual UTF-8 encoder fallback if `TextEncoder` is undefined.

---

## 5. Verification Method

### Manual Verification Instructions
1. **Option Spamming**:
   - Go to the game in `answering` state.
   - Double-click the correct answer very rapidly. Observe if the correct sound plays twice or if duplicate logs appear.
2. **Cooldown Bypass**:
   - End a round and wait for the transition to `waiting_buzz`.
   - Rapidly press Space or Enter at the exact moment the transition occurs. Verify if the buzzer registers a buzz before 500ms has elapsed.
3. **Large JSON DoS Test**:
   - Create a JSON file of 490KB containing 1,500 questions.
   - Import it via the Admin Panel and check if the browser tab freezes or hangs.
4. **Malformed JSON Test**:
   - Import JSONs containing:
     - Duplicate question IDs.
     - Questions with 5 options instead of 4.
     - Primitive values inside the array.
     - Extra fields (e.g. `{"id": "q1", "question": "...", "options": [...], "answer_hash": "...", "evil_field": "X".repeat(100000)}`).
5. **Subtle Crypto and TextEncoder Absence**:
   - Run the app in a browser console/test environment where `window.crypto` is mocked to `undefined` or delete `window.TextEncoder`.
   - Verify if answering questions still functions correctly.
