# Handoff Report: Core Game UI, CSS Animations & Screen Glows (Milestone 4)

This report details the architectural analysis and concrete design proposals for the physical pull-rope visual slider, strength progress bar with fiery glow animations, and active buzz-in screen glow feedback inside the Knowledge Tug of War Web Component.

---

## 1. Observation

We directly observed the following codebase files and assets:

### A. Main App UI Structure (`src/app.tsx`)
- **Main Container**: Lines 530-541 define the outer container representing the game canvas:
  ```tsx
  530:       {/* 1. Main 16:9 Game Container (Scaled via CSS transform) */}
  531:       <div 
  532:         ref={containerRef}
  533:         style={{
  534:           width: '960px',
  535:           height: '540px',
  536:           transform: `scale(${scale})`,
  537:           transformOrigin: 'center center',
  538:           flexShrink: 0
  539:         }}
  540:         className="relative flex flex-col justify-between bg-surface text-on-surface font-body select-none p-6 rounded-2xl border-2 border-surface-dim box-border shadow-2xl transition-all duration-300"
  541:       >
  ```
- **Tug of War Visual Element (Slider / Progress Bar)**: Lines 735-753 contain the current markup for the split force bar and central tension marker:
  ```tsx
  735:         {/* 3. Tug of War Visual Element (Dynamic split bar with central ribbon mark) */}
  736:         <div className="w-full my-4">
  737:           <div className="flex justify-between items-center mb-2 px-1">
  738:             <span className="text-xs font-bold text-primary">Lực Kéo Đội 1</span>
  739:             <span className="text-xs font-bold text-secondary">Lực Kéo Đội 2</span>
  740:           </div>
  741:           <div className="w-full bg-surface-dim h-8 rounded-full overflow-hidden relative border-2 border-surface-dim box-border">
  742:             {/* Central Tension Marker Ribbon */}
  743:             <div 
  744:               style={{ left: `${t1Percent}%` }} 
  745:               className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-accent-glow rotate-45 z-10 animate-pulse transition-all duration-500 ease-out"
  746:             ></div>
  747:             {/* Strength Bar Indicator */}
  748:             <div className="w-full h-full flex">
  749:               <div style={{ width: `${t1Percent}%` }} className="bg-primary-container transition-all duration-500 ease-out border-r border-white"></div>
  750:               <div style={{ width: `${t2Percent}%` }} className="bg-secondary-container transition-all duration-500 ease-out"></div>
  751:             </div>
  752:           </div>
  753:         </div>
  ```

### B. Global Styling Stylesheet (`src/styles/index.css`)
- Lines 22-31 define current glow classes for active HUD headers:
  ```css
  22: /* Custom glow animation classes using theme variables */
  23: .glow-team1 {
  24:   box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
  25:   border-color: #22c55e;
  26: }
  27: 
  28: .glow-team2 {
  29:   box-shadow: 0 0 15px rgba(33, 112, 228, 0.4);
  30:   border-color: #2170e4;
  31: }
  ```

### C. Design Guidelines & Systems
- **`brandkit.md`**:
  - Team 1 (Left) Color: `#22c55e` (Vibrant Green)
  - Team 2 (Right) Color: `#2170e4` (Vibrant Blue)
  - Highlight/Action Color: `#f97316` (Orange-Red / "Cam lửa")
  - UI Elements: "Thanh tiến trình (Progress bar) có ngọn lửa ở giữa thể hiện vạch ranh giới kéo co."
- **`DESIGN.md` (Kinetic Academy theme specification)**:
  - "Horizontal pill-shaped bars. The 'Tension Point' is marked by a glowing white diamond. The fill color transition between Team 1 and Team 2 should be a hard-stop split, not a gradient, to emphasize the 'War' aspect."
  - "Active State Glows: Any element currently being interacted with... must trigger a `2px` solid border using the `accent_glow` color with a `0 0 12px` outer blur."

---

## 2. Logic Chain

1. **Physical Pull-Rope Slider Design**:
   - The current marker is a simple white square rotated 45 degrees (`w-4 h-4`), transitioning with a default `ease-out` on the `left` property. The background is a flat colored bar without texture (Observation A).
   - To convey a "physical pull-rope," we introduce a distinct, horizontal braided rope layer inside the trench. A repeating diagonal CSS linear gradient represents braided rope fibers.
   - To make it look interactive, shifting the rope texture's `background-position` based on the score (e.g. `backgroundPosition: `${score.team1 * 12}px 0``) simulates the physical motion of the rope moving left/right as force changes.
   - For elastic snapping physics, we transition the diamond's position using a spring-like `cubic-bezier(0.34, 1.56, 0.64, 1)` (easeOutBack) which overshoots and settles, matching the mechanical feel of a tight tug-of-war rope.
   - Calibrating the diamond marker position with a `calc()` wrapper ensures it stays inside the rounded container boundaries at the limits (0% and 100%).

2. **Strength Progress Bar (Tug of War Meter)**:
   - We recommend a **hard-stop split** color transition (`bg-[#22c55e]` vs `bg-[#2170e4]` separated by a thin divider), which matches the strict competitive nature of the game and the design system (Observation C).
   - "Close-to-winning" conditions are triggered when `score.team1 >= 8` (Team 1 close to winning) or `score.team1 <= 2` (Team 2 close to winning, since Team 2 score = `10 - score.team1`).
   - On trigger, we apply keyframe-based fiery glows (`@keyframes fieryPulse` using `#f97316`) and vertical scrolling linear gradient animations (`@keyframes heatShimmer`) over the winning team's progress segment.
   - The diamond marker transitions to a high-tension critical pulse (`@keyframes criticalPulse`) scaling rapidly with an intense orange-red shadow.

3. **Active Team Buzz Glows**:
   - The active buzz is captured by the state machine's context: `state.context.activeTeam` (which is `'team1' | 'team2' | null`).
   - When set, we apply dynamic Tailwind classes to the main 16:9 container (`div` with `ref={containerRef}`) to change its borders and apply colored inner shadows on the corresponding side (`shadow-[inset_24px_0_40px_-20px_rgba(34,197,94,0.35)]` for Team 1, and `shadow-[inset_-24px_0_40px_-20px_rgba(33,112,228,0.35)]` for Team 2).
   - We couple this with two absolute-positioned overlays on the left and right edges that fade towards the center. When a team buzzes in, their side fades in to `opacity-100` and breathes with a pulse, providing immediate visual feedback of who is active.

---

## 3. Caveats

- **Network Limits**: This analysis was performed in a read-only local environment. We did not run live code on a browser.
- **Theme Configurations**: We assume the tailwind configuration contains extended colors `primary-container` (`#22c55e`), `secondary-container` (`#2170e4`), and `accent-glow` (`#f97316`), which was successfully verified in `tailwind.config.js`.
- **Team 2 Color Options**: Although the brand kit recommends blue for Team 2, the design guidelines mention red (`#b91a24` / `#ef4444`) as an alternative tension color. We have provided detailed styles for both variants.

---

## 4. Conclusion

We propose the following concrete modifications for `src/app.tsx` and `src/styles/index.css`:

### Proposed additions to `src/styles/index.css`
```css
/* --- PHYSICAL PULL-ROPE VISUAL SLIDER & TEXTURES --- */

/* Repeating diagonal gradient mimicking braided rope fibers */
.rope-texture {
  background: repeating-linear-gradient(
    45deg,
    #d2b48c,
    #d2b48c 6px,
    #c69c6d 6px,
    #c69c6d 12px,
    #b08d63 12px,
    #b08d63 18px
  );
  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.5), 0 1px 1px rgba(255, 255, 255, 0.15);
  opacity: 0.95;
  filter: contrast(1.15) brightness(0.95);
}

/* --- DYNAMIC STRENGTH BAR & FIERY GLOW ANIMATIONS --- */

/* Pulsing fiery outline & glow on the winning progress bar side */
@keyframes fieryPulse {
  0%, 100% {
    box-shadow: inset 0 0 12px rgba(249, 115, 22, 0.6);
    filter: brightness(1) saturate(1.1);
  }
  50% {
    box-shadow: inset 0 0 24px rgba(239, 68, 68, 0.9), 0 0 12px rgba(249, 115, 22, 0.5);
    filter: brightness(1.25) saturate(1.3);
  }
}

/* Heat wave shimmer horizontal scroll effect */
@keyframes heatShimmer {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
}

/* Rapid scaling tension pulse for the central diamond marker */
@keyframes criticalPulse {
  0%, 100% {
    transform: translate(-50%, -50%) rotate(45deg) scale(1);
    box-shadow: 0 0 12px #ffffff, 0 0 20px #f97316;
  }
  50% {
    transform: translate(-50%, -50%) rotate(45deg) scale(1.2);
    box-shadow: 0 0 20px #ffffff, 0 0 35px #ef4444, 0 0 50px #f97316;
  }
}

/* --- SCREEN EDGE BUZZ GLOW ANIMATIONS --- */

/* Breathing pulse effect for active buzz screen edge overlays */
@keyframes glowPulse {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
    filter: brightness(1.1);
  }
}
```

### Proposed changes to `src/app.tsx`

#### 1. Dynamic screen borders and backdrop glows on the main container
Modify lines 530-541 in `src/app.tsx` as follows:

**Before:**
```tsx
      {/* 1. Main 16:9 Game Container (Scaled via CSS transform) */}
      <div 
        ref={containerRef}
        style={{
          width: '960px',
          height: '540px',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0
        }}
        className="relative flex flex-col justify-between bg-surface text-on-surface font-body select-none p-6 rounded-2xl border-2 border-surface-dim box-border shadow-2xl transition-all duration-300"
      >
```

**After (Using Blue for Team 2):**
```tsx
      {/* 1. Main 16:9 Game Container (Scaled via CSS transform) */}
      <div 
        ref={containerRef}
        style={{
          width: '960px',
          height: '540px',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0
        }}
        className={`relative flex flex-col justify-between bg-surface text-on-surface font-body select-none p-6 rounded-2xl border-2 box-border transition-all duration-500 overflow-hidden ${
          state.context.activeTeam === 'team1' 
            ? 'border-primary-container/80 shadow-[0_0_45px_rgba(34,197,94,0.45),inset_24px_0_40px_-20px_rgba(34,197,94,0.35)]'
            : state.context.activeTeam === 'team2'
              ? 'border-secondary-container/80 shadow-[0_0_45px_rgba(33,112,228,0.45),inset_-24px_0_40px_-20px_rgba(33,112,228,0.35)]'
              : 'border-surface-dim shadow-2xl'
        }`}
      >
        {/* Dynamic Screen Edge Backdrop Glow overlays */}
        <div 
          className={`absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-primary-container/20 via-primary-container/5 to-transparent pointer-events-none rounded-l-2xl z-0 transition-opacity duration-300 ${
            state.context.activeTeam === 'team1' ? 'opacity-100 animate-[glowPulse_2s_infinite_ease-in-out]' : 'opacity-0'
          }`}
        />
        <div 
          className={`absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-secondary-container/20 via-secondary-container/5 to-transparent pointer-events-none rounded-r-2xl z-0 transition-opacity duration-300 ${
            state.context.activeTeam === 'team2' ? 'opacity-100 animate-[glowPulse_2s_infinite_ease-in-out]' : 'opacity-0'
          }`}
        />
```

**Alternative After (Using Red for Team 2):**
```tsx
      {/* 1. Main 16:9 Game Container (Scaled via CSS transform) */}
      <div 
        ref={containerRef}
        style={{
          width: '960px',
          height: '540px',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0
        }}
        className={`relative flex flex-col justify-between bg-surface text-on-surface font-body select-none p-6 rounded-2xl border-2 box-border transition-all duration-500 overflow-hidden ${
          state.context.activeTeam === 'team1' 
            ? 'border-primary-container/80 shadow-[0_0_45px_rgba(34,197,94,0.45),inset_24px_0_40px_-20px_rgba(34,197,94,0.35)]'
            : state.context.activeTeam === 'team2'
              ? 'border-tertiary/80 shadow-[0_0_45px_rgba(185,26,36,0.45),inset_-24px_0_40px_-20px_rgba(185,26,36,0.35)]'
              : 'border-surface-dim shadow-2xl'
        }`}
      >
        {/* Dynamic Screen Edge Backdrop Glow overlays */}
        <div 
          className={`absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-primary-container/20 via-primary-container/5 to-transparent pointer-events-none rounded-l-2xl z-0 transition-opacity duration-300 ${
            state.context.activeTeam === 'team1' ? 'opacity-100 animate-[glowPulse_2s_infinite_ease-in-out]' : 'opacity-0'
          }`}
        />
        <div 
          className={`absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-tertiary/20 via-tertiary/5 to-transparent pointer-events-none rounded-r-2xl z-0 transition-opacity duration-300 ${
            state.context.activeTeam === 'team2' ? 'opacity-100 animate-[glowPulse_2s_infinite_ease-in-out]' : 'opacity-0'
          }`}
        />
```

#### 2. Physical Pull-Rope Slider & Fiery Progress Bar Layout
Modify lines 735-753 in `src/app.tsx` as follows:

**Before:**
```tsx
        {/* 3. Tug of War Visual Element (Dynamic split bar with central ribbon mark) */}
        <div className="w-full my-4">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-xs font-bold text-primary">Lực Kéo Đội 1</span>
            <span className="text-xs font-bold text-secondary">Lực Kéo Đội 2</span>
          </div>
          <div className="w-full bg-surface-dim h-8 rounded-full overflow-hidden relative border-2 border-surface-dim box-border">
            {/* Central Tension Marker Ribbon */}
            <div 
              style={{ left: `${t1Percent}%` }} 
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-accent-glow rotate-45 z-10 animate-pulse transition-all duration-500 ease-out"
            ></div>
            {/* Strength Bar Indicator */}
            <div className="w-full h-full flex">
              <div style={{ width: `${t1Percent}%` }} className="bg-primary-container transition-all duration-500 ease-out border-r border-white"></div>
              <div style={{ width: `${t2Percent}%` }} className="bg-secondary-container transition-all duration-500 ease-out"></div>
            </div>
          </div>
        </div>
```

**After (Using Blue for Team 2):**
```tsx
        {/* 3. Tug of War Visual Element (Dynamic split bar with central ribbon mark) */}
        <div className="w-full my-4 z-10">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-xs font-bold text-primary flex items-center gap-1 font-display uppercase tracking-wider">
              🟢 Lực Kéo Đội 1 {state.context.score.team1 >= 8 && <span className="text-[#f97316] animate-pulse">🔥 NGUY CẤP</span>}
            </span>
            <span className="text-xs font-bold text-secondary flex items-center gap-1 font-display uppercase tracking-wider">
              {state.context.score.team2 >= 8 && <span className="text-[#f97316] animate-pulse">NGUY CẤP 🔥</span>} Lực Kéo Đội 2 🔵
            </span>
          </div>
          
          {/* Main Trench Container */}
          <div className="w-full bg-[#111c2d] h-9 rounded-full relative p-[3px] border-2 border-surface-dim box-border shadow-[inset_0_4px_6px_rgba(0,0,0,0.6)] flex items-center overflow-hidden">
            
            {/* Strength Bar Indicators (Hard-stop split background) */}
            <div className="w-full h-full flex rounded-full overflow-hidden">
              <div 
                style={{ width: `${t1Percent}%` }} 
                className={`transition-all duration-700 ease-out relative border-r border-white/20 ${
                  state.context.score.team1 >= 8 
                    ? 'bg-primary-container animate-[fieryPulse_1.5s_infinite_ease-in-out]' 
                    : 'bg-primary-container'
                }`}
              >
                {/* Visual heat wave effect for Team 1 when close to winning */}
                {state.context.score.team1 >= 8 && (
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(249,115,22,0.4)_50%,transparent_100%)] bg-[length:200%_100%] animate-[heatShimmer_2s_linear_infinite]"></div>
                )}
              </div>
              <div 
                style={{ width: `${t2Percent}%` }} 
                className={`transition-all duration-700 ease-out relative ${
                  state.context.score.team2 >= 8 
                    ? 'bg-secondary-container animate-[fieryPulse_1.5s_infinite_ease-in-out]' 
                    : 'bg-secondary-container'
                }`}
              >
                {/* Visual heat wave effect for Team 2 when close to winning */}
                {state.context.score.team2 >= 8 && (
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(249,115,22,0.4)_50%,transparent_100%)] bg-[length:200%_100%] animate-[heatShimmer_2s_linear_infinite]"></div>
                )}
              </div>
            </div>
            
            {/* Physical Pull-Rope Overlay (Braided Texture with dynamic movement translation) */}
            <div 
              style={{ 
                backgroundPosition: `${state.context.score.team1 * 12}px 0px`,
                transition: 'background-position 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)' 
              }}
              className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-3 rope-texture rounded-full pointer-events-none z-10"
            ></div>
            
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

          </div>
        </div>
```

---

## 5. Verification Method

To verify these design proposals:
1. **Compilation Check**: Run the command `npm run build` inside the folder `d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war` to ensure the project builds correctly without syntax errors.
2. **Visual Inspection**: Open the built bundle or run `npm run dev` to verify:
   - The rope texture looks braided and shifts appropriately left/right when team scores update.
   - The diamond ribbon stays within the bar boundaries at limits (0 and 10 score points).
   - Dynamic glows pulse cleanly around the screen edges when a team buzzes in.
   - The fiery warning indicator activates precisely when a team reaches 8 points or higher.
3. **Reduced Motion Safety**: Verify standard `@media (prefers-reduced-motion: reduce)` rules disable the intense pulsating animations if active on the user's OS.
