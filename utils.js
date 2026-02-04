/**
 * Shared Utilities
 * Includes security helpers
 */
const Utils = {
    /**
     * Escapes HTML special characters to prevent XSS
     * Optimization: Uses single-pass regex replacement instead of chained .replace() calls
     * @param {string} unsafe
     * @returns {string}
     */
    escapeHtml: (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe.replace(/[&<>"']/g, (m) => {
            switch (m) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#039;';
                default: return m;
            }
        });
    }
};
