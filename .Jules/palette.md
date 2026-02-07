## 2026-02-01 - [Form Validation & Feedback]
**Learning:** Standard HTML5 `required` attribute allows whitespace, which can lead to empty submissions. Replacing intrusive `alert()` calls with Toasts and focus management creates a much smoother flow.
**Action:** Always combine `required` attributes with explicit JS validation (`.trim()`) for text inputs, and use visual indicators (asterisks) to make expectations clear upfront.

## 2024-05-21 - [Accessible Glassmorphism Menus]
**Learning:** For glassmorphism menus implemented with `div`s, replacing them with semantic `<button`> tags plus a CSS reset (`background: transparent; border: none; text-align: left`) is the most robust way to add accessibility without breaking the visual design.
**Action:** Use the `.theme-opt` CSS reset pattern for any new interactive list items in the design system.

## 2024-06-25 - [Password Visibility Toggle]
**Learning:** Native `input[type="password"]` lacks a toggle mechanism, causing friction for users entering complex keys. Custom implementations must handle keyboard focus (`:focus-visible`) and dynamic `aria-label` updates to remain accessible.
**Action:** Use a semantic `<button>` wrapper (not `div` or `span`) for toggles, ensuring it follows the input in DOM order but appears visually integrated via absolute positioning.
