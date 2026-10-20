import { useState, useEffect } from 'react';
import { generateFlashcards } from '../services/geminiService';
import { saveStudyMaterial, getUserProfile } from '../services/firebaseService';
import { Loader2, Repeat, Check, BookmarkPlus, Settings2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function FlashcardsTab({ fileContent, user }) {
    const [config, setConfig] = useState({
        numCards: ''
    });

    const [flashcards, setFlashcards] = useState(null);
    const [isConfiguring, setIsConfiguring] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    const [mastered, setMastered] = useState([]);
    const [reviewAgain, setReviewAgain] = useState([]);
    const [isComplete, setIsComplete] = useState(false);

    const [maxCards, setMaxCards] = useState(15);

    useEffect(() => {
        if (user) {
            getUserProfile(user.uid).then(p => {
                const limit = p.plan === 'free' ? 15 : 40;
                setMaxCards(limit);
                if (config.numCards > limit) {
                    setConfig(prev => ({ ...prev, numCards: limit }));
                }
            });
        }
    }, [user, config.numCards]);

    const handleGenerate = async () => {
        if (!fileContent) return;

        setLoading(true);
        setError('');
        setIsConfiguring(false);

        try {
            const num = Math.min(parseInt(config.numCards) || 10, 40);
            const result = await generateFlashcards(fileContent, num);
            setFlashcards(result);
            resetDeckState();
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to generate flashcards. Please check your internet connection or try generating fewer cards.');
            // Do NOT set isConfiguring to true here so the error message shows!
        }
        setLoading(false);
    };

    const resetDeckState = () => {
        setCurrentIndex(0);
        setIsFlipped(false);
        setMastered([]);
        setReviewAgain([]);
        setIsComplete(false);
    };

    const handleNext = (status) => {
        setIsFlipped(false);

        // Add brief timeout so the card flips back down before sliding to the next one
        setTimeout(() => {
            if (status === 'mastered') {
                setMastered([...mastered, flashcards[currentIndex]]);
            } else {
                setReviewAgain([...reviewAgain, flashcards[currentIndex]]);
            }

            if (currentIndex < flashcards.length - 1) {
                setCurrentIndex(currentIndex + 1);
            } else {
                setIsComplete(true);
            }
        }, 150);
    };

    const handleRestart = () => {
        resetDeckState();
    };

    const handleSaveToLibrary = async () => {
        if (!user) {
            toast.error("Please log in to save to your library!");
            return;
        }
        try {
            await saveStudyMaterial(user.uid, `My Flashcard Deck (${config.numCards} Cards)`, "flashcards", flashcards);
            toast.success("Saved perfectly to your library!");
        } catch (error) {
            toast.error("Failed to save to library.");
        }
    };

    if (isConfiguring) {
        return (
            <div className="fade-in" style={{ maxWidth: '400px', margin: '0 auto', padding: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <Settings2 size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
                    <h2 className="gradient-text">Flashcard Settings</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Customize your study deck.</p>
                </div>

                <div style={{ marginBottom: '2.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Number of Flashcards</label>
                        <input
                        type="number"
                        min="1"
                        max={maxCards}
                        value={config.numCards}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!e.target.value) { setConfig({ ...config, numCards: '' }); return; }
                            setConfig({ ...config, numCards: Math.min(Math.max(1, val), maxCards) });
                        }}
                        placeholder="e.g. 10"
                        style={{
                            width: '100%', padding: '0.75rem', borderRadius: '8px',
                            border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '1rem'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <small style={{ color: 'var(--text-muted)' }}>
                            Choose between 1 – {maxCards} flashcards. More cards take longer to generate.
                        </small>
                        {maxCards === 15 && <span className="badge badge-premium">Upgrade for 40</span>}
                    </div>
                </div>

                <button className="btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }} onClick={handleGenerate}>
                    Generate Deck
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0' }} className="fade-in">
                <Loader2 className="spinner" size={48} color="var(--accent-primary)" />
                <h3 style={{ marginTop: '1rem' }}>Generating your custom {config.numCards}-card deck...</h3>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ color: 'var(--error)', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
                <p>{error}</p>
                <button className="btn-secondary" style={{ marginTop: '1rem' }} onClick={() => setIsConfiguring(true)}>Go Back</button>
            </div>
        );
    }

    if (isComplete) {
        return (
            <div className="slide-up" style={{ textAlign: 'center', padding: '3rem 2rem', background: 'var(--bg-glass-hover)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
                <h2 className="gradient-text" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Deck Completed!</h2>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', margin: '2rem 0' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{mastered.length}</div>
                        <div style={{ color: 'var(--text-muted)' }}>Mastered</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>{reviewAgain.length}</div>
                        <div style={{ color: 'var(--text-muted)' }}>Review Again</div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <button className="btn-secondary" onClick={handleRestart}>
                        <Repeat size={18} /> Restart Same Deck
                    </button>
                    <button className="btn-primary" onClick={() => setIsConfiguring(true)}>
                        <Settings2 size={18} /> Generate New Deck
                    </button>
                    <button onClick={handleSaveToLibrary} className="btn-secondary">
                        <BookmarkPlus size={18} /> Save Deck
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            {/* Header and Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button className="btn-secondary" onClick={() => setIsConfiguring(true)} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                    <Settings2 size={16} /> Deck Settings
                </button>

                <div style={{ flex: 1, textAlign: 'center', fontSize: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                    Card {currentIndex + 1} of {flashcards?.length}
                </div>

                <button onClick={handleSaveToLibrary} className="btn-secondary" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                    <BookmarkPlus size={16} /> Save Deck
                </button>
            </div>

            {/* Flashcard Component */}
            {flashcards && flashcards.length > 0 && (
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div
                        onClick={() => setIsFlipped(!isFlipped)}
                        style={{
                            height: '350px',
                            perspective: '1000px',
                            cursor: 'pointer',
                            marginBottom: '2rem'
                        }}
                    >
                        <div style={{
                            width: '100%',
                            height: '100%',
                            position: 'relative',
                            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                            transformStyle: 'preserve-3d',
                            transform: isFlipped ? 'rotateX(180deg)' : 'rotateX(0deg)'
                        }}>

                            {/* Front */}
                            <div style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                backfaceVisibility: 'hidden',
                                background: 'var(--bg-glass-hover)',
                                borderRadius: '16px',
                                border: '2px solid var(--accent-primary)',
                                boxShadow: 'var(--shadow-md)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2rem',
                                textAlign: 'center',
                                fontSize: '1.4rem',
                                fontWeight: 600
                            }}>
                                {flashcards[currentIndex].front}
                            </div>

                            {/* Back */}
                            <div style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                backfaceVisibility: 'hidden',
                                background: 'var(--bg-primary)',
                                borderRadius: '16px',
                                border: '2px solid var(--success)',
                                boxShadow: 'var(--shadow-lg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2rem',
                                textAlign: 'center',
                                fontSize: '1.2rem',
                                transform: 'rotateX(180deg)',
                                overflowY: 'auto'
                            }}>
                                {flashcards[currentIndex].back}
                            </div>

                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }} className={isFlipped ? "fade-in" : "slide-up"}>
                        <button
                            onClick={() => handleNext('review')}
                            disabled={!isFlipped}
                            style={{
                                flex: 1, padding: '1rem',
                                borderRadius: '8px', fontSize: '1rem', fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                background: isFlipped ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                color: isFlipped ? 'var(--warning)' : 'var(--text-muted)',
                                opacity: isFlipped ? 1 : 0.5,
                                cursor: isFlipped ? 'pointer' : 'not-allowed',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <Repeat size={20} /> Review Again
                        </button>

                        <button
                            onClick={() => handleNext('mastered')}
                            disabled={!isFlipped}
                            style={{
                                flex: 1, padding: '1rem',
                                borderRadius: '8px', fontSize: '1rem', fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                background: isFlipped ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-primary)',
                                border: `1px solid ${isFlipped ? 'var(--success)' : 'var(--border-color)'}`,
                                color: isFlipped ? 'var(--success)' : 'var(--text-muted)',
                                opacity: isFlipped ? 1 : 0.5,
                                cursor: isFlipped ? 'pointer' : 'not-allowed',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <Check size={20} /> Got It!
                        </button>
                    </div>

                    {!isFlipped && (
                        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Click the card to flip
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
