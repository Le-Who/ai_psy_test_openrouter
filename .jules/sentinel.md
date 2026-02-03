## 2025-05-22 - Hardcoded Secrets in Config Files
**Vulnerability:** A valid TinyURL API token (`TINYTOKEN`) was hardcoded in `app-settings.js`.
**Learning:** Developers often treat "settings" or "config" files as safe places for secrets, or forget to separate secrets from configuration when using client-side architectures. In this case, `app-settings.js` was included directly in `index.html`.
**Prevention:** Never store secrets in client-side code or files committed to the repo. Use `localStorage` for user-provided tokens (BYOK pattern) or a backend proxy for app-provided secrets. Added `getTinyToken()` to prompt user for the key instead.
