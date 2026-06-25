# Handoff Report: Milestone 1 Setup and Build System Design

## 1. Observation
- The project requirements demand a single-file Custom Element (Web Component) wrapper `<knowledge-tug-of-war>` that encapsulates a Preact app styled with Tailwind CSS (as defined in `d:\AI APP\DauTruongKienThuc\Requirement\.agents\orchestrator\PROJECT.md`, lines 3-6 and 22-26).
- The user has requested CSS bundling Option B (Inlined CSS) and per-question cryptographic salts in JSON configuration (`d:\AI APP\DauTruongKienThuc\Requirement\.agents\orchestrator\ORIGINAL_REQUEST.md`, lines 9-13).
- The visual styling must implement the "Kinetic Academy" design tokens: colors (Primary Green `#22c55e`, Secondary Blue `#2170e4`, Alert Red `#b91a24`, Surface `#f9f9ff`), typography (Display: `Space Grotesk`, Body: `Plus Jakarta Sans`), and exaggerated border rounding (`rounded-lg` of 1rem for buttons) as specified in `d:\AI APP\DauTruongKienThuc\Requirement\stitch_knowledge_tug_of_war\kinetic_academy\DESIGN.md`.

---

## 2. Logic Chain
1. **Style Scope Encapsulation**: A standard Custom Element uses the Shadow DOM to isolate styles. To style elements inside a Shadow Root, the styles must be declared inside that Shadow Root (either via `<style>` tag or Constructable Stylesheets).
2. **Avoiding External CSS Chunks**: Standard Vite configurations output separate `.css` files. To compile everything into a single JavaScript file, we must prevent Vite from writing separate CSS files.
3. **Inlining via Query Prefix**: Appending `?inline` to our CSS import (e.g. `import styles from './styles/index.css?inline'`) tells Vite to process the stylesheet (running Tailwind CSS and Autoprefixer) and return it as a raw string instead of writing a separate file.
4. **Programmatic Injection**: By writing a standard Web Component wrapper `class KnowledgeTugOfWarElement extends HTMLElement`, we can create a `<style>` element in `connectedCallback`, set its text content to the compiled CSS string, and append it directly to `this.shadowRoot`.
5. **Single Bundle Assembly**: Configuring Vite with `build.lib` in `iife` format outputs a self-executing bundle. Setting `assetsInlineLimit` to 10MB ensures that all images and audio assets imported in components are converted into Base64 data URIs and bundled directly within the JS file.

---

## 3. Caveats
- **Font Loading**: Shadow DOM styles cannot easily load external fonts without performance penalties (FOUT). We assume the host application will load the Google Fonts links in its own `<head>`, but we include an `@import` fallback inside the compiled CSS.
- **Dynamic Attributes**: Standard Custom Elements must manually handle `attributeChangedCallback` for attributes like `theme` or `default-questions` to trigger Preact re-renders. We've designed the wrapper class to do exactly this.

---

## 4. Conclusion
We have successfully designed the project structure, packaging strategy, and exact configuration files for Milestone 1. The inlined CSS injection strategy guarantees full Shadow DOM encapsulation and single-file bundling, which makes the `<knowledge-tug-of-war>` element entirely portable, lightweight, and suitable for WordPress or Next.js integration.

---

## 5. Verification Method
1. **Build Verification**:
   Run the following commands in the workspace root once the files are implemented:
   ```bash
   npm install
   npm run build
   ```
   Check the `dist/` directory. It must contain only `knowledge-tug-of-war.js` (and potentially a source map), with **no separate `.css` files**.
2. **Encapsulation Verification**:
   Open `index.html` in a web browser using Vite's dev server (`npm run dev`). Inspect the `<knowledge-tug-of-war>` element in Chrome DevTools:
   - Ensure a `#shadow-root (open)` exists.
   - Verify that all CSS is contained in a `<style>` tag directly under the Shadow Root.
   - Verify that adding a style like `button { background: red; }` to the host page's console does not alter the appearance of buttons inside the Shadow DOM.
   - Verify that Tailwind classes like `bg-surface-container` and `font-display` resolve correctly inside the custom element.
