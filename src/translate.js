import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { cancel } from '@clack/prompts';
import chalk from 'chalk';
dotenv.config();
function getClients() {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!geminiApiKey && !groqApiKey) {
        cancel('Missing API keys. Please set GEMINI_API_KEY or GROQ_API_KEY in your .env file.');
        process.exit(1);
    }
    return {
        gemini: geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null,
        groq: groqApiKey
            ? new OpenAI({
                apiKey: groqApiKey,
                baseURL: 'https://api.groq.com/openai/v1',
            })
            : null,
    };
}
function cleanJsonString(raw) {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : raw.replace(/```json/g, '').replace(/```/g, '').trim();
}
async function translateWithGemini(prompt, client) {
    const res = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
    });
    return res.text || '{}';
}
async function translateWithGroq(prompt, client) {
    const completion = await client.chat.completions.create({
        model: 'groq/compound-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
    });
    return completion.choices[0]?.message?.content || '{}';
}
export async function translateJSONTree(sourceObj, baseLang, targetLang) {
    const { gemini, groq } = getClients();
    const prompt = `Translate the JSON values from ${baseLang} to ${targetLang}. 
Keep exact same JSON keys, nested structure, and placeholders like {{name}}. 
Return ONLY valid JSON, no markdown blocks.

JSON:
${JSON.stringify(sourceObj, null, 2)}`;
    let rawText = '';
    if (gemini) {
        try {
            rawText = await translateWithGemini(prompt, gemini);
        }
        catch (err) {
            const shortErr = formatAiError(err);
            console.log(chalk.yellow(`· Gemini failed (${shortErr}), routing to Groq fallback...`));
            if (!groq)
                throw new Error('Groq key not configured for fallback');
            try {
                rawText = await translateWithGroq(prompt, groq);
            }
            catch (groqErr) {
                const shortGroqErr = formatAiError(groqErr);
                console.error(chalk.red(`× Groq fallback also failed (${shortGroqErr})`));
                throw groqErr;
            }
        }
    }
    else if (groq) {
        rawText = await translateWithGroq(prompt, groq);
    }
    else {
        throw new Error('No AI provider available.');
    }
    return JSON.parse(cleanJsonString(rawText));
}
export function deepDiff(source, target) {
    const diff = {};
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            const nested = deepDiff(source[key], target[key] || {});
            if (Object.keys(nested).length > 0) {
                diff[key] = nested;
            }
        }
        else if (target[key] === undefined) {
            diff[key] = source[key];
        }
    }
    return diff;
}
export function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        }
        else {
            result[key] = source[key];
        }
    }
    return result;
}
function formatAiError(err) {
    const status = err?.status || err?.error?.code || 'ERROR';
    if (status === 429 || status === 'RESOURCE_EXHAUSTED') {
        return 'rate limit (429)';
    }
    if (status === 503) {
        return 'service unavailable (503)';
    }
    return err?.error?.message ? `code ${status}` : String(status);
}
