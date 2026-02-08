## 2024-05-22 - Hardcoded API Token in Config
**Vulnerability:** A valid TinyURL API token (`TINYTOKEN`) was hardcoded in `app-settings.js` and used in `app.js`.
**Learning:** Hardcoded secrets in client-side JavaScript are publicly visible and can be abused by anyone who inspects the source code.
**Prevention:** Always retrieve sensitive tokens dynamically (e.g., via user input, environment variables during build, or backend proxy). For client-side only apps, prompt the user for their own keys.
