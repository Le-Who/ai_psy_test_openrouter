/**
 * Shared Utilities
 * Includes security helpers
 */
const Utils = {
    /**
     * Escapes HTML special characters to prevent XSS
     * @param {string} unsafe
     * @returns {string}
     */
    escapeHtml: (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
};
