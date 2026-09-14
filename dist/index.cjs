#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_commander = require("commander");
var import_chalk2 = __toESM(require("chalk"), 1);
var import_prompts2 = require("@clack/prompts");
var import_promises = __toESM(require("fs/promises"), 1);
var import_path = __toESM(require("path"), 1);

// src/translate.ts
var import_genai = require("@google/genai");
var import_openai = __toESM(require("openai"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_prompts = require("@clack/prompts");
var import_chalk = __toESM(require("chalk"), 1);
import_dotenv.default.config();
function getClients() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!geminiApiKey && !groqApiKey) {
    (0, import_prompts.cancel)("Missing API keys. Please set GEMINI_API_KEY or GROQ_API_KEY in your .env file.");
    process.exit(1);
  }
  return {
    gemini: geminiApiKey ? new import_genai.GoogleGenAI({ apiKey: geminiApiKey }) : null,
    groq: groqApiKey ? new import_openai.default({
      apiKey: groqApiKey,
      baseURL: "https://api.groq.com/openai/v1"
    }) : null
  };
}
function cleanJsonString(raw) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : raw.replace(/```json/g, "").replace(/```/g, "").trim();
}
async function translateWithGemini(prompt, client) {
  const res = await client.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt
  });
  return res.text || "{}";
}
async function translateWithGroq(prompt, client) {
  const completion = await client.chat.completions.create({
    model: "groq/compound-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1
  });
  return completion.choices[0]?.message?.content || "{}";
}
async function translateJSONTree(sourceObj, baseLang, targetLang) {
  const { gemini, groq } = getClients();
  const prompt = `Translate the JSON values from ${baseLang} to ${targetLang}. 
Keep exact same JSON keys, nested structure, and placeholders like {{name}}. 
Return ONLY valid JSON, no markdown blocks.

JSON:
${JSON.stringify(sourceObj, null, 2)}`;
  let rawText = "";
  if (gemini) {
    try {
      rawText = await translateWithGemini(prompt, gemini);
    } catch (err) {
      const shortErr = formatAiError(err);
      console.log(import_chalk.default.yellow(`\xB7 Gemini failed (${shortErr}), routing to Groq fallback...`));
      if (!groq) throw new Error("Groq key not configured for fallback");
      try {
        rawText = await translateWithGroq(prompt, groq);
      } catch (groqErr) {
        const shortGroqErr = formatAiError(groqErr);
        console.error(import_chalk.default.red(`\xD7 Groq fallback also failed (${shortGroqErr})`));
        throw groqErr;
      }
    }
  } else if (groq) {
    rawText = await translateWithGroq(prompt, groq);
  } else {
    throw new Error("No AI provider available.");
  }
  return JSON.parse(cleanJsonString(rawText));
}
function deepDiff(source, target) {
  const diff = {};
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      const nested = deepDiff(source[key], target[key] || {});
      if (Object.keys(nested).length > 0) {
        diff[key] = nested;
      }
    } else if (target[key] === void 0) {
      diff[key] = source[key];
    }
  }
  return diff;
}
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
function formatAiError(err) {
  const status = err?.status || err?.error?.code || "ERROR";
  if (status === 429 || status === "RESOURCE_EXHAUSTED") {
    return "rate limit (429)";
  }
  if (status === 503) {
    return "service unavailable (503)";
  }
  return err?.error?.message ? `code ${status}` : String(status);
}

// src/index.ts
var program = new import_commander.Command();
program.name("i18nflow").description("Local-first i18n CLI").version("0.1.0");
program.command("ping").description("Test CLI connection").action(() => {
  console.log(import_chalk2.default.gray("i18nflow:") + " " + import_chalk2.default.green("operational"));
});
program.command("init").description("Initialize i18nflow configuration and folders").action(async () => {
  (0, import_prompts2.intro)(import_chalk2.default.inverse(" i18nflow setup "));
  const sourceLocale = await (0, import_prompts2.text)({
    message: "Source/base locale:",
    placeholder: "es, en, fr..."
  });
  if (typeof sourceLocale === "symbol") {
    (0, import_prompts2.cancel)("Setup cancelled.");
    process.exit(0);
  }
  const localesDir = await (0, import_prompts2.text)({
    message: "Locales directory path:",
    initialValue: "./locales"
  });
  if (typeof localesDir === "symbol") {
    (0, import_prompts2.cancel)("Setup cancelled.");
    process.exit(0);
  }
  const targetsInput = await (0, import_prompts2.text)({
    message: "Target locales (comma-separated):",
    placeholder: "en, fr, de..."
  });
  if (typeof targetsInput === "symbol") {
    (0, import_prompts2.cancel)("Setup cancelled.");
    process.exit(0);
  }
  const targets = targetsInput.split(",").map((s2) => s2.trim()).filter(Boolean);
  const s = (0, import_prompts2.spinner)();
  s.start("Generating configuration and file structure...");
  const targetDirAbs = import_path.default.resolve(process.cwd(), localesDir);
  await import_promises.default.mkdir(targetDirAbs, { recursive: true });
  const sourceFilePath = import_path.default.join(targetDirAbs, `${sourceLocale}.json`);
  try {
    await import_promises.default.access(sourceFilePath);
  } catch {
    await import_promises.default.writeFile(sourceFilePath, JSON.stringify(initialBaseContent(sourceLocale), null, 2), "utf-8");
  }
  const configContent = `export default {
  source: '${sourceLocale}',
  localesDir: '${localesDir}',
  targets: ${JSON.stringify(targets)},
};
`;
  await import_promises.default.writeFile(import_path.default.resolve(process.cwd(), "i18nflow.config.ts"), configContent, "utf-8");
  s.stop("Configuration generated.");
  (0, import_prompts2.outro)(import_chalk2.default.green(`Initialized in ${localesDir} with base ${sourceLocale}.json`));
});
program.command("add <locale>").description("Add a new target locale").action(async (locale) => {
  (0, import_prompts2.intro)(import_chalk2.default.inverse(` i18nflow add: ${locale} `));
  checkEnvKeys();
  const configPath = import_path.default.resolve(process.cwd(), "i18nflow.config.ts");
  let config;
  try {
    config = await import(configPath);
  } catch {
    (0, import_prompts2.cancel)('Configuration file i18nflow.config.ts not found. Run "i18nflow init" first.');
    process.exit(1);
  }
  const { localesDir, targets } = config.default;
  if (targets.includes(locale)) {
    (0, import_prompts2.cancel)(`Locale "${locale}" is already registered in targets.`);
    process.exit(1);
  }
  const targetDirAbs = import_path.default.resolve(process.cwd(), localesDir);
  await import_promises.default.mkdir(targetDirAbs, { recursive: true });
  const targetFilePath = import_path.default.join(targetDirAbs, `${locale}.json`);
  try {
    await import_promises.default.access(targetFilePath);
    (0, import_prompts2.cancel)(`File "${locale}.json" already exists on disk.`);
    process.exit(1);
  } catch {
    const s = (0, import_prompts2.spinner)();
    s.start(`Translating base tree to ${locale}...`);
    const baseContentJSON = await import_promises.default.readFile(import_path.default.join(targetDirAbs, `${config.default.source}.json`), "utf-8");
    const baseContent = JSON.parse(baseContentJSON);
    const translatedContent = await translateJSONTree(baseContent, config.default.source, locale);
    await import_promises.default.writeFile(targetFilePath, JSON.stringify(translatedContent, null, 2), "utf-8");
    s.stop(`Translated and saved ${locale}.json`);
  }
  targets.push(locale);
  const updatedConfigContent = `export default {
  source: '${config.default.source}',
  localesDir: '${localesDir}',
  targets: ${JSON.stringify(targets)},
};
`;
  await import_promises.default.writeFile(configPath, updatedConfigContent, "utf-8");
  (0, import_prompts2.outro)(import_chalk2.default.green(`Locale "${locale}" added and configuration updated.`));
});
program.command("sync").description("Sync missing nested keys across target locales").action(async () => {
  (0, import_prompts2.intro)(import_chalk2.default.inverse(" i18nflow sync "));
  checkEnvKeys();
  const configModule = await import(import_path.default.resolve(process.cwd(), "i18nflow.config.ts"));
  const config = configModule.default || configModule;
  const localesDirAbs = import_path.default.resolve(process.cwd(), config.localesDir);
  const sourceFilePath = import_path.default.join(localesDirAbs, `${config.source}.json`);
  const sourceContent = JSON.parse(await import_promises.default.readFile(sourceFilePath, "utf-8"));
  for (const target of config.targets) {
    const targetFilePath = import_path.default.join(localesDirAbs, `${target}.json`);
    let targetContent = {};
    try {
      targetContent = JSON.parse(await import_promises.default.readFile(targetFilePath, "utf-8"));
    } catch {
    }
    const missing = deepDiff(sourceContent, targetContent);
    if (Object.keys(missing).length === 0) {
      console.log(`  ${import_chalk2.default.dim("\xB7")} ${target}.json ${import_chalk2.default.cyan("[synced]")}`);
      continue;
    }
    const s = (0, import_prompts2.spinner)();
    s.start(`Syncing ${target}.json (${Object.keys(missing).length} root keys missing)...`);
    const translatedMissing = await translateJSONTree(missing, config.source, target);
    const merged = deepMerge(targetContent, translatedMissing);
    await import_promises.default.writeFile(targetFilePath, JSON.stringify(merged, null, 2), "utf-8");
    s.stop(`Synced ${target}.json`);
  }
  (0, import_prompts2.outro)(import_chalk2.default.green("Sync process completed."));
});
program.command("diff <locale>").description("Show key differences against source locale").action(async (locale) => {
  const configModule = await import(import_path.default.resolve(process.cwd(), "i18nflow.config.ts"));
  const config = configModule.default || configModule;
  const localesDirAbs = import_path.default.resolve(process.cwd(), config.localesDir);
  const sourceFilePath = import_path.default.join(localesDirAbs, `${config.source}.json`);
  const targetFilePath = import_path.default.join(localesDirAbs, `${locale}.json`);
  let sourceContent = {};
  let targetContent = {};
  try {
    sourceContent = JSON.parse(await import_promises.default.readFile(sourceFilePath, "utf-8"));
  } catch {
    (0, import_prompts2.cancel)(`Source file "${config.source}.json" missing.`);
    process.exit(1);
  }
  try {
    targetContent = JSON.parse(await import_promises.default.readFile(targetFilePath, "utf-8"));
  } catch {
    (0, import_prompts2.cancel)(`Target file "${locale}.json" missing.`);
    process.exit(1);
  }
  const differences = deepDiff(sourceContent, targetContent);
  if (Object.keys(differences).length === 0) {
    console.log(import_chalk2.default.green(`\u2713 ${locale}.json is up to date with ${config.source}.json`));
  } else {
    console.log(import_chalk2.default.yellow(`\u26A0 Delta keys in ${locale}.json:`));
    console.log(JSON.stringify(differences, null, 2));
  }
});
program.command("remove <locale>").description("Remove a target locale file").action(async (locale) => {
  (0, import_prompts2.intro)(import_chalk2.default.inverse(` i18nflow remove: ${locale} `));
  const configModule = await import(import_path.default.resolve(process.cwd(), "i18nflow.config.ts"));
  const config = configModule.default || configModule;
  const localesDirAbs = import_path.default.resolve(process.cwd(), config.localesDir);
  const targetFilePath = import_path.default.join(localesDirAbs, `${locale}.json`);
  const updatedTargets = config.targets.filter((t) => t !== locale);
  await import_promises.default.writeFile(import_path.default.resolve(process.cwd(), "i18nflow.config.ts"), `export default {
  source: '${config.source}',
  localesDir: '${config.localesDir}',
  targets: ${JSON.stringify(updatedTargets)},
};
`, "utf-8");
  try {
    await import_promises.default.unlink(targetFilePath);
    (0, import_prompts2.outro)(import_chalk2.default.green(`Removed ${locale}.json and updated config targets.`));
  } catch {
    (0, import_prompts2.cancel)(`Target file "${targetFilePath}" not found on disk.`);
    process.exit(1);
  }
});
program.parse();
function initialBaseContent(locale) {
  switch (locale) {
    case "en":
      return { hello: "Hello" };
    case "es":
      return { hello: "Hola" };
    case "fr":
      return { hello: "Bonjour" };
    default:
      return { hello: locale };
  }
}
function checkEnvKeys() {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    (0, import_prompts2.cancel)("Missing API keys. Please set GEMINI_API_KEY or GROQ_API_KEY in your .env file.");
    process.exit(1);
  }
}
