## 2024-05-21 - Hardcoded API Tokens in Client-Side Config
**Vulnerability:** Found a hardcoded TinyURL API token (`TINYTOKEN`) directly in `app-settings.js`.
**Learning:** Client-side apps often struggle with secret management. Developers might default to hardcoding keys for convenience, not realizing the risk even in private repos (which can become public).
**Prevention:** Enforce a "User-Provided Keys" pattern for client-side apps. Use `localStorage` to persist keys provided via UI prompts, never commit them to source.
