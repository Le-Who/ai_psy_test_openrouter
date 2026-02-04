## 2026-02-01 - [Form Validation & Feedback]
**Learning:** Standard HTML5 `required` attribute allows whitespace, which can lead to empty submissions. Replacing intrusive `alert()` calls with Toasts and focus management creates a much smoother flow.
**Action:** Always combine `required` attributes with explicit JS validation (`.trim()`) for text inputs, and use visual indicators (asterisks) to make expectations clear upfront.

## 2026-02-02 - [Interactive Elements Semantics]
**Learning:** Using `div`s with `onclick` creates "fake buttons" that are invisible to screen readers and keyboard users.
**Action:** Always use `<button type="button">` for interactive elements that aren't links, applying CSS resets (`background: none; border: none;`) to maintain visual design while gaining native accessibility.
