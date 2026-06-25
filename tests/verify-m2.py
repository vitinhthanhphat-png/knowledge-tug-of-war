import os
import json
import time
from playwright.sync_api import sync_playwright

def run_verification():
    html_path = "D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\dist-test.html"
    url = f"file:///{html_path.replace(os.sep, '/')}"
    
    report = {
        "url": url,
        "fsm_transitions": {
            "idle": False,
            "waiting_buzz": False,
            "answering": False,
            "result": False,
            "ended": False,
            "reset_to_idle": False
        },
        "keyboard_lockout": {
            "space_locks_out_enter": False,
            "enter_locks_out_space": False
        },
        "input_textarea_ignore": {
            "input_space_ignored": False,
            "textarea_enter_ignored": False
        },
        "space_scroll_prevention": {
            "scroll_prevented": False
        },
        "inter_round_cooldown": {
            "ignored_before_500ms": False,
            "accepted_after_500ms": False
        },
        "logs": [],
        "errors": []
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # Set up a new context and page
        context = browser.new_context()
        page = context.new_page()
        
        page.on("console", lambda msg: report["logs"].append({
            "type": msg.type,
            "text": msg.text
        }))
        
        page.on("pageerror", lambda err: report["errors"].append(err.message))
        
        # Navigate to the test page
        page.goto(url, wait_until="load")
        
        # Helper to get the inner state from the preact app
        def get_game_state():
            return page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                if (!host || !host.shadowRoot) return null;
                // We can query the main content text or indicators to infer the state
                const shadow = host.shadowRoot;
                const header = shadow.querySelector('header');
                const main = shadow.querySelector('main');
                
                // Let's inspect the visual state
                const startBtn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
                const restartBtn = Array.from(shadow.querySelectorAll('button')).find(b => b.textContent.includes('CHƠI LẠI'));
                const endTitle = Array.from(shadow.querySelectorAll('h2')).find(h => h.textContent.includes('KẾT THÚC TRẬN ĐẤU'));
                const buzzBanner = shadow.innerHTML.includes('ĐẬP CHUÔNG ĐỂ GIÀNH QUYỀN TRẢ LỜI');
                const answeringBanner = shadow.innerHTML.includes('ĐANG TRẢ LỜI');
                const resultBanner = shadow.innerHTML.includes('TRẢ LỜI ĐÚNG') || shadow.innerHTML.includes('TRẢ LỜI SAI') || shadow.innerHTML.includes('HẾT GIỜ TRẢ LỜI');
                
                if (startBtn) return 'idle';
                if (endTitle || restartBtn) return 'ended';
                if (buzzBanner) return 'waiting_buzz';
                if (answeringBanner) return 'answering';
                if (resultBanner) return 'result';
                return 'unknown';
            }""")

        def get_active_team():
            return page.evaluate("""() => {
                const host = document.querySelector('knowledge-tug-of-war');
                if (!host || !host.shadowRoot) return null;
                const shadow = host.shadowRoot;
                if (shadow.innerHTML.includes('ĐỘI 1 ĐANG TRẢ LỜI')) return 'team1';
                if (shadow.innerHTML.includes('ĐỘI 2 ĐANG TRẢ LỜI')) return 'team2';
                return null;
            }""")
            
        print("Checking initial state...")
        initial_state = get_game_state()
        print(f"Initial state: {initial_state}")
        if initial_state == 'idle':
            report["fsm_transitions"]["idle"] = True
            
        # 1. Start Game
        page.evaluate("""() => {
            const host = document.querySelector('knowledge-tug-of-war');
            const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
            if (btn) btn.click();
        }""")
        
        time.sleep(0.1)
        state_after_start = get_game_state()
        print(f"State after clicking start: {state_after_start}")
        if state_after_start == 'waiting_buzz':
            report["fsm_transitions"]["waiting_buzz"] = True
            
        # Let's reset first to run the inter-round cooldown test cleanly
        page.evaluate("() => localStorage.clear()")
        page.reload(wait_until="load")
        time.sleep(0.5)
        
        # 2. Inter-round Cooldown (buzz is ignored for 500ms after entering the round)
        # Click start again
        page.evaluate("""() => {
            const host = document.querySelector('knowledge-tug-of-war');
            const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
            if (btn) btn.click();
        }""")
        
        # Immediately dispatch Space (Team 1) keydown
        page.evaluate("""() => {
            const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
            window.dispatchEvent(event);
        }""")
        
        time.sleep(0.1)
        state_immediate_buzz = get_game_state()
        print(f"State immediately after buzz (during 500ms cooldown): {state_immediate_buzz}")
        if state_immediate_buzz == 'waiting_buzz':
            report["inter_round_cooldown"]["ignored_before_500ms"] = True
            
        # Wait until cooldown is over (>500ms)
        time.sleep(0.5)
        
        # Dispatch Space again
        page.evaluate("""() => {
            const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
            window.dispatchEvent(event);
        }""")
        
        time.sleep(0.1)
        state_after_cooldown_buzz = get_game_state()
        print(f"State after buzz post-cooldown: {state_after_cooldown_buzz}")
        if state_after_cooldown_buzz == 'answering':
            report["inter_round_cooldown"]["accepted_after_500ms"] = True
            report["fsm_transitions"]["answering"] = True
            
        # Click one option to go to result
        page.evaluate("""() => {
            const host = document.querySelector('knowledge-tug-of-war');
            const btn = host.shadowRoot.querySelectorAll('main button')[0];
            if (btn) btn.click();
        }""")
        
        time.sleep(0.1)
        state_after_answer = get_game_state()
        print(f"State after answering: {state_after_answer}")
        if state_after_answer == 'result':
            report["fsm_transitions"]["result"] = True
            
        # Wait 2.2 seconds for transition to ended
        print("Waiting for auto-transition to ended state...")
        time.sleep(2.2)
        state_after_result = get_game_state()
        print(f"State after auto-transition: {state_after_result}")
        if state_after_result == 'ended':
            report["fsm_transitions"]["ended"] = True
            
        # Click CHƠI LẠI
        page.evaluate("""() => {
            const host = document.querySelector('knowledge-tug-of-war');
            const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('CHƠI LẠI'));
            if (btn) btn.click();
        }""")
        time.sleep(0.1)
        state_after_reset = get_game_state()
        print(f"State after reset/replay: {state_after_reset}")
        if state_after_reset == 'idle':
            report["fsm_transitions"]["reset_to_idle"] = True
            
        # 3. Keyboard lockout verification
        # Transition back to waiting_buzz
        page.evaluate("""() => {
            const host = document.querySelector('knowledge-tug-of-war');
            const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
            if (btn) btn.click();
        }""")
        time.sleep(0.6) # Wait past the 500ms cooldown
        
        # Dispatch Space and Enter synchronously
        page.evaluate("""() => {
            window.lockout_results = [];
            // We'll dispatch Space first, then Enter immediately in the same call
            const spaceEvent = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
            const enterEvent = new KeyboardEvent('keydown', { code: 'Enter', bubbles: true });
            window.dispatchEvent(spaceEvent);
            window.dispatchEvent(enterEvent);
        }""")
        time.sleep(0.1)
        
        active_team = get_active_team()
        print(f"Active team after synch Space + Enter: {active_team}")
        if active_team == 'team1':
            report["keyboard_lockout"]["space_locks_out_enter"] = True
            
        # Reset and test the other way (Enter first, then Space)
        page.evaluate("() => localStorage.clear()")
        page.reload(wait_until="load")
        time.sleep(0.5)
        page.evaluate("""() => {
            const host = document.querySelector('knowledge-tug-of-war');
            const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
            if (btn) btn.click();
        }""")
        time.sleep(0.6)
        
        # Dispatch Enter first, then Space synchronously
        page.evaluate("""() => {
            const enterEvent = new KeyboardEvent('keydown', { code: 'Enter', bubbles: true });
            const spaceEvent = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
            window.dispatchEvent(enterEvent);
            window.dispatchEvent(spaceEvent);
        }""")
        time.sleep(0.1)
        
        active_team = get_active_team()
        print(f"Active team after synch Enter + Space: {active_team}")
        if active_team == 'team2':
            report["keyboard_lockout"]["enter_locks_out_space"] = True
            
        # Reset again for the next tests
        page.evaluate("() => localStorage.clear()")
        page.reload(wait_until="load")
        time.sleep(0.5)
        page.evaluate("""() => {
            const host = document.querySelector('knowledge-tug-of-war');
            const btn = Array.from(host.shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU CHƠI'));
            if (btn) btn.click();
        }""")
        time.sleep(0.6)
        
        # 4. Input and Textarea Ignore
        page.evaluate("""() => {
            // Create a temporary input and textarea outside the shadow DOM
            const input = document.createElement('input');
            input.id = 'test-input';
            document.body.appendChild(input);
            input.focus();
            
            // Dispatch Space inside input
            const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
            input.dispatchEvent(event);
        }""")
        time.sleep(0.1)
        state_after_input_space = get_game_state()
        print(f"State after Space in input: {state_after_input_space}")
        if state_after_input_space == 'waiting_buzz':
            report["input_textarea_ignore"]["input_space_ignored"] = True
            
        # Focused textarea test
        page.evaluate("""() => {
            const textarea = document.createElement('textarea');
            textarea.id = 'test-textarea';
            document.body.appendChild(textarea);
            textarea.focus();
            
            // Dispatch Enter inside textarea
            const event = new KeyboardEvent('keydown', { code: 'Enter', bubbles: true });
            textarea.dispatchEvent(event);
        }""")
        time.sleep(0.1)
        state_after_textarea_enter = get_game_state()
        print(f"State after Enter in textarea: {state_after_textarea_enter}")
        if state_after_textarea_enter == 'waiting_buzz':
            report["input_textarea_ignore"]["textarea_enter_ignored"] = True
            
        # Clean up input/textarea
        page.evaluate("""() => {
            const input = document.getElementById('test-input');
            const textarea = document.getElementById('test-textarea');
            if (input) input.remove();
            if (textarea) textarea.remove();
        }""")
        
        # 5. Space Scroll Prevention
        # Make the page scrollable
        page.evaluate("""() => {
            document.body.style.height = '2000px';
            window.scrollTo(0, 0);
        }""")
        time.sleep(0.1)
        
        # Dispatch Space on window
        page.evaluate("""() => {
            const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
            window.dispatchEvent(event);
        }""")
        time.sleep(0.1)
        
        scroll_y = page.evaluate("() => window.scrollY")
        print(f"Scroll Y after Space keydown: {scroll_y}")
        if scroll_y == 0:
            report["space_scroll_prevention"]["scroll_prevented"] = True
            
        # Clean up height
        page.evaluate("() => document.body.style.height = ''")
        
        # Close browser
        browser.close()
        
    # Print summary
    print("VERIFICATION SUMMARY:")
    print(json.dumps(report, indent=2))
    
    # Save the output
    out_path = "D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\tests\\m2_verification_summary.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Summary written to {out_path}")

if __name__ == "__main__":
    run_verification()
