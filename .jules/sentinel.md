## 2024-10-26 - Hardcoded TinyURL Token
**Vulnerability:** A hardcoded TinyURL API token (`TINYTOKEN`) was found in `app-settings.js`, exposing the repository owner's account to potential abuse.
**Learning:** Secrets should never be committed to the codebase, even for "client-side" keys if they allow writes/actions on behalf of an account.
**Prevention:** Use `localStorage` to store user-provided keys, prompting the user to enter them when needed.
