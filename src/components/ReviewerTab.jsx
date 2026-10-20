import { useState, useEffect, useRef } from 'react';
import { Download, Loader2, BookmarkPlus, FileText } from 'lucide-react';
import { generateReviewer } from '../services/geminiService';
import { saveStudyMaterial } from '../services/firebaseService';
import { reviewerTitle } from '../utils/reviewerMarkdown';
import { printReviewer } from '../utils/printReviewer';
import ReviewerDocument, { ColumnToggle } from './ReviewerDocument';
import { toast } from 'react-hot-toast';

// Above this many characters the function writes the reviewer in parts (REVIEWER_SINGLE_PASS_CHARS).
const LARGE_DOCUMENT_CHARS = 90_000;
const CHARS_PER_PAGE = 2_500;

const textLength = (content) => {
    if (!content) return 0;
    if (typeof content === 'string') return content.length;
    if (content.type === 'text') return content.data.length;
    if (content.type === 'parts') return content.items.reduce((n, item) => n + (item.type === 'text' ? item.data.length : 0), 0);
    return 0;
};

export default function ReviewerTab({ fileContent, user }) {
    const [reviewerContent, setReviewerContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState('');
    const [isHighlighting, setIsHighlighting] = useState(false);
    const [accent, setAccent] = useState(null); // null = ink, which follows day/night desk
    const [columnCount, setColumnCount] = useState(2);
    const documentRef = useRef(null);

    const chars = textLength(fileContent);
    const isLarge = chars > LARGE_DOCUMENT_CHARS;

    useEffect(() => {
        if (!loading) return;
        const started = Date.now();
        const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
        return () => clearInterval(id);
    }, [loading]);

    const fetchReviewer = async () => {
        if (!fileContent) return;
        setLoading(true);
        setElapsed(0);
        setError('');
        try {
            const result = await generateReviewer(fileContent, isHighlighting);
            setReviewerContent(result);
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to generate reviewer. Please try again.');
        }
        setLoading(false);
    };

    const handleDownloadPDF = () => {
        if (!printReviewer(documentRef.current, reviewerTitle(reviewerContent))) {
            toast.error('Allow pop-ups for StudyPal to download the PDF.');
        }
    };

    const handleSaveToLibrary = async () => {
        if (!user) {
            toast.error("Please log in to save to your library!");
            return;
        }

        try {
            await saveStudyMaterial(user.uid, reviewerTitle(reviewerContent, 'My Reviewer'), "reviewer", reviewerContent);
            toast.success("Saved perfectly to your library!");
        } catch (error) {
            console.error("Save error details:", error);
            toast.error(`Failed to save to library: ${error.message || "Unknown error"}`);
        }
    };

    if (loading) {
        const minutes = Math.floor(elapsed / 60);
        const seconds = String(elapsed % 60).padStart(2, '0');
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', textAlign: 'center' }} className="fade-in">
                <Loader2 className="spinner" size={48} color="var(--accent-primary)" />
                <h3 style={{ marginTop: '1rem' }}>Writing your reviewer…</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '440px' }}>
                    {isLarge
                        ? `This is a large document (about ${Math.round(chars / CHARS_PER_PAGE)} pages), so it's written in parts. This can take 2–5 minutes; keep this tab open.`
                        : 'This usually takes under a minute.'}
                </p>
                <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    {minutes}:{seconds}
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', background: 'var(--pen-soft)', color: 'var(--error)', borderRadius: '12px', border: '1px solid var(--error)' }}>
                <strong>Error:</strong> {error}
                <div style={{ marginTop: '1rem' }}>
                    <button onClick={fetchReviewer} className="btn-secondary">Try again</button>
                </div>
            </div>
        );
    }

    if (!reviewerContent) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', textAlign: 'center' }} className="fade-in">
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '50%', color: 'var(--accent-primary)', marginBottom: '1.5rem' }}>
                    <FileText size={48} />
                </div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Ready to generate Reviewer</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '420px' }}>
                    Turns your notes into a study reviewer: numbered topics, comparison tables, high-yield boxes, worked examples and a quick self-check after each topic.
                </p>

                <div className="fade-in" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '400px', textAlign: 'left' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Reviewer Settings</h4>

                    {/* Highlight Toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.95rem', color: 'var(--text-primary)', userSelect: 'none' }}>
                        <input
                            type="checkbox"
                            checked={isHighlighting}
                            onChange={(e) => setIsHighlighting(e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                        />
                        Highlight the most testable facts
                    </label>

                    {/* Column layout toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Layout:</span>
                        <ColumnToggle columns={columnCount} setColumns={setColumnCount} />
                    </div>

                    {/* Header Color Picker */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <label htmlFor="reviewer-accent" style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            Header Theme Color:
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {accent ? (
                                <button onClick={() => setAccent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
                                    Reset
                                </button>
                            ) : (
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ink</span>
                            )}
                            <input
                                id="reviewer-accent"
                                type="color"
                                value={accent || '#1E1C19'}
                                onChange={(e) => setAccent(e.target.value)}
                                style={{
                                    width: '32px', height: '32px', padding: 0,
                                    border: '2px solid var(--bg-glass)', boxShadow: '0 0 0 1px var(--border-color)',
                                    borderRadius: '50%', cursor: 'pointer', outline: 'none',
                                    backgroundColor: 'transparent'
                                }}
                            />
                        </div>
                    </div>
                </div>

                <button onClick={fetchReviewer} className="btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
                    <FileText size={20} /> Generate Reviewer
                </button>
                {isLarge && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                        Large document detected — it will be written in parts (2–5 minutes).
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <ColumnToggle columns={columnCount} setColumns={setColumnCount} />
                <button onClick={handleSaveToLibrary} className="btn-secondary">
                    <BookmarkPlus size={18} /> Save to Library
                </button>
                <button onClick={handleDownloadPDF} className="btn-primary">
                    <Download size={18} /> Download as PDF
                </button>
            </div>

            <ReviewerDocument ref={documentRef} markdown={reviewerContent} columns={columnCount} accent={accent} />
        </div>
    );
}
