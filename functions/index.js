// StudyPal server-side AI.
// The Gemini key lives only here, as a Secret Manager secret. The browser calls the `ai`
// callable function, which checks the caller is signed in, validates the request, applies
// a per-user rate limit, then talks to Gemini.

import { setGlobalOptions } from 'firebase-functions';
import { onCall, HttpsError } from 'firebase-functions/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';

initializeApp();
const db = getFirestore();

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const MODEL = 'gemini-2.5-flash';

// Caps how many instances can run at once, so a burst of abuse can't scale costs without bound.
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

// ─────────────────────────────────────────────────────────────────────────────
// Limits
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMIT_PER_HOUR = 60;            // AI requests per user per hour, on every plan
const MAX_TEXT_CHARS = 2_000_000;          // a few hundred pages of notes
const MAX_INLINE_CHARS = 27_000_000;       // base64 images/scanned PDFs, ~20 MB decoded (Gemini inline cap)
const MAX_CHAT_HISTORY_CHARS = 2_000_000;
const MAX_QUIZ_QUESTIONS = 30;
const MAX_FLASHCARDS = 40;
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
// Scanned PDFs have no text layer, so they're sent to Gemini as the file itself.
const DOCUMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf'];

// Reviewer sizing. Gemini 2.5 Flash reads ~1M tokens but writes at most 65,536, so long
// documents are written in parts. Overridable through env vars for local testing.
const REVIEWER_SINGLE_PASS_CHARS = Number(process.env.REVIEWER_SINGLE_PASS_CHARS) || 90_000;  // ~40 slides/pages
const REVIEWER_PART_CHARS = Number(process.env.REVIEWER_PART_CHARS) || 60_000;
const REVIEWER_MAX_PARTS = 12;
const REVIEWER_CONCURRENCY = 8;   // a 150-page document is about 7 parts, so they all run at once

const fail = (message) => { throw new HttpsError('invalid-argument', message); };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * generateContent with retries for rate limits and transient Gemini errors.
 */
const isRetryable = (e) => [429, 500, 502, 503, 504].includes(Number(e?.status || e?.code))
    || /overloaded|unavailable|rate limit|resource exhausted|deadline/i.test(e?.message || '');

const backoff = (attempt) => sleep(2000 * 3 ** attempt + Math.random() * 1000);

const generate = async (ai, params, retries = 3) => {
    for (let attempt = 0; ; attempt++) {
        try {
            return await ai.models.generateContent(params);
        } catch (e) {
            if (!isRetryable(e) || attempt >= retries) throw e;
            await backoff(attempt);
        }
    }
};

/**
 * Run `fn` over `items` with at most `limit` running at once, keeping order.
 */
const mapLimit = async (items, limit, fn) => {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
};

/**
 * Consume one request from the caller's hourly allowance, or throw resource-exhausted.
 * Stored in aiRateLimits/{uid}, which only the Admin SDK writes.
 */
const consumeRateLimit = async (uid) => {
    const ref = db.collection('aiRateLimits').doc(uid);
    const now = Date.now();
    const hour = 60 * 60 * 1000;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};
        const windowStart = data.windowStart?.toMillis?.() || 0;

        if (now - windowStart >= hour) {
            tx.set(ref, { windowStart: Timestamp.fromMillis(now), count: 1 });
            return;
        }
        if ((data.count || 0) >= RATE_LIMIT_PER_HOUR) {
            const minutes = Math.ceil((windowStart + hour - now) / 60000);
            throw new HttpsError('resource-exhausted', `Too many AI requests. Try again in ${minutes} min.`);
        }
        tx.update(ref, { count: FieldValue.increment(1) });
    });
};

/**
 * Log one AI request for the admin dashboard. Never throws.
 */
const logAIUsage = async (auth, feature, itemCount) => {
    try {
        const userId = auth.uid;
        const userEmail = auth.token.email || 'unknown';
        await db.collection('aiUsageLogs').add({
            userId,
            userEmail,
            feature,
            model: MODEL,
            itemCount: itemCount || 0,
            timestamp: FieldValue.serverTimestamp(),
        });
        await db.collection('userStats').doc(userId).set({
            userId,
            email: userEmail,
            totalCalls: FieldValue.increment(1),
            [`${feature}Calls`]: FieldValue.increment(1),
            lastActiveAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    } catch (e) {
        logger.warn('AI usage log failed (non-critical)', e);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Input helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a document payload from the browser and flatten it to a list of items.
 * Accepts a string, { type: 'text', data }, { type: 'inline', mimeType, data } for images and
 * scanned PDFs, or { type: 'parts', items: [...] } for several uploaded files.
 */
const documentItems = (payload) => {
    if (typeof payload === 'string') payload = { type: 'text', data: payload };
    const items = payload?.type === 'parts' && Array.isArray(payload.items) ? payload.items : [payload];
    if (items.length === 0) fail('Missing document content.');

    let textChars = 0;
    let inlineChars = 0;
    for (const item of items) {
        if (!item || typeof item.data !== 'string') fail('Missing document content.');
        if (item.type === 'text') {
            textChars += item.data.length;
        } else if (item.type === 'inline') {
            if (!DOCUMENT_MIME_TYPES.includes(item.mimeType)) fail('Unsupported file type.');
            inlineChars += item.data.length;
        } else {
            fail('Unsupported document payload.');
        }
    }
    if (textChars > MAX_TEXT_CHARS) fail('This document is too large.');
    if (inlineChars > MAX_INLINE_CHARS) fail('These images or scanned pages are too large. Try fewer pages at a time.');
    return items;
};

/**
 * Turn a document payload into Gemini parts.
 */
const documentParts = (payload) => documentItems(payload).map((item) => (
    item.type === 'text'
        ? { text: `Document Text:\n${item.data}` }
        : { inlineData: { data: item.data, mimeType: item.mimeType } }
));

/**
 * The document as one string if it is text only, otherwise null.
 */
const documentText = (payload) => {
    const items = documentItems(payload);
    return items.every((item) => item.type === 'text') ? items.map((item) => item.data).join('\n\n') : null;
};

/**
 * Validate chat message parts: text, or inline images.
 */
const chatParts = (parts) => {
    if (typeof parts === 'string') parts = [{ text: parts }];
    if (!Array.isArray(parts) || parts.length === 0) fail('Empty message.');
    return parts.map((part) => {
        if (typeof part?.text === 'string') return { text: part.text };
        const inline = part?.inlineData;
        if (inline && typeof inline.data === 'string' && IMAGE_MIME_TYPES.includes(inline.mimeType)) {
            return { inlineData: { data: inline.data, mimeType: inline.mimeType } };
        }
        fail('Unsupported message part.');
    });
};

const partsSize = (parts) => parts.reduce((n, p) => n + (p.text?.length || p.inlineData?.data.length || 0), 0);

/**
 * Clean up markdown json block wrappers from LLM response
 */
const cleanJSONResponse = (text) => {
    let clean = (text || '').trim();
    clean = clean.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    const arrStart = clean.indexOf('[');
    const arrEnd = clean.lastIndexOf(']');
    const objStart = clean.indexOf('{');
    const objEnd = clean.lastIndexOf('}');

    // Use whichever comes first, so an object that contains arrays isn't cut down to one of them.
    const objectFirst = objStart !== -1 && (arrStart === -1 || objStart < arrStart);
    if (!objectFirst && arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
        clean = clean.substring(arrStart, arrEnd + 1);
    } else if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
        clean = clean.substring(objStart, objEnd + 1);
    }

    try {
        return JSON.parse(clean);
    } catch {
        logger.error('JSON parsing failed on LLM output', { text: (text || '').slice(0, 500) });
        throw new Error('The AI model returned conversational text rather than clean JSON.');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Tasks
// ─────────────────────────────────────────────────────────────────────────────

// ── Reviewer ────────────────────────────────────────────────────────────────
// The house style mirrors a good med/engineering "trans": numbered topic sections, short bullets,
// comparison tables, typed callouts (rendered by src/utils/reviewerMarkdown.js), worked examples
// and a short recall check per section. The renderer numbers headings and lays out columns,
// so the model only has to get the structure right.

const REVIEWER_STYLE = `You write study reviewers ("trans") that students print and study from. Output GitHub-flavored Markdown in the house style below. StudyPal renders it, so follow the style exactly.

ACCURACY
- Use only facts from the source. You may add a short clarifying phrase for a term, but never invent values, doses, numbers, dates, names, formulas or references.
- Keep every number, unit, dose, threshold, classification, formula, list and named step from the source. Keep the source's terminology and language (if the source mixes English and Filipino, you may too).
- Cover every topic in the source, in the source's order. Condense the wording, never drop content. Skip only filler: greetings, slide numbers, footers, repeated headers, tables of contents.

STRUCTURE
- "## Heading" for each major topic, "### Heading" for subtopics. Do not number headings; StudyPal numbers them. Never use "####" or deeper, and never use a bold line as a fake heading.
- Under each heading write short bullets: one idea per bullet, at most about two lines, in a compact note-taking style. Nest at most one level. Use a numbered list only for ordered steps or sequences.
- A short paragraph (up to 3 sentences) may introduce a topic. No walls of text.
- Bold a key term (**term**) where it is defined. At most one or two bold phrases per bullet.

TABLES: use one whenever two or more items are compared on two or more attributes
- For example: types and classifications; drugs (Drug | Class | Mechanism | Uses | Adverse effects); differentials; signs vs. symptoms; left- vs. right-sided; formulas (Quantity | Formula | Units | Notes); material properties; algorithm comparisons.
- 2 to 5 columns. Short phrases in cells, not paragraphs. No lists or line breaks inside a cell; separate items with "; ". Every row has the same number of cells as the header.
- Write tables compactly: one space around cell text, no padding for alignment, and a separator row of exactly "| --- | --- |" with one "---" per column.
- Leave a blank line before and after every table.

MATH, SCIENCE AND ENGINEERING
- Use LaTeX for every formula, variable, unit expression and chemical formula. Inline: $...$. Display: "$$" on its own line, then the formula, then "$$" on its own line, with blank lines around the block.
- Keep each display formula short enough for half a page width; split long derivations into several lines or steps.
- After a key formula, list each symbol with its meaning and units.
- Never use "$" for money; write PHP 500 or ₱500.

CALLOUTS: a blockquote whose first line is one of these markers. Use only these.
> [!HIGHYIELD]
> The few facts most likely to be tested. At most one per ## section.

> [!PEARL] Optional short title
> A clinical pearl, practical insight, real-world application or "why it matters".

> [!MNEMONIC] Optional short title
> Only a mnemonic that is in the source or is widely established. Spell out what each letter stands for.

> [!PITFALL]
> Common mistakes, look-alikes that get confused, exceptions, contraindications.

> [!FORMULA] Optional short title
> A key formula and its variables, for formula-heavy topics.

> [!EXAMPLE] Optional short title
> A worked example or solved problem, laid out as **Given:**, **Find:**, **Solution:** (numbered steps, one equation per step) and **Answer:** (with units).

> [!CHECK]
> - A recall question? → its short answer

- End every ## section with one [!CHECK] callout of 2 to 4 recall questions on that section's most important points, each written as "question → answer".
- Every line of a callout starts with "> ". Keep callouts short (about 6 lines at most), except EXAMPLE.

NEVER
- No HTML tags, images, links, emojis, horizontal rules, or code fences unless the source contains real code.
- No conversational text such as "Here is your reviewer". Output only the reviewer.`;

const REVIEWER_HIGHLIGHT = `

HIGHLIGHT MODE
- Mark the single most testable phrase of a bullet with ==double equals==, for example ==EF below 40%==. Use it on at most one phrase every two or three bullets, never on a whole sentence.`;

const REVIEWER_WHOLE_LAYOUT = `

DOCUMENT LAYOUT
1. "# Title": the subject and topic from the source.
2. One "#### " line with course, lecturer, date or source details found in the source, separated by " | ". Leave this line out if the source has none.
3. "> [!NOTE] At a glance", then 3 to 6 bullets: what this covers and the learning objectives ("You should be able to ...").
4. The ## topic sections, each ending with its [!CHECK].
5. "## High-yield recap": 8 to 15 bullets with the most testable facts from the whole document, and no [!CHECK] after it.`;

const reviewerPartLayout = (part, total) => `

THIS IS PART ${part} OF ${total}
The source was split into ${total} parts that are written separately and then joined in order. Write only this part.
- Output only ## sections (with their ### subsections, tables and callouts) for the content in this part.
- No "# " title, no "#### " line, no "At a glance" and no recap; those are added separately.
- If this part begins or ends in the middle of a topic, still give that content a ## heading named after the topic.`;

const REVIEWER_CONFIG = {
    temperature: 0.3,
    thinkingConfig: { thinkingBudget: 1024 },
};
// A part of ~60k characters needs about 8k tokens of reviewer. The caps leave plenty of room
// while making a stuck response stop in about a minute rather than several.
const PART_MAX_TOKENS = 24_576;
const WHOLE_MAX_TOKENS = 40_960;
// After this long, stop splitting and rewriting parts, so the request finishes well inside
// the function's 540 s timeout.
const REVIEWER_RETRY_UNTIL_MS = 330_000;

// The same character, or the same short run like "| :--- ", repeated over and over means the
// model got stuck, usually padding a table separator, and would only stop at its output cap.
const RUNAWAY = /(.)\1{400,}|(.{2,16}?)\2{80,}/;

/**
 * Stream a response, and stop as soon as it starts repeating itself.
 * Returns { text, stop }: stop is Gemini's finish reason, or 'RUNAWAY'.
 */
const streamText = async (ai, params, retries = 3) => {
    for (let attempt = 0; ; attempt++) {
        const controller = new AbortController();
        let text = '';
        let stop = null;
        try {
            const stream = await ai.models.generateContentStream({
                ...params,
                config: { ...params.config, abortSignal: controller.signal },
            });
            for await (const chunk of stream) {
                text += chunk.text || '';
                stop = chunk.candidates?.[0]?.finishReason || stop;
                if (RUNAWAY.test(text.slice(-2000))) {
                    controller.abort();
                    return { text, stop: 'RUNAWAY' };
                }
            }
            return { text, stop };
        } catch (e) {
            if (!isRetryable(e) || attempt >= retries) throw e;
            await backoff(attempt);
        }
    }
};

/**
 * Strip wrappers the model sometimes adds (a code fence around everything, a chatty first line)
 * and collapse padded or runaway table rows.
 */
const cleanReviewerMarkdown = (text) => {
    let md = (text || '').trim();
    md = md.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1').trim();
    const firstBlock = md.search(/^(#|>)/m);
    if (firstBlock > 0 && firstBlock < 400 && /^(here|sure|okay|ok|below|certainly)\b/i.test(md)) {
        md = md.slice(firstBlock);
    }
    return md
        .split('\n')
        .map((line) => {
            if (/^\s*(?:>\s*)*\|/.test(line)) {
                line = line.replace(/(:?)-{4,}(:?)/g, '$1---$2').replace(/ {2,}/g, ' ');
            }
            return line.replace(/(.)\1{200,}/g, '$1$1$1');
        })
        // Whatever is still enormous is the tail of a runaway response, not content.
        .filter((line) => line.length < 6000)
        .join('\n');
};

/**
 * Split long text into parts of about `size` characters, cutting at a page marker,
 * then a blank line, then a line break, so no part starts mid-sentence.
 */
const splitText = (text, size) => {
    const parts = [];
    let start = 0;
    while (start < text.length) {
        let end = Math.min(start + size, text.length);
        if (end < text.length) {
            const searchFrom = start + Math.floor(size * 0.6);
            const window = text.slice(searchFrom, end);
            for (const re of [/\n--- Page \d+ ---\n/g, /\n[ \t]*\n/g, /\n/g]) {
                let last = -1;
                for (const m of window.matchAll(re)) last = m.index;
                if (last !== -1) { end = searchFrom + last; break; }
            }
        }
        parts.push(text.slice(start, end));
        start = end;
    }
    return parts;
};

const finishedEarly = (result) => result.stop === 'MAX_TOKENS';

/**
 * The part of a runaway response written before it got stuck, cut at a line break. A table it
 * was in the middle of is dropped, so the continuation can write that content afresh.
 */
const keepBeforeRunaway = (text) => {
    const match = text.match(RUNAWAY);
    if (!match) return text;
    const lines = text.slice(0, match.index).split('\n').slice(0, -1);
    while (lines.length && /^\s*(?:>\s*)*\|/.test(lines[lines.length - 1])) lines.pop();
    return lines.join('\n').trimEnd();
};

/**
 * Append a continuation, dropping its opening lines if they repeat the end of what was kept
 * (the model tends to restart the heading or sentence it was on).
 */
const joinContinuation = (written, next) => {
    const tail = new Set(written.split('\n').slice(-12).map((l) => l.trim()).filter(Boolean));
    const lines = next.split('\n');
    let start = 0;
    while (start < lines.length && (!lines[start].trim() || tail.has(lines[start].trim()))) start++;
    return [written, lines.slice(start).join('\n')].filter(Boolean).join('\n\n');
};

const CONTINUE_AFTER_RUNAWAY =`Your reply above broke off while you were writing a table: you started padding the cells with spaces. Continue the reviewer from exactly where the text above ends and cover the rest of the source, in the same style. Don't repeat anything already written. From here on, write comparisons as bullet lists instead of tables.`;

/**
 * Stream a reviewer response. Gemini sometimes pads a Markdown table with spaces until it runs
 * out of output, and does so again on a retry at the same spot. So when that happens, keep what
 * it wrote before getting stuck and have it continue from there without tables.
 */
const writeWithRecovery = async (ai, contents, config) => {
    let written = '';
    let result = await streamText(ai, { model: MODEL, contents, config });
    for (let attempt = 0; result.stop === 'RUNAWAY' && attempt < 3; attempt++) {
        written = joinContinuation(written, keepBeforeRunaway(result.text));
        logger.info('Reviewer runaway, continuing', { attempt, keptChars: written.length });
        result = await streamText(ai, {
            model: MODEL,
            contents: [
                ...contents,
                { role: 'model', parts: [{ text: written }] },
                { role: 'user', parts: [{ text: CONTINUE_AFTER_RUNAWAY }] },
            ],
            config,
        });
    }
    const last = result.stop === 'RUNAWAY' ? keepBeforeRunaway(result.text) : result.text;
    return { text: joinContinuation(written, last), stop: result.stop === 'RUNAWAY' ? 'STOP' : result.stop };
};

/**
 * Write the ## sections for one part. If the model runs out of output room, split the part
 * in two and write each half, so nothing is silently cut off.
 */
const writeReviewerPart = async (ai, text, part, total, highlight, retryUntil, depth = 0) => {
    const instruction = REVIEWER_STYLE + (highlight ? REVIEWER_HIGHLIGHT : '') + reviewerPartLayout(part, total);
    const started = Date.now();
    const result = await writeWithRecovery(
        ai,
        [{ role: 'user', parts: [{ text: instruction }, { text: `Document Text (part ${part} of ${total}):\n${text}` }] }],
        { ...REVIEWER_CONFIG, maxOutputTokens: PART_MAX_TOKENS },
    );
    logger.info('Reviewer part', {
        part, total, depth, inChars: text.length, outChars: result.text.length, stop: result.stop,
        secs: Math.round((Date.now() - started) / 1000),
    });
    if (finishedEarly(result) && depth < 2 && text.length > 8_000 && Date.now() < retryUntil) {
        const halves = splitText(text, Math.ceil(text.length / 2));
        const written = await Promise.all(halves.map((half) =>
            writeReviewerPart(ai, half, part, total, highlight, retryUntil, depth + 1)));
        return written.join('\n\n');
    }
    return cleanReviewerMarkdown(result.text);
};

/**
 * Title, header line, "At a glance" and recap for a reviewer written in parts.
 */
const writeReviewerFrame = async (ai, sourceText, body) => {
    const outline = body.split('\n').filter((line) => /^#{2,3} /.test(line)).join('\n');
    const highYield = [...body.matchAll(/^> \[!HIGHYIELD\][^\n]*\n((?:>[^\n]*\n?)+)/gm)]
        .map((m) => m[1].replace(/^> ?/gm, '').trim())
        .join('\n')
        .slice(0, 40_000);

    // Markdown rather than JSON: recap bullets are full of LaTeX, and "\alpha" or "\frac" inside a
    // JSON string is an invalid or silently wrong escape.
    const instruction = `You are finishing a study reviewer that was written in parts. From the opening of the source document, the reviewer's outline and its high-yield notes, write exactly this Markdown and nothing else:

# <a short title naming the subject and the topics of the whole outline>
#### <course | lecturer | lecture date | school, only those the opening text states>

> [!NOTE] At a glance
> - <3 to 6 bullets on what the reviewer covers and its learning objectives: "You should be able to ...">

## High-yield recap

- <8 to 15 bullets with the most testable facts across the whole reviewer, taken from the high-yield notes and outline>

Replace each <...> with the content it describes. Leave out the "#### " line entirely unless the opening text names a course, lecturer, lecture date or school; dates and organisations mentioned inside the material don't count. Bullets may use **bold** and $LaTeX$. Use only facts from the inputs.`;

    try {
        const result = await generate(ai, {
            model: MODEL,
            contents: [{ role: 'user', parts: [
                { text: instruction },
                { text: `Opening of the source:\n${sourceText.slice(0, 12_000)}` },
                { text: `Reviewer outline:\n${outline}` },
                { text: `High-yield notes:\n${highYield}` },
            ] }],
            config: { temperature: 0.3, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 512 } },
        });
        const frame = cleanReviewerMarkdown(result.text)
            .replace(/^# +(?:\*\*)?Title:?(?:\*\*)?:? */im, '# ')
            .replace(/^#{1,6}[ \t]*$/gm, '');
        const recapAt = frame.search(/^## /m);
        const head = (recapAt === -1 ? frame : frame.slice(0, recapAt)).trim();
        return {
            head: /^# /m.test(head) ? head : `# Reviewer\n\n${head}`.trim(),
            tail: recapAt === -1 ? '' : frame.slice(recapAt).trim(),
        };
    } catch (e) {
        logger.warn('Reviewer frame failed, using a plain title', e);
        return { head: '# Reviewer', tail: '' };
    }
};

/**
 * Write a reviewer in parts for documents too long for one response.
 */
const writeReviewerInParts = async (ai, text, highlight, partSize, retryUntil) => {
    const size = Math.max(partSize, Math.ceil(text.length / REVIEWER_MAX_PARTS));
    const chunks = splitText(text, size);
    const parts = await mapLimit(chunks, REVIEWER_CONCURRENCY, (chunk, i) =>
        writeReviewerPart(ai, chunk, i + 1, chunks.length, highlight, retryUntil));
    const body = parts.filter(Boolean).join('\n\n');
    const { head, tail } = await writeReviewerFrame(ai, text, body);
    return [head, body, tail].filter(Boolean).join('\n\n');
};

const generateReviewer = async (ai, { payload, highlightFocus }) => {
    const highlight = !!highlightFocus;
    const text = documentText(payload);
    const retryUntil = Date.now() + REVIEWER_RETRY_UNTIL_MS;

    if (text !== null && text.length > REVIEWER_SINGLE_PASS_CHARS) {
        return { result: await writeReviewerInParts(ai, text, highlight, REVIEWER_PART_CHARS, retryUntil), itemCount: 0 };
    }

    // Short documents, images and scanned PDFs: one pass sees everything at once.
    const instruction = REVIEWER_STYLE + (highlight ? REVIEWER_HIGHLIGHT : '') + REVIEWER_WHOLE_LAYOUT;
    const result = await writeWithRecovery(
        ai,
        [{ role: 'user', parts: [{ text: instruction }, ...documentParts(payload)] }],
        { ...REVIEWER_CONFIG, maxOutputTokens: WHOLE_MAX_TOKENS },
    );

    // Dense text that didn't fit in one response: redo it in smaller parts.
    if (finishedEarly(result) && text !== null && Date.now() < retryUntil) {
        const partSize = Math.max(20_000, Math.ceil(text.length / 3));
        return { result: await writeReviewerInParts(ai, text, highlight, partSize, retryUntil), itemCount: 0 };
    }
    return { result: cleanReviewerMarkdown(result.text), itemCount: 0 };
};

const QUIZ_FORMATS = {
    'mixed': {
        instruction: `The quiz must include a mix of these types: Multiple Choice, Identification (Short answer), Enumeration, and Situational (Scenario based).`,
        rules: `Return the output strictly as a JSON array of objects with this structure formats depending on the type:
[
  { "type": "multiple-choice", "question": "...", "options": ["A", "B", "C", "D"], "answer": "The correct option text" },
  { "type": "identification", "question": "...", "answer": "The expected short answer" },
  { "type": "enumeration", "question": "Enumerate the [X] items/steps/things related to...", "answer": "1. Item one\\n2. Item two\\n3. Item three" },
  { "type": "situational", "question": "...", "options": ["A", "B", "C", "D"], "answer": "Correct option text" }
]`,
    },
    'multiple-choice': {
        instruction: `The quiz must only contain Multiple Choice questions.`,
        rules: `Return strictly as a JSON array: [{"type": "multiple-choice", "question": "...", "options": ["A","B","C","D"], "answer": "Option text"}]`,
    },
    'identification': {
        instruction: `The quiz must only contain Identification (Short answer) questions.`,
        rules: `Return strictly as a JSON array: [{"type": "identification", "question": "...", "answer": "Expected exact answer text"}]`,
    },
    'enumeration': {
        instruction: `The quiz must only contain Enumeration questions where students must list a complete set of items, steps, or elements.`,
        rules: `Return strictly as a JSON array: [{"type": "enumeration", "question": "Enumerate the [X] items/steps related to...", "answer": "1. Item one\\n2. Item two\\n3. Item three"}]`,
    },
    'situational': {
        instruction: `The quiz must only contain Situational (Scenario based) questions.`,
        rules: `Return strictly as a JSON array: [{"type": "situational", "question": "A scenario...", "options": ["A","B","C","D"], "answer": "Correct option text"}]`,
    },
};

const DIFFICULTY_HINTS = {
    easy: 'Focus on direct recall and basic facts.',
    medium: 'Include some application and deeper understanding questions.',
    hard: 'Focus on complex situational scenarios and synthesis of concepts.',
};

const BATCH_SIZE = 10;

/**
 * Generate `total` items in batches of 10, telling the model which items already exist so
 * later batches don't repeat them. Stops early if a batch fails, like the original client code.
 */
const generateInBatches = async (ai, total, docParts, buildInstruction, keyOf) => {
    let items = [];
    let remaining = total;

    while (remaining > 0) {
        const batchSize = Math.min(remaining, BATCH_SIZE);
        try {
            const result = await generate(ai, {
                model: MODEL,
                contents: [{ role: 'user', parts: [{ text: buildInstruction(batchSize, items) }, ...docParts] }],
                config: { responseMimeType: 'application/json' },
            });
            const batch = cleanJSONResponse(result.text);
            if (Array.isArray(batch)) items = [...items, ...batch];
        } catch (e) {
            logger.error('Generation batch error', e);
            break;
        }
        remaining -= batchSize;
    }

    // Final dedup (case-insensitive), then trim to exact count
    const seen = new Set();
    return items.filter((item) => {
        const key = String(keyOf(item) || '').toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, total);
};

const generateQuiz = async (ai, { payload, difficulty, numQuestions, questionType }) => {
    const format = QUIZ_FORMATS[questionType] || QUIZ_FORMATS.mixed;
    const diffInstruction = DIFFICULTY_HINTS[difficulty] || '';
    const total = Math.max(1, Math.min(parseInt(numQuestions) || 5, MAX_QUIZ_QUESTIONS));
    const docParts = documentParts(payload);

    const questions = await generateInBatches(ai, total, docParts, (batchSize, done) => {
        const exclusionHint = done.length > 0
            ? `\n\nAVOID REPEATING these already-generated topics (do NOT ask about them again):\n${done.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}`
            : '';
        return `You are a quiz generator. Your ONLY job is to output a JSON array.
Generate EXACTLY ${batchSize} quiz questions from the document — no more, no less.
Difficulty: ${difficulty}. ${diffInstruction}
${format.instruction}
${exclusionHint}

RULES:
1. Output EXACTLY ${batchSize} elements in the JSON array.
2. Each question MUST be on a DIFFERENT topic — no duplicates.
3. Output ONLY the raw JSON array. Do NOT wrap in markdown code fences or conversational text.

${format.rules}`;
    }, (q) => q.question);

    return { result: questions, itemCount: questions.length };
};

const generateFlashcards = async (ai, { payload, numCards }) => {
    const total = Math.max(1, Math.min(parseInt(numCards) || 10, MAX_FLASHCARDS));
    const docParts = documentParts(payload);

    const cards = await generateInBatches(ai, total, docParts, (batchSize, done) => {
        const exclusionHint = done.length > 0
            ? `\n\nAVOID REPEATING these already-generated concepts (do NOT create cards for them again):\n${done.map((c, i) => `${i + 1}. ${c.front}`).join('\n')}`
            : '';
        return `You are a flashcard generator. Your ONLY job is to output a JSON array.
Extract EXACTLY ${batchSize} key concepts and their definitions from the document below.
${exclusionHint}

IMPORTANT RULES:
1. The JSON array MUST contain EXACTLY ${batchSize} elements.
2. Each flashcard MUST cover a DIFFERENT concept — no duplicates.
3. Output ONLY the raw JSON array. Do NOT wrap in markdown code fences or conversational text.

Strict JSON format:
[
  { "front": "Concept or Question", "back": "Definition or Answer" }
]`;
    }, (c) => c.front);

    return { result: cards, itemCount: cards.length };
};

const CHAT_SYSTEM_INSTRUCTION = "You are StudyPal's AI assistant. You help students understand study material, explain difficult concepts clearly, and act like a friendly, encouraging tutor. Keep responses clean, well-formatted, and use markdown where helpful.";

const chat = async (ai, { history, message }) => {
    if (!Array.isArray(history)) history = [];
    const contents = history.map((h) => ({
        role: h?.role === 'model' ? 'model' : 'user',
        parts: chatParts(h?.parts),
    }));
    contents.push({ role: 'user', parts: chatParts(message) });

    const size = contents.reduce((n, c) => n + partsSize(c.parts), 0);
    if (size > MAX_CHAT_HISTORY_CHARS + MAX_INLINE_CHARS) fail('This conversation is too long. Start a new chat.');

    const result = await generate(ai, {
        model: MODEL,
        contents,
        config: { systemInstruction: CHAT_SYSTEM_INSTRUCTION },
    });
    return { result: result.text || '', itemCount: 0 };
};

const TASKS = {
    reviewer: generateReviewer,
    quiz: generateQuiz,
    flashcards: generateFlashcards,
    chat,
};

// ─────────────────────────────────────────────────────────────────────────────
// Callable
// ─────────────────────────────────────────────────────────────────────────────

export const ai = onCall({
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 540,   // long reviewers are written in several parts
    memory: '1GiB',
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in to use AI features.');

    const { task, ...params } = request.data || {};
    const run = TASKS[task];
    if (!run) fail('Unknown AI task.');

    await consumeRateLimit(request.auth.uid);

    const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
    try {
        const { result, itemCount } = await run(client, params);
        await logAIUsage(request.auth, task, itemCount);
        return { result };
    } catch (e) {
        if (e instanceof HttpsError) throw e;
        logger.error(`AI task "${task}" failed`, e);
        throw new HttpsError('internal', 'The AI service could not complete this request. Please try again.');
    }
});
