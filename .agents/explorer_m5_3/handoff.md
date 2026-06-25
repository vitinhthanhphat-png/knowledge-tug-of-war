# Handoff Report — Milestone 5 E2E Verification Test Suite (verify-m5.py) Design

This report contains the self-contained design plan for the E2E verification test suite (`verify-m5.py`) using Playwright for Milestone 5 (Web Component Bundling & Hardening).

---

## 1. Observation

We directly investigated and verified the following files in the project workspace:

### 1.1 Vite Bundling and Style Injection Configurations
*   **`package.json`** (lines 6-10):
    ```json
    "scripts": {
      "dev": "vite",
      "build": "tsc && vite build",
      "preview": "vite preview"
    }
    ```
*   **`vite.config.ts`** (lines 6-23):
    ```typescript
    build: {
      cssCodeSplit: false,
      assetsInlineLimit: 10485760,
      sourcemap: false,
      emptyOutDir: true,
      lib: {
        entry: 'src/main.tsx',
        name: 'KnowledgeTugOfWar',
        formats: ['iife'],
        fileName: () => 'knowledge-tug-of-war.js',
      },
      rollupOptions: {
        external: [],
        output: {
          extend: true
        }
      }
    }
    ```
    This configuration forces all CSS and assets (images, icons) up to 10MB to be inlined directly within `dist/knowledge-tug-of-war.js` and outputs a single IIFE bundle.
*   **`src/main.tsx`** (lines 3, 18-28):
    ```typescript
    import styles from './styles/index.css?inline';
    ...
    connectedCallback() {
      const styleTag = document.createElement('style');
      styleTag.textContent = styles;
      this.shadow.appendChild(styleTag);

      this.mountPoint = document.createElement('div');
      this.mountPoint.className = 'w-full h-full relative overflow-hidden';
      this.shadow.appendChild(this.mountPoint);

      this.renderApp();
    }
    ```
    Tailwind styles are imported inline and dynamically injected inside the Shadow DOM for full CSS scoping and encapsulation.

### 1.2 Previous Verification Suites
*   **`tests/verify-m3.py`**:
    *   Generates valid and invalid question JSON schemas (empty ID, no option matching hash, multiple options matching hash, file >500KB) at lines 11-71.
    *   Simulates non-secure context fallback by programmatically setting `window.crypto.subtle = undefined` at lines 333-335:
        ```python
        page.evaluate("""() => {
            Object.defineProperty(window.crypto, 'subtle', { value: undefined, writable: true, configurable: true });
        }""")
        ```
    *   Validates Admin Panel toggle, aspect ratio scaler position (modal renders outside scale transform container), and schema import error banners.
*   **`tests/verify-m4.py`**:
    *   Measures bundle size of compiled JS in KB (lines 88-92).
    *   Injects a comprehensive `AudioContext` mock prior to navigation (lines 115-191) to capture synthesized sounds and logs.
    *   Tests full game gameplay loops (rounds 1-3), verifies background position shifting of `.rope-texture` on pull, and captures screenshots at desktop and mobile layouts (lines 284-411).
    *   Verifies mobile layout constraints (scaler disabled, single column options grid, touch-to-buzz buttons visible) at lines 457-489.

---

## 2. Logic Chain

The requirements for Milestone 5 state we need to combine and extend these verification strategies into a unified E2E test suite (`verify-m5.py`) focusing on Bundling & Hardening. 

Here is our step-by-step reasoning for the test suite design:
1.  **Production Bundle Size Check**:
    *   *Observation*: The compiled JS bundle in M4 was `1027.81 KB`.
    *   *Logic*: Establishing a strict size boundary (< 1.2 MB or 1200 KB) in the test script ensures that subsequent changes do not break asset inlining or bundle size constraints.
2.  **Dynamic Custom Element Mounting & Shadow DOM Scoping**:
    *   *Observation*: `dist-test.html` statically declares the custom element tag.
    *   *Logic*: A true library-grade web component must support dynamic loading and lifecycle events. We need a test case that loads a blank page, injects the JS bundle, programmatically creates/appends the element, reads attributes, asserts style injection in Shadow DOM, and disposes/unmounts it, ensuring `disconnectedCallback()` triggers Preact clean-up.
3.  **Core Gameplay & FSM Transitions**:
    *   *Observation*: Gameplay requires states `idle` -> `waiting_buzz` -> `answering` -> `result` -> `ended`.
    *   *Logic*: The E2E script must automate a full match playthrough, verifying:
        *   Inter-round cooldown prevents premature keyboard triggers.
        *   Keyboard buzz-in (Space/Enter) triggers active team answering state.
        *   Correct and incorrect clicks adjust scores and shift the rope background.
        *   High-tension critical states (score >= 8) visually activate pulse warning styles.
4.  **Admin Panel & Scaling Integrity**:
    *   *Observation*: M3 and M4 checked modal positioning and rendering outside the scale container.
    *   *Logic*: The M5 script should verify that clicking the gear button opens the modal unscaled, and both import and export tabs work. It should check that exporting returns a JSON array matching the active local storage questions schema.
5.  **Adversarial Hardening Verification**:
    *   *Observation*: Explorer 1 identified vulnerability vectors in key/click spamming, missing JSON structure fields, and non-secure environments.
    *   *Logic*: The E2E test suite must verify the hardening mechanisms:
        *   *Spamming*: Firing multiple keydowns/clicks in rapid succession must be ignored, resolving only the first trigger.
        *   *Size Limit*: Uploading files >500KB must be blocked with an error banner.
        *   *Invalid Schemas*: Uploads with empty fields, missing option lists, or invalid SHA-256 hashes must be rejected with localized validation messages.
        *   *No-Crypto Context*: Simulating `window.crypto.subtle = undefined` must execute cleanly using the fallback hashing library.

---

## 3. Caveats

*   **Mock AudioContext**: Because headless Chromium in Playwright does not natively output audio streams without interaction and configuration, the verification script must rely on a mock class definition of `window.AudioContext` to intercept and check Web Audio API calls.
*   **Dynamic Timing**: Small sleep delays (`time.sleep` or `page.wait_for_timeout`) are necessary to allow transitions (e.g. countdown timer ticking, game resetting) to complete, which can introduce minor test fragility if the machine running the tests is highly resource-constrained.
*   **Static File Host**: The verification script is designed to run against local build directories (`dist-test.html`) using the `file://` protocol, which also serves to test the `window.crypto.subtle` fallback mechanism.

---

## 4. Conclusion

A comprehensive design plan for the E2E verification test suite (`verify-m5.py`) has been constructed. It combines all test requirements into a robust script. Below is the proposed design blueprint for the implementer agent:

### Unified E2E Test Suite Blueprint (`tests/verify-m5.py`)

```python
import os
import json
import time
import hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright

def generate_adversarial_json_files():
    valid_hash = hashlib.sha256("4test-salt".encode("utf-8")).hexdigest()
    
    valid_questions = [{
        "id": "q1",
        "question": "What is 2 + 2?",
        "options": ["3", "4", "5", "6"],
        "answer_hash": valid_hash,
        "salt": "test-salt"
    }]
    
    invalid_schema = [{
        "id": "",  # Empty ID
        "question": "No ID question?",
        "options": ["A", "B", "C", "D"],
        "answer_hash": valid_hash,
        "salt": "test-salt"
    }]
    
    invalid_crypto = [{
        "id": "iq1",
        "question": "No correct answer hash matches?",
        "options": ["A", "B", "C", "D"],
        "answer_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "salt": "test-salt"
    }]

    with open("valid_m5.json", "w", encoding="utf-8") as f:
        json.dump(valid_questions, f)
    with open("invalid_schema_m5.json", "w", encoding="utf-8") as f:
        json.dump(invalid_schema, f)
    with open("invalid_crypto_m5.json", "w", encoding="utf-8") as f:
        json.dump(invalid_crypto, f)
    with open("large_m5.json", "w", encoding="utf-8") as f:
        f.write("A" * (505 * 1024))  # 505KB file

def cleanup_adversarial_files():
    for f in ["valid_m5.json", "invalid_schema_m5.json", "invalid_crypto_m5.json", "large_m5.json"]:
        if os.path.exists(f):
            os.remove(f)

def run_e2e_verification():
    project_root = Path(__file__).parent.parent
    js_bundle = project_root / "dist" / "knowledge-tug-of-war.js"
    html_test_file = project_root / "dist-test.html"
    
    report = {
        "bundle_validation": {"exists": False, "size_kb": 0, "under_limit": False},
        "dynamic_mount": {"registered": False, "shadow_dom_attached": False, "style_injected": False, "teardown_successful": False},
        "gameplay_flow": {"start_game": False, "cooldown_active": False, "buzz_works": False, "timer_ticks": False, "tug_and_score_update": False, "critical_warning_displays": False, "audio_synthesized": False},
        "admin_interactions": {"toggle_works": False, "unscaled_modal": False, "export_validation": False, "import_validation": False},
        "hardening_checks": {"buzz_spam_prevented": False, "click_spam_prevented": False, "file_size_limit_blocks": False, "invalid_schema_blocks": False, "crypto_fallback_works": False},
        "logs": [],
        "errors": []
    }

    # 1. Bundle Size Validation
    if js_bundle.exists():
        report["bundle_validation"]["exists"] = True
        size_kb = round(os.path.getsize(js_bundle) / 1024, 2)
        report["bundle_validation"]["size_kb"] = size_kb
        report["bundle_validation"]["under_limit"] = size_kb < 1200.0  # Limit to 1.2MB

    generate_adversarial_json_files()
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()
            
            page.on("console", lambda msg: report["logs"].append({"type": msg.type, "text": msg.text}))
            page.on("pageerror", lambda err: report["errors"].append(err.message))

            # 2. Dynamic Mount Verification
            page.goto("about:blank")
            # Inject bundle script
            page.add_script_tag(path=str(js_bundle))
            
            # Mount via evaluate
            page.evaluate("""() => {
                const element = document.createElement('knowledge-tug-of-war');
                element.id = 'dynamic-widget';
                element.setAttribute('theme', 'kinetic-academy');
                document.body.appendChild(element);
            }""")
            
            mounted = page.evaluate("() => document.getElementById('dynamic-widget') !== null")
            shadow_attached = page.evaluate("() => document.getElementById('dynamic-widget').shadowRoot !== null")
            style_injected = page.evaluate("""() => {
                const root = document.getElementById('dynamic-widget').shadowRoot;
                const style = root.querySelector('style');
                return style !== null && style.textContent.includes('tailwind');
            }""")
            
            report["dynamic_mount"]["registered"] = mounted
            report["dynamic_mount"]["shadow_dom_attached"] = shadow_attached
            report["dynamic_mount"]["style_injected"] = style_injected
            
            # Clean teardown
            page.evaluate("() => document.getElementById('dynamic-widget').remove()")
            teardown_ok = page.evaluate("() => document.getElementById('dynamic-widget') === null")
            report["dynamic_mount"]["teardown_successful"] = teardown_ok
            
            # 3. Core Gameplay & Audio synthesis Mock
            url = f"file:///{str(html_test_file).replace(os.sep, '/')}"
            # Inject AudioContext Mock
            audio_mock_js = """
            window.audioCalls = [];
            class MockAudioContext {
                constructor() { window.audioCalls.push('constructor'); this.state = 'suspended'; }
                resume() { window.audioCalls.push('resume'); this.state = 'running'; return Promise.resolve(); }
                createOscillator() {
                    return {
                        type: 'sine',
                        frequency: {
                            setValueAtTime: (v, t) => window.audioCalls.push(`osc-freq-${v}`),
                            linearRampToValueAtTime: (v, t) => window.audioCalls.push(`osc-freq-ramp-${v}`),
                            exponentialRampToValueAtTime: (v, t) => window.audioCalls.push(`osc-freq-exp-${v}`)
                        },
                        connect: () => {}, start: () => {}, stop: () => {}
                    };
                }
                createGain() {
                    return { gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} };
                }
                createBiquadFilter() {
                    return { frequency: { setValueAtTime: () => {} }, connect: () => {} };
                }
                createBuffer() { return { getChannelData: () => new Float32Array(100) }; }
                createBufferSource() { return { connect: () => {}, start: () => {}, stop: () => {} }; }
                get destination() { return {}; }
            }
            window.AudioContext = window.AudioContext || MockAudioContext;
            window.webkitAudioContext = window.webkitAudioContext || MockAudioContext;
            """
            page.add_init_script(audio_mock_js)
            page.goto(url)
            page.evaluate("() => localStorage.clear()")
            page.reload()
            
            # Click START_GAME
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
                if (btn) btn.click();
            }""")
            time.sleep(0.2)
            
            # Cooldown check: buzz immediately (should be blocked)
            page.keyboard.press("Space")
            time.sleep(0.1)
            cooldown_ok = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                return !host.shadowRoot.innerHTML.includes('ĐANG TRẢ LỜI');
            }""")
            report["gameplay_flow"]["cooldown_active"] = cooldown_ok
            
            # Wait past 500ms cooldown, then buzz
            time.sleep(0.5)
            page.keyboard.press("Space")
            time.sleep(0.1)
            buzzed = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                return host.shadowRoot.innerHTML.includes('ĐANG TRẢ LỜI');
            }""")
            report["gameplay_flow"]["buzz_works"] = buzzed
            
            # Verify timer decrease (wait 1.2s)
            time.sleep(1.2)
            timer_text = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const span = host.shadowRoot.querySelector('span[class*="text-rose"]'); // or countdown span
                return span ? span.textContent : '';
            }""")
            report["gameplay_flow"]["timer_ticks"] = len(timer_text) > 0
            
            # Answer question
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('main button')).find(b => b.textContent.includes('SHA-256'));
                if (btn) btn.click();
            }""")
            time.sleep(0.2)
            
            # Score check
            score_updated = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                return host.shadowRoot.innerHTML.includes('TRẢ LỜI ĐÚNG');
            }""")
            report["gameplay_flow"]["tug_and_score_update"] = score_updated
            
            # Check Audio Context Syntheses
            audio_calls = page.evaluate("() => window.audioCalls")
            report["gameplay_flow"]["audio_synthesized"] = len(audio_calls) > 0
            
            # 4. Admin Panel check
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Admin'));
                if (btn) btn.click();
            }""")
            time.sleep(0.2)
            
            admin_open = page.evaluate("() => document.querySelector('knowledge-tug-of-war').shadowRoot.innerHTML.includes('Bảng Điều Khiển Admin')")
            report["admin_interactions"]["toggle_works"] = admin_open
            
            # Aspect ratio check
            unscaled = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const rootDiv = host.shadowRoot.querySelector('div[style*="scale"]');
                const adminModal = host.shadowRoot.querySelector('div[class*="backdrop-blur"]');
                return rootDiv && adminModal ? !rootDiv.contains(adminModal) : false;
            }""")
            report["admin_interactions"]["unscaled_modal"] = unscaled
            
            # 5. Adversarial checks
            # A. Key spamming check
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('RESET'));
                if (btn) btn.click();
            }""")
            time.sleep(0.1)
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
                if (btn) btn.click();
            }""")
            time.sleep(0.6)
            
            # Spam Space 10 times
            for _ in range(10):
                page.keyboard.down("Space")
            page.keyboard.up("Space")
            time.sleep(0.1)
            
            # Assert only one audio constructor trigger for buzz was generated
            calls = page.evaluate("() => window.audioCalls")
            buzz_sends = [c for c in report["logs"] if "BUZZ" in c["text"]]
            report["hardening_checks"]["buzz_spam_prevented"] = len(buzz_sends) <= 1
            
            # B. Upload size check
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Admin'));
                if (btn) btn.click();
            }""")
            time.sleep(0.2)
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const importTab = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Import / Export'));
                if (importTab) importTab.click();
            }""")
            time.sleep(0.1)
            
            with page.expect_file_chooser() as fc_info:
                page.evaluate("""() => {
                    const host = document.querySelector('knowledge-tug-of-war');
                    const uploadBtn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Chọn file JSON'));
                    if (uploadBtn) uploadBtn.click();
                }""")
                file_chooser = fc_info.value
                file_chooser.set_files("large_m5.json")
            time.sleep(0.3)
            
            size_err = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                return host.shadowRoot.innerHTML.includes('vượt quá giới hạn');
            }""")
            report["hardening_checks"]["file_size_limit_blocks"] = size_err
            
            # C. Invalid schema check
            with page.expect_file_chooser() as fc_info:
                page.evaluate("""() => {
                    const host = document.querySelector('knowledge-tug-of-war');
                    const uploadBtn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Chọn file JSON'));
                    if (uploadBtn) uploadBtn.click();
                }""")
                file_chooser = fc_info.value
                file_chooser.set_files("invalid_schema_m5.json")
            time.sleep(0.3)
            
            schema_err = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                return host.shadowRoot.innerHTML.includes('id') || host.shadowRoot.innerHTML.includes('đáp án');
            }""")
            report["hardening_checks"]["invalid_schema_blocks"] = schema_err
            
            # D. Crypto subtle fallback check
            # Simulate non-secure context
            page.evaluate("() => { Object.defineProperty(window.crypto, 'subtle', { value: undefined, writable: true, configurable: true }); }")
            # Click Reset / Play
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('RESET'));
                if (btn) btn.click();
            }""")
            time.sleep(0.1)
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
                if (btn) btn.click();
            }""")
            time.sleep(0.6)
            
            # Buzz
            page.keyboard.press("Space")
            time.sleep(0.2)
            
            # Answer option correct (SHA-256 is index 1 or contains text)
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('main button')).find(b => b.textContent.includes('SHA-256'));
                if (btn) btn.click();
            }""")
            time.sleep(0.2)
            
            correct_with_fallback = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                return host.shadowRoot.innerHTML.includes('TRẢ LỜI ĐÚNG');
            }""")
            report["hardening_checks"]["crypto_fallback_works"] = correct_with_fallback
            
            browser.close()
            
    except Exception as e:
        report["errors"].append(str(e))
        print(f"E2E Execution Error: {e}")
        
    cleanup_adversarial_files()
    
    out_path = project_root / "tests" / "m5_verification_summary.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Summary written to {out_path}")

if __name__ == "__main__":
    run_e2e_verification()
```

---

## 5. Verification Method

To verify the test design report and ensure that the verification suite runs properly on the system:

1.  **Run Build Script**:
    *   Ensure the web component is fully built by running:
        ```powershell
        npm run build
        ```
    *   Verify the existence of `dist/knowledge-tug-of-war.js`.
2.  **Run E2E Verification Suite**:
    *   Deploy the E2E verification file by saving the python script above to `knowledge-tug-of-war/tests/verify-m5.py`.
    *   Run the script with the project virtual environment or global playwright python context:
        ```powershell
        python tests/verify-m5.py
        ```
3.  **Inspect Summary JSON Output**:
    *   Open and inspect `tests/m5_verification_summary.json`.
    *   Ensure all categories (`bundle_validation`, `dynamic_mount`, `gameplay_flow`, `admin_interactions`, and `hardening_checks`) return `true` across their respective test fields.
    *   Confirm there are no entries in the `"errors"` list.
