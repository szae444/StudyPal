import React, { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import ReviewerDocument, { ColumnToggle } from './ReviewerDocument';
import { printReviewer } from '../utils/printReviewer';
import { reviewerTitle } from '../utils/reviewerMarkdown';
import { ArrowLeft, Download, CheckCircle, XCircle, Repeat, Check } from 'lucide-react';

export default function LibraryViewer({ material, onBack }) {
    if (!material) return null;

    if (material.type === 'reviewer') {
        return <ReviewerViewer material={material} onBack={onBack} />;
    }
    
    if (material.type === 'quiz') {
        return <QuizViewer material={material} onBack={onBack} />;
    }

    if (material.type === 'flashcards') {
        return <FlashcardsViewer material={material} onBack={onBack} />;
    }

    return (
        <div className="fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>Unsupported Material Type</h2>
            <button className="btn-secondary" onClick={onBack} style={{ marginTop: '1rem' }}>
                <ArrowLeft size={16} /> Back to Library
            </button>
        </div>
    );
}

// --- Reviewer Viewer ---
function ReviewerViewer({ material, onBack }) {
    const [columnCount, setColumnCount] = useState(2);
    const documentRef = useRef(null);

    const handleDownloadPDF = () => {
        if (!printReviewer(documentRef.current, reviewerTitle(material.data, material.title || 'Reviewer'))) {
            toast.error('Allow pop-ups for StudyPal to download the PDF.');
        }
    };

    return (
        <div className="fade-in">
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <button className="btn-secondary" onClick={onBack}>
                    <ArrowLeft size={18} /> Back to Library
                </button>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ColumnToggle columns={columnCount} setColumns={setColumnCount} />
                    <button onClick={handleDownloadPDF} className="btn-primary">
                        <Download size={18} /> Download
                    </button>
                </div>
            </div>

            <ReviewerDocument ref={documentRef} markdown={material.data || ''} columns={columnCount} />
        </div>
    );
}

// --- Quiz Viewer ---
function QuizViewer({ material, onBack }) {
    const quizData = material.data;
    const [userAnswers, setUserAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);

    const handleOptionChange = (qIndex, value) => {
        setUserAnswers(prev => ({ ...prev, [qIndex]: value }));
    };

    const calculateScore = () => {
        let score = 0;
        quizData.forEach((q, index) => {
            if (q.type === 'identification') {
                if (String(userAnswers[index]).trim().toLowerCase() === String(q.answer).trim().toLowerCase()) {
                    score++;
                }
            } else {
                if (userAnswers[index] === q.answer) {
                    score++;
                }
            }
        });
        return score;
    };

    const handleRetake = () => {
        setUserAnswers({});
        setSubmitted(false);
    };

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button className="btn-secondary" onClick={onBack}>
                    <ArrowLeft size={18} /> Back to Library
                </button>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }} className="gradient-text">{material.title}</h2>
            </div>

            <div className="slide-up">
                {quizData.map((item, qIndex) => (
                    <div key={qIndex} style={{
                        marginBottom: '2rem',
                        padding: '1.5rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        border: `1px solid ${userAnswers[qIndex] && !submitted ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                        boxShadow: userAnswers[qIndex] && !submitted ? 'var(--shadow-sm)' : 'none',
                        transition: 'all 0.3s ease',
                        position: 'relative'
                    }}>
                        <span style={{
                            position: 'absolute', top: '-12px', left: '20px',
                            background: 'var(--accent-gradient)', color: 'var(--bg-primary)',
                            padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                            textTransform: 'uppercase', boxShadow: 'var(--shadow-sm)'
                        }}>
                            {item.type.replace('-', ' ')}
                        </span>

                        <h4 style={{ margin: '1rem 0 1.5rem 0', fontSize: '1.1rem' }}>
                            {qIndex + 1}. {item.question}
                        </h4>

                        {item.options ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {item.options.map((opt, optIndex) => {
                                    const isSelected = userAnswers[qIndex] === opt;
                                    const isCorrect = submitted && item.answer === opt;
                                    const isWrong = submitted && isSelected && item.answer !== opt;

                                    let bg = 'var(--bg-primary)';
                                    let border = 'var(--border-color)';

                                    if (isSelected) {
                                        bg = 'var(--bg-glass-hover)';
                                        border = 'var(--accent-primary)';
                                    }
                                    if (isCorrect) {
                                        bg = 'rgba(16, 185, 129, 0.1)';
                                        border = 'var(--success)';
                                    }
                                    if (isWrong) {
                                        bg = 'rgba(239, 68, 68, 0.1)';
                                        border = 'var(--error)';
                                    }

                                    return (
                                        <label key={optIndex} style={{
                                            display: 'flex', alignItems: 'center', gap: '1rem',
                                            padding: '1rem', borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: bg,
                                            cursor: submitted ? 'default' : 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}>
                                            <input
                                                type="radio"
                                                name={`lib-question-${qIndex}`}
                                                value={opt}
                                                checked={isSelected}
                                                onChange={() => !submitted && handleOptionChange(qIndex, opt)}
                                                disabled={submitted}
                                                style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px' }}
                                            />
                                            <span style={{ flex: 1, fontSize: '1rem', color: isCorrect ? 'var(--success)' : (isWrong ? 'var(--error)' : 'inherit') }}>{opt}</span>
                                            {isCorrect && <CheckCircle size={20} color="var(--success)" />}
                                            {isWrong && <XCircle size={20} color="var(--error)" />}
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <div>
                                <input
                                    type="text"
                                    value={userAnswers[qIndex] || ''}
                                    onChange={(e) => !submitted && handleOptionChange(qIndex, e.target.value)}
                                    disabled={submitted}
                                    placeholder="Type your answer here..."
                                    style={{
                                        width: '100%', padding: '1rem',
                                        borderRadius: '8px', border: '1px solid var(--border-color)',
                                        background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                        fontSize: '1rem', outline: 'none'
                                    }}
                                />
                                {submitted && (
                                    <div className="fade-in" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div>
                                            {String(userAnswers[qIndex]).trim().toLowerCase() === String(item.answer).trim().toLowerCase() ?
                                                <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={18} /> Correct!</span> :
                                                <span style={{ color: 'var(--error)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><XCircle size={18} /> Incorrect</span>
                                            }
                                        </div>
                                        <div>
                                            <strong style={{ color: 'var(--success)' }}>Correct Answer:</strong> {item.answer}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {!submitted ? (
                    <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                        <button
                            className="btn-primary"
                            onClick={() => setSubmitted(true)}
                            disabled={Object.keys(userAnswers).length !== quizData.length}
                            style={{ padding: '1rem 3rem', fontSize: '1.1rem', opacity: Object.keys(userAnswers).length !== quizData.length ? 0.5 : 1 }}
                        >
                            Submit Answers
                        </button>
                    </div>
                ) : (
                    <div style={{
                        textAlign: 'center', marginTop: '3rem', padding: '3rem 2rem',
                        background: 'var(--bg-glass-hover)', borderRadius: '16px', border: '2px solid var(--accent-primary)',
                        boxShadow: 'var(--shadow-lg)'
                    }} className="slide-up">
                        <h2 className="gradient-text" style={{ fontSize: '2.5rem' }}>Quiz Results</h2>
                        <div style={{ width: '120px', height: '120px', margin: '2rem auto', borderRadius: '50%', border: '8px solid var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                            {Math.round((calculateScore() / quizData.length) * 100)}%
                        </div>
                        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
                            You scored <strong>{calculateScore()}</strong> out of <strong>{quizData.length}</strong> correct.
                        </p>

                        <button className="btn-secondary" style={{ marginTop: '2rem' }} onClick={handleRetake}>
                            <Repeat size={18} style={{ marginRight: '0.5rem' }} /> Retake Quiz
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Flashcards Viewer ---
function FlashcardsViewer({ material, onBack }) {
    const flashcards = material.data;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [mastered, setMastered] = useState([]);
    const [reviewAgain, setReviewAgain] = useState([]);
    const [isComplete, setIsComplete] = useState(false);

    const handleNext = (status) => {
        setIsFlipped(false);
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
        setCurrentIndex(0);
        setIsFlipped(false);
        setMastered([]);
        setReviewAgain([]);
        setIsComplete(false);
    };

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

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <button className="btn-secondary" onClick={onBack}>
                        <ArrowLeft size={18} /> Back to Library
                    </button>
                    <button className="btn-primary" onClick={handleRestart}>
                        <Repeat size={18} /> Restart Same Deck
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ paddingTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button className="btn-secondary" onClick={onBack} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                    <ArrowLeft size={16} /> Library
                </button>

                <div style={{ flex: 1, textAlign: 'center', fontSize: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                    Card {currentIndex + 1} of {flashcards?.length}
                </div>
                
                <div style={{ width: '80px' }}></div> {/* Spacer for centering */}
            </div>

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
                            border: '1px solid var(--border-color)',
                            color: isFlipped ? 'var(--success)' : 'var(--text-muted)',
                            opacity: isFlipped ? 1 : 0.5,
                            cursor: isFlipped ? 'pointer' : 'not-allowed',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <Check size={20} /> Got It!
                    </button>
                </div>
            </div>
        </div>
    );
}
