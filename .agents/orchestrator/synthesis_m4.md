# Synthesis Report — Milestone 4: Core Game UI, CSS Animations & Audio

This report aggregates the visual design, interactive animations, and Web Audio API synthesizer proposals for Milestone 4.

## 1. Background Asset Copy
* **Source Path**: `C:\Users\TechshareVN_Lap\.gemini\antigravity\brain\bd96c7df-a698-441b-9e79-e02c46ff353c\game_background_1782358874419.png`
* **Destination Path**: `d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\src\assets\game_background_1782358874419.png`
* **Requirement**: Copy this asset into the project folder prior to running the build, so Vite can successfully resolve the background asset import.

## 2. Visual Styling & Mobile Responsiveness
* **Tailwind Config**: Extend config in `tailwind.config.js` to include the spacing and border-radius properties from Kinetic Academy.
* **Glassmorphism Panels**: Use combination of transparent borders (`border-white/40`) and backdrop filters (`backdrop-blur-md`) for overlays.
* **Mechanical 3D Options Keys**: 
  - Style option buttons with a thick bottom border (`border-b-[6px] border-surface-dim`) and vertical offset transitions on hover and active click to simulate physical mechanical keyboard keys.
  - Position option indicator labels (A, B, C, D) absolute-positioned in the top-left of the button with label-caps styling.
* **Mobile Stack Adaptability**:
  - Add an `isMobile` screen width/height check hook.
  - If mobile: disable aspect ratio scaler CSS transform, make layout fluid (`w-full min-h-screen`), change options layout grid to a single column (1x4 grid), and display tap buttons ("TAP TO BUZZ") for teams to play without a physical keyboard.
  - If desktop: keep the centered 16:9 scaled card with a 2x2 options grid.

## 3. Dynamic Visual Effects & Animations
* **Braided Rope Trench**: Add a horizontal braided rope texture layer (using repeating diagonal gradients) inside the slider trench. Animate `background-position` dynamically relative to scores to simulate rope pull.
* **Elastic Tension Point**: Render the central marker as a glowing white diamond rotated 45 degrees, shifting its position with boundary margins via `calc()` and custom elastic spring transitions (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
* **Fiery Victory Danger Warning**: Trigger orange-red highlights (`#f97316`), heat shimmers, and rapid scaling chimes when a team reaches a critical score (score >= 8).
* **Active Buzz glows**: Display green left-edge and blue/red right-edge fading gradient backdrop overlays pulsing when `activeTeam` is set.

## 4. Programmatic Audio Synthesizers
* **Context Activation**: Automatically initialize and resume `AudioContext` inside a window-level interaction listener (`click`, `keydown`) to unlock autoplay restrictions.
* **Procedural Sounds (Web Audio API)**:
  - `playBuzzSound`: Classic retro sweep (sine/sawtooth, 160Hz -> 90Hz).
  - `playTickSound`: Woodblock click (sine, 1200Hz -> 600Hz, rapid exponential decay).
  - `playCorrectSound`: Chime arpeggio of C major chord notes (triangle, C5 -> E5 -> G5 -> C6).
  - `playWrongSound`: Dissapointing heavy thud (low sawtooth, 120Hz -> 60Hz).
  - `playPullRopeSound`: Procedural white noise swoop with a bandpass sweep to simulate rope friction.

---

## Verification Plan
1. **Compilation**: Run `npm run build` to verify no typescript compile errors and confirm successful asset packaging.
2. **Visual Check**: Test responsiveness by shrinking the browser window. Verify that the 16:9 scaler switches off, options stack vertically, and touch buttons are displayed.
3. **Animations Check**: Check that the rope texture shifts, diamond marker snaps elastically, warning shimmers appear at score >= 8, and edge glows flash on buzz-in.
4. **Audio Check**: Verify that chimes, ticks, buzzes, and swooshes synthesize cleanly without throwing security exceptions.
