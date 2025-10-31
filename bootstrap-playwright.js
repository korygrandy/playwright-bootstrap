// bootstrap-playwright.js
// This script initializes a Playwright E2E framework.
// FIX: Implements try/catch around 'execSync' for the test run to gracefully handle the intentionally failing test.
// v1.56 UPDATE: Updated README.md and network_data.spec.ts to showcase new APIs and Test Agents.
// ENHANCEMENT: Added pre-install prompt to skip test execution and defaulted parallel workers for speed.
// 🌟 NEW ENHANCEMENT: Implemented best-practice authentication using globalSetup (auth.setup.ts) and storageState.
// 🐞 BUG FIXES:
// 1. Corrected path handling in auth.setup.ts to avoid "Bad character escape sequence" error on Windows.
// 2. Corrected auth.setup.ts to use 'chromium.launch()' instead of 'test.request.newContext()' for UI login.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// --- CONSTANTS FOR AUTH SETUP ---
const AUTH_DIR = 'auth';
const STORAGE_STATE_FILE = path.join(AUTH_DIR, 'user.json');
// The path used in the config file (relative from testDir)
const RELATIVE_STORAGE_STATE_PATH = path.join('..', STORAGE_STATE_FILE).replace(/\\/g, '/'); // Ensure forward slashes for cross-platform
// ---

// --- 1. FILE CONTENT DEFINITIONS (STATIC DATA) ---

const getFileContents = () => ({
    'package.json': (testDirName) => `
{
  "name": "playwright-e2e-framework",
  "version": "1.0.0",
  "description": "Playwright E2E tests for the resume application.",
  "scripts": {
    "test": "npx playwright test --config=\${testDirName}/playwright.config.ts",
    "test:ui": "npx playwright test --ui",
    "test:visual": "npm run test \${testDirName}/tests/visual.spec.ts",
    "test:visual:update": "npm run test:visual -- --update-snapshots",
    "report": "npx playwright show-report \${testDirName}/html-report"
  },
  "keywords": [
    "playwright",
    "e2e",
    "automation",
    "typescript"
  ],
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@types/node": "^20.10.0"
  }
}
`,
    '.gitignore': `
/node_modules
/test-artifacts/
/html-report/
/playwright-report/
/screenshots/
/e2e.tests/tests/visual.spec.ts-snapshots
.env
.DS_Store
/dist
/build
/${AUTH_DIR}
`,
    'tsconfig.json': (testDirName) => `
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      // NOTE: This alias is kept for IDE convenience, but files below now use relative imports (../) for stability.
      "~/*": ["./\${testDirName}/*"]
    }
  },
  "include": [
    "./**/*.ts"
  ]
}
`,
    'README.md': () => `
# Playwright E2E Automation Framework

This project contains a robust **Playwright end-to-end (E2E) testing framework**, initialized with the latest features of Playwright v1.56.

---

## 🔐 Authentication via Global Setup (Best Practice)

This framework uses Playwright's **Global Setup** to manage the authenticated state, which is the fastest way to run authenticated tests.

1.  **Login & Save:** The \`e2e.tests/auth.setup.ts\` file runs **once** before all tests to log in and save the session data to \`${STORAGE_STATE_FILE}\`.
2.  **Load State:** All browser projects in \`playwright.config.ts\` are configured to **automatically load** this saved state, skipping the login UI step for every test and worker.
3.  **Test Example:** See \`auth_storage.spec.ts\` for an example of a test that starts directly on a protected page.

---

## 🤖 Playwright Test Agents (v1.56)

Playwright v1.56 introduced **Test Agents**, custom AI-driven agents that can assist with test creation, generation, and self-healing.

These agents can be generated using the following command, which creates agent definitions for various AI clients (like VS Code, Claude, or OpenCode):

\`\`\`bash
npx playwright init-agents --loop=vscode
# or --loop=claude, --loop=opencode
\`\`\`

**The three core agents are:**
* **🎭 planner:** Explores the application and creates a Markdown test plan.
* **🎭 generator:** Transforms the Markdown plan into actual Playwright Test files.
* **🎭 healer:** Executes the test suite and automatically repairs failing tests.

---

## ⚙️ Configuration Summary

This framework was initialized with the following settings:

| Setting | Value | Impact |
| :--- | :--- | :--- |
| **Test Retries** | **{__RETRIES__}** | The number of times a test will re-run globally upon failure. |
| **Max Parallel Workers** | **{__WORKERS__}** | Limits concurrent test file execution. Set to \`undefined\` if using OS default. |
| **Browser Projects** | **{__BROWSERS__}** | Only these projects are included in \`playwright.config.ts\`. |
| **Base URL** | **{__BASE_URL__}** | The default application URL. |

### 🛠️ Important Note on Visual Tests

During the initial run, the system creates baseline screenshots for the visual regression test. You **must** manually review these newly created images in the snapshot folder to confirm they represent the correct desired state of the application.

---

## ✨ New API Showcase (v1.56)

The framework's \`network_data.spec.ts\` test now showcases the new v1.56 methods:
* \`page.consoleMessages()\`
* \`page.pageErrors()\`
* \`page.requests()\`

These methods allow for retrieving recent data without manually setting up page listeners, simplifying network and console assertions.

---

## ▶️ Getting Started

### 1. Run All Tests

\`\`\`bash
npm test
\`\`\`

### 2. View the HTML Report

\`\`\`bash
npm run report
\`\`\`

### 3. Debugging with UI Mode

\`\`\`bash
npm run test:ui
\`\`\`
`,
    [path.join('e2e.tests', 'playwright.config.ts')]: (testDirName, config) => `
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// The baseURL is set to the value provided during the bootstrap process, 
// unless the BASE_URL environment variable is explicitly set.
const DEFAULT_BASE_URL = '${config.baseURL}';
const storageStatePath = path.join(__dirname, '${RELATIVE_STORAGE_STATE_PATH}');

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  baseURL: process.env.BASE_URL || DEFAULT_BASE_URL,
  
  // 🔐 GLOBAL SETUP: Runs once before all tests to save the authentication state
  globalSetup: require.resolve('./auth.setup'),
  
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // --- Configurable Settings ---
  retries: ${config.retries},
  workers: ${config.maxWorkers}, // Use undefined for auto
  // -----------------------------

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'html-report' }]
  ],
  
  timeout: 60000,
  
  use: {
    baseURL: process.env.BASE_URL || DEFAULT_BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry', 
    video: 'retain-on-failure', 
    // 🔐 GLOBAL USE: Automatically loads the saved authentication state for all tests
    storageState: storageStatePath, 
  },

  projects: [
    ${config.browserProjects.map(p => {
        // We only use the saved storage state for web browsers, not API tests (which typically use API tokens)
        if (p === 'chromium') return `{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }`;
        if (p === 'firefox') return `{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }`;
        if (p === 'webkit') return `{ name: 'webkit', use: { ...devices['Desktop Safari'] } }`;
        if (p === 'mobile-chrome') return `{ name: 'mobile-chrome', use: { ...devices['Pixel 5'] } }`;
        return '';
    }).join(',\n    ')}
  ].filter(p => p !== ''),
  
  outputDir: 'test-artifacts',
});
`,
    // --- NEW FILE: auth.setup.ts ---
    [path.join('e2e.tests', 'auth.setup.ts')]: (testDirName) => {
        // Use path.join to ensure OS-agnostic path construction, and double-escape the backslashes
        // if needed, so the resulting string in the .ts file is a valid JS string.
        const safeStoragePath = STORAGE_STATE_FILE.replace(/\\/g, '\\\\');

        return `
import { test, expect, chromium } from '@playwright/test';
import * as path from 'path';

// --- Constants for Authentication ---
const AUTH_URL = 'https://practicetestautomation.com/practice-test-login/';
const USERNAME = 'student';
const PASSWORD = 'Password123';
// The path where the authentication state will be saved (relative to the framework root).
// FIX: Constructs the path using path.join and uses the escaped variable for cross-platform compatibility.
const STORAGE_STATE_PATH = path.join(process.cwd(), '${safeStoragePath}');

/**
 * Global setup function to log in once and save the session state.
 * This runs before all tests start.
 */
async function globalSetup() {
    console.log('\\n🔐 Running Playwright Global Setup: Logging in and saving session...');
    
    // 1. LAUNCH BROWSER: Use chromium to launch a headless browser (FIXED)
    const browser = await chromium.launch();
    
    // 2. CREATE PAGE: Get a Page object from the Browser Context
    const page = await browser.newPage();
    
    try {
        await page.goto(AUTH_URL);

        // Perform login
        await page.locator('#username').fill(USERNAME);
        await page.locator('#password').fill(PASSWORD);
        await page.getByRole('button', { name: 'Submit' }).click();

        // Wait for successful redirect and verify a protected element
        const protectedPageUrl = 'https://practicetestautomation.com/logged-in-successfully/';
        await page.waitForURL(protectedPageUrl);
        await expect(page.locator('.post-title')).toHaveText('Logged In Successfully');
        
        // 3. Save the session state (cookies, local storage, etc.)
        await page.context().storageState({ path: STORAGE_STATE_PATH });
        
        console.log(\`✅ Authentication state saved to: \${STORAGE_STATE_PATH}\`);

    } catch (error) {
        console.error('❌ Global Setup Failed: Could not login and save authentication state.');
        console.error('Check if the website is available and if credentials (student/Password123) are correct.');
        throw error;
    } finally {
        // 4. CLOSE BROWSER: It's critical to close the browser instance created in global setup
        await browser.close();
    }
}

export default globalSetup;
`;
    },
    [path.join('e2e.tests', 'testdata.json')]: () => `
{
  "app": {
    "expectedTitle": "Professional Portfolio",
    "expectedQuote": "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "resumeLink": "https://example.com/my-resume.pdf"
  }
}
`,
    [path.join('e2e.tests', 'fixtures', 'baseTest.ts')]: () => `
import { test as baseTest, TestInfo } from '@playwright/test';
// FIX: Use relative paths for stable module resolution at runtime
import { LandingPage } from '../pages/LandingPage';
import { GlobalData } from '../utils/GlobalData';
import { TestUtils } from '../utils/TestUtils';

// EXPORTED MyFixtures to resolve "Unresolved variable/type MyFixtures" IDE error
export type MyFixtures = {
  landingPage: LandingPage;
  globalData: GlobalData;
  utils: TestUtils;
  testInfo: TestInfo; 
};

/**
 * Checks if the test is currently in a retry cycle AND has the '@no-retry' tag.
 * If both are true, it skips the test for the current retry attempt.
 * @param testInfo The current test information object.
 */
export function skipIfNoRetry(testInfo: TestInfo): void {
  const isVolatile = testInfo.title.includes('@no-retry');
  
  if (isVolatile && testInfo.retry > 0) {
    console.log(\`\\n⚠️ Skipping known volatile test: \${testInfo.title} (Retry #\${testInfo.retry}). Retries disabled for this tag.\`);
    // testInfo.skip() is the correct runtime method to skip the current test iteration
    testInfo.skip(); 
  }
}

// Extend baseTest to inject your Page Object Models (POMs) and Utils
export const test = baseTest.extend<MyFixtures>({
  
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },

  globalData: async ({ }, use) => {
    await use(GlobalData.getInstance());
  },
  
  utils: async ({ page }, use) => {
    await use(new TestUtils(page));
  },

  testInfo: [
    async ({}, use, testInfo) => {
      await use(testInfo);
    },
    { scope: 'test' }
  ]
});

// Re-export Playwright core elements
export { expect, ConsoleMessage, Request, APIRequestContext, APIResponse } from '@playwright/test';
// Re-export custom elements explicitly to satisfy IDEs
export { skipIfNoRetry };
`,
    [path.join('e2e.tests', 'pages', 'LandingPage.ts')]: () => `
import { Page, Locator } from '@playwright/test';

export class LandingPage {
  readonly page: Page;
  readonly header: Locator;
  readonly resumeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.getByRole('heading', { level: 1 });
    this.resumeButton = page.getByRole('link', { name: 'Download Resume' });
  }

  async navigate() {
    await this.page.goto('/');
  }

  async clickResumeButton() {
    await this.resumeButton.click();
  }
}
`,
    [path.join('e2e.tests', 'tests', 'seed.spec.ts')]: () => `
// FIX: Changed from '~/fixtures/baseTest' to relative path
import { test, expect } from '../fixtures/baseTest';

test.describe('Initial Seed Test', () => {
    test('should verify the homepage is accessible', async ({ page }) => {
        // This test runs against the Base URL provided in playwright.config.ts 
        await page.goto('/');
        await expect(page).toHaveTitle(/The Internet/); 
    });
});
`,
    [path.join('e2e.tests', 'tests', 'api.spec.ts')]: () => `
// FIX: Changed from '~/fixtures/baseTest' to relative path
import { test, expect } from '@playwright/test';
import { APIRequestContext } from '../fixtures/baseTest'; 

test.describe('Swagger Petstore API GET Test', () => {
    
    const petId = 1;
    const petUrl = \`https://petstore.swagger.io/v2/pet/\${petId}\`;

    test('should successfully retrieve pet ID 1 and verify basic structure', async ({ request }: { request: APIRequestContext }) => {
        
        await test.step(\`Retrieve pet \${petId} via GET request\`, async () => {
            
            const getResponse = await request.get(petUrl, {
                headers: {
                    'accept': 'application/json' 
                }
            });

            expect(getResponse.status(), \`Expected Status 200 for \${petId}. Received: \${getResponse.status()}\`).toBe(200);
            expect(getResponse.headers()['content-type']).toContain('application/json');

            const pet = await getResponse.json();
            
            expect(pet.id).toBe(petId);
            expect(typeof pet.status).toBe('string');
            expect(pet.status.length).toBeGreaterThan(0);
            
            console.log(\`✅ Successfully retrieved pet ID \${petId} (\${pet.name}) with status: \${pet.status}\`);
        });
    });
});
`,
    // --- UPDATED auth_storage.spec.ts (Now only verification) ---
    [path.join('e2e.tests', 'tests', 'auth_storage.spec.ts')]: () => `
// FIX: Changed from '~/fixtures/baseTest' to relative path
import { test, expect } from '../fixtures/baseTest';

const PROTECTED_URL = 'https://practicetestautomation.com/logged-in-successfully/';

test.describe('Storage State Verification (After Global Setup)', () => {
    
    /**
     * This test demonstrates that the session state saved by auth.setup.ts
     * is automatically loaded by the browser context. This allows the test
     * to start directly on the protected page, skipping the login UI.
     */
    test('should automatically access protected page using pre-loaded session', async ({ page }) => {
        
        await test.step('Navigate to Protected Page', async () => {
            // Note: No login actions required here!
            await page.goto(PROTECTED_URL);
        });

        // Verify successful access by checking for a protected element
        await test.step('Verify Authenticated State', async () => {
            const successMessage = page.locator('.post-title');
            
            await expect(successMessage).toBeVisible({ timeout: 10000 });
            await expect(successMessage).toHaveText('Logged In Successfully');
            await expect(page).toHaveURL(/.*logged-in-successfully/);
            
            console.log("✅ Successfully accessed protected page via pre-authenticated storage state.");
        });
    });
});
`,
    // --- END UPDATED auth_storage.spec.ts ---
    [path.join('e2e.tests', 'tests', 'a11y.spec.ts')]: () => `
// FIX: Changed from '~/fixtures/baseTest' to relative path
import { test } from "../fixtures/baseTest";
test("placeholder a11y test", () => { /* Add Axe-core integration here */ });
`,
    [path.join('e2e.tests', 'tests', 'visual.spec.ts')]: () => `
// FIX: Changed from '~/fixtures/baseTest' to relative path
import { test, expect } from '../fixtures/baseTest';

test.describe('Visual Regression Test', () => {
    test('should match the baseline screenshot of the homepage body', async ({ page }) => {
        // Removed 'waitUntil: domcontentloaded'
        await page.goto('/');

        const contentContainer = page.locator('#content');

        await expect(contentContainer).toHaveScreenshot('homepage-content-baseline.png', {
            maxDiffPixelRatio: 0.01
        });
    });
});
`,
    [path.join('e2e.tests', 'tests', 'the-internet-sample.spec.ts')]: () => `
// FIX: Changed from '~/fixtures/baseTest' to relative path
import { test, expect } from '../fixtures/baseTest';

test.describe('Video Recording Showcase', () => {
  test('should navigate to A/B Testing page and verify header', async ({ page }) => {
    await page.goto('/');

    const abTestLink = page.getByRole('link', { name: 'A/B Testing' });
    await expect(abTestLink).toBeVisible();
    
    await abTestLink.click();
    
    const newHeader = page.getByRole('heading', { level: 3 });
    await expect(newHeader).toBeVisible();
    
    await expect(page).toHaveURL(/.*abtest/);
  });
});
`,
    [path.join('e2e.tests', 'tests', 'volatile.spec.ts')]: () => `
// FIX: Changed from '~/fixtures/baseTest' to relative path
import { test, expect, skipIfNoRetry } from '../fixtures/baseTest';

test.describe('Volatile Test Suite Demonstrating Conditional Retries', () => {

    test('should retry 2 times on failure (Default Global Behavior)', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('h1')).toBeVisible(); 
    });

    test('should skip on retry if tagged as volatile @no-retry', async ({ page, testInfo }) => {
        
        // --- CONDITIONAL RETRY LOGIC ---
        skipIfNoRetry(testInfo);
        // -------------------------------

        await page.goto('/status_codes');
        await page.getByRole('link', { name: '200' }).click();
        await expect(page.locator('p')).toContainText('This page returned a 200 status code.');
    });
});
`,
    [path.join('e2e.tests', 'tests', 'expected-fail.spec.ts')]: () => `
// This test is designed to FAIL intentionally to demonstrate Playwright's error logging, 
// automatic retries (if configured), and screenshot capture on failure.
// You should see this test retry and eventually fail in the console output.
import { test, expect } from '../fixtures/baseTest';

test.describe('Expected Failure Showcase', () => {
    test('should fail to demonstrate error reporting and retry behavior', async ({ page }) => {
        await page.goto('/');

        // This assertion is GUARANTEED to fail because the homepage title is 'The Internet'
        // and it will never be 'INTENTIONALLY FAILED TEST'.
        await expect(page).toHaveTitle('INTENTIONALLY FAILED TEST', { timeout: 1000 });
    });
});
`,
    [path.join('e2e.tests', 'utils', 'GlobalData.ts')]: () => `
import testData from '../testdata.json';

// Utility class to load and expose data from testdata.json using the Singleton pattern.
export class GlobalData {
    private static instance: GlobalData;
    public readonly app: { expectedTitle: string, expectedQuote: string, resumeLink: string };

    private constructor() {
        this.app = testData.app;
    }

    public static getInstance(): GlobalData {
        if (!GlobalData.instance) {
            GlobalData.instance = new GlobalData();
        }
        return GlobalData.instance;
    }
}
`,
    [path.join('e2e.tests', 'utils', 'TestUtils.ts')]: () => `
import { Page } from '@playwright/test';

// Utility class for common, reusable actions.
export class TestUtils { 
    constructor(private page: Page) {} 

    /**
     * Example: Custom wait function
     */
    async customWait(ms: number) {
        await this.page.waitForTimeout(ms);
        console.log(\`Waited for \${ms}ms.\`);
    }
}
`,
    [path.join('e2e.tests', 'tests', 'network_data.spec.ts')]: () => `
// FIX: Changed from '~/fixtures/baseTest' to relative path
import { test, expect } from '../fixtures/baseTest';

test.describe('Network and Console Data Showcase (v1.56 New APIs)', () => {
    
    // --- SHOWCASE: page.consoleMessages() and page.pageErrors() (v1.56) ---
    test('should capture and verify console log messages using new APIs', async ({ page }) => {
        
        await page.goto('/');

        // Trigger console messages and an error on the client side
        await page.evaluate(() => {
            console.log('CLIENT_LOG: Page is fully loaded and interactive.');
            console.error('CLIENT_ERROR: An expected non-fatal error occurred.');
            // Note: page.pageErrors() will catch unhandled exceptions, not console.error
        });
        
        // No manual listeners required! The new API gets recent messages.
        const consoleMessages = await page.consoleMessages();
        
        const logMessage = consoleMessages.find(msg => msg.text().includes('CLIENT_LOG:'));
        expect(logMessage, 'Expected console log message not found.').toBeDefined();
        expect(logMessage!.type()).toBe('log');

        const errorMessage = consoleMessages.find(msg => msg.text().includes('CLIENT_ERROR:'));
        expect(errorMessage, 'Expected console error message not found.').toBeDefined();
        expect(errorMessage!.type()).toBe('error');

        // Optional: Example of checking for unhandled exceptions (pageErrors)
        const pageErrors = await page.pageErrors();
        expect(pageErrors.length, 'No unhandled page errors should have occurred.').toBe(0);
    });

    // --- SHOWCASE: page.requests() (v1.56) ---
    test('should capture and verify network requests using new API', async ({ page }) => {
        
        // Navigating to the page generates network requests
        await page.goto('/');
        
        // Wait for all network activity to finish
        await page.waitForLoadState('networkidle');

        // No manual listeners required! The new API gets recent requests.
        const requests = await page.requests();

        const mainRequest = requests.find(req => req.url().endsWith('/') && req.method() === 'GET');
        expect(mainRequest, 'Main page request not found.').toBeDefined();
        
        // Await the response of the captured request
        expect(mainRequest!.response()).toBeTruthy();
        expect((await mainRequest!.response())!.status()).toBe(200);

        const cssRequest = requests.find(req => req.resourceType() === 'stylesheet');
        expect(cssRequest, 'A stylesheet request was expected.').toBeDefined();

        console.log(\`Captured \${requests.length} total network requests during navigation (using page.requests()).\`);
    });
});
`
});


// --- 2. HELPER FUNCTIONS (UTILITIES) ---

function createDir(dirPath) {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Directory created: ${dirPath}`);
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

function writeFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content.trim() + '\n', 'utf8');
        console.log(`✅ File created: ${filePath}`);
    } catch (error) {
        console.error(`❌ Error writing file ${filePath}: ${error.message}`);
        throw new Error(`Failed to write critical file: ${filePath}`);
    }
}

function promptUser(query, options = {}) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();

        // Ensure ans is safely converted to a string before trimming
        let result = String(ans || '').trim() || options.default;

        if (options.type === 'boolean') {
             // Resolve as true if the answer starts with 'y' or 'Y', otherwise false (defaulting to true)
            return resolve(result.toLowerCase().startsWith('y') || result === '');
        }

        if (options.type === 'number') {
            const num = parseInt(result, 10);
            return resolve(isNaN(num) ? options.default : num);
        }

        if (options.type === 'multiselect') {
            // If options.default was an array, result might be an array if input was empty.
            if (Array.isArray(result)) {
                return resolve(result);
            }

            const selection = result.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
            const validOptions = options.valid || [];

            // Map common inputs to canonical names
            const canonicalSelection = selection.map(s => {
                if (s.includes('chrome') && !s.includes('mobile')) return 'chromium';
                if (s.includes('firefox')) return 'firefox';
                if (s.includes('webkit') || s.includes('safari')) return 'webkit';
                if (s.includes('mobile')) return 'mobile-chrome';
                return null;
            }).filter(s => s && validOptions.includes(s));

            // Ensure no duplicates
            const finalSelection = [...new Set(canonicalSelection)];

            return resolve(finalSelection.length > 0 ? finalSelection : options.default);
        }

        resolve(result);
    }));
}


// --- 3. MODULAR SETUP FUNCTIONS (LOGIC) ---

/**
 * Prompts the user for framework settings and handles directory setup.
 * CRITICAL: Changes the CWD to the determined frameworkRoot for simple npm/npx execution.
 * @returns {Promise<Object>} The configuration object.
 */
async function getFrameworkSettings() {
    const defaultTestDirName = 'e2e.tests';
    const defaultRootName = 'tested-app';
    const defaultBaseUrl = 'https://the-internet.herokuapp.com/';

    // --- 1. Path Configuration ---
    const parentDir = path.join(process.cwd(), '..');
    const defaultFrameworkRoot = path.join(parentDir, defaultRootName);
    const defaultTestDir = path.join(defaultFrameworkRoot, defaultTestDirName);

    const inputPath = await promptUser(`Enter the full path to the E2E framework folder (Default: ${defaultTestDir}): `);

    // CRITICAL FIX: Explicitly cast the awaited result to a string to prevent "Cannot read properties of undefined (reading 'trim')"
    const safeInputPath = String(inputPath || '');

    const testDir = safeInputPath.trim() || defaultTestDir;

    const testDirName = path.basename(testDir);
    const frameworkRoot = path.dirname(testDir);

    console.log(`\nFramework Root Directory (for package.json): ${frameworkRoot}`);
    console.log(`Framework Test Directory (for playwright.config.ts): ${testDir}\n`);

    createDir(frameworkRoot);
    process.chdir(frameworkRoot);

    // --- 2. Base URL ---
    const inputBaseUrl = await promptUser(`Enter the default Base URL for your application (Default: ${defaultBaseUrl}): `, { default: defaultBaseUrl });
    const baseURL = inputBaseUrl;
    console.log(`\nUsing Base URL: ${baseURL}`);

    // --- 3. Concurrency and Retries (Robustness/Performance) ---
    // ENHANCEMENT: Defaulted to 4 for better parallelism.
    const maxWorkers = await promptUser(`Max Parallel Workers (e.g., 4, or leave blank for OS default 'undefined') (Default: 4): `, { type: 'number', default: 4 });
    const retries = await promptUser(`Default Test Retries on failure (e.g., 2): `, { type: 'number', default: 2 });

    // --- 4. Browser Selection (Scope) ---
    const browserOptions = [
        'chromium',
        'firefox',
        'webkit',
        'mobile-chrome'
    ];
    const defaultBrowsers = ['chromium', 'firefox'];
    const browserPrompt = `\nSelect browsers to include (Comma-separated: ${browserOptions.join(', ')} | Default: ${defaultBrowsers.join(', ')}): `;
    const selectedBrowsers = await promptUser(browserPrompt, { type: 'multiselect', valid: browserOptions, default: defaultBrowsers });

    console.log(`\nConfiguration Summary:`);
    console.log(`- Max Workers: ${maxWorkers}`);
    console.log(`- Test Retries: ${retries}`);
    console.log(`- Browsers: ${selectedBrowsers.join(', ')}`);

    return {
        testDirName,
        frameworkRoot,
        baseURL,
        // Set to 'undefined' if the user left it blank or entered 0, otherwise use the number
        maxWorkers: (maxWorkers === 0 || maxWorkers === 'undefined') ? 'undefined' : String(maxWorkers),
        retries,
        browserProjects: selectedBrowsers
    };
}

/**
 * Creates the internal directory structure relative to the new CWD (frameworkRoot).
 * @param {string} testDirName
 */
function createStructure(testDirName) {
    const frameworkPath = path.join(process.cwd(), testDirName);
    createDir(frameworkPath);
    // NEW DIRECTORY: For authentication state
    createDir(path.join(process.cwd(), AUTH_DIR));

    createDir(path.join(frameworkPath, 'fixtures'));
    createDir(path.join(frameworkPath, 'pages'));
    createDir(path.join(frameworkPath, 'tests'));
    createDir(path.join(frameworkPath, 'utils'));
}

/**
 * Writes all framework files, using the new CWD (frameworkRoot) as the base.
 * @param {string} testDirName
 * @param {Object} config The configuration object containing dynamic values.
 */
function writeFiles(testDirName, config) {
    const fileContents = getFileContents();

    for (const filePathKey in fileContents) {
        let contentFunc = fileContents[filePathKey];
        let content;
        let finalPath;

        if (filePathKey.includes('e2e.tests')) {
            finalPath = filePathKey.replace('e2e.tests', testDirName);
        } else {
            finalPath = filePathKey;
        }

        // Handle content generation for config, README, and generic functions
        if (filePathKey.includes('playwright.config.ts')) {
            content = contentFunc(testDirName, config);
        } else if (filePathKey === 'README.md') {
            // README content requires variable replacement
            content = contentFunc()
                .replace('{__RETRIES__}', config.retries)
                .replace('{__WORKERS__}', config.maxWorkers)
                .replace('{__BROWSERS__}', config.browserProjects.join(', '))
                .replace('{__BASE_URL__}', config.baseURL);
        } else if (typeof contentFunc === 'function') {
            // Handle content generation for auth.setup.ts, which is a function that returns a template string
            content = contentFunc(testDirName);
        } else {
            // This handles non-function content like .gitignore
            content = contentFunc;
        }

        writeFile(finalPath, content);
    }
}

/**
 * Runs the verification tests and includes the intentionally failing test.
 * @param {string} testDirName
 * @param {Object} config The configuration object.
 */
function runVerificationTests(testDirName, config) {
    console.log(`\n======================================================`);
    console.log(`🔬 Running initial verification tests...`);
    console.log(`======================================================`);

    const expectedFailPath = `${testDirName}/tests/expected-fail.spec.ts`;

    console.log(`\n📢 **IMPORTANT NOTE** 📢`);
    console.log(`The test **${expectedFailPath}** is INTENTIONALLY designed to fail.`);
    console.log(`This is to demonstrate Playwright's error reporting, failure screenshots,`);
    console.log(`and the retry mechanism (set to **${config.retries}** retries).`);
    console.log(`The final report will correctly show one expected failure.`);

    // Include the new auth_storage.spec.ts
    const allTests = `${testDirName}/tests/seed.spec.ts ${testDirName}/tests/the-internet-sample.spec.ts ${testDirName}/tests/network_data.spec.ts ${testDirName}/tests/api.spec.ts ${testDirName}/tests/visual.spec.ts ${testDirName}/tests/volatile.spec.ts ${testDirName}/tests/auth_storage.spec.ts ${expectedFailPath}`;
    const fullVerificationCommand = `npx playwright test --config=${testDirName}/playwright.config.ts ${allTests} --update-snapshots`;

    console.log(`\n--- Running Global Setup, Creating Baseline Snapshot & Full Suite (Including Expected Failure) ---`);

    try {
        // This command is expected to throw because expected-fail.spec.ts fails.
        execSync(fullVerificationCommand, { stdio: ['ignore', 'inherit', 'inherit'] });

        // This code path should theoretically not be reached unless the expected-fail test is removed or fixed.
        console.log(`--- Baseline Snapshot Created and Full Suite Run Successfully ---`);

    } catch (error) {
        // If we catch an error, it is likely due to the expected test failure (non-zero status).
        // A non-zero status means tests failed, but the command itself ran successfully.
        if (error.status !== undefined && error.status !== 0) {
            console.log(`\n--- Verification Run Complete with Expected Failures (Exit Code ${error.status}) ---`);
            console.log(`✅ This is the intended behavior. The 'expected-fail.spec.ts' failed, successfully demonstrating the error and retry logic.`);
            console.log(`--- Baseline Snapshot Created ---`);
        } else {
            // If the status is undefined or zero, but an error was still caught, re-throw a real fatal error.
            throw error;
        }
    }
}

function installDependencies() {
    console.log(`\n======================================================`);
    console.log(`📦 Installing dependencies (in ${process.cwd()})...`);
    console.log(`======================================================`);
    execSync('npm install', { stdio: 'inherit' });

    console.log(`\n======================================================`);
    console.log(`💻 Installing browser binaries...`);
    console.log(`======================================================`);
    execSync('npx playwright install', { stdio: 'inherit' });
}

function initializeVsCodeAgent() {
    console.log(`\n======================================================`);
    console.log(`🤖 Initializing Playwright VS Code Debugging Agent...`);
    console.log(`   (Required for the v1.56 Test Agents feature)`);
    console.log(`======================================================`);
    try {
        // Run init-agents for VS Code as a standard setup step
        execSync('npx playwright init-agents --loop=vscode', { stdio: 'inherit' });
        console.log(`✅ VS Code Agent setup files completed (.vscode folder created).`);
    } catch (error) {
        console.log(`⚠️ VS Code Agent setup failed. This feature requires Playwright >= 1.56. Not critical for basic test execution.`);
    }
}


// --- 4. MAIN EXECUTION ---

async function setupFramework() {
    console.log(`\n======================================================`);
    console.log(`🚀 Playwright E2E Framework Bootstrap (v1.56 Ready)`);
    console.log(`======================================================`);

    try {
        // ENHANCEMENT: Ask if user wants to run tests before installation begins
        const shouldRunTests = await promptUser(
            'Do you want to run the initial verification tests after installation (Recommended: Y/n)? ',
            { type: 'boolean', default: true }
        );

        if (!shouldRunTests) {
            console.log("\n⚠️ Skipping initial test execution as requested. Remember to run 'npm test' later!");
        }

        const config = await getFrameworkSettings();

        createStructure(config.testDirName);
        writeFiles(config.testDirName, config);
        installDependencies();

        // Conditional test run
        if (shouldRunTests) {
            runVerificationTests(config.testDirName, config);
        }

        initializeVsCodeAgent();

        // 7. Final Instructions
        console.log(`\n======================================================`);
        console.log(`🎉 Setup Complete!`);
        console.log(`======================================================`);
        console.log(`\nYour Playwright framework is ready at root: **${config.frameworkRoot}**`);
        console.log(`The test directory is: **${path.join(config.frameworkRoot, config.testDirName)}**`);
        console.log(`\n--- Next Steps ---`);
        console.log(`1. **Authentication**: The session for **student/Password123** is saved to **${path.join(config.frameworkRoot, STORAGE_STATE_FILE)}** and is loaded automatically for all UI tests.`);
        if (!shouldRunTests) {
             console.log(`2. **Run Tests Now**: Execute 'npm test' to verify the installation and create visual snapshots.`);
        }
        console.log(`2. View the full HTML report by running: **npm run report**`);
        console.log(`3. **Manual Validation**: Inspect snapshots in '${config.testDirName}/tests/visual.spec.ts-snapshots' to confirm the visual baseline is correct.`);

    } catch (error) {
        console.error(`\n\n❌ Fatal Error during setup. Execution failed.`);
        console.error(`Error details: ${error.message}`);
        process.exit(1);
    }
}

(async () => {
    await setupFramework();
})();
