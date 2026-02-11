# Sentinel Security Journal

## 2024-05-22 - Client-Side API Key Management
**Vulnerability:** Hardcoded API keys in source files (`app-settings.js`) exposed secrets in a public client-side codebase.
**Learning:** Since this is a static site with no backend, standard environment variable injection isn't possible for runtime secrets.
**Prevention:** Implement a "Bring Your Own Key" pattern: prompt the user for sensitive keys (like TinyURL) and store them in `localStorage`. Never commit default keys.
