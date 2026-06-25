# Milestone 4 Handoff Report: Core Game UI, CSS Animations & Audio

## 1. Observation

During read-only investigation, the following codebase structures and style specifications were observed:

### A. Style and Design System Specs
- **Colors**:
  - `brandkit.md` (lines 13-16) defines Team 1 (Left) as green `#22c55e`, Team 2 (Right) as blue `#2170e4`, Highlight/Action as orange `#f97316`, and Surface as white/ivory `#f9f9ff` with 60-80% Glassmorphism.
  - `DESIGN.md` (lines 3-50) specifies additional Tailwind configurations. Primary/Success is `#006e2f` with containers at `#22c55e` (Vibrant Green for Team 1). Secondary is `#0058be` with containers at `#2170e4` (Bold Blue for Team 2). Tertiary is red `#b91a24`.
- **Typography**:
  - `brandkit.md` (lines 19-20) specifies `Space Grotesk` for Display/Numbers (clock, score, keys) and `Plus Jakarta Sans` for body text (question/answers).
- **Core Components Layout**:
  - `DESIGN.md` (lines 134-165) specifies:
    - **Tonal Layers / Glassmorphism**: Cards have a subtle 2px solid border, with backdrop blurs (Glassmorphism) for overlays.
    - **Quiz Answer Buttons**: Exaggerated rounded corners (`rounded-lg` / 1rem). Answer letter in the top-left using `label-caps`. 2px vertical hover lift.
    - **Key Icons (Space, Enter)**: 3D mechanical keys with a 4px bottom border offset in a darker shade.
    - **Active state glows**: 2px border in `accent_glow` (`#f97316`) and 12px outer blur.
    - **Progress bar**: Split pill-shape with hard transition and glowing center marker.

### B. Mobile Grid and Responsive Layout
- `DESIGN.md` (lines 132-133): "On mobile, the Arena and Dashboard stack vertically, with force meters moving to the extreme top and bottom edges of the viewport."
- `app.tsx` (lines 531-541) currently forces a rigid 16:9 container using JS-based scaling:
  ```typescript
  width: '960px',
  height: '540px',
  transform: `scale(${scale})`,
  transformOrigin: 'center center',
  flexShrink: 0
  ```
  Scaling a fixed 960px card to fit small mobile screens (e.g. 360px wide) reduces layout sizes by `0.375`, making text sizes (~6.75px) completely illegible and creating huge letterboxing.

### C. Background Image Verification
- `game_background_1782358874419.png` is not checked into the current workspace `Requirement` directory under `knowledge-tug-of-war` or `stitch_knowledge_tug_of_war`.
- It was discovered in the global AppData cache directory:
  `C:\Users\TechshareVN_Lap\.gemini\antigravity\brain\bd96c7df-a698-441b-9e79-e02c46ff353c\game_background_1782358874419.png`
  File size: 700,625 bytes (~700KB).

---

## 2. Logic Chain

1. **Self-Contained Style Delivery**: Web Components operate in the Shadow DOM. To inject styling, Tailwind's output stylesheet (compiled from `src/styles/index.css` using `tailwind.config.js` options) must be imported as a string and attached inside the Shadow DOM (`main.tsx` connect callback). Hence, all animations, glassmorphism panels, and mechanical key variables must be declared either in Tailwind's utility class configuration or defined in `src/styles/index.css`.
2. **Glassmorphism Panels**: A combination of semi-transparent white backgrounds (`bg-white/65` or `bg-white/80`), backdrop blur (`backdrop-blur-md` or `backdrop-blur-[16px]`), and subtle white borders (`border border-white/40` or `border border-white/50`) achieves the high-energy glassmorphism required by R1 and `DESIGN.md`.
3. **Mechanical Option Buttons**: Placing option indicator letters (A, B, C, D) absolute-positioned in the top-left corner (top-2 left-2) with keycap styling, while adding top padding (`pt-8 pb-4 px-4`) to the options button, satisfies the constraint of "answer letters in top-left using label-caps" without overlapping answer text.
4. **Mechanical 3D Press Effect**: Styling the button with a thick bottom border (`border-b-[6px] border-surface-dim`) and moving it on hover (`hover:-translate-y-1 hover:border-b-[6px]`) and press (`active:translate-y-[2px] active:border-b-[2px]`) achieves the physical mechanical key weight and "squishy" tactile feel.
5. **Dynamic Mobile Refactoring**:
   - Mobile phones have high vertical aspect ratios (portrait) rather than 16:9. A rigid scaled letterbox makes the UI unusable.
   - We must introduce an `isMobile` check that detects screen width < 640px or height < 600px.
   - On mobile, `isMobile === true`:
     - Bypass the `useAspectRatioScaler` CSS transform.
     - Change the container styling from fixed `960x540` to fluid `w-full min-h-screen`.
     - Stack components vertically.
     - Refactor the option button grid from `grid-cols-2` to `grid-cols-1` (1x4 stacked).
     - Render explicit touch tapping cards for "Đội 1 Đập" and "Đội 2 Đập" on-screen, as physical keyboard keys (Space/Enter) are unavailable on mobile phones.
   - On desktop, `isMobile === false`:
     - Keep the rigid 16:9 scaled card with `grid-cols-2`.
6. **Self-Contained Icons**: To prevent loading heavy external fonts (Material Icons) inside a sandboxed Web Component, inline SVG elements (like Lucide's flame icon) should be used for the progress bar tension marker.

---

## 3. Caveats

- **Assets Copied Externally**: The background image `game_background_1782358874419.png` must be manually copied from the AppData cache directory into the project folder (`src/assets/game_background_1782358874419.png`) by the implementer.
- **Audio Hook Integration**: This milestone focuses on UI and styling; the audio hooks (already stubbed in `app.tsx` as `playBuzzSound()`, `playCorrectSound()`, etc.) are left as hooks and should be mapped to actual audio play actions in subsequent steps once audio files are added.

---

## 4. Conclusion

We recommend applying the following style configurations and layout restructuring.

### A. Proposed Code: `tailwind.config.js`
Modify `tailwind.config.js` to extend theme borders and spacings:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f9f9ff',
          dim: '#cfdaf2',
          bright: '#f9f9ff',
          lowest: '#ffffff',
          low: '#f0f3ff',
          container: '#e7eeff',
          high: '#dee8ff',
          highest: '#d8e3fb',
        },
        'on-surface': '#111c2d',
        'on-surface-variant': '#3d4a3d',
        'inverse-surface': '#263143',
        'inverse-on-surface': '#ecf1ff',
        outline: {
          DEFAULT: '#6d7b6c',
          variant: '#bccbb9',
        },
        primary: {
          DEFAULT: '#006e2f',
          container: '#22c55e',
        },
        secondary: {
          DEFAULT: '#0058be',
          container: '#2170e4',
        },
        tertiary: {
          DEFAULT: '#b91a24',
          container: '#ff8a83',
        },
        'accent-glow': '#f97316',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '48px',
        'meter-height': '32px',
        'container-max': '1200px',
      },
    },
  },
  plugins: [],
}
```

### B. Proposed Code: `src/styles/index.css`
Append styling for glass panels, mechanical buttons, and fire glows:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:host {
  display: block;
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: inherit;
}

/* Glassmorphism panel styling */
.glass-panel {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

/* Mechanical key layout offset helper */
.key-3d-active {
  transform: translateY(2px);
  border-bottom-width: 2px !important;
}

/* Custom glow animations for active states */
.glow-pulse {
  animation: pulseGlow 1.5s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes pulseGlow {
  from {
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.3), inset 0 0 2px rgba(34, 197, 94, 0.3);
    border-color: rgba(34, 197, 94, 0.4);
  }
  to {
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.6), inset 0 0 6px rgba(34, 197, 94, 0.5);
    border-color: rgba(34, 197, 94, 0.8);
  }
}

/* Center fire background animations */
.fire-glow {
  animation: firePulse 3s infinite alternate ease-in-out;
}

@keyframes firePulse {
  0% {
    opacity: 0.35;
    transform: scale(1) translate(-50%, -50%);
    filter: blur(50px);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.15) translate(-48%, -52%);
    filter: blur(65px);
  }
  100% {
    opacity: 0.3;
    transform: scale(0.9) translate(-52%, -48%);
    filter: blur(45px);
  }
}

.fiery-progress-glow {
  box-shadow: 0 0 15px rgba(249, 115, 22, 0.4), inset 0 0 6px rgba(249, 115, 22, 0.2);
}

.flame-icon-glow {
  filter: drop-shadow(0 0 6px #f97316) drop-shadow(0 0 12px #ef4444);
  animation: flameFlicker 0.15s infinite alternate ease-in-out;
}

@keyframes flameFlicker {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.08);
  }
}
```

### C. Proposed Code: `src/app.tsx`
Add background import, mobile detector hook, inline Lucide flame icon, and restructure the JSX return code:
1. **Background Import** (add near line 5):
   ```typescript
   import gameBg from './assets/game_background_1782358874419.png';
   ```
2. **Mobile Detector & Flame SVG** (add inside `App` definition, around line 200):
   ```typescript
   const [isMobile, setIsMobile] = useState(false);
   useEffect(() => {
     const checkMobile = () => {
       setIsMobile(window.innerWidth < 640 || window.innerHeight < 600);
     };
     checkMobile();
     window.addEventListener('resize', checkMobile);
     return () => window.removeEventListener('resize', checkMobile);
   }, []);

   const FlameIcon = () => (
     <svg 
       xmlns="http://www.w3.org/2000/svg" 
       viewBox="0 0 24 24" 
       fill="none" 
       stroke="currentColor" 
       strokeWidth="2.5" 
       strokeLinecap="round" 
       strokeLinejoin="round" 
       className="w-7 h-7 text-white"
     >
       <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
     </svg>
   );
   ```
3. **JSX Restructuring**: Replace the `return` statement (from line 527 to 1072) with the fluid/responsive overlay-enabled container block detailed in Section 2 & 5.

---

## 5. Verification Method

### A. Independent Verification Commands
To test compile and verify layout encapsulation, run the following commands:
```powershell
# Navigate to project directory
cd "d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war"

# Run typescript build to verify types compile correctly with the image import
npm run build
```

### B. Verification Conditions
- Check the compiled javascript output bundle size.
- Inspect the dev server local preview by running `npm run dev` and resizing the browser viewport to mobile dimensions (e.g. 360x740) to verify the scaler switches off, options stack in a single column, and Team Buzz buttons appear.
- Check the background image rendering inside the container.
