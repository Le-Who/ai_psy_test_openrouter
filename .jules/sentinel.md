## 2026-02-17 - Unsafe Error Rendering
**Vulnerability:** XSS in `app.js` error handling where `errorBox.innerHTML` was directly assigned `err.message` without escaping.
**Learning:** The application mostly uses `Utils.escapeHtml` for dynamic content, but error handling was overlooked, assuming API errors are safe.
**Prevention:** Always use `textContent` for displaying error messages or untrusted text unless rich text is explicitly required and strictly sanitized.
