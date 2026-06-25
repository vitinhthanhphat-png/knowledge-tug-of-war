import os
import json
import time
import hashlib
from playwright.sync_api import sync_playwright

def get_hash(option, salt):
    return hashlib.sha256((option + salt).encode('utf-8')).hexdigest()

def run_verification():
    html_path = "D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\dist-test.html"
    url = f"file:///{html_path.replace(os.sep, '/')}"
    
    print(f"Loading URL: {url}")
    
    results = {
        "fsm_transitions": "pending",
        "keyboard_lockout": "pending",
        "inputs_ignored": "pending",
        "cooldown_500ms": "pending",
        "errors": []
    }
    
    # 2 Questions configuration
    questions = [
        {
            "id": "q1",
            "question": "Question 1 - Which color is sky?",
            "options": ["Red", "Blue", "Green", "Yellow"],
            "answer_hash": get_hash("Blue", "salt1"),
            "salt": "salt1"
        },
        {
            "id": "q2",
            "question": "Question 2 - What is 2+2?",
            "options": ["3", "4", "5", "6"],
            "answer_hash": get_hash("4", "salt2"),
            "salt": "salt2"
        }
    ]
    
    screenshots_dir = "d:\\AI APP\\DauTruongKienThuc\\Requirement\\.agents\\challenger_m2_2\\screenshots"
    os.makedirs(screenshots_dir, exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        page.on("pageerror", lambda err: results["errors"].append(err.message))
        
        # Navigate to page
        page.goto(url, wait_until="load")
        
        # Inject our questions
        page.evaluate(f"""(questions) => {{
            const el = document.querySelector('knowledge-tug-of-war');
            el.setAttribute('default-questions', JSON.stringify(questions));
        }}""", questions)
        
        # Wait a moment for Preact to update the questions
        page.wait_for_timeout(500)
        
        shadow = page.locator("knowledge-tug-of-war")
        
        # -------------------------------------------------------------
        # TEST 1: FSM Transitions (idle -> waiting_buzz -> answering -> result -> ended)
        # -------------------------------------------------------------
        print("\n--- Testing FSM Transitions ---")
        
        # Check initial Idle state
        idle_text = shadow.locator("header >> text=Chưa bắt đầu")
        play_btn = shadow.locator("button >> text=BẮT ĐẦU CHƠI")
        
        if idle_text.count() > 0 and play_btn.is_visible():
            print("FSM Transition Check: Initial state is IDLE (Pass)")
            page.screenshot(path=os.path.join(screenshots_dir, "01_state_idle.png"))
        else:
            print("FSM Transition Check: Initial state is NOT IDLE (Fail)")
            results["fsm_transitions"] = "failed: initial state not idle"
            return
            
        # Transition: idle -> waiting_buzz
        play_btn.click()
        page.wait_for_timeout(200) # Wait brief moment
        
        buzz_banner = shadow.locator("text=ĐẬP CHUÔNG ĐỂ GIÀNH QUYỀN TRẢ LỜI")
        if buzz_banner.is_visible():
            print("FSM Transition Check: idle -> waiting_buzz (Pass)")
            page.screenshot(path=os.path.join(screenshots_dir, "02_state_waiting_buzz.png"))
        else:
            print("FSM Transition Check: idle -> waiting_buzz (Fail)")
            results["fsm_transitions"] = "failed: failed to transition to waiting_buzz"
            return
            
        # Transition: waiting_buzz -> answering (Wait > 500ms cooldown first)
        page.wait_for_timeout(600)
        page.keyboard.press("Space")
        page.wait_for_timeout(200)
        
        answering_banner = shadow.locator("text=ĐỘI 1 ĐANG TRẢ LỜI")
        if answering_banner.is_visible():
            print("FSM Transition Check: waiting_buzz -> answering (Pass)")
            page.screenshot(path=os.path.join(screenshots_dir, "03_state_answering.png"))
        else:
            print("FSM Transition Check: waiting_buzz -> answering (Fail)")
            results["fsm_transitions"] = "failed: failed to transition to answering on Space"
            return
            
        # Transition: answering -> result (Click correct answer 'Blue')
        option_blue = shadow.locator("button >> text=Blue")
        option_blue.click()
        page.wait_for_timeout(200)
        
        result_banner = shadow.locator("text=ĐỘI 1 TRẢ LỜI ĐÚNG")
        if result_banner.is_visible():
            print("FSM Transition Check: answering -> result (Pass)")
            page.screenshot(path=os.path.join(screenshots_dir, "04_state_result_correct.png"))
        else:
            print("FSM Transition Check: answering -> result (Fail)")
            results["fsm_transitions"] = "failed: failed to transition to result on answer"
            return
            
        # Transition: result -> waiting_buzz (Round 2)
        # Click "Tiếp tục" link to skip 2s delay
        next_link = shadow.locator("button >> text=Tiếp tục")
        next_link.click()
        page.wait_for_timeout(200)
        
        round2_text = shadow.locator("header >> text=ROUND 2")
        if round2_text.is_visible() and buzz_banner.is_visible():
            print("FSM Transition Check: result -> waiting_buzz (Round 2) (Pass)")
            page.screenshot(path=os.path.join(screenshots_dir, "05_state_round2_waiting_buzz.png"))
        else:
            print("FSM Transition Check: result -> waiting_buzz (Round 2) (Fail)")
            results["fsm_transitions"] = "failed: failed to transition to round 2 waiting_buzz"
            return
            
        # Transition: waiting_buzz -> answering (Team 2 this time via Enter key)
        page.wait_for_timeout(600)
        page.keyboard.press("Enter")
        page.wait_for_timeout(200)
        
        answering_t2 = shadow.locator("text=ĐỘI 2 ĐANG TRẢ LỜI")
        if answering_t2.is_visible():
            print("FSM Transition Check: waiting_buzz -> answering (Team 2) (Pass)")
            page.screenshot(path=os.path.join(screenshots_dir, "06_state_answering_t2.png"))
        else:
            print("FSM Transition Check: waiting_buzz -> answering (Team 2) (Fail)")
            results["fsm_transitions"] = "failed: failed to transition to answering on Enter"
            return
            
        # Transition: answering -> result (Click incorrect answer '3')
        option_3 = shadow.locator("button >> text=3")
        option_3.click()
        page.wait_for_timeout(200)
        
        result_incorrect = shadow.locator("text=ĐỘI 2 TRẢ LỜI SAI")
        if result_incorrect.is_visible():
            print("FSM Transition Check: answering -> result (Incorrect) (Pass)")
            page.screenshot(path=os.path.join(screenshots_dir, "07_state_result_incorrect.png"))
        else:
            print("FSM Transition Check: answering -> result (Incorrect) (Fail)")
            results["fsm_transitions"] = "failed: failed to transition to result (incorrect)"
            return
            
        # Transition: result -> ended (Last question finished, should transition to ended)
        next_link.click()
        page.wait_for_timeout(200)
        
        ended_banner = shadow.locator("text=KẾT THÚC TRẬN ĐẤU")
        if ended_banner.is_visible():
            print("FSM Transition Check: result -> ended (Pass)")
            page.screenshot(path=os.path.join(screenshots_dir, "08_state_ended.png"))
            results["fsm_transitions"] = "passed"
        else:
            print("FSM Transition Check: result -> ended (Fail)")
            results["fsm_transitions"] = "failed: failed to transition to ended"
            return

        # -------------------------------------------------------------
        # TEST 2: Keyboard Lockout & Synchronous Keydown Lockout
        # -------------------------------------------------------------
        print("\n--- Testing Keyboard Lockout ---")
        
        # Reset game
        reset_btn = shadow.locator("button >> text=CHƠI LẠI")
        reset_btn.click()
        page.wait_for_timeout(200)
        
        # Start game again
        play_btn.click()
        page.wait_for_timeout(200)
        
        # Cooldown wait
        page.wait_for_timeout(600)
        
        # Synchronously dispatch Space, then Enter
        # Check activeTeam. If Space was first, activeTeam must be team1.
        page.evaluate("""() => {
            const e1 = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
            const e2 = new KeyboardEvent('keydown', { code: 'Enter', bubbles: true });
            window.dispatchEvent(e1);
            window.dispatchEvent(e2);
        }""")
        page.wait_for_timeout(200)
        
        t1_answering = shadow.locator("text=ĐỘI 1 ĐANG TRẢ LỜI")
        if t1_answering.is_visible():
            print("Keyboard Lockout: Space locks out synchronous Enter (Pass)")
        else:
            print("Keyboard Lockout: Space did NOT lock out Enter correctly (Fail)")
            results["keyboard_lockout"] = "failed: Space did not lock out Enter"
            return
            
        # Submit answer to go back to result, reset again to test Enter locking out Space
        option_blue = shadow.locator("button >> text=Blue")
        option_blue.click()
        page.wait_for_timeout(200)
        
        next_link.click()
        page.wait_for_timeout(200)
        
        # We are on Q2. Let's wait for cooldown.
        page.wait_for_timeout(600)
        
        # Synchronously dispatch Enter, then Space
        page.evaluate("""() => {
            const e1 = new KeyboardEvent('keydown', { code: 'Enter', bubbles: true });
            const e2 = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
            window.dispatchEvent(e1);
            window.dispatchEvent(e2);
        }""")
        page.wait_for_timeout(200)
        
        t2_answering = shadow.locator("text=ĐỘI 2 ĐANG TRẢ LỜI")
        if t2_answering.is_visible():
            print("Keyboard Lockout: Enter locks out synchronous Space (Pass)")
            results["keyboard_lockout"] = "passed"
        else:
            print("Keyboard Lockout: Enter did NOT lock out Space correctly (Fail)")
            results["keyboard_lockout"] = "failed: Enter did not lock out Space"
            return
            
        # Complete Q2 so we can reset
        option_3 = shadow.locator("button >> text=3")
        option_3.click()
        page.wait_for_timeout(200)
        next_link.click()
        page.wait_for_timeout(200)
        
        # -------------------------------------------------------------
        # TEST 3: Keyboard events inside inputs/textareas & Space page scroll prevention
        # -------------------------------------------------------------
        print("\n--- Testing Input Fields & Space Scroll Prevention ---")
        
        # Reset and Start Game
        reset_btn.click()
        page.wait_for_timeout(200)
        play_btn.click()
        page.wait_for_timeout(200)
        
        # We are in waiting_buzz state.
        # Inject an input element into the body.
        page.evaluate("""() => {
            const input = document.createElement('input');
            input.id = 'test-input';
            input.type = 'text';
            document.body.appendChild(input);
        }""")
        
        # Wait cooldown
        page.wait_for_timeout(600)
        
        # Focus input and press Space
        page.focus("#test-input")
        page.keyboard.press("Space")
        page.wait_for_timeout(200)
        
        # It should NOT buzz. State should still be waiting_buzz.
        if buzz_banner.is_visible():
            print("Input Fields Check: Space inside input is ignored (Pass)")
        else:
            print("Input Fields Check: Space inside input triggered buzz (Fail)")
            results["inputs_ignored"] = "failed: Space in input triggered buzz"
            return
            
        # Press Enter inside input
        page.keyboard.press("Enter")
        page.wait_for_timeout(200)
        if buzz_banner.is_visible():
            print("Input Fields Check: Enter inside input is ignored (Pass)")
        else:
            print("Input Fields Check: Enter inside input triggered buzz (Fail)")
            results["inputs_ignored"] = "failed: Enter in input triggered buzz"
            return
            
        # Clean up input element
        page.evaluate("""() => {
            const input = document.getElementById('test-input');
            if (input) input.remove();
        }""")
        
        # Test Space page scroll prevention:
        # We'll dispatch a Space keydown on the window and check if defaultPrevented is true.
        default_prevented = page.evaluate("""() => {
            let prevented = false;
            const listener = (e) => {
                if (e.code === 'Space') {
                    prevented = e.defaultPrevented;
                }
            };
            window.addEventListener('keydown', listener);
            const ev = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
            window.dispatchEvent(ev);
            window.removeEventListener('keydown', listener);
            return prevented;
        }""")
        
        if default_prevented:
            print("Space Scroll Prevention Check: Space default is prevented (Pass)")
            results["inputs_ignored"] = "passed"
        else:
            print("Space Scroll Prevention Check: Space default was NOT prevented (Fail)")
            results["inputs_ignored"] = "failed: Space default was not prevented"
            return

        # -------------------------------------------------------------
        # TEST 4: Cooldown window (500ms)
        # -------------------------------------------------------------
        print("\n--- Testing 500ms Inter-Round Cooldown ---")
        
        # Currently, the game is in answering state because we finished testing inputs and dispatched Space on window.
        # Let's finish Q1 and go to Q2 to test cooldown cleanly.
        option_blue = shadow.locator("button >> text=Blue")
        option_blue.click()
        page.wait_for_timeout(200)
        
        # Click Next
        next_link.click()
        page.wait_for_timeout(200)
        
        # We just entered Q2 (waiting_buzz state).
        # Immediately (100ms) try to press Space.
        page.wait_for_timeout(100)
        page.keyboard.press("Space")
        page.wait_for_timeout(200)
        
        # It should STILL be in waiting_buzz state because 100ms < 500ms.
        if buzz_banner.is_visible():
            print("Cooldown Check: Buzz at 100ms ignored (Pass)")
        else:
            print("Cooldown Check: Buzz at 100ms triggered state change (Fail)")
            results["cooldown_500ms"] = "failed: buzz at 100ms was not ignored"
            return
            
        # Wait another 500ms (total ~800ms) and press Space.
        page.wait_for_timeout(500)
        page.keyboard.press("Space")
        page.wait_for_timeout(200)
        
        # It should now transition to answering state.
        if t1_answering.is_visible():
            print("Cooldown Check: Buzz at 800ms accepted (Pass)")
            results["cooldown_500ms"] = "passed"
        else:
            print("Cooldown Check: Buzz at 800ms was NOT accepted (Fail)")
            results["cooldown_500ms"] = "failed: buzz at 800ms was ignored"
            return
            
        browser.close()
        
    print("\n--- Verification Summary ---")
    print(json.dumps(results, indent=2))
    
    # Save results to a file
    with open("d:\\AI APP\DauTruongKienThuc\\Requirement\\.agents\\challenger_m2_2\\verification_log.json", "w") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    run_verification()
