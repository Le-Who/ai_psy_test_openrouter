## 2026-02-01 - [Form Validation & Feedback]
**Learning:** Standard HTML5 `required` attribute allows whitespace, which can lead to empty submissions. Replacing intrusive `alert()` calls with Toasts and focus management creates a much smoother flow.
**Action:** Always combine `required` attributes with explicit JS validation (`.trim()`) for text inputs, and use visual indicators (asterisks) to make expectations clear upfront.

## 2026-02-01 - [Keyboard Accessibility for Custom Menus]
**Learning:** The app relies on `div`-based custom menus which are inaccessible to keyboard users by default.
**Action:** When using custom UI components, always manually implement `role="menu"`, `tabindex="0"`, and `onkeydown` handlers to ensure parity with native controls.
