const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

// Read app.js
const appPath = path.join(__dirname, '../app.js');
if (!fs.existsSync(appPath)) {
    console.error("app.js not found at", appPath);
    process.exit(1);
}
const appCode = fs.readFileSync(appPath, 'utf8');

// Mock DOM elements
const mockElements = {
    apiKeyInput: { value: 'test-key' },
    themeInput: { value: 'test-theme', focus: () => {} },
    notesInput: { value: '' },
    qCountInput: { value: '5' },
    audienceInput: { value: 'General' },
    difficultyInput: { value: '1' },
    errorBox: { style: {}, innerHTML: '', textContent: '' },
    loadingOverlay: { style: {} },
    loadingText: { innerText: '' },
    setupView: { style: {} },
    testView: { style: {} },
    resultsView: { style: {} },
    libraryView: { style: {} },
    duelView: { style: {} },
    tabPsy: { classList: { toggle: () => {} } },
    tabQuiz: { classList: { toggle: () => {} } },
    audienceGroup: { style: {} },
    difficultyGroup: { style: {} },
    toast: { className: '', innerText: '' }
};

// Mock Document
const document = {
    getElementById: (id) => mockElements[id] || { style: {}, addEventListener: () => {} },
    querySelectorAll: () => [],
    addEventListener: () => {},
    title: 'Test',
    createElement: (tag) => ({ style: {}, innerHTML: '', appendChild: () => {} })
};

// Mock Window
const window = {
    location: { hash: '', pathname: '/', origin: 'http://localhost' },
    history: { replaceState: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    onpopstate: null,
    navigator: { clipboard: { writeText: () => {} } },
    isSecureContext: true
};

// Mock API
const api = {
    call: async () => {
        throw new Error('<img src=x onerror=alert("XSS")>');
    }
};

// Mock SCHEMAS
const SCHEMAS = {
    psy_blueprint: {},
    quiz_blueprint: {},
    psy_questions: {},
    quiz_questions: {}
};

// Create VM context
const context = vm.createContext({
    document,
    window,
    localStorage: window.localStorage,
    location: window.location,
    history: window.history,
    navigator: window.navigator,
    console,
    api,
    SCHEMAS,
    Utils: { escapeHtml: (s) => s }, // Mock Utils
    Storage: { renderLibraryHTML: () => '' }, // Mock Storage
    setTimeout: setTimeout,
    alert: console.log,
    TINYTOKEN: 'mock-token' // avoid ReferenceError
});

// Execute app.js
try {
    vm.runInContext(appCode, context);
    // Expose app to window so we can access it
    vm.runInContext('window.app = app;', context);
} catch (e) {
    console.error("Error loading app.js:", e);
    process.exit(1);
}

// Get app instance
const app = context.window.app;

// Run the verification test
async function runTest() {
    console.log("Running XSS Fix Verification Test...");

    // Simulate start with error
    const event = { preventDefault: () => {} };
    await app.start(event);

    const errorBox = mockElements.errorBox;

    // Assert that innerHTML was NOT set (or is empty in our mock since textContent setter doesn't update it)
    // The key vulnerability was `errorBox.innerHTML = ...` which would put the raw HTML string into innerHTML property.
    // If it was changed to `textContent = ...`, innerHTML should remain empty (in this simple mock).
    assert.strictEqual(errorBox.innerHTML, '', "innerHTML should not be set directly with unsafe content");

    // Assert that textContent WAS set with the error message
    assert.strictEqual(errorBox.textContent, '<img src=x onerror=alert("XSS")>', "textContent should contain the error message");

    console.log("✅ Security Test Passed: Error message rendered as text, XSS prevented.");
}

runTest().catch(err => {
    console.error("❌ Test Failed:", err);
    process.exit(1);
});
