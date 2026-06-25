# Handoff Report — Milestone 3 (Local Storage & Web Crypto API)

## 1. Observation
Direct observations in the codebase and test execution:
- **Files Modified**:
  - `knowledge-tug-of-war/src/crypto.ts`: Replaced lines 1–30 (all contents) with pure JS SHA-256 fallback algorithm, null/undefined normalizations, and case-insensitive check.
  - `knowledge-tug-of-war/src/app.tsx`: Added `STORAGE_KEY`, `getInitialQuestions`, `validateQuestionsJSON`, `useAspectRatioScaler` hooks, and integrated them into the `App` component. Admin Panel controls were moved into a tabbed modal outside the scaled 16:9 container.
- **Verification Commands & Results**:
  - Initial build and final build command: `npm run build` executed inside `d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war`.
    Result:
    ```
    > knowledge-tug-of-war@1.0.0 build
    > tsc && vite build

    vite v5.4.21 building for production...
    transforming...
    ✓ 15 modules transformed.
    rendering chunks...
    computing gzip size...
    dist/knowledge-tug-of-war.js  100.98 kB │ gzip: 31.24 kB
    ✓ built in 719ms
    ```
  - Automated tests command: `python tests/verify-m3.py` executed inside `d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war`.
    Result:
    ```
    [Test Pass] Fallback to default and initial cache write works.
    [Test Pass] Cache load prioritizes over defaultQuestions attribute.
    [Test Pass] Admin panel opens on gear click.
    [Test Pass] Admin modal renders outside the scaled container.
    [Test Pass] Invalid schema correctly rejected with error logs.
    [Test Pass] Invalid crypto (no correct option) correctly rejected.
    [Test Pass] Invalid crypto (multiple correct options) correctly rejected.
    [Test Pass] Valid JSON question successfully imported and rendered.
    [Test Pass] Answer validation works perfectly without window.crypto.subtle.
    ```
  - Pure JS fallback correctness test: `node .agents/explorer_m3_2/test_sha256.js` executed inside `d:\AI APP\DauTruongKienThuc\Requirement`.
    Result:
    ```
    All tests passed successfully!
    ```

## 2. Logic Chain
1. **HTTP context safety check**: Under non-secure HTTP environments, `window.crypto.subtle` is `undefined`. To prevent crashes, `hashAnswer` dynamically checks the availability of `SubtleCrypto`. If unavailable or if it throws a security error, it redirects inputs to a self-contained, pure JS SHA-256 fallback (`sha256Fallback`) that outputs lowercase hex.
2. **Defensive normalization**: Concatenating null or undefined strings produces hashes of `"null"` or `"undefined"`. Parameter defaults and fallback assignments (`answer || ""` and `salt || ""`) in `crypto.ts` prevent these vulnerabilities.
3. **Case-insensitive matching**: Comparisons of hexadecimal values from external files with internal hashes can fail if case mismatches occur (e.g. uppercase hex strings in imports). Normalizing both to lowercase (`hash.toLowerCase() === expectedHash.toLowerCase()`) mitigates this.
4. **Local Storage Caching & Mount protection**:
   - `getInitialQuestions` reads `localStorage` before falling back to `defaultQuestions`.
   - On the first mount, `isFirstMountRef` is checked; if questions are already present in the actor (loaded from `localStorage`), the `IMPORT_QUESTIONS` action for the `defaultQuestions` attribute is skipped. This prevents overwriting custom cached questions.
5. **Secure Import Validation**:
   - Limit file size to 500KB (`file.size > 500 * 1024`) to avoid DOS attacks.
   - Graceful file reader abort/error triggers.
   - Schema validation ensures array/object structure and type matches.
   - Cryptographic check counts matches between option hashes and `answer_hash` using `verifyAnswer`. Imports are rejected unless `correctMatches === 1`.
6. **Layout Isolation**: Toggling `isAdminOpen` overlays the Admin Panel modal natively at `scale: 1` over the screen, while `useAspectRatioScaler` letterbox-scales the 16:9 canvas beneath it. Positioning the modal outside the scaled wrapper prevents unreadable sizes on small devices.

## 3. Caveats
- No caveats. The implementation covers all edge cases (non-secure context, case mismatch, mount overwrite, file size limits, invalid schema logs, single matching hash check) and is fully verified by automated browser verification.

## 4. Conclusion
Milestone 3 is fully implemented and passes all TypeScript compiling, static bundling, and Playwright verification checks.

## 5. Verification Method
To independently verify the implementation:
1. Navigate to the project folder:
   `cd "d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war"`
2. Run compilation:
   `npm run build`
   Confirm that it builds without typecheck errors and generates `dist/knowledge-tug-of-war.js`.
3. Run the automated Playwright test suite:
   `python tests/verify-m3.py`
   Confirm that all nine verification assertions print `[Test Pass]` and `m3_verification_summary.json` contains no errors.
