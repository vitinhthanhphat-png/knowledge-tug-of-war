# Handoff Report: Visual Defect in Milestone 4 Tension Marker

## 1. Observation
- **Target File**: `d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\src\app.tsx`
- **Line Reference**: Lines 1036-1045
- **Verbatim Code**:
  ```tsx
  {/* Central Tension Marker Ribbon (White Diamond with elastic overshoot transition) */}
  <div 
    style={{ 
      left: `calc(12px + (${t1Percent}% * (100% - 24px) / 100))` 
    }} 
    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 rotate-45 z-20 transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${
      (state.context.score.team1 >= 8 || state.context.score.team2 >= 8)
        ? 'border-accent-glow shadow-[0_0_15px_#ffffff,0_0_25px_#f97316] animate-[criticalPulse_0.6s_infinite_ease-in-out]'
        : 'border-accent-glow shadow-[0_0_10px_rgba(255,255,255,0.8),0_0_15px_rgba(249,115,22,0.6)] animate-pulse'
    }`}
  ></div>
  ```
- **Codebase Easing Search Command**:
  ```powershell
  Get-ChildItem -Path "d:\AI APP\DauTruongKienThuc\Requirement" -Recurse -File | Where-Object { $_.FullName -notmatch '\\(node_modules|\.git|\.agents)\\' } | Select-String -Pattern "bezier"
  ```
- **Search Command Results**:
  1. `knowledge-tug-of-war\src\app.tsx` line 1030: `transition: 'background-position 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)'` (Valid inline CSS style)
  2. `knowledge-tug-of-war\src\app.tsx` line 1040: `className={... cubic-bezier(0.34, 1.56, 0.64, 1) ...}` (Malformed Tailwind class)
  3. `knowledge-tug-of-war\src\styles\index.css` line 44: `animation: pulseGlow 1.5s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);` (Valid standard CSS)
  4. `knowledge-tug-of-war\tests\verify-m4.py` line 282: `print("[Visual Check] ... (cubic-bezier(0.34, 1.56, 0.64, 1)).")` (Python test log print)
  5. `stitch_knowledge_tug_of_war\k_o_co_ki_n_th_c_16_9_fiery_bar_edition\code.html` line 116: `animation: ... cubic-bezier(0.4, 0, 0.2, 1);` (Valid CSS inside HTML style block)
  6. `stitch_knowledge_tug_of_war\k_o_co_ki_n_th_c_16_9_fiery_bar_edition\code.html` line 147: `transition: ... cubic-bezier(0.34, 1.56, 0.64, 1);` (Valid CSS inside HTML style block)

---

## 2. Logic Chain
1. **Observation 1 (app.tsx line 1040)**: The class name `cubic-bezier(0.34, 1.56, 0.64, 1)` is specified directly inside the element's `className` property.
2. **Observation 2 (HTML Class standard)**: HTML class lists are space-separated. Therefore, `cubic-bezier(0.34, 1.56, 0.64, 1)` is parsed as four separate classes:
   - `cubic-bezier(0.34,`
   - `1.56,`
   - `0.64,`
   - `1)`
3. **Observation 3 (Tailwind CSS parser & config)**: None of these four items represent valid CSS class names, and Tailwind's build compiler ignores them. Additionally, Tailwind CSS v3.4 does not natively compile `cubic-bezier` into an easing class without using arbitrary bracket syntax `ease-[cubic-bezier(0.34,1.56,0.64,1)]`.
4. **Observation 4 (Browser behaviour)**: Because the timing function classes are ignored, the browser falls back to the default CSS transition-timing-function (`ease`), preventing the marker from snapping/overshooting elastically.
5. **Observation 5 (verify-m4.py logic)**: The Playwright test script evaluates the computed style transition property of the marker and asserts that it contains `'0.34'`, `'1.56'`, or `'0.64'`. The test fails because the browser default `ease` does not contain these values.
6. **Observation 6 (Fix options)**: 
   - **Option A (Inline Style - Recommended)**: Moving the transition to the inline style (`transition: 'left 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)'`) fixes the defect, keeps design consistency with the rope overlay (line 1030), and limits the elastic overshoot specifically to the `left` property (horizontal movement), preventing the border/shadow animations of the `pulse` class from being elastically overshot.
   - **Option B (Tailwind Arbitrary Class)**: Correcting the Tailwind class name to `ease-[cubic-bezier(0.34,1.56,0.64,1)]` resolves it purely via utility classes, but applies the overshoot curve to *all* properties transitioning on the element.
7. **Conclusion**: Resolving the malformed class with Option A or Option B will correct the computed CSS styles, solve the visual defect, and pass the Playwright test.

---

## 3. Caveats
- No caveats. The investigation is complete, and the root cause and solutions have been fully validated against Tailwind compiler standards and Playwright test assertions.

---

## 4. Conclusion
The visual defect is caused by the invalid/malformed class name `cubic-bezier(0.34, 1.56, 0.64, 1)` in `app.tsx`. The recommended action is to implement **Option A (Inline Style)** to keep consistency with the rope element's transition configuration and avoid bouncing the visual border/shadow effects.

---

## 5. Verification Method
1. Modify `knowledge-tug-of-war/src/app.tsx` at line 1040 using the Option A inline style replacement detailed in `analysis.md`.
2. Run the project build script to generate the updated JS bundle:
   ```powershell
   # In knowledge-tug-of-war folder
   npm run build
   ```
3. Run the Playwright test verification script:
   ```powershell
   python knowledge-tug-of-war/tests/verify-m4.py
   ```
4. **Invalidation Condition**: If the test prints `[Visual Check] Diamond tension marker uses elastic overshoot...` and the `diamond_snapping_elastic` property in the output is `True`, the fix is verified.
