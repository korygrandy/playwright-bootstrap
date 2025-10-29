# Playwright E2E Automation Framework

This project contains a robust **Playwright end-to-end (E2E) testing framework**.

---

## ⚙️ Configuration Summary

This framework was initialized with the following settings:

| Setting | Value | Impact |
| :--- | :--- | :--- |
| **Test Retries** | **2** | The number of times a test will re-run globally upon failure. |
| **Max Parallel Workers** | **undefined** | Limits concurrent test file execution. Set to `undefined` if using OS default. |
| **Browser Projects** | **chromium, firefox** | Only these projects are included in `playwright.config.ts`. |
| **Base URL** | **https://the-internet.herokuapp.com/** | The default application URL. |

### 🛠️ Important Note on Visual Tests

During the initial run, the system creates baseline screenshots for the visual regression test. You **must** manually review these newly created images in the snapshot folder to confirm they represent the correct desired state of the application.

---

## ▶️ Getting Started

### 1. Run All Tests

```bash
npm test
```

### 2. View the HTML Report

```bash
npm run report
```

### 3. Debugging with UI Mode

```bash
npm run test:ui
```
