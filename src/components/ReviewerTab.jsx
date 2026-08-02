import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Download, Loader2, BookmarkPlus, FileText } from 'lucide-react';
import { generateReviewer } from '../services/geminiService';
import { saveStudyMaterial } from '../services/firebaseService';
import { toast } from 'react-hot-toast';

export default function ReviewerTab({ fileContent, user }) {
    const [reviewerContent, setReviewerContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isHighlighting, setIsHighlighting] = useState(false);
    const [headerColor, setHeaderColor] = useState('#1A1A1A');
    const [columnCount, setColumnCount] = useState(2);

    const fetchReviewer = async () => {
        if (!fileContent) return;
        setLoading(true);
        setError('');
        try {
            const result = await generateReviewer(fileContent, isHighlighting, user?.uid, user?.email);
            setReviewerContent(result);
        } catch (err) {
            console.error(err);
            setError('Failed to generate reviewer. Please ensure your Gemini API key is configured correctly in .env.local.');
        }
        setLoading(false);
    };

    const handleDownloadPDF = () => {
        const printWindow = window.open('', '_blank', 'width=1000,height=800');
        const h1Color = headerColor;
        const h2Color = headerColor;
        const h3Color = headerColor;

        // Get the HTML content of the reviewer div
        const reviewerEl = document.querySelector('.reviewer-layout');
        const content = reviewerEl ? reviewerEl.innerHTML : '';

        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StudyPal Reviewer</title>
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
      border-top: 2px solid ${h1Color};
      border-bottom: 2px solid ${h1Color};
      color: ${h1Color};
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
      background-color: ${h2Color};
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
      border: 1px solid ${h3Color};
      color: ${h3Color};
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
      border: 1px dashed ${h1Color};
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


    const handleSaveToLibrary = async () => {
        if (!user) {
            toast.error("Please log in to save to your library!");
            return;
        }

        try {
            await saveStudyMaterial(user.uid, "My Reviewer", "reviewer", reviewerContent);
            toast.success("Saved perfectly to your library!");
        } catch (error) {
            console.error("Save error details:", error);
            toast.error(`Failed to save to library: ${error.message || "Unknown error"}`);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }} className="fade-in">
                <Loader2 className="spinner" size={48} color="var(--accent-primary)" />
                <h3 style={{ marginTop: '1rem' }}>Generating your customized reviewer...</h3>
                <p style={{ color: 'var(--text-muted)' }}>This might take a few seconds.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderRadius: '12px', border: '1px solid var(--error)' }}>
                <strong>Error:</strong> {error}
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
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '400px' }}>
                    Click the button below to analyze your uploaded document and generate a comprehensive study reviewer.
                </p>

                <div className="fade-in" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '400px', textAlign: 'left' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Reviewer Settings</h4>
                    
                    {/* Highlight Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setIsHighlighting(!isHighlighting)}>
                        <input 
                            type="checkbox" 
                            checked={isHighlighting} 
                            onChange={(e) => setIsHighlighting(e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                        />
                        <label style={{ fontSize: '0.95rem', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
                            Highlight important information
                        </label>
                    </div>

                    {/* Column layout toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <label style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Layout:</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {[1, 2].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setColumnCount(n)}
                                    style={{
                                        padding: '0.4rem 1rem',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem',
                                        fontWeight: 500,
                                        border: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        background: columnCount === n ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                        color: columnCount === n ? 'var(--bg-primary)' : 'var(--text-primary)',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {n === 1 ? '1 Column' : '2 Columns'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Header Color Picker */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <label style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            Header Theme Color:
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{headerColor.toUpperCase()}</span>
                            <input
                                type="color"
                                value={headerColor}
                                onChange={(e) => setHeaderColor(e.target.value)}
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
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1.5rem' }}>
                <button onClick={handleSaveToLibrary} className="btn-secondary">
                    <BookmarkPlus size={18} /> Save to Library
                </button>
                <button onClick={handleDownloadPDF} className="btn-primary">
                    <Download size={18} /> Download as PDF
                </button>
            </div>

            {/* Custom Styling block to inject headerColor and columnCount */}
            <style>{`
                .custom-reviewer-theme h1 { border-color: ${headerColor}; color: ${headerColor}; }
                .custom-reviewer-theme h2 { background-color: ${headerColor}; color: #ffffff; }
                .custom-reviewer-theme h3 { border-color: ${headerColor}; color: ${headerColor}; }
                .custom-reviewer-theme h4 { color: ${headerColor}; border-color: ${headerColor}; opacity: 0.8; }
                .custom-reviewer-theme blockquote { border-color: ${headerColor}; }
                .custom-reviewer-theme strong { border-bottom-color: ${headerColor}; }
                .reviewer-layout.custom-reviewer-theme { column-count: ${columnCount} !important; column-rule: ${columnCount === 2 ? '1px solid var(--border-color)' : 'none'} !important; }
            `}</style>

            {/* Markdown Content Area */}
            <div className="reviewer-layout custom-reviewer-theme">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {reviewerContent}
                </ReactMarkdown>
            </div>
        </div>
    );
}
