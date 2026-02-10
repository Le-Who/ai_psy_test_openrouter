# Sentinel's Journal

## 2026-02-10 - Hardcoded API Key Exposure
**Vulnerability:** A hardcoded `TINYTOKEN` (TinyURL API key) was embedded in `app-settings.js`.
**Learning:** Client-side-only applications should avoid storing any shared credentials, as they are inherently public.
**Prevention:** Use a BYOK (Bring Your Own Key) pattern, storing user credentials in `localStorage` or `sessionStorage` rather than in source code.
