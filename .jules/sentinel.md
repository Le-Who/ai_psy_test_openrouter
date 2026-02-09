## 2025-05-15 - Hardcoded TinyURL Token
**Vulnerability:** Found a hardcoded TinyURL API token `TINYTOKEN` in `app-settings.js`. This token was exposed in the client-side code, allowing anyone to use the TinyURL account quota.
**Learning:** Hardcoded secrets in client-side applications are always visible to users. Simply moving them to a "settings" file does not secure them.
**Prevention:** Use dynamic inputs for API keys (like `prompt()` or a settings UI) and store them in `localStorage`. Never commit secrets to the repository.
