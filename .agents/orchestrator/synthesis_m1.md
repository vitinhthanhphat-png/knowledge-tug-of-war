# Aggregated Explorer Findings — Milestone 1

## Subagent Results Summary
- 2 completed (Explorer 1, Explorer 3), 1 pending (Explorer 2)
- No missing coverage: Explorer 1 and 3 provided complete build files, Vite configs, Tailwind settings, and Custom Element wrapper logic.

## Aggregated Findings

### 1. Build and Bundling Strategy
- **Framework**: Preact with `@preact/preset-vite` for a lightweight, React-compatible runtime.
- **Custom Element Wrapper**: Use a vanilla HTML custom element class `KnowledgeTugOfWarElement` registering `<knowledge-tug-of-war>` to mount the Preact `<App />` root.
- **Tailwind Shadow DOM Integration**:
  - Process Tailwind CSS using PostCSS.
  - Import the CSS as a raw string using Vite's `?inline` query suffix: `import styles from './styles/index.css?inline';`
  - In `connectedCallback`, programmatically append a `<style>` tag to the `Shadow DOM` and write the compiled CSS string inside it.
  - This ensures 100% encapsulation, preventing styles from leaking in or out, while maintaining Tailwind utility availability inside the component.
- **Single JS File Compilation**:
  - Vite configured in library mode with `formats: ['iife']` to output a single IIFE bundle (`knowledge-tug-of-war.js`).
  - Disable CSS splitting (`cssCodeSplit: false`).
  - Set `assetsInlineLimit: 10485760` (10MB) to pack all image and audio assets directly into the JS bundle as base64 data URLs.
  - Inline all dependencies (`external: []`).

### 2. Standard Configurations

#### `package.json`
- Dependencies: `preact` (~10.22), `xstate` (~5.14/5.18).
- DevDependencies: `@preact/preset-vite`, `autoprefixer`, `postcss`, `tailwindcss`, `typescript`, `vite`.

#### `vite.config.ts`
- Uses library options targeting `src/main.tsx`.
- Outputs a single IIFE bundle inside `dist/knowledge-tug-of-war.js`.
- Configures aliases for `react` and `react-dom` targeting `preact/compat`.

#### `tailwind.config.js`
- Scopes utility classes to `index.html` and `src/**/*.{js,ts,jsx,tsx}`.
- Customizes theme tokens (surface colors, outline colors, primary container green, secondary container blue, and accent-glow orange) based on `DESIGN.md` (Theme: Kinetic Academy).

#### `index.html` (Dev Sandbox)
- Includes font links in the head for Space Grotesk and Plus Jakarta Sans.
- Mounts `<knowledge-tug-of-war>` with custom questions and theme.
- Loads the module entrypoint `src/main.tsx` dynamically for Vite HMR.

## Per-Subagent Status
- **Explorer 1**: Completed. Artifact: `.agents/explorer_m1_1/analysis.md`
- **Explorer 2**: Pending.
- **Explorer 3**: Completed. Artifact: `.agents/explorer_m1_3/analysis.md`
