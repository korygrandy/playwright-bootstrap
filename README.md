# 🎭 Playwright E2E Automation Framework

This project contains a robust **Playwright end-to-end (E2E) testing framework** built on best practices, designed for high performance, stability, and maintainability.

---

## ✨ Key Features

This framework is configured out-of-the-box with professional features, including:

* **🔐 Pre-Authenticated Sessions:** Uses Playwright's Global Setup to log in once, save the session state (`auth/user.json`), and load it automatically for all tests, completely skipping the login step.
* **🏎️ High-Performance Configuration:** Optimized for speed with parallel execution enabled and a default of 4 worker threads.
* **🧪 Advanced Test Examples:** Includes ready-to-use tests for **API testing**, **Visual Regression**, **Network/Console logging** (using modern Playwright APIs), and a template for **Accessibility (A11y)**.
* **🛡️ Robustness Features:** Configured for automatic test **retries** on failure and a custom utility for **conditional retries** to handle known volatile tests.
* **🧩 Custom Fixtures & POMs:** Extends the core Playwright `test` object with custom fixtures for Page Object Models (POMs) and utility classes.
* **🧩 Playwright MCP Ai Agent OOTB:** Start using Playwright MCP immidiately!

---
  
## 🚀 Getting Started

To run the full suite and generate the initial reports and snapshots:

### 1. Run All Tests

Runs the full suite, including UI, API, and visual tests.

```bash
npm test
