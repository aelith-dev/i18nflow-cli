# i18nflow-cli

> AI-driven CLI tool to automate, audit, and synchronize multi-language JSON translation files.

[![npm version](https://img.shields.io/npm/v/@aelith-dev/i18nflow-cli.svg)](https://www.npmjs.com/package/@aelith-dev/i18nflow-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ Features

*   **AI-Powered Sync**: Automatically detects missing keys across locales and generates accurate translations using AI (Gemini / Groq).
*   **Zero-Config Defaults**: Works out-of-the-box with interactive setup and standard JSON i18n directory structures.
*   **Fast & Deterministic**: Built with Node.js and TypeScript for rapid execution in CI/CD pipelines or local development.
*   **Clean CLI**: Ergonomic command-line interface with interactive prompts (`clack`).

---

## 🚀 Installation & Quick Start

### Global Install
```bash
npm install -g @aelith-dev/i18nflow-cli
# or via pnpm
pnpm add -g @aelith-dev/i18nflow-cli
```

### One-off execution via npx
```bash
npx @aelith-dev/i18nflow-cli ping
```

---

## 🔑 Environment Configuration

Set your Gemini or Groq API key in your environment variables or a `.env` file in your project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

---

## 🛠️ Available Commands

| Command | Description |
| :--- | :--- |
| `i18nflow init` | Interactive setup to initialize configuration (`i18nflow.config.ts`) and folder structures |
| `i18nflow add <locale>` | Translate and add a new target locale file based on the source JSON tree |
| `i18nflow sync` | Detect missing nested keys across target locales and auto-translate/merge them |
| `i18nflow diff <locale>` | Show key differences (delta) against the source locale |
| `i18nflow remove <locale>` | Remove a target locale JSON file and update target configuration |

---

## 📁 Recommended Directory Structure
```text
your-project/
├── locales/
│   ├── en.json  # Base reference
│   └── es.json  # Target (auto-synced)
└── i18nflow.config.ts
```

---

## 🛡️ License
MIT © [Darieth Jasso](https://github.com/dariethjasso)

---
> *Part of **Aelith Studio** ecosystem.*