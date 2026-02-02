## 2025-02-18 - Hardcoded API Key in Config
**Vulnerability:** A hardcoded TinyURL API token (`TINYTOKEN`) was found in `app-settings.js`. This exposes the API key to anyone with access to the codebase (or viewing the client-side source), potentially leading to unauthorized usage or quota exhaustion.
**Learning:** Developers sometimes move secrets to a "settings" file (like `app-settings.js`) thinking it organizes them, but client-side JavaScript files are public. Separation of concerns (logic vs config) does not equal security in a client-side context.
**Prevention:** Never store secrets in client-side code. For client-side apps requiring external APIs, either use a backend proxy or (as implemented here) prompt the user for their own key/token and store it in `localStorage`.
