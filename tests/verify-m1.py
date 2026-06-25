import os
import json
from playwright.sync_api import sync_playwright

def run_verification():
    html_path = "D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\dist-test.html"
    url = f"file:///{html_path.replace(os.sep, '/')}"
    
    results = {
        "url": url,
        "logs": [],
        "errors": [],
        "element_registered": False,
        "shadow_dom_mounted": False,
        "theme_applied": None,
        "questions_loaded": False,
        "styling_scoped": False,
        "viewports": {}
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console messages and errors BEFORE navigating!
        page.on("console", lambda msg: results["logs"].append({
            "type": msg.type,
            "text": msg.text,
            "location": msg.location
        }))
        
        page.on("pageerror", lambda err: results["errors"].append(err.message))
        
        # Navigate to the file
        page.goto(url, wait_until="load")
        
        # 1. Verify custom element registration
        custom_element_exists = page.evaluate("() => document.querySelector('knowledge-tug-of-war') !== null")
        results["element_registered"] = custom_element_exists
        
        if custom_element_exists:
            # 2. Verify Shadow DOM mounting
            shadow_mounted = page.evaluate("() => document.querySelector('knowledge-tug-of-war').shadowRoot !== null")
            results["shadow_dom_mounted"] = shadow_mounted
            
            if shadow_mounted:
                # 3. Verify theme attribute read
                results["theme_applied"] = page.evaluate("() => document.querySelector('knowledge-tug-of-war').getAttribute('theme')")
                
                # 4. Check if styles are injected inside shadowRoot
                styles_count = page.evaluate("() => document.querySelector('knowledge-tug-of-war').shadowRoot.querySelectorAll('style').length")
                results["styling_scoped"] = styles_count > 0
                
                # 5. Check if questions are rendered in shadow root
                questions_rendered = page.evaluate("""() => {
                    const shadow = document.querySelector('knowledge-tug-of-war').shadowRoot;
                    const questionText = shadow.querySelector('h2');
                    return questionText ? questionText.textContent : null;
                }""")
                results["question_text"] = questions_rendered
                results["questions_loaded"] = questions_rendered is not None and "Which algorithm is used" in questions_rendered
                
                # 6. Check responsive layouts
                viewports_to_test = {
                    "desktop": {"width": 1280, "height": 800},
                    "tablet": {"width": 768, "height": 1024},
                    "mobile": {"width": 375, "height": 667}
                }
                
                os.makedirs("D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\tests\\screenshots", exist_ok=True)
                
                for name, size in viewports_to_test.items():
                    page.set_viewport_size(size)
                    page.wait_for_timeout(500) # Let it settle
                    
                    # Take screenshot
                    screenshot_path = f"D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\tests\\screenshots\\{name}.png"
                    page.screenshot(path=screenshot_path)
                    
                    # Measure layout bounding client rect to verify responsiveness
                    layout_info = page.evaluate("""() => {
                        const host = document.querySelector('knowledge-tug-of-war');
                        const rect = host.getBoundingClientRect();
                        const shadow = host.shadowRoot;
                        const container = shadow.querySelector('div'); // target the root mount point div
                        const containerRect = container ? container.getBoundingClientRect() : null;
                        return {
                            hostWidth: rect.width,
                            hostHeight: rect.height,
                            containerWidth: containerRect ? containerRect.width : 0,
                            containerHeight: containerRect ? containerRect.height : 0
                        };
                    }""")
                    
                    results["viewports"][name] = {
                        "viewport_size": size,
                        "screenshot_path": screenshot_path,
                        "layout": layout_info
                    }
                    
        browser.close()
        
    # Write report
    report_path = "D:\\AI APP\\DauTruongKienThuc\\Requirement\\knowledge-tug-of-war\\tests\\verification_result.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
        
    print("Verification completed. JSON output written to:", report_path)

if __name__ == "__main__":
    run_verification()
