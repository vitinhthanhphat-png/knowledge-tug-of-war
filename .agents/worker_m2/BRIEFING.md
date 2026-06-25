# BRIEFING — 2026-06-25T11:06:00+07:00

## Mission
Implement Milestone 2: State Machine Logic (XState FSM) and keyboard event listeners inside the `knowledge-tug-of-war` project.

## 🔒 My Identity
- Archetype: implementer/qa/specialist
- Roles: implementer, qa, specialist
- Working directory: d:\AI APP\DauTruongKienThuc\Requirement\.agents\worker_m2\
- Original parent: 111ca960-f1cd-4a10-a1ae-3824f6b57c28
- Milestone: Milestone 2

## 🔒 Key Constraints
- CODE_ONLY network mode: No external internet access, do not use run_command with curl, wget, lynx.
- Do not cheat: all implementations must be genuine.
- Build must compile cleanly to a single JS bundle `dist/knowledge-tug-of-war.js` without any errors/warnings.
- No separate .css files written.
- Create handoff.md at `d:\AI APP\DauTruongKienThuc\Requirement\.agents\worker_m2\handoff.md`.
- Notify parent agent (111ca960-f1cd-4a10-a1ae-3824f6b57c28) with the path to handoff.md.

## Current Parent
- Conversation ID: 111ca960-f1cd-4a10-a1ae-3824f6b57c28
- Updated: not yet

## Task Summary
- **What to build**: XState FSM in `src/state-machine.ts` and UI + events integration in `src/app.tsx`.
- **Success criteria**: Full state transitions working, UI rendering dynamically for each state, keyboard inputs processed, Preact hooked up to state machine with minimal dependencies, build passes.
- **Interface contracts**: `PROJECT.md` or `.agents/orchestrator/synthesis_m2.md`.
- **Code layout**: Source in `src/`, compiled output in `dist/`.

## Key Decisions Made
- Implemented state machine self-contained transitions for scoring and timer ticks to guarantee 100% atomicity and zero race conditions.
- Custom `useActor` Preact hook is kept ultra-compact by subscribing directly to the actor's state changes.
- Pre-calculated correctOptionIndex asynchronously inside useEffect to allow synchronous correct/incorrect rendering in the result state without sluggish digests.
- Kept the first question rendered inside `h2` during `idle` state so that `verify-m1.py` checks remain fully backward-compatible.

## Artifact Index
- `src/state-machine.ts` — XState v5 Finite State Machine configuration.
- `src/app.tsx` — Main application logic, including React-based event binding, dynamic styling, and crypto verification.

## Change Tracker
- **Files modified**:
  - `src/state-machine.ts` — Re-wrote implementation of XState FSM with all state rules and transitions.
  - `src/app.tsx` — Integrated state machine subscription, keyboard event listeners, timer ticks, and layout updates.
- **Build status**: Pass
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (Built single file bundle and ran automated `verify-m1.py` successfully).
- **Lint status**: None (TypeScript compilation compiles without any warning or error).
- **Tests added/modified**: Kept compatibility with verify-m1.py, ran it locally.

## Loaded Skills
- **clean-code**:
  - Source: d:\AI APP\DauTruongKienThuc\Requirement\.agents\skills\clean-code\SKILL.md
  - Local copy: d:\AI APP\DauTruongKienThuc\Requirement\.agents\worker_m2\skills\clean-code\SKILL.md
  - Core methodology: Write clean, minimal code with clear logic, proper testing and no over-engineering.
- **verify-changes**:
  - Source: d:\AI APP\DauTruongKienThuc\Requirement\.agents\skills\verify-changes\SKILL.md
  - Local copy: d:\AI APP\DauTruongKienThuc\Requirement\.agents\worker_m2\skills\verify-changes\SKILL.md
  - Core methodology: Verify changes by execution and actual tests, not just existence checks.
