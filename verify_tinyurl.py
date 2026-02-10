from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Open the app
        try:
            page.goto("http://localhost:3000")
        except Exception as e:
            print(f"Error navigating: {e}")
            return

        # 2. Check if the input exists
        input_selector = "#tinyUrlInput"
        try:
            page.wait_for_selector(input_selector, timeout=5000)
            print("SUCCESS: Input field found.")
        except Exception as e:
            print(f"FAILURE: Input field not found: {e}")
            page.screenshot(path="failure.png")
            return

        # 3. Enter a dummy token
        dummy_token = "TEST_TOKEN_123"
        page.fill(input_selector, dummy_token)
        print("Filled token.")

        # Take screenshot of the input
        page.screenshot(path="verification_input.png")
        print("Screenshot taken: verification_input.png")

        # 4. Verify persistence logic (simulated)
        # We simulate the user clicking 'Start' which saves to localStorage.
        # Since we can't easily click start without API key error, we'll manually save to localStorage
        # to verify that app.init() correctly loads it on reload.

        page.evaluate(f"localStorage.setItem('tinyurl_token', '{dummy_token}')")
        print("Manually set localStorage.")

        # Reload
        page.reload()
        print("Reloaded page.")

        # Verify value is loaded
        try:
            page.wait_for_selector(input_selector, timeout=5000)
            value = page.input_value(input_selector)

            if value == dummy_token:
                print(f"SUCCESS: Token persisted and loaded: {value}")
            else:
                print(f"FAILURE: Expected {dummy_token}, got {value}")
        except Exception as e:
             print(f"FAILURE verifying persistence: {e}")

        # Take another screenshot
        page.screenshot(path="verification_persisted.png")
        print("Screenshot taken: verification_persisted.png")

        browser.close()

if __name__ == "__main__":
    run()
