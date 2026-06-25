import os
import sys
import json
import traceback
from playwright.sync_api import sync_playwright

def run_tests():
    url = "http://localhost:8000/dist-test.html"
    print(f"Starting empirical verification of {url}...")
    
    report = {
        "success": False,
        "console_errors": [],
        "custom_element_registered": False,
        "shadow_dom_mounted": False,
        "styles_isolated": False,
        "tailwind_loaded": False,
        "responsive_layout": {},
        "failures": []
    }
    
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        
        # Test 1: Desktop viewport and initial load / error check
        print("\n--- Running Desktop Tests (1280x720) ---")
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()
        
        # Capture console errors BEFORE navigation to catch load-time errors
        def on_console(msg):
            if msg.type == "error":
                err_msg = f"[{msg.location.get('url', 'unknown')}:{msg.location.get('lineNumber', 0)}] {msg.text}"
                print(f"Captured Console Error: {err_msg}")
                report["console_errors"].append(err_msg)
            else:
                # Print other console logs for debug info
                print(f"Console [{msg.type}]: {msg.text}")
                
        page.on("console", on_console)
        
        try:
            # Navigate to the test page
            response = page.goto(url, wait_until="networkidle", timeout=10000)
            if not response or response.status != 200:
                raise Exception(f"Failed to load page. HTTP Status: {response.status if response else 'No Response'}")
            
            # Allow short delay for any dynamic rendering
            page.wait_for_timeout(2000)
            
            # 2. Check Custom Element registration
            registered = page.evaluate("() => typeof customElements.get('knowledge-tug-of-war') !== 'undefined'")
            report["custom_element_registered"] = registered
            print(f"Custom Element registered: {registered}")
            if not registered:
                report["failures"].append("Custom element 'knowledge-tug-of-war' is not registered.")
            
            # 3. Check Shadow DOM mounting
            shadow_mounted = page.evaluate("() => { const el = document.querySelector('knowledge-tug-of-war'); return el && !!el.shadowRoot; }")
            report["shadow_dom_mounted"] = shadow_mounted
            print(f"Shadow DOM mounted: {shadow_mounted}")
            if not shadow_mounted:
                report["failures"].append("Shadow DOM is not mounted on '<knowledge-tug-of-war>'.")
                
            if shadow_mounted:
                # 4. Check Tailwind CSS styling scoped in shadow root
                style_content = page.evaluate("() => { const el = document.querySelector('knowledge-tug-of-war'); const style = el.shadowRoot.querySelector('style'); return style ? style.textContent : ''; }")
                
                # Verify that Tailwind or CSS styles exist in the shadow root style tag
                has_tailwind_markers = "tailwind" in style_content.lower() or "glow-team" in style_content or ".w-full" in style_content
                report["tailwind_loaded"] = has_tailwind_markers
                print(f"Tailwind / styles injected into shadow root: {has_tailwind_markers} (Length: {len(style_content)} chars)")
                if not has_tailwind_markers or len(style_content) == 0:
                    report["failures"].append("Tailwind CSS / styling is not found inside the shadow root style tag.")
                
                # Check for styles leaking from host or isolation
                # We inject a global style in the host page to make h2 elements red, and check if it affects the h2 inside Shadow DOM.
                page.evaluate("""() => {
                    const style = document.createElement('style');
                    style.id = 'leak-test-style';
                    style.textContent = 'h2 { color: rgb(255, 0, 0) !important; }';
                    document.head.appendChild(style);
                }""")
                
                h2_color = page.evaluate("""() => {
                    const el = document.querySelector('knowledge-tug-of-war');
                    const h2 = el.shadowRoot.querySelector('h2');
                    if (!h2) return null;
                    return window.getComputedStyle(h2).color;
                }""")
                
                print(f"Computed color of H2 inside Shadow DOM: {h2_color}")
                # H2 is in a white card, color should not be red (rgb(255, 0, 0)). It should be the default text color or black.
                if h2_color and h2_color != "rgb(255, 0, 0)":
                    report["styles_isolated"] = True
                    print("CSS encapsulation works: host styles did not leak into Shadow DOM.")
                else:
                    report["styles_isolated"] = False
                    report["failures"].append(f"CSS encapsulation failure: Host styled h2 with red leaked into Shadow DOM (computed color: {h2_color})")
                
                # Take desktop screenshot
                screenshot_path = os.path.abspath("screenshot_desktop.png")
                page.screenshot(path=screenshot_path, full_page=True)
                print(f"Desktop screenshot saved to {screenshot_path}")
                report["responsive_layout"]["desktop"] = {
                    "screenshot": screenshot_path,
                    "width": 1280,
                    "height": 720
                }
                
            # Test 2: Mobile Viewport (375x667)
            print("\n--- Running Mobile Tests (375x667) ---")
            mobile_context = browser.new_context(viewport={"width": 375, "height": 667})
            mobile_page = mobile_context.new_page()
            
            # Navigate mobile
            mobile_page.goto(url, wait_until="networkidle", timeout=10000)
            mobile_page.wait_for_timeout(2000)
            
            # Check element bounding box to ensure it fits and scales correctly
            box = mobile_page.evaluate("""() => {
                const el = document.querySelector('knowledge-tug-of-war');
                if (!el) return null;
                const rect = el.getBoundingClientRect();
                return { width: rect.width, height: rect.height, left: rect.left, right: rect.right };
            }""")
            
            print(f"Custom element bounding box on mobile: {box}")
            if box:
                # Ensure width does not overflow mobile viewport width (375px)
                # Note: Parent div in dist-test.html has padding/margins, custom element is in a container.
                # Let's check body scrollWidth as well to check for overall page horizontal scrolling/overflow.
                body_scroll_width = mobile_page.evaluate("() => document.body.scrollWidth")
                print(f"Mobile body scrollWidth: {body_scroll_width}")
                if body_scroll_width <= 375:
                    print("Responsive layout matches mobile viewport width without overflow.")
                    report["responsive_layout"]["mobile"] = {
                        "status": "pass",
                        "body_scroll_width": body_scroll_width,
                        "element_width": box["width"]
                    }
                else:
                    print(f"WARNING: Horizontal scroll detected on mobile (scrollWidth: {body_scroll_width}px > viewport width: 375px)")
                    report["responsive_layout"]["mobile"] = {
                        "status": "warning",
                        "body_scroll_width": body_scroll_width,
                        "element_width": box["width"],
                        "note": "Horizontal scroll detected."
                    }
                    # Check if the custom element itself exceeds the body viewport
                    if box["width"] > 375:
                        report["failures"].append(f"Custom element overflows mobile screen width: element width {box['width']}px exceeds 375px.")
            
            mobile_screenshot_path = os.path.abspath("screenshot_mobile.png")
            mobile_page.screenshot(path=mobile_screenshot_path, full_page=True)
            print(f"Mobile screenshot saved to {mobile_screenshot_path}")
            report["responsive_layout"]["mobile"]["screenshot"] = mobile_screenshot_path
            
            # If all checks passed and no console errors, set success = True
            if not report["failures"] and len(report["console_errors"]) == 0:
                report["success"] = True
                
        except Exception as err:
            print(f"Test Execution Error: {err}")
            traceback.print_exc()
            report["failures"].append(f"Test script failed with exception: {str(err)}")
        finally:
            browser.close()
            
    # Write JSON report
    report_path = os.path.abspath("verification_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nVerification results written to {report_path}")
    
    return report

if __name__ == "__main__":
    run_tests()
