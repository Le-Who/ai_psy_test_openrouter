## 2024-05-22 - [Synchronous LocalStorage & String Concatenation]
**Learning:** This app uses `localStorage` for potentially large datasets and generates UI via massive string concatenation in `storage.js`.
**Action:** Always look for caching opportunities in `Storage` methods (like `renderLibraryHTML`) to avoid repeated expensive serialization/deserialization and string operations on the main thread.

## 2024-05-23 - [Render Cache Optimization]
**Learning:** Caching the final joined HTML string in `Storage` reduces render time from O(N) to O(1).
**Action:** When managing list rendering with incremental updates (`unshift`/`push`), update the cached HTML string incrementally instead of rebuilding it entirely.
## 2024-10-24 - [Inefficient String Escaping in Hot Paths]
**Learning:** The `escapeHtml` utility used multiple chained `.replace()` calls, causing redundant string traversals. This utility is heavily used in rendering loops (e.g., `renderLibraryHTML`), making it a hidden CPU sink.
**Action:** Use a single regex replace with a callback for string sanitization functions to ensure O(n) complexity instead of O(n * k) passes.
## 2026-02-06 - [Inefficient Naming Collision Check]
**Learning:** `Storage.save` used a `while` loop with `array.some` to check for unique names, resulting in O(N*K) complexity which spiked to ~760ms for 1000 items.
**Action:** Use a `Set` for O(1) existence checks when validating uniqueness against a large list of items.
## 2026-03-01 - [DOM Query Optimization]
**Learning:** Frequent `document.getElementById` and `querySelectorAll` calls inside rendering loops (`renderQ`) add measurable overhead, especially for static elements like views and button containers.
**Action:** Cache DOM elements in an `app.ui` object during initialization (`initUI`) and reuse these references in render methods to ensure O(1) access.

## 2024-05-25 - [Persistent Set Cache for Collision Checks]
**Learning:** Even with O(1) lookups via `Set`, rebuilding the `Set` from a large array on every `save()` operation remains O(N) and blocks the main thread during bulk operations or frequent saves.
**Action:** Maintain a persistent `_themesCache` (Set) in the `Storage` class and update it incrementally (add/delete) to keep `save()` complexity closer to O(1).

## 2026-03-02 - [Avoid Full Re-render on Delete]
**Learning:** `openLibrary()` rebuilds the entire HTML string and updates `innerHTML`, which is O(N) and causes layout thrashing. Deleting a single item caused a full re-render.
**Action:** Use `element.remove()` to remove the DOM node directly (O(1)) and only call `openLibrary()` if the list becomes empty.
