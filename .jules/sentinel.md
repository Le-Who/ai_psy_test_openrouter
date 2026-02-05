## 2024-05-22 - Hardcoded API Keys
**Vulnerability:** Found a hardcoded TinyURL API token (`TINYTOKEN`) in `app-settings.js`.
**Learning:** Even utility tokens for services like link shortening are sensitive and should not be committed to the repo. Hardcoding them allows anyone with access to the code to abuse the quota or delete links.
**Prevention:** Store such tokens in `localStorage` on the client side and prompt the user for them if missing, or use a secure backend proxy. Never commit secrets to the codebase.
