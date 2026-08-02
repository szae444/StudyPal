import { useState, useEffect } from 'react';
import { generateQuiz } from '../services/geminiService';
import { saveStudyMaterial, getUserProfile } from '../services/firebaseService';
import { Loader2, CheckCircle, XCircle, BookmarkPlus, Settings2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function QuizTab({ fileContent, user }) {
    const [config, setConfig] = useState({
        difficulty: 'easy',
        numQuestions: '',
        questionType: 'mixed',
        displayMode: 'all'
    });

    const [quizData, setQuizData] = useState(null);
    const [isConfiguring, setIsConfiguring] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [userAnswers, setUserAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);
    // For one-by-one mode
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [oneByOneAnswered, setOneByOneAnswered] = useState(false);

    const [maxQuestions, setMaxQuestions] = useState(10);

    useEffect(() => {
        if (user) {
            getUserProfile(user.uid).then(p => {
                const limit = p.plan === 'free' ? 10 : 30;
                setMaxQuestions(limit);
                if (config.numQuestions > limit) {
                    setConfig(prev => ({ ...prev, numQuestions: limit }));
                }
            });
        }
    }, [user, config.numQuestions]);

    const handleGenerate = async () => {
        if (!fileContent) return;

        const num = Math.min(parseInt(config.numQuestions) || 10, 30);

        setLoading(true);
        setError('');
        setIsConfiguring(false);

        try {
            const result = await generateQuiz(fileContent, config.difficulty, num, config.questionType, user?.uid, user?.email);
            setQuizData(result);
            setUserAnswers({});
            setSubmitted(false);
            setCurrentQIndex(0);
            setOneByOneAnswered(false);
        } catch (err) {
            console.error(err);
            setError('Failed to generate quiz. Please check your internet connection or try a different difficulty/length.');
            // Do NOT set isConfiguring to true here, otherwise the error block below is skipped!
        }
        setLoading(false);
    };

    const handleOptionChange = (qIndex, value) => {
        setUserAnswers(prev => ({ ...prev, [qIndex]: value }));
    };

    const calculateScore = () => {
        let score = 0;
        if (!quizData) return 0;

        quizData.forEach((q, index) => {
            // For identification, we can do a loose string match (case insensitive)
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

    const handleSaveToLibrary = async () => {
        if (!user) {
            toast.error("Please log in to save to your library!");
            return;
        }
        try {
            await saveStudyMaterial(user.uid, `My ${config.difficulty} ${config.questionType} Quiz`, "quiz", quizData);
            toast.success("Saved perfectly to your library!");
        } catch (error) {
            toast.error("Failed to save to library.");
        }
    };

    const progressPercentage = quizData ? (Object.keys(userAnswers).length / quizData.length) * 100 : 0;

    if (isConfiguring) {
        return (
            <div className="fade-in" style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <Settings2 size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
                    <h2 className="gradient-text">Quiz Settings</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Customize how you want to be tested.</p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Difficulty</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {['easy', 'medium', 'hard'].map(level => (
                            <button
                                key={level}
                                onClick={() => setConfig({ ...config, difficulty: level })}
                                className="btn-secondary"
                                style={{
                                    flex: 1,
                                    textTransform: 'capitalize',
                                    background: config.difficulty === level ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                    color: config.difficulty === level ? 'var(--bg-primary)' : 'var(--text-primary)',
                                    borderColor: config.difficulty === level ? 'transparent' : 'var(--border-color)'
                                }}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Number of Questions</label>
                    <input
                        type="number"
                        min="1"
                        max={maxQuestions}
                        value={config.numQuestions}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!e.target.value) { setConfig({ ...config, numQuestions: '' }); return; }
                            setConfig({ ...config, numQuestions: Math.min(Math.max(1, val), maxQuestions) });
                        }}
                        placeholder="e.g. 10"
                        style={{
                            width: '100%', padding: '0.75rem', borderRadius: '8px',
                            border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '1rem'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Choose between 1 – {maxQuestions} questions. More questions take longer.</p>
                        {maxQuestions === 10 && <span className="badge badge-premium">Upgrade for 30</span>}
                    </div>
                </div>

                <div style={{ marginBottom: '2.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Question Format</label>
                    <select
                        value={config.questionType}
                        onChange={(e) => setConfig({ ...config, questionType: e.target.value })}
                        style={{
                            width: '100%', padding: '0.75rem', borderRadius: '8px',
                            border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '1rem'
                        }}
                    >
                        <option value="mixed">Mixed (All Types)</option>
                        <option value="multiple-choice">Multiple Choice Only</option>
                        <option value="identification">Identification Only</option>
                        <option value="enumeration">Enumeration Only</option>
                        <option value="situational">Situational Only</option>
                    </select>
                </div>

                {/* Display Mode Toggle */}
                <div style={{ marginBottom: '2.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Question Display</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[{ value: 'all', label: 'All at Once' }, { value: 'one-by-one', label: 'One by One' }].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setConfig({ ...config, displayMode: opt.value })}
                                className="btn-secondary"
                                style={{
                                    flex: 1,
                                    background: config.displayMode === opt.value ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                    color: config.displayMode === opt.value ? 'var(--bg-primary)' : 'var(--text-primary)',
                                    borderColor: config.displayMode === opt.value ? 'transparent' : 'var(--border-color)'
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button className="btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }} onClick={handleGenerate}>
                    Generate Quiz
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0' }}>
                <Loader2 className="spinner" size={48} color="var(--accent-primary)" />
                <p style={{ marginTop: '1rem' }}>Generating your custom {config.difficulty} quiz...</p>
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

    // ── ONE-BY-ONE MODE ──────────────────────────────────────────
    if (config.displayMode === 'one-by-one' && quizData) {
        const isLastQuestion = currentQIndex === quizData.length - 1;
        const item = quizData[currentQIndex];
        const hasAnswered = oneByOneAnswered;

        // Final results screen
        if (submitted) {
            return (
                <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'var(--bg-glass-hover)', borderRadius: '16px', border: '2px solid var(--accent-primary)' }} className="slide-up">
                    <h2 className="gradient-text" style={{ fontSize: '2.5rem' }}>Quiz Complete!</h2>
                    <div style={{ width: '120px', height: '120px', margin: '2rem auto', borderRadius: '50%', border: '8px solid var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                        {Math.round((calculateScore() / quizData.length) * 100)}%
                    </div>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>You scored <strong>{calculateScore()}</strong> out of <strong>{quizData.length}</strong>.</p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
                        <button className="btn-secondary" onClick={handleSaveToLibrary}><BookmarkPlus size={18} /> Save Quiz</button>
                        <button className="btn-secondary" onClick={() => setIsConfiguring(true)}>New Quiz</button>
                    </div>
                </div>
            );
        }

        return (
            <div className="fade-in">
                {/* Progress bar */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        <span>Question {currentQIndex + 1} of {quizData.length}</span>
                        <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }} onClick={() => setIsConfiguring(true)}><Settings2 size={14} /> Settings</button>
                    </div>
                    <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--accent-gradient)', width: `${((currentQIndex + (hasAnswered ? 1 : 0)) / quizData.length) * 100}%`, transition: 'width 0.4s ease' }} />
                    </div>
                </div>

                {/* Question Card */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '2rem', border: '1px solid var(--border-color)', position: 'relative', marginBottom: '1.5rem' }} className="slide-up" key={currentQIndex}>
                    <span style={{ position: 'absolute', top: '-12px', left: '20px', background: 'var(--accent-gradient)', color: 'var(--bg-primary)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {item.type.replace('-', ' ')}
                    </span>
                    <h4 style={{ margin: '0.5rem 0 1.5rem', fontSize: '1.15rem' }}>{currentQIndex + 1}. {item.question}</h4>

                    {/* Multiple choice / situational */}
                    {item.options ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {item.options.map((opt, i) => {
                                const isSelected = userAnswers[currentQIndex] === opt;
                                const isCorrect = hasAnswered && item.answer === opt;
                                const isWrong = hasAnswered && isSelected && item.answer !== opt;
                                return (
                                    <label key={i} onClick={() => !hasAnswered && handleOptionChange(currentQIndex, opt)} style={{
                                        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
                                        borderRadius: '8px', cursor: hasAnswered ? 'default' : 'pointer',
                                        border: `1px solid ${isCorrect ? 'var(--success)' : isWrong ? 'var(--error)' : isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                        background: isCorrect ? 'rgba(16,185,129,0.1)' : isWrong ? 'rgba(239,68,68,0.1)' : isSelected ? 'var(--bg-glass-hover)' : 'var(--bg-primary)',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <input type="radio" name={`q-${currentQIndex}`} value={opt} checked={isSelected} onChange={() => !hasAnswered && handleOptionChange(currentQIndex, opt)} disabled={hasAnswered} style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px' }} />
                                        <span style={{ flex: 1, color: isCorrect ? 'var(--success)' : isWrong ? 'var(--error)' : 'inherit' }}>{opt}</span>
                                        {isCorrect && <CheckCircle size={20} color="var(--success)" />}
                                        {isWrong && <XCircle size={20} color="var(--error)" />}
                                    </label>
                                );
                            })}
                        </div>
                    ) : item.type === 'enumeration' ? (
                        <div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>List each item on a new line.</p>
                            <textarea rows={5} value={userAnswers[currentQIndex] || ''} onChange={(e) => !hasAnswered && handleOptionChange(currentQIndex, e.target.value)} disabled={hasAnswered}
                                placeholder={"1. First item\n2. Second item"}
                                style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: `1px solid ${hasAnswered ? 'var(--border-color)' : 'var(--accent-primary)'}`, background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                            />
                            {hasAnswered && <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--success)', borderRadius: '8px' }}><strong style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle size={16} /> Answer:</strong><pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>{item.answer}</pre></div>}
                        </div>
                    ) : (
                        <div>
                            <input type="text" value={userAnswers[currentQIndex] || ''} onChange={(e) => !hasAnswered && handleOptionChange(currentQIndex, e.target.value)} disabled={hasAnswered} placeholder="Type your answer here..."
                                style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: `1px solid ${hasAnswered ? 'var(--border-color)' : 'var(--accent-primary)'}`, background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }}
                            />
                            {hasAnswered && (
                                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--success)', borderRadius: '8px' }}>
                                    {String(userAnswers[currentQIndex]).trim().toLowerCase() === String(item.answer).trim().toLowerCase()
                                        ? <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={18} /> Correct!</span>
                                        : <span style={{ color: 'var(--error)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><XCircle size={18} /> Incorrect</span>}
                                    <div style={{ marginTop: '0.5rem' }}><strong style={{ color: 'var(--success)' }}>Correct Answer:</strong> {item.answer}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    {!hasAnswered ? (
                        <button className="btn-primary" style={{ padding: '0.75rem 2rem' }}
                            disabled={userAnswers[currentQIndex] === undefined || userAnswers[currentQIndex] === ''}
                            onClick={() => setOneByOneAnswered(true)}
                        >
                            Check Answer
                        </button>
                    ) : isLastQuestion ? (
                        <button className="btn-primary" style={{ padding: '0.75rem 2rem' }} onClick={() => setSubmitted(true)}>
                            Finish Quiz
                        </button>
                    ) : (
                        <button className="btn-primary" style={{ padding: '0.75rem 2rem' }} onClick={() => { setCurrentQIndex(i => i + 1); setOneByOneAnswered(false); }}>
                            Next Question →
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            {/* Header Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <button className="btn-secondary" onClick={() => setIsConfiguring(true)}>
                    <Settings2 size={18} /> Reconfigure Quiz
                </button>

                {quizData && (
                    <button onClick={handleSaveToLibrary} className="btn-secondary">
                        <BookmarkPlus size={18} /> Save this Quiz
                    </button>
                )}
            </div>

            {/* Progress Bar */}
            {quizData && !submitted && !loading && (
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        <span>Progress</span>
                        <span>{Object.keys(userAnswers).length} / {quizData.length} Completed</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            background: 'var(--accent-gradient)',
                            width: `${progressPercentage}%`,
                            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}></div>
                    </div>
                </div>
            )}

            {quizData && !loading && (
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
                                                border: `1px solid ${border}`,
                                                background: bg,
                                                cursor: submitted ? 'default' : 'pointer',
                                                transition: 'all 0.2s ease',
                                                transform: isSelected && !submitted ? 'scale(1.01)' : 'scale(1)'
                                            }}>
                                                <input
                                                    type="radio"
                                                    name={`question-${qIndex}`}
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
                            ) : item.type === 'enumeration' ? (
                                <div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>List each item on a new line or separate with commas.</p>
                                    <textarea
                                        rows={5}
                                        value={userAnswers[qIndex] || ''}
                                        onChange={(e) => !submitted && handleOptionChange(qIndex, e.target.value)}
                                        disabled={submitted}
                                        placeholder={"1. First item\n2. Second item\n3. Third item"}
                                        style={{
                                            width: '100%', padding: '1rem',
                                            borderRadius: '8px', border: `1px solid ${submitted ? 'var(--border-color)' : 'var(--accent-primary)'}`,
                                            background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                            fontSize: '1rem', outline: 'none', resize: 'vertical',
                                            fontFamily: 'inherit', lineHeight: 1.6
                                        }}
                                    />
                                    {submitted && (
                                        <div className="fade-in" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: '8px' }}>
                                            <strong style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}><CheckCircle size={16} /> Complete Answer:</strong>
                                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>{item.answer}</pre>
                                        </div>
                                    )}
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
                                            borderRadius: '8px', border: `1px solid ${submitted ? 'var(--border-color)' : 'var(--accent-primary)'}`,
                                            background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                            fontSize: '1rem', outline: 'none', transition: 'border 0.3s ease'
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
                            <h2 className="gradient-text" style={{ fontSize: '2.5rem' }}>Quiz Complete!</h2>
                            <div style={{ width: '120px', height: '120px', margin: '2rem auto', borderRadius: '50%', border: '8px solid var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                                {Math.round((calculateScore() / quizData.length) * 100)}%
                            </div>
                            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
                                You scored <strong>{calculateScore()}</strong> out of <strong>{quizData.length}</strong> correct.
                            </p>

                            <button className="btn-secondary" style={{ marginTop: '2rem' }} onClick={() => setIsConfiguring(true)}>
                                Create Another Quiz
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
