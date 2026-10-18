import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Layers } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { updateStudyMaterial } from '../services/firebaseService';
import { GRADES, isDue, isNew, rateCard, previewIntervals } from '../utils/srs';

const NEW_PER_SESSION = 20;
const REQUEUE_WINDOW_MS = 15 * 60000; // "Again" cards come back within this session

const buildQueue = (decks) => {
    const now = Date.now();
    const due = [];
    const fresh = [];
    decks.forEach((deck) => {
        deck.data.forEach((card, index) => {
            if (!isDue(card, now)) return;
            const item = { deckId: deck.id, deckTitle: deck.title || 'Untitled deck', index };
            if (isNew(card)) fresh.push(item); else due.push({ ...item, due: card.srs.due });
        });
    });
    due.sort((a, b) => a.due - b.due);
    return [...due, ...fresh.slice(0, NEW_PER_SESSION)];
};

export default function ReviewSession({ materials, onMaterialUpdated, onExit, onGenerate }) {
    const deckMaterials = useMemo(
        () => materials.filter((m) => m.type === 'flashcards' && Array.isArray(m.data) && m.data.length > 0),
        [materials],
    );

    // Snapshot the queue when the session opens so it doesn't reshuffle as we save.
    const [decks, setDecks] = useState(() => Object.fromEntries(deckMaterials.map((d) => [d.id, d])));
    const [queue, setQueue] = useState(() => buildQueue(deckMaterials));
    const [startCount] = useState(() => buildQueue(deckMaterials).length);
    const [flipped, setFlipped] = useState(false);
    const [tally, setTally] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 });

    const item = queue[0];
    const card = item ? decks[item.deckId]?.data[item.index] : null;
    const intervals = useMemo(() => (card ? previewIntervals(card) : {}), [card]);
    const reviewed = tally[1] + tally[2] + tally[3] + tally[4];

    const grade = useCallback(async (rating) => {
        if (!item || !card || !flipped) return;
        const updated = rateCard(card, rating);
        const deck = decks[item.deckId];
        const data = deck.data.map((c, i) => (i === item.index ? updated : c));
        const nextDeck = { ...deck, data };

        setDecks((prev) => ({ ...prev, [deck.id]: nextDeck }));
        setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
        setFlipped(false);
        setQueue((q) => {
            const rest = q.slice(1);
            return updated.srs.due - Date.now() < REQUEUE_WINDOW_MS ? [...rest, item] : rest;
        });

        try {
            await updateStudyMaterial(deck.id, { data });
            onMaterialUpdated?.(nextDeck);
        } catch (e) {
            console.error(e);
            toast.error('Could not save that review. Check your connection.');
        }
    }, [item, card, flipped, decks, onMaterialUpdated]);

    useEffect(() => {
        const onKey = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
            if (e.code === 'Space' || e.key === 'Enter') {
                if (e.target.closest?.('button') && e.key === 'Enter') return;
                e.preventDefault();
                setFlipped((f) => !f);
            } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
                grade(Number(e.key));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [flipped, grade]);

    const header = (
        <div className="page-head" style={{ marginBottom: 'var(--s-5)' }}>
            <div>
                <h1>Review cards</h1>
                <p>Rate how well you remembered. StudyPal schedules each card right before you'd forget it.</p>
            </div>
            <button className="btn-secondary" onClick={onExit}><ArrowLeft size={16} /> Back to desk</button>
        </div>
    );

    if (deckMaterials.length === 0) {
        return (
            <div className="fade-in">
                {header}
                <div className="tile tile-card" style={{ maxWidth: 560 }}>
                    <h2 className="tile-title"><Layers size={16} /> No decks yet</h2>
                    <p style={{ lineHeight: '26px', color: 'var(--card-text-2)' }}>Generate flashcards from your notes and save the deck. It will show up here for spaced review.</p>
                    <button className="btn-primary" style={{ alignSelf: 'flex-start' }} onClick={onGenerate}>Make flashcards</button>
                </div>
            </div>
        );
    }

    if (!card) {
        const allCards = Object.values(decks).flatMap((d) => d.data);
        const nextDue = allCards.filter((c) => c.srs).map((c) => c.srs.due).sort((a, b) => a - b)[0];
        return (
            <div className="fade-in">
                {header}
                <div className="review-wrap">
                    <div className="tile" style={{ alignItems: 'flex-start', padding: 'var(--s-7)' }}>
                        <span className="landing-section-label">{reviewed ? 'Session done' : 'Nothing due'}</span>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--fs-3xl)', margin: 0 }}>
                            {reviewed ? <>You reviewed <span className="hl">{reviewed} {reviewed === 1 ? 'card' : 'cards'}</span>.</> : 'You are all caught up.'}
                        </h2>
                        {reviewed > 0 && (
                            <div style={{ display: 'flex', gap: 'var(--s-5)', flexWrap: 'wrap' }}>
                                {GRADES.map((g) => (
                                    <span key={g.rating} className="tabular" style={{ fontSize: 'var(--fs-md)' }}>
                                        <strong>{tally[g.rating]}</strong> <span style={{ color: 'var(--text-muted)' }}>{g.label.toLowerCase()}</span>
                                    </span>
                                ))}
                            </div>
                        )}
                        {nextDue && (
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Next card comes back <strong className="tabular">
                                    {new Date(nextDue).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </strong>.
                            </p>
                        )}
                        <button className="btn-primary" onClick={onExit}>Back to desk</button>
                    </div>
                </div>
            </div>
        );
    }

    const progress = startCount ? Math.min(100, (reviewed / Math.max(startCount, reviewed + queue.length)) * 100) : 0;

    return (
        <div className="fade-in">
            {header}
            <div className="review-wrap">
                <div className="review-top">
                    <span className="stat-note">{item.deckTitle}</span>
                    <div className="review-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
                    <span className="stat-note tabular">{queue.length} left</span>
                </div>

                <div className="index-card-scene">
                    <div
                        className={`index-card ${flipped ? 'flipped' : ''}`}
                        onClick={() => setFlipped((f) => !f)}
                        role="button"
                        tabIndex={0}
                        aria-label={flipped ? 'Answer side. Press Space to see the question.' : 'Question side. Press Space to see the answer.'}
                    >
                        <div className="index-card-face front">
                            <div className="face-label"><span>Question</span>{isNew(card) && <span className="badge badge-warning">New</span>}</div>
                            <div className="face-text">{card.front}</div>
                        </div>
                        <div className="index-card-face back">
                            <div className="face-label"><span>Answer</span></div>
                            <div className="face-text">{card.back}</div>
                        </div>
                    </div>
                </div>

                {flipped ? (
                    <div className="grade-row slide-up">
                        {GRADES.map((g) => (
                            <button key={g.rating} className={`grade-btn ${g.tone}`} onClick={() => grade(g.rating)}>
                                {g.label}
                                <small>{intervals[g.rating]}</small>
                            </button>
                        ))}
                    </div>
                ) : (
                    <button className="btn-primary" style={{ alignSelf: 'center', minWidth: 220 }} onClick={() => setFlipped(true)}>
                        Show answer
                    </button>
                )}

                <div className="review-hint">
                    <span><span className="kbd">Space</span> flip</span>
                    <span><span className="kbd">1</span>–<span className="kbd">4</span> rate</span>
                </div>
            </div>
        </div>
    );
}
