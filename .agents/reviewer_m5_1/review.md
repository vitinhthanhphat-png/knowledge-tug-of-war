# MILESTONE 5 QUALITY & ADVERSARIAL REVIEW REPORT

This report evaluates code correctness, completeness, layout conformance, and hardening integrity for Milestone 5 (Web Component Bundling & Hardening) of the Knowledge Tug of War Web Component.

---

## Part 1: Quality Review Report

### Review Summary

**Verdict**: APPROVE

The implementation of Milestone 5 meets all criteria for correct dynamic Web Component bundling, dynamic mounting, local storage synchronization, JSON schema validation, cryptographic fallback, and input spam protection. The test scripts verify all E2E requirements successfully.

---

### Findings

#### [Minor] Finding 1: Type Coverage Tool Reports False Positives
- **What**: The regex-based `type_coverage.py` checker reports a 42% type coverage score (too low) and fails, despite TypeScript compiling successfully with zero warnings/errors.
- **Where**: `.agents/skills/lint-and-validate/scripts/type_coverage.py`
- **Why**: The checker relies on simple regex matches (`function \w+\([^)]*\)\s*:\s*\w+`) to verify type annotations. Since the code leverages TypeScript type inference for component and helper return types (standard React/Preact practice), the script marks them as "untyped".
- **Suggestion**: Explicitly annotate the return types of all exported hooks and helper functions in `src/app.tsx` and `src/main.tsx`, or update the `type_coverage.py` regex checks to parse AST or lower its strictness threshold.

#### [Minor] Finding 2: Missing lang Attribute and Keyboard Handlers (WCAG Accessibility)
- **What**: Static accessibility check (`accessibility_checker.py`) reports warnings about missing `lang` attributes on `<html>` tags in HTML files and missing keyboard handlers for `onClick` events.
- **Where**: `dist-test.html`, `index.html`, `code.html`, and `src/app.tsx`
- **Why**: Standard WCAG compliance requires declaring a language on root HTML document elements, and elements with interactive click handlers should support keyboard interactions.
- **Suggestion**: Add `lang="vi"` (or `lang="en"`) to all HTML documents, and add `onKeyDown` listeners to clickable buttons where appropriate.

---

### Verified Claims

- **Reconnection Duplication Guard** → Verified via code inspection and playwright execution tests → **PASS**
  - *Detail*: `connectedCallback()` checks if `this.mountPoint` or `div.w-full.h-full.relative.overflow-hidden` already exists in the Shadow Root. It does not create duplicate mount points, and `disconnectedCallback()` correctly unmounts the Preact application.
- **Programmatic Getters/Setters** → Verified via code inspection and E2E simulation → **PASS**
  - *Detail*: Property `defaultQuestions` has defined getter and setter methods on the `KnowledgeTugOfWarElement` class, which sanitizes dynamically assigned arrays.
- **JSON Validator and String Length Limits** → Verified via `verify-m5.py` upload simulation → **PASS**
  - *Detail*: File uploads larger than 500KB are blocked. The JSON schema enforces question limits (<= 100 questions, question text <= 500 characters, options array length exactly 4, option string <= 100 characters, salt <= 64 characters) and verifies that exactly 1 option hashes to `answer_hash` using the provided salt.
- **Input Spam Protection** → Verified via E2E playwright stress test → **PASS**
  - *Detail*: Ref-based lock `isSubmittingRef.current` halts click spam during cryptographic hashing, and a 500ms delay since the round starts prevents instant-buzz script macros.
- **Python Script Platform Compatibility** → Verified via manual command runs on Windows → **PASS**
  - *Detail*: `verify_all.py`, `checklist.py`, and `auto_preview.py` have the `io.TextIOWrapper` UTF-8 wrapper correctly integrated, preventing Windows console encoding issues.

---

### Coverage Gaps

- **JSON File Upload Content-Type Check** — Risk level: **Low** — *Recommendation*: Accept Risk. The file extension is limited to `.json` in the file chooser, and `JSON.parse` will throw on non-JSON content.
- **Admin Panel Question Cap** — Risk level: **Medium** — *Recommendation*: Investigate/Fix. (See Challenge 1 below).

---

### Unverified Items

- None. All major criteria were verified through code analysis and browser testing.

---

## Part 2: Adversarial Challenge Report

### Challenge Summary

**Overall risk assessment**: LOW

The hardening measures successfully protect against most client-side exploits and spamming attempts. However, the admin panel's manual additions bypass some bounds checks.

---

### Challenges

#### [Medium] Challenge 1: Absence of Total Count Limits in Manual Additions
- **Assumption challenged**: Question count limit (<= 100) is enforced on imports and initial values, implying total loaded questions will not exceed the limit.
- **Attack scenario**: A malicious admin or script could trigger the manual "+ Lưu câu hỏi" button or trigger `handleAddQuestion` repeatedly. The handler `handleAddQuestion` appends the question without checking whether the total questions count has exceeded the limit.
- **Blast radius**: The questions array can grow indefinitely in-memory and overflow local storage (exceeding browser quota), causing write crashes.
- **Mitigation**: Update `handleAddQuestion` in `app.tsx` to check if `state.context.questions.length >= 100` before appending and show an alert if the limit is reached.

#### [Low] Challenge 2: Salt Unicode Normalization Sensitivity
- **Assumption challenged**: Salt strings are raw character sequences.
- **Attack scenario**: If a question author uses unicode characters in the salt or correct answer, different browsers or OS platforms might represent them in different normalization forms (NFC vs NFD), leading to cryptographic validation failure.
- **Blast radius**: Answers that are spelling-wise correct fail to match the hash, causing false validation errors.
- **Mitigation**: Standardize both the answer text and salt by calling `str.normalize("NFC")` before hashing.

---

### Stress Test Results

- **Simultaneous Button Click Spam** → Parallel clicks trigger `OPTION_CLICK` event exactly once → **PASS**
- **Keyboard Buzz Macro Spam** → Repeated rapid space/enter keystrokes trigger `BUZZ` event exactly once → **PASS**
- **Oversized Import (505KB File)** → Blocked by size guard with "vượt quá giới hạn" error → **PASS**
- **Crypto Subtle Web API Disabling** → Subtle API disabled; fallback pure JS SHA-256 runs and verifies answers successfully → **PASS**

---

### Unchallenged Areas

- **Backend Socket State Mismatches** — Out of scope. The component is standalone client-side.
