// StudyPal Gemini AI Service Layer
// Integrates Gemini AI directly using @google/generative-ai SDK

import { GoogleGenerativeAI } from "@google/generative-ai";
import { logAIUsage } from './firebaseService';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
let genAI = null;

if (apiKey) {
    try {
        genAI = new GoogleGenerativeAI(apiKey);
    } catch (e) {
        console.error("Failed to initialize GoogleGenerativeAI client", e);
    }
}

/**
 * Clean up markdown json block wrappers from LLM response
 */
const cleanJSONResponse = (text) => {
    try {
        let clean = text.trim();

        // Strip markdown code fences if present
        clean = clean.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

        // Extract outermost JSON array or object
        const arrStart = clean.indexOf('[');
        const arrEnd = clean.lastIndexOf(']');
        const objStart = clean.indexOf('{');
        const objEnd = clean.lastIndexOf('}');

        if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
            clean = clean.substring(arrStart, arrEnd + 1);
        } else if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
            clean = clean.substring(objStart, objEnd + 1);
        }

        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parsing failed on LLM output:", text);
        throw new Error(`The AI model returned conversational text rather than clean JSON. Response: "${text.slice(0, 200)}"`);
    }
};

/**
 * Helper to dynamically load the Gemini model instance with specific configurations.
 */
const getModel = (modelName = 'gemini-2.5-flash', jsonMode = false) => {
    if (!genAI) {
        throw new Error("Gemini API Key is missing. Please configure VITE_GEMINI_API_KEY in your .env.local file.");
    }
    const config = {};
    if (jsonMode) {
        config.responseMimeType = "application/json";
    }
    return genAI.getGenerativeModel({ model: modelName, generationConfig: config });
};

/**
 * Generate a study reviewer from document content.
 */
export const generateReviewer = async (payload, highlightFocus = false, userId = null, userEmail = null) => {
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

    const model = getModel('gemini-2.5-flash');
    
    // Prepare inputs
    const inputs = [instruction];
    if (typeof payload === 'string') {
        inputs.push(`Document Text:\n${payload}`);
    } else if (payload && payload.type === 'text') {
        inputs.push(`Document Text:\n${payload.data}`);
    } else if (payload && payload.type === 'inline') {
        if (payload.mimeType?.startsWith('image/')) {
            inputs.push({
                inlineData: {
                    data: payload.data,
                    mimeType: payload.mimeType
                }
            });
        } else {
            inputs.push(`[Attached File of type ${payload.mimeType}]`);
        }
    }

    try {
        const result = await model.generateContent(inputs);
        const resultText = result.response.text();
        
        logAIUsage(userId, userEmail, 'reviewer', 'gemini-2.5-flash', 0);
        
        let cleanedResult = resultText.trim();
        cleanedResult = cleanedResult.replace(/^Here[\s\S]*?(?:#)/i, '#');
        return cleanedResult;
    } catch (error) {
        console.error("Gemini reviewer generation error:", error);
        throw error;
    }
};

/**
 * Generate interactive quiz questions from document content.
 */
export const generateQuiz = async (payload, difficulty, numQuestions = 5, questionType = 'mixed', userId = null, userEmail = null) => {
    let diffInstruction = "";
    if (difficulty === 'easy') diffInstruction = "Focus on direct recall and basic facts.";
    if (difficulty === 'medium') diffInstruction = "Include some application and deeper understanding questions.";
    if (difficulty === 'hard') diffInstruction = "Focus on complex situational scenarios and synthesis of concepts.";

    let formatInstruction = "";
    let formatOutputRules = "";

    if (questionType === 'mixed') {
        formatInstruction = `The quiz must include a mix of these types: Multiple Choice, Identification (Short answer), Enumeration, and Situational (Scenario based).`;
        formatOutputRules = `Return the output strictly as a JSON array of objects with this structure formats depending on the type:
[
  { "type": "multiple-choice", "question": "...", "options": ["A", "B", "C", "D"], "answer": "The correct option text" },
  { "type": "identification", "question": "...", "answer": "The expected short answer" },
  { "type": "enumeration", "question": "Enumerate the [X] items/steps/things related to...", "answer": "1. Item one\\n2. Item two\\n3. Item three" },
  { "type": "situational", "question": "...", "options": ["A", "B", "C", "D"], "answer": "Correct option text" }
]`;
    } else if (questionType === 'multiple-choice') {
        formatInstruction = `The quiz must only contain Multiple Choice questions.`;
        formatOutputRules = `Return strictly as a JSON array: [{"type": "multiple-choice", "question": "...", "options": ["A","B","C","D"], "answer": "Option text"}]`;
    } else if (questionType === 'identification') {
        formatInstruction = `The quiz must only contain Identification (Short answer) questions.`;
        formatOutputRules = `Return strictly as a JSON array: [{"type": "identification", "question": "...", "answer": "Expected exact answer text"}]`;
    } else if (questionType === 'enumeration') {
        formatInstruction = `The quiz must only contain Enumeration questions where students must list a complete set of items, steps, or elements.`;
        formatOutputRules = `Return strictly as a JSON array: [{"type": "enumeration", "question": "Enumerate the [X] items/steps related to...", "answer": "1. Item one\\n2. Item two\\n3. Item three"}]`;
    } else if (questionType === 'situational') {
        formatInstruction = `The quiz must only contain Situational (Scenario based) questions.`;
        formatOutputRules = `Return strictly as a JSON array: [{"type": "situational", "question": "A scenario...", "options": ["A","B","C","D"], "answer": "Correct option text"}]`;
    }

    const BATCH_SIZE = 10;
    let questions = [];
    let remaining = numQuestions;

    while (remaining > 0) {
        const batchSize = Math.min(remaining, BATCH_SIZE);
        const exclusionHint = questions.length > 0
            ? `\n\nAVOID REPEATING these already-generated topics (do NOT ask about them again):\n${questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}`
            : '';

        const batchInstruction = `You are a quiz generator. Your ONLY job is to output a JSON array.
Generate EXACTLY ${batchSize} quiz questions from the document — no more, no less.
Difficulty: ${difficulty}. ${diffInstruction}
${formatInstruction}
${exclusionHint}

RULES:
1. Output EXACTLY ${batchSize} elements in the JSON array.
2. Each question MUST be on a DIFFERENT topic — no duplicates.
3. Output ONLY the raw JSON array. Do NOT wrap in markdown code fences or conversational text.

${formatOutputRules}`;

        try {
            const model = getModel('gemini-2.5-flash', true);
            const inputs = [batchInstruction];
            
            if (typeof payload === 'string') {
                inputs.push(`Document Text:\n${payload}`);
            } else if (payload && payload.type === 'text') {
                inputs.push(`Document Text:\n${payload.data}`);
            } else if (payload && payload.type === 'inline') {
                if (payload.mimeType?.startsWith('image/')) {
                    inputs.push({
                        inlineData: {
                            data: payload.data,
                            mimeType: payload.mimeType
                        }
                    });
                } else {
                    inputs.push(`[Attached File of type ${payload.mimeType}]`);
                }
            }

            const result = await model.generateContent(inputs);
            const raw = result.response.text();
            const batch = cleanJSONResponse(raw);
            questions = [...questions, ...batch];
        } catch (e) {
            console.error("Quiz generation batch error:", e);
            break;
        }

        remaining -= batchSize;
    }

    // Final dedup by question text (case-insensitive), then trim to exact count
    const seen = new Set();
    questions = questions.filter(q => {
        const key = String(q.question || '').toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, numQuestions);

    logAIUsage(userId, userEmail, 'quiz', 'gemini-2.5-flash', questions.length);
    return questions;
};

/**
 * Generate flashcard decks from document content.
 */
export const generateFlashcards = async (payload, numCards = 10, userId = null, userEmail = null) => {
    const BATCH_SIZE = 10;
    let cards = [];
    let remaining = numCards;

    while (remaining > 0) {
        const batchSize = Math.min(remaining, BATCH_SIZE);
        const exclusionHint = cards.length > 0
            ? `\n\nAVOID REPEATING these already-generated concepts (do NOT create cards for them again):\n${cards.map((c, i) => `${i + 1}. ${c.front}`).join('\n')}`
            : '';

        const batchInstruction = `You are a flashcard generator. Your ONLY job is to output a JSON array.
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

        try {
            const model = getModel('gemini-2.5-flash', true);
            const inputs = [batchInstruction];
            
            if (typeof payload === 'string') {
                inputs.push(`Document Text:\n${payload}`);
            } else if (payload && payload.type === 'text') {
                inputs.push(`Document Text:\n${payload.data}`);
            } else if (payload && payload.type === 'inline') {
                if (payload.mimeType?.startsWith('image/')) {
                    inputs.push({
                        inlineData: {
                            data: payload.data,
                            mimeType: payload.mimeType
                        }
                    });
                } else {
                    inputs.push(`[Attached File of type ${payload.mimeType}]`);
                }
            }

            const result = await model.generateContent(inputs);
            const raw = result.response.text();
            const batch = cleanJSONResponse(raw);
            cards = [...cards, ...batch];
        } catch (e) {
            console.error("Flashcards generation batch error:", e);
            break;
        }

        remaining -= batchSize;
    }

    // Final dedup by front text (case-insensitive), then trim to exact count
    const seen = new Set();
    cards = cards.filter(c => {
        const key = String(c.front || '').toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, numCards);

    logAIUsage(userId, userEmail, 'flashcards', 'gemini-2.5-flash', cards.length);
    return cards;
};

/**
 * Create a new Gemini Chat Session.
 */
export const createChatSession = (history = [], userId = null, userEmail = null) => {
    if (!genAI) {
        throw new Error("Gemini API Key is missing. Please configure VITE_GEMINI_API_KEY in your .env.local file.");
    }

    const systemInstruction = "You are StudyPal's AI assistant. You help students understand study material, explain difficult concepts clearly, and act like a friendly, encouraging tutor. Keep responses clean, well-formatted, and use markdown where helpful.";

    const modelWithInstruction = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemInstruction
    });

    // Map history to Gemini's format: [{ role: 'user'|'model', parts: [{ text: '...' }] }]
    const formattedHistory = history.map(h => ({
        role: h.role === 'assistant' ? 'model' : h.role,
        parts: h.parts || [{ text: h.text || '' }]
    }));

    const chat = modelWithInstruction.startChat({
        history: formattedHistory
    });

    return {
        sendMessage: async (messageParts) => {
            let result;
            if (typeof messageParts === 'string') {
                result = await chat.sendMessage(messageParts);
            } else if (Array.isArray(messageParts)) {
                const mappedParts = messageParts.map(part => {
                    if (part.text) {
                        return { text: part.text };
                    }
                    if (part.inlineData) {
                        return {
                            inlineData: {
                                mimeType: part.inlineData.mimeType,
                                data: part.inlineData.data
                            }
                        };
                    }
                    return null;
                }).filter(Boolean);
                
                result = await chat.sendMessage(mappedParts);
            }
            
            // Log chat usage
            logAIUsage(userId, userEmail, 'chat', 'gemini-2.5-flash', 0);
            
            return {
                response: {
                    text: () => result.response.text()
                }
            };
        }
    };
};
