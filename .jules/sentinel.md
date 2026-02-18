## 2024-05-23 - Hardcoded TinyURL Token in Config
**Vulnerability:** A valid TinyURL API token was hardcoded in `app-settings.js` as `const TINYTOKEN`.
**Learning:** The application lacks a secure configuration management system for client-side secrets, leading developers to embed keys directly.
**Prevention:** External API keys must be retrieved from user input (prompt) and stored in `localStorage`, never embedded in client-side code.
