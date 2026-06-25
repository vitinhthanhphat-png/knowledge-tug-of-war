# Handoff Report - Reviewer M3 2

## 1. Observation
- **Modified files**:
  - `knowledge-tug-of-war/src/crypto.ts`
  - `knowledge-tug-of-war/src/app.tsx`
- **Build execution**: `npm run build` ran successfully with output:
  ```
  vite v5.4.21 building for production...
  transforming...
  ✓ 15 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/knowledge-tug-of-war.js  100.98 kB │ gzip: 31.24 kB
  ✓ built in 745ms
  ```
- **Verification execution**: `python tests/verify-m3.py` executed successfully and all assertions passed. The resulting summary at `tests/m3_verification_summary.json` confirms:
  - `initial_cache_load`: `true`
  - `fallback_to_default`: `true`
  - `mount_protection`: `true`
  - `reactive_sync`: `true`
  - `fallback_active_without_subtle`: `true`
  - `case_insensitivity`: `true`
  - `null_undefined_safety`: `true`
  - `import_validation_size_limit`: `true`
  - `import_validation_schema`: `true`
  - `import_validation_crypto_none_match`: `true`
  - `import_validation_crypto_multi_match`: `true`
  - `import_validation_success`: `true`
- **Key Code snippets observed**:
  - **Mount Protection** (`app.tsx` lines 235-247):
    ```typescript
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
    ```
  - **JSON Schema and Cryptographic Verification** (`app.tsx` lines 103-127):
    ```typescript
    // Cryptographic validation (Ensure exactly one option matches the answer hash)
    if (!errors.some(e => e.index === i)) {
      const salt = q.salt || '';
      const options = q.options as string[];
      let correctMatches = 0;

      for (const option of options) {
        const isMatch = await verifyAnswer(option, salt, q.answer_hash);
        if (isMatch) correctMatches++;
      }

      if (correctMatches === 0) {
        errors.push({
          index: i,
          questionId: qId,
          message: `${prefix} Lỗi kiểm tra băm: Không có đáp án nào khớp với 'answer_hash'. Kiểm tra lại đáp án đúng và salt.`
        });
      } else if (correctMatches > 1) {
        errors.push({
          index: i,
          questionId: qId,
          message: `${prefix} Lỗi kiểm tra băm: Có nhiều hơn 1 đáp án khớp với 'answer_hash'.`
        });
      }
    }
    ```
  - **Web Crypto Fallback** (`crypto.ts` lines 105-121):
    ```typescript
    const hasSubtleCrypto = typeof globalThis !== 'undefined' &&
      globalThis.crypto &&
      typeof globalThis.crypto.subtle !== 'undefined' &&
      typeof globalThis.crypto.subtle.digest === 'function';
      
    if (hasSubtleCrypto) {
      try {
        const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (err) {
        console.warn("Web Crypto API failed, falling back to pure JS implementation:", err);
      }
    }
    return sha256Fallback(data);
    ```
  - **Aspect Ratio Scaler and Admin Overlay Sibling rendering** (`app.tsx` lines 525-541, 773-776):
    ```typescript
    const { containerRef, scale } = useAspectRatioScaler(960, 540);
    // ...
    return (
      <div className="w-full h-full min-h-[540px] ... relative">
        <div ref={containerRef} style={{ transform: `scale(${scale})` }} ...>
          ...
        </div>
        {isAdminOpen && (
          <div className="absolute inset-0 ... z-50 ...">
            ...
          </div>
        )}
      </div>
    );
    ```

## 2. Logic Chain
- **Point 1 (Local Storage Caching)**: The initialization flow correctly parses existing storage or defaults back (with instant writeback). The `isFirstMountRef` check successfully stops default attributes from rewriting user-defined storage on mount, while still allowing dynamic changes later. The `useEffect` correctly triggers storage writes reactively on `state.context.questions` changes.
- **Point 2 (Cryptographic Validation & Fallback)**: The `hasSubtleCrypto` guard allows the app to fallback transparently to pure-JS SHA-256 (`sha256Fallback`) when `window.crypto.subtle` is undefined (e.g. non-secure HTTP contexts). Case-insensitivity is achieved via `expectedHash.toLowerCase()`, and safety is ensured by treating null/undefined values as empty strings.
- **Point 3 (Admin Panel & File Safety)**: Safe file uploads are guaranteed by checking `file.size > 500 * 1024` before reading. Schema validation enforces specific format types, and cryptographic checks reject JSONs where any question has 0 or >1 options matching the expected hash. Tab layouts correctly separate the questions editor, JSON import/export, and hash helper.
- **Point 4 (Scale Coordination)**: The container scales to parent boundaries preserving aspect ratio. Since the overlay container is rendered as a sibling to the scaled game canvas rather than inside it, it ignores the scale transform and renders natively, preventing clipping or distortion.

## 3. Caveats
- Playwright's `set_files` function requires standard forward slashes on Windows environments due to driver execution boundaries; `verify-m3.py` has been updated to standardize these paths.

## 4. Conclusion
- The implementation is complete, secure, robust, and correctly meets all Milestone 3 criteria.
- **Verdict**: APPROVED.

## 5. Verification Method
- Execute the build command:
  ```powershell
  cd "d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war"
  npm run build
  ```
- Run the automated python verification script:
  ```powershell
  python tests/verify-m3.py
  ```
- Verify the test summary file:
  `d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\tests\m3_verification_summary.json`
