import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
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

    const handleDownloadPDF = () => {
        const printWindow = window.open('', '_blank', 'width=1000,height=800');
        const headerColor = '#1A1A1A'; // Default or theme color

        // Get the HTML content of the reviewer div
        const reviewerEl = document.querySelector('.reviewer-layout');
        const content = reviewerEl ? reviewerEl.innerHTML : '';

        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StudyPal Reviewer - ${material.title || 'Reviewer'}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: white;
      color: #1a1a1a;
      padding: 1.8cm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Academic Tables print styling */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.2rem 0;
      font-size: 0.8rem;
      break-inside: avoid;
      page-break-inside: avoid;
      display: table !important;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }

    /* Math formula displays */
    .katex-display {
      margin: 1rem 0;
      break-inside: avoid;
      page-break-inside: avoid;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .katex {
      font-size: 1.05em;
    }

    .reviewer-layout {
      column-count: ${columnCount} !important;
      -webkit-column-count: ${columnCount} !important;
      column-gap: 2.5rem !important;
      column-rule: ${columnCount === 2 ? '1px solid #e5e5e5' : 'none'} !important;
      column-fill: auto !important;
      font-size: 0.9rem;
      line-height: 1.6;
      text-align: justify;
    }

    .reviewer-layout h1 {
      column-span: all;
      text-align: center;
      font-family: 'Instrument Serif', 'Times New Roman', serif;
      font-style: italic;
      font-size: 2.6rem;
      font-weight: 500;
      border-top: 2px solid ${headerColor};
      border-bottom: 2px solid ${headerColor};
      color: ${headerColor};
      padding: 0.8rem 0;
      margin-bottom: 1.5rem;
      page-break-after: avoid;
      break-after: avoid;
    }

    .reviewer-layout h4 {
      column-span: all;
      text-align: center;
      text-transform: uppercase;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 0.75rem;
      letter-spacing: 2px;
      color: #666;
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 0.8rem;
      margin-bottom: 2rem;
      font-weight: 600;
      page-break-after: avoid;
      break-after: avoid;
    }

    .reviewer-layout h2 {
      background-color: ${headerColor};
      color: #ffffff;
      padding: 0.5rem 1rem;
      font-size: 1.15rem;
      border-radius: 4px;
      margin-top: 1.8rem;
      margin-bottom: 1.5rem;
      page-break-after: avoid;
      break-after: avoid;
      text-align: center;
      box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.08);
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-weight: 700;
    }

    .reviewer-layout h3 {
      background: #f5f5f5;
      border: 1px solid ${headerColor};
      color: ${headerColor};
      padding: 0.4rem 0.8rem;
      font-size: 0.95rem;
      font-weight: 600;
      text-transform: uppercase;
      text-align: center;
      margin-top: 1.4rem;
      margin-bottom: 0.8rem;
      page-break-after: avoid;
      break-after: avoid;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }

    .reviewer-layout blockquote {
      border: 1px dashed ${headerColor};
      background: #fbfbfb;
      padding: 0.8rem 1.2rem;
      margin: 1.2rem 0;
      border-radius: 4px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .reviewer-layout blockquote p { margin-bottom: 0; }

    .reviewer-layout ul, .reviewer-layout ol {
      padding-left: 1.5rem;
      margin-bottom: 1.2rem;
    }

    .reviewer-layout li {
      margin-bottom: 0.4rem;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .reviewer-layout p {
      margin-bottom: 0.8rem;
    }

    .reviewer-layout strong {
      background: rgba(245, 158, 11, 0.15) !important; /* Premium highlighter tint */
      padding: 1px 4px;
      font-weight: 700;
      border-radius: 3px;
      color: #000;
      border-bottom: none !important;
    }

    @media print {
      body { padding: 1.2cm; }
      .reviewer-layout {
        column-count: ${columnCount} !important;
        column-gap: 2rem !important;
      }
    }
  </style>
</head>
<body>
  <div class="reviewer-layout">
    ${content}
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="fade-in">
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <button className="btn-secondary" onClick={onBack}>
                    <ArrowLeft size={18} /> Back to Library
                </button>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {[1, 2].map(n => (
                            <button
                                key={n}
                                onClick={() => setColumnCount(n)}
                                style={{
                                    padding: '0.3rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: columnCount === n ? 'var(--accent-primary)' : 'transparent',
                                    color: columnCount === n ? 'var(--bg-primary)' : 'var(--text-muted)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {n} Col
                            </button>
                        ))}
                    </div>
                    <button onClick={handleDownloadPDF} className="btn-primary">
                        <Download size={18} /> Download
                    </button>
                </div>
            </div>

            <div className={`reviewer-layout ${columnCount === 2 ? 'two-columns' : ''}`} style={{ 
                columnCount: columnCount, 
                columnRule: columnCount === 2 ? '1px solid var(--border-color)' : 'none',
                columnGap: '2rem'
            }}>
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {material.data || ''}
                </ReactMarkdown>
            </div>
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
