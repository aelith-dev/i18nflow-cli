#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";
import chalk2 from "chalk";
import { intro, outro, text, cancel as cancel2, spinner } from "@clack/prompts";
import fs from "fs/promises";
import path from "path";

// src/translate.ts
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";
import { cancel } from "@clack/prompts";
import chalk from "chalk";
dotenv.config();
function getClients() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!geminiApiKey && !groqApiKey) {
    cancel("Missing API keys. Please set GEMINI_API_KEY or GROQ_API_KEY in your .env file.");
    process.exit(1);
  }
  return {
    gemini: geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null,
    groq: groqApiKey ? new OpenAI({
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
      console.log(chalk.yellow(`\xB7 Gemini failed (${shortErr}), routing to Groq fallback...`));
      if (!groq) throw new Error("Groq key not configured for fallback");
      try {
        rawText = await translateWithGroq(prompt, groq);
      } catch (groqErr) {
        const shortGroqErr = formatAiError(groqErr);
        console.error(chalk.red(`\xD7 Groq fallback also failed (${shortGroqErr})`));
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
var program = new Command();
program.name("i18nflow").description("Local-first i18n CLI").version("0.1.0");
program.command("ping").description("Test CLI connection").action(() => {
  console.log(chalk2.gray("i18nflow:") + " " + chalk2.green("operational"));
});
program.command("init").description("Initialize i18nflow configuration and folders").action(async () => {
  intro(chalk2.inverse(" i18nflow setup "));
  const sourceLocale = await text({
    message: "Source/base locale:",
    placeholder: "es, en, fr..."
  });
  if (typeof sourceLocale === "symbol") {
    cancel2("Setup cancelled.");
    process.exit(0);
  }
  const localesDir = await text({
    message: "Locales directory path:",
    initialValue: "./locales"
  });
  if (typeof localesDir === "symbol") {
    cancel2("Setup cancelled.");
    process.exit(0);
  }
  const targetsInput = await text({
    message: "Target locales (comma-separated):",
    placeholder: "en, fr, de..."
  });
  if (typeof targetsInput === "symbol") {
    cancel2("Setup cancelled.");
    process.exit(0);
  }
  const targets = targetsInput.split(",").map((s2) => s2.trim()).filter(Boolean);
  const s = spinner();
  s.start("Generating configuration and file structure...");
  const targetDirAbs = path.resolve(process.cwd(), localesDir);
  await fs.mkdir(targetDirAbs, { recursive: true });
  const sourceFilePath = path.join(targetDirAbs, `${sourceLocale}.json`);
  try {
    await fs.access(sourceFilePath);
  } catch {
    await fs.writeFile(sourceFilePath, JSON.stringify(initialBaseContent(sourceLocale), null, 2), "utf-8");
  }
  const configContent = `export default {
  source: '${sourceLocale}',
  localesDir: '${localesDir}',
  targets: ${JSON.stringify(targets)},
};
`;
  await fs.writeFile(path.resolve(process.cwd(), "i18nflow.config.ts"), configContent, "utf-8");
  s.stop("Configuration generated.");
  outro(chalk2.green(`Initialized in ${localesDir} with base ${sourceLocale}.json`));
});
program.command("add <locale>").description("Add a new target locale").action(async (locale) => {
  intro(chalk2.inverse(` i18nflow add: ${locale} `));
  checkEnvKeys();
  const configPath = path.resolve(process.cwd(), "i18nflow.config.ts");
  let config;
  try {
    config = await import(configPath);
  } catch {
    cancel2('Configuration file i18nflow.config.ts not found. Run "i18nflow init" first.');
    process.exit(1);
  }
  const { localesDir, targets } = config.default;
  if (targets.includes(locale)) {
    cancel2(`Locale "${locale}" is already registered in targets.`);
    process.exit(1);
  }
  const targetDirAbs = path.resolve(process.cwd(), localesDir);
  await fs.mkdir(targetDirAbs, { recursive: true });
  const targetFilePath = path.join(targetDirAbs, `${locale}.json`);
  try {
    await fs.access(targetFilePath);
    cancel2(`File "${locale}.json" already exists on disk.`);
    process.exit(1);
  } catch {
    const s = spinner();
    s.start(`Translating base tree to ${locale}...`);
    const baseContentJSON = await fs.readFile(path.join(targetDirAbs, `${config.default.source}.json`), "utf-8");
    const baseContent = JSON.parse(baseContentJSON);
    const translatedContent = await translateJSONTree(baseContent, config.default.source, locale);
    await fs.writeFile(targetFilePath, JSON.stringify(translatedContent, null, 2), "utf-8");
    s.stop(`Translated and saved ${locale}.json`);
  }
  targets.push(locale);
  const updatedConfigContent = `export default {
  source: '${config.default.source}',
  localesDir: '${localesDir}',
  targets: ${JSON.stringify(targets)},
};
`;
  await fs.writeFile(configPath, updatedConfigContent, "utf-8");
  outro(chalk2.green(`Locale "${locale}" added and configuration updated.`));
});
program.command("sync").description("Sync missing nested keys across target locales").action(async () => {
  intro(chalk2.inverse(" i18nflow sync "));
  checkEnvKeys();
  const configModule = await import(path.resolve(process.cwd(), "i18nflow.config.ts"));
  const config = configModule.default || configModule;
  const localesDirAbs = path.resolve(process.cwd(), config.localesDir);
  const sourceFilePath = path.join(localesDirAbs, `${config.source}.json`);
  const sourceContent = JSON.parse(await fs.readFile(sourceFilePath, "utf-8"));
  for (const target of config.targets) {
    const targetFilePath = path.join(localesDirAbs, `${target}.json`);
    let targetContent = {};
    try {
      targetContent = JSON.parse(await fs.readFile(targetFilePath, "utf-8"));
    } catch {
    }
    const missing = deepDiff(sourceContent, targetContent);
    if (Object.keys(missing).length === 0) {
      console.log(`  ${chalk2.dim("\xB7")} ${target}.json ${chalk2.cyan("[synced]")}`);
      continue;
    }
    const s = spinner();
    s.start(`Syncing ${target}.json (${Object.keys(missing).length} root keys missing)...`);
    const translatedMissing = await translateJSONTree(missing, config.source, target);
    const merged = deepMerge(targetContent, translatedMissing);
    await fs.writeFile(targetFilePath, JSON.stringify(merged, null, 2), "utf-8");
    s.stop(`Synced ${target}.json`);
  }
  outro(chalk2.green("Sync process completed."));
});
program.command("diff <locale>").description("Show key differences against source locale").action(async (locale) => {
  const configModule = await import(path.resolve(process.cwd(), "i18nflow.config.ts"));
  const config = configModule.default || configModule;
  const localesDirAbs = path.resolve(process.cwd(), config.localesDir);
  const sourceFilePath = path.join(localesDirAbs, `${config.source}.json`);
  const targetFilePath = path.join(localesDirAbs, `${locale}.json`);
  let sourceContent = {};
  let targetContent = {};
  try {
    sourceContent = JSON.parse(await fs.readFile(sourceFilePath, "utf-8"));
  } catch {
    cancel2(`Source file "${config.source}.json" missing.`);
    process.exit(1);
  }
  try {
    targetContent = JSON.parse(await fs.readFile(targetFilePath, "utf-8"));
  } catch {
    cancel2(`Target file "${locale}.json" missing.`);
    process.exit(1);
  }
  const differences = deepDiff(sourceContent, targetContent);
  if (Object.keys(differences).length === 0) {
    console.log(chalk2.green(`\u2713 ${locale}.json is up to date with ${config.source}.json`));
  } else {
    console.log(chalk2.yellow(`\u26A0 Delta keys in ${locale}.json:`));
    console.log(JSON.stringify(differences, null, 2));
  }
});
program.command("remove <locale>").description("Remove a target locale file").action(async (locale) => {
  intro(chalk2.inverse(` i18nflow remove: ${locale} `));
  const configModule = await import(path.resolve(process.cwd(), "i18nflow.config.ts"));
  const config = configModule.default || configModule;
  const localesDirAbs = path.resolve(process.cwd(), config.localesDir);
  const targetFilePath = path.join(localesDirAbs, `${locale}.json`);
  const updatedTargets = config.targets.filter((t) => t !== locale);
  await fs.writeFile(path.resolve(process.cwd(), "i18nflow.config.ts"), `export default {
  source: '${config.source}',
  localesDir: '${config.localesDir}',
  targets: ${JSON.stringify(updatedTargets)},
};
`, "utf-8");
  try {
    await fs.unlink(targetFilePath);
    outro(chalk2.green(`Removed ${locale}.json and updated config targets.`));
  } catch {
    cancel2(`Target file "${targetFilePath}" not found on disk.`);
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
    cancel2("Missing API keys. Please set GEMINI_API_KEY or GROQ_API_KEY in your .env file.");
    process.exit(1);
  }
}
