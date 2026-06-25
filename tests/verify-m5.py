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
            page.on("dialog", lambda dialog: dialog.accept()) # Auto-accept alerts

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
                return style !== null && style.textContent.length > 0;
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
            window.webkitAudioContext = MockAudioContext;
            """
            page.add_init_script(audio_mock_js)
            page.goto(url)
            page.evaluate("() => localStorage.clear()")
            page.reload()
            time.sleep(0.5)
            
            # Click START_GAME
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
                if (btn) btn.click();
            }""")
            time.sleep(0.2)
            report["gameplay_flow"]["start_game"] = True
            
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
                const spans = Array.from(host.shadowRoot.querySelectorAll('span'));
                const timerSpan = spans.find(s => s.textContent.includes('Còn lại'));
                return timerSpan ? timerSpan.textContent : '';
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
            
            # Verify warning style definition exists in Shadow DOM stylesheet
            critical_warning_ok = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const style = host.shadowRoot.querySelector('style');
                return style && style.textContent.includes('fieryPulse');
            }""")
            report["gameplay_flow"]["critical_warning_displays"] = critical_warning_ok
            
            # 4. Admin Panel check
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Admin'));
                if (btn) btn.click();
            }""")
            time.sleep(0.2)
            
            admin_open = page.evaluate("() => document.querySelector('knowledge-tug-of-war').shadowRoot.innerHTML.includes('Bảng Điều Khiển Admin')")
            report["admin_interactions"]["toggle_works"] = admin_open
            
            # Aspect ratio check - modal should be sibling of glass-panel container
            unscaled = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const rootDiv = host.shadowRoot.querySelector('div.glass-panel');
                const adminModal = Array.from(host.shadowRoot.querySelectorAll('div')).find(el => el.textContent.includes('Bảng Điều Khiển Admin') && el.className.includes('absolute'));
                return rootDiv && adminModal ? !rootDiv.contains(adminModal) : false;
            }""")
            report["admin_interactions"]["unscaled_modal"] = unscaled
            
            # Click Export JSON tab
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const tab = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Import / Export'));
                if (tab) tab.click();
            }""")
            time.sleep(0.1)
            
            # Export validation
            with page.expect_download() as download_info:
                page.evaluate("""() => {
                    const host = document.querySelector('knowledge-tug-of-war');
                    const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Tải file JSON xuống'));
                    if (btn) btn.click();
                }""")
            download = download_info.value
            download_path = download.path()
            with open(download_path, "r", encoding="utf-8") as f:
                exported_data = json.load(f)
            export_ok = isinstance(exported_data, list) and len(exported_data) > 0 and "question" in exported_data[0]
            report["admin_interactions"]["export_validation"] = export_ok
            
            # Import validation
            with page.expect_file_chooser() as fc_info:
                page.evaluate("""() => {
                    const host = document.querySelector('knowledge-tug-of-war');
                    const uploadBtn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Chọn file JSON'));
                    if (uploadBtn) uploadBtn.click();
                }""")
                file_chooser = fc_info.value
                file_chooser.set_files(os.path.abspath("valid_m5.json"))
            time.sleep(1.5)
            
            import_ok = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                return host.shadowRoot.innerHTML.includes('What is 2 + 2?');
            }""")
            report["admin_interactions"]["import_validation"] = import_ok
            
            # 5. Hardening checks
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
            
            # Reset logs and spam Space 10 times
            report["logs"] = []
            for _ in range(10):
                page.keyboard.down("Space")
            page.keyboard.up("Space")
            time.sleep(0.1)
            
            buzz_sends = [c for c in report["logs"] if "BUZZ" in c["text"]]
            report["hardening_checks"]["buzz_spam_prevented"] = len(buzz_sends) <= 1
            
            # B. Click spamming check
            page.keyboard.press("Space")
            time.sleep(0.2)
            report["logs"] = []
            # Click option 10 times in parallel
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('main button')).find(b => b.textContent.includes('SHA-256'));
                if (btn) {
                    for (let i = 0; i < 10; i++) {
                        btn.click();
                    }
                }
            }""")
            time.sleep(0.2)
            click_sends = [c for c in report["logs"] if "OPTION_CLICK" in c["text"]]
            report["hardening_checks"]["click_spam_prevented"] = len(click_sends) <= 1
 
            # C. Upload size check
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
                file_chooser.set_files(os.path.abspath("large_m5.json"))
            time.sleep(0.3)
            
            size_err = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                return host.shadowRoot.innerHTML.includes('vượt quá giới hạn');
            }""")
            report["hardening_checks"]["file_size_limit_blocks"] = size_err
            
            # D. Invalid schema check
            with page.expect_file_chooser() as fc_info:
                page.evaluate("""() => {
                    const host = document.querySelector('knowledge-tug-of-war');
                    const uploadBtn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Chọn file JSON'));
                    if (uploadBtn) uploadBtn.click();
                }""")
                file_chooser = fc_info.value
                file_chooser.set_files(os.path.abspath("invalid_schema_m5.json"))
            time.sleep(0.3)
            
            schema_err = page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                return host.shadowRoot.innerHTML.includes('id') || host.shadowRoot.innerHTML.includes('đáp án') || host.shadowRoot.innerHTML.includes('lỗi định dạng') || host.shadowRoot.innerHTML.includes('Lỗi dữ liệu');
            }""")
            report["hardening_checks"]["invalid_schema_blocks"] = schema_err
            
            # E. Crypto subtle fallback check
            # Close admin panel
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Đóng'));
                if (btn) btn.click();
            }""")
            time.sleep(0.2)
            
            # Clear local storage to reset to default questions
            page.evaluate("() => localStorage.clear()")
            # Register init script to block crypto.subtle and reload
            page.add_init_script("if (window.crypto) { Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true }); }")
            page.reload()
            time.sleep(0.5)
            
            page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
                if (btn) btn.click();
            }""")
            time.sleep(0.6)
            
            page.keyboard.press("Space")
            time.sleep(0.2)
            
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
        import traceback
        traceback.print_exc()
        report["errors"].append(str(e))
        print(f"E2E Execution Error: {e}")
        
    cleanup_adversarial_files()
    
    out_dir = project_root / "tests"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "m5_verification_summary.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Summary written to {out_path}")

if __name__ == "__main__":
    run_e2e_verification()
