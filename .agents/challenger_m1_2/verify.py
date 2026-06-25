import sys
import traceback

print("Python version:", sys.version)
print("Executable:", sys.executable)

try:
    from playwright.sync_api import sync_playwright
    print("Playwright imported successfully!")
    
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        print("Browser launched successfully!")
        browser.close()
        print("Browser closed successfully!")
except Exception as e:
    print("Error occurred:")
    traceback.print_exc()
    sys.exit(1)
