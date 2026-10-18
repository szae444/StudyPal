// Spaced repetition for saved flashcard decks, using the FSRS scheduler.
// Each card in a saved deck may carry an `srs` object. Dates are stored as
// epoch milliseconds so the deck can be written straight back to Firestore.

import { fsrs, createEmptyCard, Rating, State } from 'ts-fsrs';

const scheduler = fsrs({ enable_fuzz: true, request_retention: 0.9 });

export const GRADES = [
    { rating: Rating.Again, key: '1', label: 'Again', tone: 'again' },
    { rating: Rating.Hard, key: '2', label: 'Hard', tone: 'hard' },
    { rating: Rating.Good, key: '3', label: 'Good', tone: 'good' },
    { rating: Rating.Easy, key: '4', label: 'Easy', tone: 'easy' },
];

const toStored = (card) => ({
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps ?? 0,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null,
});

const fromStored = (srs) => ({
    ...srs,
    due: new Date(srs.due),
    last_review: srs.last_review ? new Date(srs.last_review) : undefined,
});

/** A card with no `srs` yet has never been reviewed, so it counts as due now. */
export const isDue = (card, now = Date.now()) => !card.srs || card.srs.due <= now;

export const isNew = (card) => !card.srs || card.srs.state === State.New;

/** Rate a card and return a copy with its next schedule. */
export const rateCard = (card, rating, now = new Date()) => {
    const current = card.srs ? fromStored(card.srs) : createEmptyCard(now);
    const { card: next } = scheduler.next(current, now, rating);
    return { ...card, srs: toStored(next) };
};

/** Preview the interval each grade would give, e.g. { 1: '1m', 3: '10m', ... }. */
export const previewIntervals = (card, now = new Date()) => {
    const current = card.srs ? fromStored(card.srs) : createEmptyCard(now);
    const preview = scheduler.repeat(current, now);
    const out = {};
    for (const { rating } of GRADES) {
        out[rating] = formatInterval(preview[rating].card.due.getTime() - now.getTime());
    }
    return out;
};

export const formatInterval = (ms) => {
    const mins = Math.max(1, Math.round(ms / 60000));
    if (mins < 60) return `${mins}m`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    if (days < 31) return `${days}d`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo`;
    return `${(days / 365).toFixed(1)}y`;
};

/** Summaries for every flashcard deck in a library list. */
export const summarizeDecks = (materials, now = Date.now()) =>
    materials
        .filter((m) => m.type === 'flashcards' && Array.isArray(m.data) && m.data.length > 0)
        .map((m) => ({
            id: m.id,
            title: m.title || 'Untitled deck',
            total: m.data.length,
            due: m.data.filter((c) => isDue(c, now)).length,
            fresh: m.data.filter(isNew).length,
        }));
