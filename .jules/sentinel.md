# Sentinel Journal

## 2024-05-23 - Hardcoded TinyURL Token Removal
**Vulnerability:** A hardcoded TinyURL API token (`TINYTOKEN`) was present in `app-settings.js`, exposing it to anyone with access to the client-side code.
**Learning:** Developers often hardcode secrets for convenience during development, forgetting that client-side code is public. Even "low-risk" tokens like URL shorteners should be protected to prevent abuse (e.g., rate limit exhaustion, malicious redirects).
**Prevention:** Secrets should never be committed to source control. For client-side apps without a backend, prompt the user for their own key or use a proxy server. In this case, we implemented a "Bring Your Own Key" pattern using `localStorage`.
