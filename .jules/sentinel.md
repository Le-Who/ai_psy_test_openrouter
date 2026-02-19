## 2024-05-23 - Hardcoded Third-Party API Tokens in Client-Side Apps
**Vulnerability:** A hardcoded TinyURL API token (`TINYTOKEN`) was found in `app-settings.js`.
**Learning:** In client-side only applications (without a backend proxy), secrets cannot be securely stored in source code. Environment variables are also exposed in the bundle.
**Prevention:** Use a user-prompt mechanism (e.g. `prompt()` or a settings UI) to request the token from the user at runtime and store it in `localStorage`. The application logic must gracefully handle the absence of the token (e.g., disable features or prompt on demand).
