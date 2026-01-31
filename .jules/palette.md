## 2024-05-22 - Likert Scale Accessibility
**Learning:** Custom interactive widgets (like Likert scales) built with `div`s completely exclude keyboard users. Converting them to `<button>` elements requires minimal CSS resets (`appearance: none`, `font: inherit`) but instantly provides tab navigation and enter/space support without custom key handlers.
**Action:** Always prefer native `<button>` elements for selection grids over `div`s with onclick handlers.
