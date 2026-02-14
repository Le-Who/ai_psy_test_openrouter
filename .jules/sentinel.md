## 2024-05-23 - [Reflected XSS in Error Handling]
**Vulnerability:** Error messages from `api.call` were directly assigned to `innerHTML` of `#errorBox`, allowing execution of malicious HTML/JS if the error message source is compromised or spoofed.
**Learning:** Never assume `err.message` is safe text. Using `innerHTML` for dynamic content is a critical risk. `textContent` combined with `white-space: pre-wrap` provides a secure and readable alternative.
**Prevention:** Use `textContent` for all error messages. Verify frontend rendering with Playwright by injecting mock errors.
