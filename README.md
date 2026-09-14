# i18nflow-cli

> AI-driven CLI tool to automate, audit, and synchronize multi-language JSON translation files.

[![npm version](https://img.shields.io/npm/v/@dariethjasso/i18nflow-cli.svg)](https://www.npmjs.com/package/@dariethjasso/i18nflow-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ Features

*   **AI-Powered Sync**: Automatically detects missing keys across locales and generates accurate translations using Gemini AI.
*   **Zero-Config Defaults**: Works out-of-the-box with standard JSON i18n directory structures.
*   **Fast & Deterministic**: Built with Node.js and TypeScript for rapid execution in CI/CD pipelines or local development.
*   **Clean CLI**: Ergonomic command-line interface (`i18nflow sync`).

---

## 🚀 Installation & Quick Start

### Global Install
```bash
npm install -g @dariethjasso/i18nflow-cli
# or via pnpm
pnpm add -g @dariethjasso/i18nflow-cli
```

### One-off execution via npx
```bash
npx @dariethjasso/i18nflow-cli sync
```

---

## 🔑 Environment Configuration

Set your Gemini API key in your environment variables or a `.env` file in your project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 🛠️ Usage

Run the sync command inside your project directory:

```bash
i18nflow sync
```

### Options / Flags
| Flag | Description | Default |
| :--- | :--- | :--- |
| `-dir, --locales` | Path to your locales directory | `./locales` |
| `-base, --base-locale` | Source/reference language | `en` |
| `-k, --key` | Override Gemini API key via CLI | `process.env.GEMINI_API_KEY` |

---

## 📁 Recommended Directory Structure
```text
your-project/
├── locales/
│   ├── en/
│   │   └── common.json  # Base reference
│   └── es/
│       └── common.json  # Target (auto-synced)
└── i18nflow.config.json (optional)
```

---

## 🛡️ License
MIT © [Darieth Jasso](https://github.com/dariethjasso)

---
> *Part of **Aelith Studio** ecosystem.*