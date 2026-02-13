## 2026-02-01 - [Form Validation & Feedback]
**Learning:** Standard HTML5 `required` attribute allows whitespace, which can lead to empty submissions. Replacing intrusive `alert()` calls with Toasts and focus management creates a much smoother flow.
**Action:** Always combine `required` attributes with explicit JS validation (`.trim()`) for text inputs, and use visual indicators (asterisks) to make expectations clear upfront.

## 2024-05-21 - [Accessible Glassmorphism Menus]
**Learning:** For glassmorphism menus implemented with `div`s, replacing them with semantic `<button`> tags plus a CSS reset (`background: transparent; border: none; text-align: left`) is the most robust way to add accessibility without breaking the visual design.
**Action:** Use the `.theme-opt` CSS reset pattern for any new interactive list items in the design system.

## 2025-05-23 - [Input Group Styling]
**Learning:** Global styles on inputs (like `margin-top`) can break layout when wrapping inputs for icons.
**Action:** Move spacing properties to the wrapper container (`.input-group`) and reset them on the child input.

## 2025-05-23 - [Dynamic Button States]
**Learning:** When a button's visual text changes to convey a new state (like "Delete" -> "Confirm?"), the `aria-label` MUST update simultaneously. Screen reader users miss the context switch if the label remains static.
**Action:** Use `dataset` to store the original label, update `aria-label` during the confirmation state, and restore it on timeout or cancellation.

## 2025-05-24 - [Accessible Menu Navigation]
**Learning:** When using `role="menu"` for a dropdown, screen reader users expect Arrow key navigation, not just Tab. Simply adding the role is insufficient without the corresponding keyboard event handling.
**Action:** Always implement `keydown` listeners for ArrowUp/ArrowDown when introducing `role="menu"` to ensure the interaction matches the semantic promise.
