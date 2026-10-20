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
const MAX_INLINE_CHARS = 25_000_000;       // base64 image, ~18 MB decoded
const MAX_CHAT_HISTORY_CHARS = 2_000_000;
const MAX_QUIZ_QUESTIONS = 30;
const MAX_FLASHCARDS = 40;
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const fail = (message) => { throw new HttpsError('invalid-argument', message); };

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
 * Turn a document payload from the browser into Gemini parts.
 * Accepts a string, { type: 'text', data }, or { type: 'inline', mimeType, data } for images.
 */
const documentParts = (payload) => {
    if (typeof payload === 'string') payload = { type: 'text', data: payload };
    if (!payload || typeof payload.data !== 'string') fail('Missing document content.');

    if (payload.type === 'text') {
        if (payload.data.length > MAX_TEXT_CHARS) fail('This document is too large.');
        return [{ text: `Document Text:\n${payload.data}` }];
    }
    if (payload.type === 'inline') {
        if (!IMAGE_MIME_TYPES.includes(payload.mimeType)) fail('Unsupported file type.');
        if (payload.data.length > MAX_INLINE_CHARS) fail('This image is too large.');
        return [{ inlineData: { data: payload.data, mimeType: payload.mimeType } }];
    }
    fail('Unsupported document payload.');
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

    if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
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

const generateReviewer = async (ai, { payload, highlightFocus }) => {
    const instruction = `You are an expert tutor formatting a study guide for PDF export.
CRITICAL INSTRUCTION: Output ONLY the markdown content for the reviewer. Do NOT add conversational openers/closers.
Follow this EXACT markdown structure styling for the output:
1. Start with a single "# [Subject Name] (Lecture)" as the main title.
2. Under the title, add "#### [Professor/Instructor] | [Year/Course] | [Semester]" if applicable, otherwise just generic info.
3. Use "## [Main Topic Name]" for major topic headers.
4. Use "### [Subtopic Name]" for subtopic headers.
5. Use "> [Topic Overview or important structural summary blocks]" (blockquotes) for Topic Overviews.
6. Use bullet points ("-") for lists.
7. Format comparisons, parameters, and structured academic data using clean markdown tables.
8. For mathematical formulas, equations, variables, and quantitative problems, use standard LaTeX notation. Wrap block equations in "$$" (double dollar signs, on separate lines) and inline equations/variables in "$" (single dollar signs). E.g. $$E = mc^2$$ or $x^2 + y^2 = r^2$.
9. For math problems and quantitative concepts, provide a detailed step-by-step breakdown with explanation and clear rendering of formulas.
10. Format the content cleanly into these sections.${highlightFocus ? '\n11. HIGHLIGHT FOCUS IS ENABLED: You MUST heavily highlight and emphasize important information throughout the entire document. Use **bold** for key terms, definitions, critical formulas, important dates, and primary concepts so they stand out immediately to a student scanning the page. Use ==highlight== syntax or HTML <mark> tags if necessary for extreme emphasis.' : ''}`;

    const result = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: instruction }, ...documentParts(payload)] }],
    });
    const text = (result.text || '').trim().replace(/^Here[\s\S]*?(?:#)/i, '#');
    return { result: text, itemCount: 0 };
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
            const result = await ai.models.generateContent({
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

    const result = await ai.models.generateContent({
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
    timeoutSeconds: 300,
    memory: '512MiB',
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
