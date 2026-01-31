## 2024-05-22 - [Synchronous LocalStorage & String Concatenation]
**Learning:** This app uses `localStorage` for potentially large datasets and generates UI via massive string concatenation in `storage.js`.
**Action:** Always look for caching opportunities in `Storage` methods (like `renderLibraryHTML`) to avoid repeated expensive serialization/deserialization and string operations on the main thread.
