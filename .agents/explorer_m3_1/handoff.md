# Handoff Report — Explorer 1 (Milestone 3: Local Storage Caching)

## 1. Observation
From inspecting the codebase, the following files and code snippets govern the state initialization, question importing, and mounting:

* **File: `knowledge-tug-of-war/src/app.tsx` (Lines 27–54)**:
  ```typescript
  export function App({ theme, defaultQuestions }: AppProps) {
    // Custom useActor subscription logic to keep dependencies minimal
    const actor = useMemo(() => {
      return createActor(tugOfWarMachine, {
        input: { questions: defaultQuestions }
      }).start();
    }, []);

    const [state, setState] = useState(() => actor.getSnapshot());

    useEffect(() => {
      const subscription = actor.subscribe((nextState) => {
        setState(nextState);
      });
      return () => {
        subscription.unsubscribe();
        actor.stop();
      };
    }, [actor]);

    const send = actor.send;

    // Track dynamic attribute changes from host element
    useEffect(() => {
      if (defaultQuestions && defaultQuestions.length > 0) {
        send({ type: 'IMPORT_QUESTIONS', questions: defaultQuestions });
      }
    }, [defaultQuestions, send]);
  ```

* **File: `knowledge-tug-of-war/src/state-machine.ts` (Lines 43–52, 83–87)**:
  ```typescript
      idle: {
        on: {
          IMPORT_QUESTIONS: {
            actions: assign(({ event }) => ({
              questions: event.questions,
              currentQuestionIndex: 0,
              importError: null,
            })),
          },
  ```
  ```typescript
        waiting_buzz: {
          ...
          on: {
            ...
            IMPORT_QUESTIONS: {
              actions: assign(({ event }) => ({
                questions: event.questions,
              })),
            },
  ```

* **File: `knowledge-tug-of-war/src/main.tsx` (Lines 42–65)**:
  ```typescript
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
  ```

## 2. Logic Chain
1. **Local Storage Key Definition**: To cache questions, we define a standard key constant `const STORAGE_KEY = 'knowledge_tug_of_war_questions';`.
2. **Initialization Flow (Component Mount)**: 
   * When `App` mounts, `useMemo` (lines 29–33) initializes the actor.
   * To check Local Storage first, we read `localStorage.getItem(STORAGE_KEY)` inside `useMemo`. If a valid JSON array exists and is not empty, we assign it as the initial questions for the actor.
   * If Local Storage is empty or fails to parse, we fall back to the `defaultQuestions` prop (parsed from the web component's `default-questions` attribute in `main.tsx`).
   * If we fall back to `defaultQuestions` and it contains questions, we write them immediately to Local Storage to ensure they are cached for subsequent reloads.
3. **Mount-Time Overwrite Protection**:
   * The `useEffect` (lines 50–54) tracks changes to `defaultQuestions` and imports them.
   * On initial mount, this effect triggers because the `defaultQuestions` prop is loaded. If Local Storage was populated, the effect would immediately call `IMPORT_QUESTIONS` and overwrite the cache with the attribute values.
   * To prevent this, we introduce `const isFirstMountRef = useRef(true);`.
   * On the first run of the effect, if the state machine already has questions (meaning they were loaded from Local Storage in `useMemo`), we skip the import.
   * On subsequent runs (when the attribute is explicitly modified after mount), `isFirstMountRef.current` is `false`, so we perform the import normally.
4. **IMPORT_QUESTIONS Caching Trigger**:
   * When `IMPORT_QUESTIONS` is dispatched (either from manual JSON file upload in `handleImportJSON` or dynamic attribute changes), the XState machine updates `state.context.questions`.
   * The Preact component is subscribed to the actor state changes.
   * We add a Preact `useEffect` that depends on `state.context.questions`. When the questions change in the actor's context, the effect writes the updated list back to Local Storage.

## 3. Caveats
* **`localStorage` Access Errors**: Accessing `localStorage` can throw exceptions if cookies/storage are blocked by the browser. All interactions are wrapped in `try-catch` blocks to ensure the component remains functional.
* **XState Purity**: No Local Storage logic is placed inside `state-machine.ts`, preserving the purity of the state machine. This keeps the game logic decoupled from the browser runtime and makes unit testing simple.
* **Component Re-mounts**: Since the actor is created inside `useMemo` with an empty dependency array `[]`, it remains stable across re-renders. If the component completely unmounts, the state is correctly re-initialized by reading the cache from Local Storage again on the next mount.

## 4. Conclusion
We propose a highly cohesive and robust caching strategy implemented entirely within the Preact component boundary (`app.tsx`). The main Web Component entry (`main.tsx`) and the state machine definition (`state-machine.ts`) do not require modifications, as all storage side-effects are decoupled reactively.

### Proposed Code Changes in `knowledge-tug-of-war/src/app.tsx`

```typescript
// Proposed additions & edits for app.tsx

// 1. Add STORAGE_KEY constant after imports
const STORAGE_KEY = 'knowledge_tug_of_war_questions';

// 2. Inside App component, initialize actor checking Local Storage:
export function App({ theme, defaultQuestions }: AppProps) {
  const isFirstMountRef = useRef(true);

  const actor = useMemo(() => {
    let initialQuestions = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialQuestions = parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load questions from Local Storage:', e);
    }

    // Fall back to attribute questions if Local Storage is empty
    if (initialQuestions.length === 0 && defaultQuestions && defaultQuestions.length > 0) {
      initialQuestions = defaultQuestions;
      // Cache the fallback questions
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialQuestions));
      } catch (e) {
        console.error('Failed to save default questions to Local Storage:', e);
      }
    }

    return createActor(tugOfWarMachine, {
      input: { questions: initialQuestions }
    }).start();
  }, []);

  const [state, setState] = useState(() => actor.getSnapshot());

  // 3. Update the dynamic attribute tracking effect to protect mount state:
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      const currentQuestions = actor.getSnapshot().context.questions;
      if (currentQuestions.length === 0 && defaultQuestions && defaultQuestions.length > 0) {
        send({ type: 'IMPORT_QUESTIONS', questions: defaultQuestions });
      }
    } else {
      if (defaultQuestions && defaultQuestions.length > 0) {
        send({ type: 'IMPORT_QUESTIONS', questions: defaultQuestions });
      }
    }
  }, [defaultQuestions, send, actor]);

  // 4. Add effect to write back to Local Storage reactively:
  useEffect(() => {
    if (state.context.questions && state.context.questions.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.context.questions));
      } catch (e) {
        console.error('Failed to save questions to Local Storage:', e);
      }
    }
  }, [state.context.questions]);
```

## 5. Verification Method
1. **Compilation Check**: Run `npm run build` to ensure the changes compile cleanly and meet TypeScript type checks.
2. **First-load / Default Caching**:
   * Set the `<knowledge-tug-of-war>` element with a `default-questions` attribute containing a JSON array of questions.
   * Open the page, open DevTools, and run `localStorage.getItem('knowledge_tug_of_war_questions')` in the console. Verify that the default questions are serialized and cached in Local Storage.
3. **Cache Prioritization on Reload**:
   * Modify one of the questions directly in Local Storage via `localStorage.setItem('knowledge_tug_of_war_questions', ...)` with a custom question title (e.g. `"Cached Question"`).
   * Reload the page. Verify that the UI displays the customized cached question from Local Storage, ignoring the `default-questions` attribute.
4. **Dynamic Import Updates**:
   * Use the "IMPORT JSON" button to upload a new question set.
   * Check Local Storage and verify that it has been updated with the newly imported questions.
   * Change the `default-questions` attribute programmatically in the console:
     `document.querySelector('knowledge-tug-of-war').setAttribute('default-questions', '...')`.
     Verify that the app updates with the new questions and caches them in Local Storage.
