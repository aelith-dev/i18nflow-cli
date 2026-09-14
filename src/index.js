#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { intro, outro, text, cancel, spinner } from '@clack/prompts';
import fs from 'fs/promises';
import path from 'path';
import { deepDiff, deepMerge, translateJSONTree } from './translate.js';
const program = new Command();
program
    .name('i18nflow')
    .description('Local-first i18n CLI')
    .version('0.1.0');
program
    .command('ping')
    .description('Test CLI connection')
    .action(() => {
    console.log(chalk.gray('i18nflow:') + ' ' + chalk.green('operational'));
});
program
    .command('init')
    .description('Initialize i18nflow configuration and folders')
    .action(async () => {
    intro(chalk.inverse(' i18nflow setup '));
    const sourceLocale = await text({
        message: 'Source/base locale:',
        placeholder: 'es, en, fr...',
    });
    if (typeof sourceLocale === 'symbol') {
        cancel('Setup cancelled.');
        process.exit(0);
    }
    const localesDir = await text({
        message: 'Locales directory path:',
        initialValue: './locales',
    });
    if (typeof localesDir === 'symbol') {
        cancel('Setup cancelled.');
        process.exit(0);
    }
    const targetsInput = await text({
        message: 'Target locales (comma-separated):',
        placeholder: 'en, fr, de...',
    });
    if (typeof targetsInput === 'symbol') {
        cancel('Setup cancelled.');
        process.exit(0);
    }
    const targets = targetsInput.split(',').map((s) => s.trim()).filter(Boolean);
    const s = spinner();
    s.start('Generating configuration and file structure...');
    const targetDirAbs = path.resolve(process.cwd(), localesDir);
    await fs.mkdir(targetDirAbs, { recursive: true });
    const sourceFilePath = path.join(targetDirAbs, `${sourceLocale}.json`);
    try {
        await fs.access(sourceFilePath);
    }
    catch {
        await fs.writeFile(sourceFilePath, JSON.stringify(initialBaseContent(sourceLocale), null, 2), 'utf-8');
    }
    const configContent = `export default {
  source: '${sourceLocale}',
  localesDir: '${localesDir}',
  targets: ${JSON.stringify(targets)},
};
`;
    await fs.writeFile(path.resolve(process.cwd(), 'i18nflow.config.ts'), configContent, 'utf-8');
    s.stop('Configuration generated.');
    outro(chalk.green(`Initialized in ${localesDir} with base ${sourceLocale}.json`));
});
program
    .command('add <locale>')
    .description('Add a new target locale')
    .action(async (locale) => {
    intro(chalk.inverse(` i18nflow add: ${locale} `));
    checkEnvKeys();
    const configPath = path.resolve(process.cwd(), 'i18nflow.config.ts');
    let config;
    try {
        config = await import(configPath);
    }
    catch {
        cancel('Configuration file i18nflow.config.ts not found. Run "i18nflow init" first.');
        process.exit(1);
    }
    const { localesDir, targets } = config.default;
    if (targets.includes(locale)) {
        cancel(`Locale "${locale}" is already registered in targets.`);
        process.exit(1);
    }
    const targetDirAbs = path.resolve(process.cwd(), localesDir);
    await fs.mkdir(targetDirAbs, { recursive: true });
    const targetFilePath = path.join(targetDirAbs, `${locale}.json`);
    try {
        await fs.access(targetFilePath);
        cancel(`File "${locale}.json" already exists on disk.`);
        process.exit(1);
    }
    catch {
        const s = spinner();
        s.start(`Translating base tree to ${locale}...`);
        const baseContentJSON = await fs.readFile(path.join(targetDirAbs, `${config.default.source}.json`), 'utf-8');
        const baseContent = JSON.parse(baseContentJSON);
        const translatedContent = await translateJSONTree(baseContent, config.default.source, locale);
        await fs.writeFile(targetFilePath, JSON.stringify(translatedContent, null, 2), 'utf-8');
        s.stop(`Translated and saved ${locale}.json`);
    }
    targets.push(locale);
    const updatedConfigContent = `export default {
  source: '${config.default.source}',
  localesDir: '${localesDir}',
  targets: ${JSON.stringify(targets)},
};
`;
    await fs.writeFile(configPath, updatedConfigContent, 'utf-8');
    outro(chalk.green(`Locale "${locale}" added and configuration updated.`));
});
program
    .command('sync')
    .description('Sync missing nested keys across target locales')
    .action(async () => {
    intro(chalk.inverse(' i18nflow sync '));
    checkEnvKeys();
    const configModule = await import(path.resolve(process.cwd(), 'i18nflow.config.ts'));
    const config = configModule.default || configModule;
    const localesDirAbs = path.resolve(process.cwd(), config.localesDir);
    const sourceFilePath = path.join(localesDirAbs, `${config.source}.json`);
    const sourceContent = JSON.parse(await fs.readFile(sourceFilePath, 'utf-8'));
    for (const target of config.targets) {
        const targetFilePath = path.join(localesDirAbs, `${target}.json`);
        let targetContent = {};
        try {
            targetContent = JSON.parse(await fs.readFile(targetFilePath, 'utf-8'));
        }
        catch {
            // Target file missing, treat as empty object
        }
        const missing = deepDiff(sourceContent, targetContent);
        if (Object.keys(missing).length === 0) {
            console.log(`  ${chalk.dim('·')} ${target}.json ${chalk.cyan('[synced]')}`);
            continue;
        }
        const s = spinner();
        s.start(`Syncing ${target}.json (${Object.keys(missing).length} root keys missing)...`);
        const translatedMissing = await translateJSONTree(missing, config.source, target);
        const merged = deepMerge(targetContent, translatedMissing);
        await fs.writeFile(targetFilePath, JSON.stringify(merged, null, 2), 'utf-8');
        s.stop(`Synced ${target}.json`);
    }
    outro(chalk.green('Sync process completed.'));
});
program
    .command('diff <locale>')
    .description('Show key differences against source locale')
    .action(async (locale) => {
    const configModule = await import(path.resolve(process.cwd(), 'i18nflow.config.ts'));
    const config = configModule.default || configModule;
    const localesDirAbs = path.resolve(process.cwd(), config.localesDir);
    const sourceFilePath = path.join(localesDirAbs, `${config.source}.json`);
    const targetFilePath = path.join(localesDirAbs, `${locale}.json`);
    let sourceContent = {};
    let targetContent = {};
    try {
        sourceContent = JSON.parse(await fs.readFile(sourceFilePath, 'utf-8'));
    }
    catch {
        cancel(`Source file "${config.source}.json" missing.`);
        process.exit(1);
    }
    try {
        targetContent = JSON.parse(await fs.readFile(targetFilePath, 'utf-8'));
    }
    catch {
        cancel(`Target file "${locale}.json" missing.`);
        process.exit(1);
    }
    const differences = deepDiff(sourceContent, targetContent);
    if (Object.keys(differences).length === 0) {
        console.log(chalk.green(`✓ ${locale}.json is up to date with ${config.source}.json`));
    }
    else {
        console.log(chalk.yellow(`⚠ Delta keys in ${locale}.json:`));
        console.log(JSON.stringify(differences, null, 2));
    }
});
program
    .command('remove <locale>')
    .description('Remove a target locale file')
    .action(async (locale) => {
    intro(chalk.inverse(` i18nflow remove: ${locale} `));
    const configModule = await import(path.resolve(process.cwd(), 'i18nflow.config.ts'));
    const config = configModule.default || configModule;
    const localesDirAbs = path.resolve(process.cwd(), config.localesDir);
    const targetFilePath = path.join(localesDirAbs, `${locale}.json`);
    const updatedTargets = config.targets.filter((t) => t !== locale);
    await fs.writeFile(path.resolve(process.cwd(), 'i18nflow.config.ts'), `export default {
  source: '${config.source}',
  localesDir: '${config.localesDir}',
  targets: ${JSON.stringify(updatedTargets)},
};
`, 'utf-8');
    try {
        await fs.unlink(targetFilePath);
        outro(chalk.green(`Removed ${locale}.json and updated config targets.`));
    }
    catch {
        cancel(`Target file "${targetFilePath}" not found on disk.`);
        process.exit(1);
    }
});
program.parse();
function initialBaseContent(locale) {
    switch (locale) {
        case 'en':
            return { hello: 'Hello' };
        case 'es':
            return { hello: 'Hola' };
        case 'fr':
            return { hello: 'Bonjour' };
        default:
            return { hello: locale };
    }
}
function checkEnvKeys() {
    if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
        cancel('Missing API keys. Please set GEMINI_API_KEY or GROQ_API_KEY in your .env file.');
        process.exit(1);
    }
}
