# BRIEFING — 2026-06-25T10:59:00+07:00

## Mission
Investigate and design the setup of Vite + Preact + Tailwind CSS project packaged as a single-file Custom Element (Web Component) <knowledge-tug-of-war>.

## 🔒 My Identity
- Archetype: explorer
- Roles: explorer_m1_3
- Working directory: d:\AI APP\DauTruongKienThuc\Requirement\.agents\explorer_m1_3\
- Original parent: 111ca960-f1cd-4a10-a1ae-3824f6b57c28
- Milestone: Milestone 1

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Bundle Tailwind CSS inside the Web Component's Shadow DOM (Vite inline CSS injection)
- Package the application into a single-file Custom Element <knowledge-tug-of-war>

## Current Parent
- Conversation ID: 111ca960-f1cd-4a10-a1ae-3824f6b57c28
- Updated: 2026-06-25T10:59:00+07:00

## Investigation State
- **Explored paths**:
  - `d:\AI APP\DauTruongKienThuc\Requirement\.agents\orchestrator\PROJECT.md`
  - `d:\AI APP\DauTruongKienThuc\Requirement\.agents\orchestrator\ORIGINAL_REQUEST.md`
  - `d:\AI APP\DauTruongKienThuc\Requirement\brandkit.md`
  - `d:\AI APP\DauTruongKienThuc\Requirement\stitch_knowledge_tug_of_war\kinetic_academy\DESIGN.md`
- **Key findings**:
  - Propose standard Web Component wrapper class wrapping Preact mounting/unmounting lifecycle.
  - Compile styles into inline CSS strings via Vite `?inline` query prefix, injecting it inside the Shadow DOM via `<style>` tag dynamically.
  - Bundle all code, styles, and assets (fonts, icons, sounds) into a single file output using Vite's Library Mode in `iife` format with an extremely large `assetsInlineLimit` (10MB).
- **Unexplored areas**:
  - XState FSM structure implementation (M2).
  - Local Storage & Web Crypto implementation (M3).

## Key Decisions Made
- Use native Custom Element class in `src/main.tsx` wrapping Preact, avoiding third-party custom element wrappers to ensure maximum lifecycle flexibility and easy shadow DOM styling.
- Use Tailwind CSS v3 configuration files (`tailwind.config.js` and `postcss.config.js`) to guarantee compatibility with Vite library options.

## Artifact Index
- d:\AI APP\DauTruongKienThuc\Requirement\.agents\explorer_m1_3\analysis.md — Detailed layout, packaging, and dependency analysis for Milestone 1
