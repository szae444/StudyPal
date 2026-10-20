// StudyPal AI Service Layer
// All Gemini calls run in the `ai` Cloud Function (functions/index.js), which holds the API key.
// Nothing in this file, or anywhere in the browser bundle, may hold a Gemini key.

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseService';

// Long quizzes run several Gemini calls in a row, so allow up to the function's own 5 minute timeout.
const callAI = async (task, params) => {
    if (!functions) {
        throw new Error("Firebase is not configured. Please add your credentials to .env.local");
    }
    const ai = httpsCallable(functions, 'ai', { timeout: 300_000 });
    try {
        const { data } = await ai({ task, ...params });
        return data.result;
    } catch (error) {
        console.error(`AI ${task} error:`, error);
        // Callable errors carry a user-facing message from the function (rate limit, too large, ...)
        throw new Error(error.message || 'The AI service is unavailable right now.');
    }
};

/**
 * Generate a study reviewer from document content.
 */
export const generateReviewer = (payload, highlightFocus = false) =>
    callAI('reviewer', { payload, highlightFocus });

/**
 * Generate interactive quiz questions from document content.
 */
export const generateQuiz = (payload, difficulty, numQuestions = 5, questionType = 'mixed') =>
    callAI('quiz', { payload, difficulty, numQuestions, questionType });

/**
 * Generate flashcard decks from document content.
 */
export const generateFlashcards = (payload, numCards = 10) =>
    callAI('flashcards', { payload, numCards });

/**
 * Create a chat session. The conversation history is kept here and sent with each message,
 * since the function itself is stateless.
 */
export const createChatSession = (history = []) => {
    // Map history to Gemini's format: [{ role: 'user'|'model', parts: [{ text: '...' }] }]
    let contents = history.map(h => ({
        role: h.role === 'assistant' ? 'model' : h.role,
        parts: h.parts || [{ text: h.text || '' }]
    }));

    return {
        sendMessage: async (messageParts) => {
            const message = typeof messageParts === 'string' ? [{ text: messageParts }] : messageParts;
            const text = await callAI('chat', { history: contents, message });
            contents = [...contents, { role: 'user', parts: message }, { role: 'model', parts: [{ text }] }];
            return {
                response: {
                    text: () => text
                }
            };
        }
    };
};
