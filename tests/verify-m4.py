import os
import json
import time
import hashlib
from playwright.sync_api import sync_playwright

def run_verification():
    html_path = "D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\dist-test.html"
    url = f"file:///{html_path.replace(os.sep, '/')}"
    
    # Generate 5 valid test questions so we can play multiple rounds
    valid_hash_4 = hashlib.sha256("4test-salt".encode("utf-8")).hexdigest()
    valid_hash_5 = hashlib.sha256("5test-salt".encode("utf-8")).hexdigest()
    valid_hash_6 = hashlib.sha256("6test-salt".encode("utf-8")).hexdigest()
    
    valid_questions = [
        {
            "id": "q1",
            "question": "What is 2 + 2?",
            "options": ["3", "4", "5", "6"],
            "answer_hash": valid_hash_4,
            "salt": "test-salt"
        },
        {
            "id": "q2",
            "question": "What is 2 + 3?",
            "options": ["3", "4", "5", "6"],
            "answer_hash": valid_hash_5,
            "salt": "test-salt"
        },
        {
            "id": "q3",
            "question": "What is 3 + 3?",
            "options": ["3", "4", "5", "6"],
            "answer_hash": valid_hash_6,
            "salt": "test-salt"
        },
        {
            "id": "q4",
            "question": "What is 2 + 2 again?",
            "options": ["3", "4", "5", "6"],
            "answer_hash": valid_hash_4,
            "salt": "test-salt"
        },
        {
            "id": "q5",
            "question": "What is 2 + 3 again?",
            "options": ["3", "4", "5", "6"],
            "answer_hash": valid_hash_5,
            "salt": "test-salt"
        }
    ]
    
    valid_json_path = os.path.abspath("valid_test_m4.json").replace(os.sep, "/")
    with open(valid_json_path, "w", encoding="utf-8") as f:
        json.dump(valid_questions, f, indent=2)

    report = {
        "build_check": {
            "js_bundle_exists": False,
            "js_bundle_size_kb": 0
        },
        "visual_behaviors": {
            "braided_rope_texture_exists": False,
            "braided_rope_movement_on_tug": False,
            "diamond_snapping_elastic": False,
            "fiery_warning_indicators": False,
            "edge_glow_backdrops": False
        },
        "audio_verification": {
            "audiocontext_activation": False,
            "procedural_buzz_sound": False,
            "procedural_tick_sound": False,
            "procedural_correct_sound": False,
            "procedural_wrong_sound": False,
            "procedural_pull_rope_sound": False
        },
        "mobile_layout": {
            "scaler_disabled": False,
            "single_column_grid": False,
            "touch_buttons_visible": False
        },
        "logs": [],
        "errors": []
    }
    
    # 1. Verify build bundle exists and has size
    js_bundle_path = "D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\dist\\knowledge-tug-of-war.js"
    if os.path.exists(js_bundle_path):
        report["build_check"]["js_bundle_exists"] = True
        report["build_check"]["js_bundle_size_kb"] = round(os.path.getsize(js_bundle_path) / 1024, 2)
        print(f"[Build Check] JS Bundle exists: {report['build_check']['js_bundle_size_kb']} KB")
    else:
        print("[Build Check] JS Bundle not found!")

    try:
        with sync_playwright() as p:
            # Launch browser
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()
            
            # Navigate to load the page and clear storage
            page.goto(url, wait_until="load")
            page.evaluate("() => localStorage.clear()")
            
            # Setup logging
            page.on("console", lambda msg: report["logs"].append({
                "type": msg.type,
                "text": msg.text
            }))
            page.on("pageerror", lambda err: report["errors"].append(err))
            
            # Inject AudioContext Mock before reloading page
            audio_mock_js = """
            window.audioCalls = [];
            class MockAudioContext {
                constructor() {
                    window.audioCalls.push('constructor');
                    this.state = 'suspended';
                    this.currentTime = 0;
                    this.sampleRate = 44100;
                }
                resume() {
                    window.audioCalls.push('resume');
                    this.state = 'running';
                    return Promise.resolve();
                }
                createOscillator() {
                    window.audioCalls.push('createOscillator');
                    const osc = {
                        type: 'sine',
                        frequency: {
                            setValueAtTime: (v, t) => window.audioCalls.push(`osc-freq-setValueAtTime-${v}-${t}`),
                            linearRampToValueAtTime: (v, t) => window.audioCalls.push(`osc-freq-linearRampToValueAtTime-${v}-${t}`),
                            exponentialRampToValueAtTime: (v, t) => window.audioCalls.push(`osc-freq-exponentialRampToValueAtTime-${v}-${t}`),
                        },
                        connect: (node) => window.audioCalls.push('osc-connect'),
                        start: (t) => window.audioCalls.push(`osc-start-${t || 0}`),
                        stop: (t) => window.audioCalls.push(`osc-stop-${t || 0}`),
                    };
                    return osc;
                }
                createBiquadFilter() {
                    window.audioCalls.push('createBiquadFilter');
                    const filter = {
                        type: 'lowpass',
                        frequency: {
                            setValueAtTime: (v, t) => window.audioCalls.push(`filter-freq-setValueAtTime-${v}-${t}`),
                            linearRampToValueAtTime: (v, t) => window.audioCalls.push(`filter-freq-linearRampToValueAtTime-${v}-${t}`),
                            exponentialRampToValueAtTime: (v, t) => window.audioCalls.push(`filter-freq-exponentialRampToValueAtTime-${v}-${t}`),
                        },
                        Q: {
                            setValueAtTime: (v, t) => window.audioCalls.push(`filter-Q-setValueAtTime-${v}-${t}`),
                        },
                        connect: (node) => window.audioCalls.push('filter-connect'),
                    };
                    return filter;
                }
                createGain() {
                    window.audioCalls.push('createGain');
                    const gainNode = {
                        gain: {
                            setValueAtTime: (v, t) => window.audioCalls.push(`gain-setValueAtTime-${v}-${t}`),
                            linearRampToValueAtTime: (v, t) => window.audioCalls.push(`gain-linearRampToValueAtTime-${v}-${t}`),
                            exponentialRampToValueAtTime: (v, t) => window.audioCalls.push(`gain-exponentialRampToValueAtTime-${v}-${t}`),
                        },
                        connect: (node) => window.audioCalls.push('gain-connect'),
                    };
                    return gainNode;
                }
                createBuffer(channels, size, rate) {
                    window.audioCalls.push('createBuffer');
                    return {
                        getChannelData: () => new Float32Array(size),
                    };
                }
                createBufferSource() {
                    window.audioCalls.push('createBufferSource');
                    return {
                        buffer: null,
                        connect: (node) => window.audioCalls.push('buf-connect'),
                        start: (t) => window.audioCalls.push(`buf-start-${t || 0}`),
                        stop: (t) => window.audioCalls.push(`buf-stop-${t || 0}`),
                    };
                }
                get destination() { return { name: 'destination' }; }
            }
            window.AudioContext = MockAudioContext;
            """
            page.add_init_script(audio_mock_js)
            
            # Reload page with the audio mock and clean state
            page.goto(url, wait_until="load")
            time.sleep(0.5)
            
            # Import our 5 valid questions
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const btn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('Admin'));
                if (btn) btn.click();
            }""")
            time.sleep(0.2)
            
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const importTab = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('Import / Export'));
                if (importTab) importTab.click();
            }""")
            time.sleep(0.1)
            
            page.on("dialog", lambda dialog: dialog.accept())
            with page.expect_file_chooser() as fc_info:
                page.evaluate("""() => {
                    const host = document.querySelector('knowledge-tug-of-war');
                    const shadow = host.shadowRoot;
                    const importBtn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('Chọn file JSON'));
                    if (importBtn) importBtn.click();
                }""")
                file_chooser = fc_info.value
                file_chooser.set_files(valid_json_path)
            time.sleep(0.5)
            
            # Close Admin Modal
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const closeBtn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('Đóng'));
                if (closeBtn) closeBtn.click();
            }""")
            time.sleep(0.2)
            
            # Click START_GAME
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const startBtn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
                if (startBtn) startBtn.click();
            }""")
            time.sleep(0.5)
            
            # Unlock AudioContext via click
            page.click("body")
            time.sleep(0.1)
            
            # Check AudioContext constructor run
            audio_calls = page.evaluate("() => window.audioCalls")
            if 'constructor' in audio_calls or 'resume' in audio_calls:
                report["audio_verification"]["audiocontext_activation"] = True
                print("[Audio Check] AudioContext successfully initialized/resumed on user click.")
            
            # Verify Braided Rope Class & Elastic Transition definition in CSS
            rope_classes = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const rope = shadow.querySelector('.rope-texture');
                return rope ? Array.from(rope.classList) : [];
            }""")
            if 'rope-texture' in rope_classes:
                report["visual_behaviors"]["braided_rope_texture_exists"] = True
                print("[Visual Check] Rope element has .rope-texture class.")
                
            # Verify Diamond Tension Marker Snapping Elastic transition
            transition_data = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const marker = Array.from(shadow.querySelectorAll('div')).find(el => el.className.includes('rotate-45') && el.className.includes('absolute'));
                if (marker) {
                    const style = window.getComputedStyle(marker);
                    return {
                        transition: style.transition,
                        classes: Array.from(marker.classList)
                    };
                }
                return null;
            }""")
            if transition_data:
                if '0.34' in transition_data['transition'] or '1.56' in transition_data['transition'] or '0.64' in transition_data['transition']:
                    report["visual_behaviors"]["diamond_snapping_elastic"] = True
                    print("[Visual Check] Diamond tension marker uses elastic overshoot easeOutBack (cubic-bezier(0.34, 1.56, 0.64, 1)).")

            # --- ROUND 1: Buzz and Answer Correctly (Score: 6 - 4) ---
            initial_rope_pos = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const rope = shadow.querySelector('.rope-texture');
                return rope ? window.getComputedStyle(rope).backgroundPosition : null;
            }""")
            
            # Buzz in with space key
            page.keyboard.press("Space")
            # Wait 1.2 seconds to allow the timer to tick once, triggering the procedural tick sound!
            time.sleep(1.2)
            
            # Check edge glow backdrops on buzz-in
            edge_glow_visible = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const leftGlow = shadow.querySelector('div[class*="from-primary-container"]');
                if (leftGlow) {
                    const style = window.getComputedStyle(leftGlow);
                    return style.opacity !== '0';
                }
                return false;
            }""")
            if edge_glow_visible:
                report["visual_behaviors"]["edge_glow_backdrops"] = True
                print("[Visual Check] Edge glow backdrop correctly activated on buzz-in.")
                
            # Click Option B ("4" - Correct)
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const optBtn = Array.from(shadow.querySelectorAll('main button')).find(b => b.textContent.includes('4'));
                if (optBtn) optBtn.click();
            }""")
            time.sleep(0.3)
            
            # Verify rope movement background-position shift
            new_rope_pos = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const rope = shadow.querySelector('.rope-texture');
                return rope ? window.getComputedStyle(rope).backgroundPosition : null;
            }""")
            if initial_rope_pos != new_rope_pos:
                report["visual_behaviors"]["braided_rope_movement_on_tug"] = True
                print(f"[Visual Check] Rope shifted background-position: {initial_rope_pos} -> {new_rope_pos}")
            
            # Click Next Question
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const nextBtn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('Tiếp tục'));
                if (nextBtn) nextBtn.click();
            }""")
            time.sleep(0.6)

            # --- ROUND 2: Buzz and Answer Correctly (Score: 7 - 3) ---
            page.keyboard.press("Space")
            time.sleep(0.2)
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const optBtn = Array.from(shadow.querySelectorAll('main button')).find(b => b.textContent.includes('5'));
                if (optBtn) optBtn.click();
            }""")
            time.sleep(0.3)
            
            # Click Next
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const nextBtn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('Tiếp tục'));
                if (nextBtn) nextBtn.click();
            }""")
            time.sleep(0.6)

            # --- ROUND 3: Buzz and Answer Correctly (Score: 8 - 2) ---
            page.keyboard.press("Space")
            time.sleep(0.2)
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const optBtn = Array.from(shadow.querySelectorAll('main button')).find(b => b.textContent.includes('6'));
                if (optBtn) optBtn.click();
            }""")
            time.sleep(0.3)
            
            # Verify score is now 8 - 2
            scores = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const headers = Array.from(shadow.querySelectorAll('header span'));
                const score1 = headers.find(h => h.className.includes('text-primary-container'))?.textContent;
                const score2 = headers.find(h => h.className.includes('text-secondary-container'))?.textContent;
                return { team1: parseInt(score1), team2: parseInt(score2) };
            }""")
            print(f"[Game Check] Score reached: Team 1 ({scores['team1']}) - Team 2 ({scores['team2']})")
            
            # Check fiery warning indicators and animations at score >= 8
            fiery_warning_active = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                
                const warningText = shadow.innerHTML.includes('NGUY CẤP');
                const bar1 = shadow.querySelector('.w-full.h-full.flex.rounded-full.overflow-hidden > div:first-child');
                const hasFieryPulse = bar1 && bar1.className.includes('animate-[fieryPulse');
                const diamond = shadow.querySelector('div[class*="criticalPulse"]');
                const hasCriticalPulse = diamond !== null;
                
                return {
                    warningText,
                    hasFieryPulse,
                    hasCriticalPulse
                };
            }""")
            
            if fiery_warning_active["warningText"] and fiery_warning_active["hasFieryPulse"] and fiery_warning_active["hasCriticalPulse"]:
                report["visual_behaviors"]["fiery_warning_indicators"] = True
                print("[Visual Check] Fiery warning indicators and critical animations successfully triggered at score >= 8!")
            else:
                print(f"[Visual Check Fail] Fiery warning active state: {fiery_warning_active}")

            # Capture Desktop Screenshot
            os.makedirs("D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\tests\\screenshots", exist_ok=True)
            desktop_screenshot = "D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\tests\\screenshots\\desktop.png"
            page.screenshot(path=desktop_screenshot)
            print(f"[Visual Check] Desktop screenshot saved to {desktop_screenshot}")

            # Verify Procedural Audio synthesis calls in AudioContext Mock
            calls = page.evaluate("() => window.audioCalls")
            
            report["audio_verification"]["procedural_buzz_sound"] = any('createOscillator' in c for c in calls) and any('osc-freq-linearRampToValueAtTime-90-' in c for c in calls)
            report["audio_verification"]["procedural_tick_sound"] = any('osc-freq-exponentialRampToValueAtTime-600-' in c for c in calls)
            report["audio_verification"]["procedural_correct_sound"] = any('osc-freq-setValueAtTime-1046.5-' in c for c in calls)
            report["audio_verification"]["procedural_pull_rope_sound"] = any('createBuffer' in c for c in calls) and any('createBufferSource' in c for c in calls)
            
            # Verify wrong sound triggers
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const nextBtn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('Tiếp tục'));
                if (nextBtn) nextBtn.click();
            }""")
            time.sleep(0.6)
            
            # Buzz
            page.keyboard.press("Space")
            time.sleep(0.2)
            
            # Answer option A (Wrong, option A is "3")
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const optBtn = Array.from(shadow.querySelectorAll('main button')).find(b => b.textContent.includes('3'));
                if (optBtn) optBtn.click();
            }""")
            time.sleep(0.3)
            
            calls_after_wrong = page.evaluate("() => window.audioCalls")
            report["audio_verification"]["procedural_wrong_sound"] = any('osc-freq-linearRampToValueAtTime-60-' in c for c in calls_after_wrong)
            
            print(f"[Audio Check] Procedural Audio triggers: {report['audio_verification']}")

            # Go to next question to return to 'waiting_buzz' state so mobile tap buttons are displayed
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const nextBtn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('Tiếp tục'));
                if (nextBtn) nextBtn.click();
            }""")
            time.sleep(0.6)

            # --- MOBILE LAYOUT VERIFICATION ---
            # Set viewport to mobile size
            page.set_viewport_size({"width": 375, "height": 667})
            time.sleep(0.5)
            
            mobile_ui = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const shadow = host.shadowRoot;
                const container = shadow.querySelector('.glass-panel');
                const transform = container ? container.style.transform : '';
                const width = container ? container.style.width : '';
                
                const scalerDisabled = !transform.includes('scale') && width === '100%';
                
                const optionsGrid = shadow.querySelector('main div[class*="grid"]');
                const singleColumnGrid = optionsGrid && optionsGrid.className.includes('grid-cols-1');
                
                const btn1 = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('ĐỘI 1 ĐẬP'));
                const btn2 = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('ĐỘI 2 ĐẬP'));
                const touchButtonsVisible = btn1 !== undefined && btn2 !== undefined;
                
                return {
                    scalerDisabled,
                    singleColumnGrid,
                    touchButtonsVisible
                };
            }""")
            
            report["mobile_layout"]["scaler_disabled"] = mobile_ui["scalerDisabled"]
            report["mobile_layout"]["single_column_grid"] = mobile_ui["singleColumnGrid"]
            report["mobile_layout"]["touch_buttons_visible"] = mobile_ui["touchButtonsVisible"]
            
            print(f"[Mobile Check] Layout status: {report['mobile_layout']}")
            
            # Capture Mobile Screenshot
            mobile_screenshot = "D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\tests\\screenshots\\mobile.png"
            page.screenshot(path=mobile_screenshot)
            print(f"[Visual Check] Mobile screenshot saved to {mobile_screenshot}")
            
            # Close browser
            browser.close()
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        report["errors"].append(str(e))
        print(f"Exception during verification: {e}")
        
    # Write report file
    out_path = "D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\tests\\m4_verification_summary.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Summary written to {out_path}")
    
    # Cleanup generated files
    try:
        os.remove(valid_json_path)
    except:
        pass

if __name__ == "__main__":
    run_verification()
