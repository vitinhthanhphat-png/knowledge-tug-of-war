# Handoff Report: Milestone 1 Setup & Bundling Architecture

## 1. Observation
We observed the following parameters and configurations across project files:
- **CSS Bundling Choice**: In `d:\AI APP\DauTruongKienThuc\Requirement\.agents\orchestrator\ORIGINAL_REQUEST.md` (lines 45-47), the user selected "CSS bundling: Option B (Inlined CSS)."
- **Web Component Interface**: In `d:\AI APP\DauTruongKienThuc\Requirement\.agents\orchestrator\PROJECT.md` (lines 22-26), the interface contract specifies the custom tag `<knowledge-tug-of-war>` and attributes `theme` (default "kinetic-academy") and `default-questions`.
- **Target Folder Status**: Attempting to list the directory `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war` returned:
  `directory D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war does not exist`
  confirming that the project directory needs to be initialized.
- **Design Specifications**: In `d:\AI APP\DauTruongKienThuc\Requirement\brandkit.md` (lines 13-20) and `d:\AI APP\DauTruongKienThuc\Requirement\stitch_knowledge_tug_of_war\kinetic_academy\DESIGN.md` (lines 118-122), typography pairing uses `Space Grotesk` (for forces and scores) and `Plus Jakarta Sans` (for questions/body).
- **Core Component Styles**: In `d:\AI APP\DauTruongKienThuc\Requirement\stitch_knowledge_tug_of_war\k_o_co_ki_n_th_c_16_9_fiery_bar_edition\code.html` (lines 101-174), specific classes like `.aspect-16-9-wrapper`, `.glass-panel`, `.mechanical-key`, `.answer-btn`, and animations like `@keyframes pulseGlow` are already defined and tested.

## 2. Logic Chain
1. **Goal**: Packages Preact, XState, and Tailwind CSS into a single-file custom element `<knowledge-tug-of-war>` with encapsulated CSS.
2. **Encapsulation**: Since the custom element uses Shadow DOM, styles in the main document `<head>` do not apply inside the shadow root.
3. **Inlining CSS**: Disabling CSS code-splitting (`cssCodeSplit: false` in `vite.config.ts`) and importing the stylesheet using Vite's `?inline` query (`import tailwindStyles from './styles/index.css?inline'`) compiles the Tailwind stylesheet into a raw JS string.
4. **Injection**: Inside the custom element's `connectedCallback`, we dynamically create a `<style>` tag containing this string and append it directly into the `shadowRoot`. This satisfies the "Option B" inlining requirement and encapsulates Tailwind.
5. **Asset Inlining**: To guarantee a single-file bundle output (e.g. `dist/knowledge-tug-of-war.js`), we configure Vite's `assetsInlineLimit` to `1000000` (1MB). This forces Vite to compile background images and sound assets into Base64 data URIs.
6. **Font Loading**: Because fonts are too large to package as base64 without bloating the bundle, the Web Component's custom class dynamically injects Google Fonts preconnect and stylesheet `<link>` tags into the parent document's `<head>` once upon mounting.

## 3. Caveats
- **Tailwind Base Reset**: Tailwind's Preflight reset applies inside the Shadow DOM but does not bleed to the outer page. Any page-wide resets (like styling `html` or `body`) will have no effect on the custom element itself; elements must be wrapped in a host container styling block or styled via `:host`.
- **Background Asset**: The background image `game_background_1782358874419.png` mentioned in the PRD is not present in the workspace directory. We have structured the paths to locate it under `src/assets/game_background.png` so the implementer can copy it.

## 4. Conclusion
We have successfully designed the configuration and entry points for Milestone 1. The custom element class, Vite config, and Tailwind configuration are ready for the Implementer to create.

## 5. Verification Method
The setup can be verified by running these commands once files are written by the Implementer:
1. **Install Dependencies**: `npm install`
2. **Run Dev Mode**: `npm run dev` and open browser to verify component renders correctly.
3. **Run Production Build**: `npm run build`
4. **Test Web Component Bundle**: Open `dist/demo.html` in browser. Inspect the DOM to verify:
   - There is a `<knowledge-tug-of-war>` custom element.
   - It contains a `#shadow-root (open)`.
   - The shadow root contains a `<style>` tag containing the bundled Tailwind CSS.
   - The outer page's stylesheet has no access to elements inside the shadow root (proven by applying a global style like `* { background: red !important; }` in the demo page and ensuring it does not turn the game background red).
