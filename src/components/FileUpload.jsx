import { useState, useRef, useEffect } from 'react';
import { UploadCloud, File, CheckCircle, X, Plus, Lock, Clock } from 'lucide-react';
import * as mammoth from 'mammoth';
import { extractTextFromPDF } from '../utils/fileParser';
import { getUserProfile, checkAndIncrementUploads } from '../services/firebaseService';
import toast from 'react-hot-toast';

export default function FileUpload({ onTextExtracted, user }) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]); // [{ name, size, payload }]
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef(null);

    const [isLocked, setIsLocked] = useState(false);
    const [userPlan, setUserPlan] = useState('free');
    const [uploadsUsed, setUploadsUsed] = useState(0);
    const [quotaResetsAt, setQuotaResetsAt] = useState(null);

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Max file size in bytes per plan. */
    const getFileSizeLimit = (plan) => {
        if (plan === 'premium') return 50 * 1024 * 1024;  // 50 MB
        if (plan === 'cram')    return 15 * 1024 * 1024;  // 15 MB
        return 5 * 1024 * 1024;                            // 5 MB (free)
    };

    /** Max uploads per plan period. */
    const getUploadMax = (plan) => {
        if (plan === 'premium') return Infinity;
        if (plan === 'cram') return 5;
        return 3;
    };

    /** Reset window in ms per plan. */
    const getResetWindowMs = (plan) =>
        plan === 'cram' ? 6 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    /** Format ms-until as "Xd Yh" or "Xh Ym" or "Ym". */
    const formatTimeUntil = (date) => {
        if (!date) return '';
        const ms = date - Date.now();
        if (ms <= 0) return 'soon';
        const totalMins = Math.floor(ms / 60000);
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        if (h >= 24) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h`; }
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    // ── Initial quota check (read-only — no increment) ────────────────────────
    useEffect(() => {
        if (!user) return;
        getUserProfile(user.uid).then(p => {
            setUserPlan(p.plan);
            const used = p.uploadsUsed || 0;
            setUploadsUsed(used);
            if (p.plan === 'premium') return;
            const max = getUploadMax(p.plan);
            if (used >= max) {
                const resetAtMs = p.uploadsResetAt?.toMillis?.() || 0;
                const windowMs = getResetWindowMs(p.plan);
                if (Date.now() < resetAtMs + windowMs) {
                    setIsLocked(true);
                    setQuotaResetsAt(new Date(resetAtMs + windowMs));
                }
                // else: window already passed — auto-reset fires on next upload
            }
        });
    }, [user]);

    // Notify parent whenever file list changes
    const notifyParent = (files) => {
        if (files.length === 0) {
            onTextExtracted(null);
            return;
        }
        if (files.length === 1) {
            onTextExtracted(files[0].payload);
            return;
        }
        // Multiple files: combine all text payloads into a single text block
        const combined = files.map(f =>
            f.payload.type === 'text'
                ? `\n\n=== ${f.name} ===\n${f.payload.data}`
                : null
        ).filter(Boolean).join('');

        // If we have a single binary (image/pdf) alongside text, just pass the first binary
        // Otherwise concatenate all text
        const hasBinary = files.some(f => f.payload.type === 'inline');
        if (hasBinary && files.length === 1) {
            onTextExtracted(files[0].payload);
        } else {
            onTextExtracted({ type: 'text', mimeType: 'text/plain', data: combined });
        }
    };

    const extractPayload = (file) => new Promise((resolve, reject) => {
        const ext = file.name.split('.').pop().toLowerCase();

        if (['txt', 'md', 'csv', 'json'].includes(ext)) {
            const reader = new FileReader();
            reader.onload = (e) => resolve({ type: 'text', mimeType: 'text/plain', data: e.target.result });
            reader.onerror = reject;
            reader.readAsText(file);

        } else if (ext === 'docx') {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
                    resolve({ type: 'text', mimeType: 'text/plain', data: result.value });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);

        } else if (ext === 'pdf') {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const text = await extractTextFromPDF(e.target.result);
                    resolve({ type: 'text', mimeType: 'text/plain', data: text });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);

        } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
            // ── Send image directly to Gemini as base64 inline data ──
            // Tesseract.js OCR fails silently in production builds due to
            // worker path issues. Gemini natively understands images, so
            // we read the file as base64 and let the AI model handle it.
            const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
            const reader = new FileReader();
            reader.onload = (e) => {
                // e.target.result is a data URL: "data:image/png;base64,XXXX..."
                const base64 = e.target.result.split(',')[1];
                resolve({ type: 'inline', mimeType: mimeMap[ext] || 'image/jpeg', data: base64 });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);

        } else {
            reject(new Error(`Unsupported file type: .${ext}`));
        }
    });

    const processFiles = async (newFiles) => {
        if (!newFiles || newFiles.length === 0) return;

        // ── 1. File size validation ───────────────────────────────────────────
        const sizeLimit = getFileSizeLimit(userPlan);
        const limitMB = sizeLimit / (1024 * 1024);
        for (const file of Array.from(newFiles)) {
            if (file.size > sizeLimit) {
                toast.error(`"${file.name}" exceeds the ${limitMB} MB limit for your plan.`);
                return;
            }
        }

        // ── 2. Extract text payload from each file FIRST ─────────────────────
        // Quota is only consumed AFTER we confirm at least one file was
        // successfully parsed — so a broken PDF never wastes an upload slot.
        setIsProcessing(true);
        const results = [];
        for (const file of Array.from(newFiles)) {
            if (uploadedFiles.some(uf => uf.name === file.name)) continue;
            try {
                const payload = await extractPayload(file);
                results.push({ name: file.name, size: (file.size / 1024).toFixed(2) + ' KB', payload });
            } catch (err) {
                console.error(err);
                toast.error(`Could not process "${file.name}": ${err.message}`);
            }
        }

        // If no files were successfully processed, abort — don't touch quota
        if (results.length === 0) {
            setIsProcessing(false);
            return;
        }

        // ── 3. Consume one quota slot now that we know extraction succeeded ───
        if (userPlan !== 'premium' && user) {
            const quota = await checkAndIncrementUploads(user.uid);
            if (!quota.allowed) {
                setIsLocked(true);
                setQuotaResetsAt(quota.resetsAt);
                toast.error('Upload quota reached. Your quota will reset automatically.');
                setIsProcessing(false);
                return;
            }
            setUploadsUsed(quota.used);
        }

        const updated = [...uploadedFiles, ...results];
        setUploadedFiles(updated);
        notifyParent(updated);
        setIsProcessing(false);
    };

    const removeFile = (e, name) => {
        e.stopPropagation();
        const updated = uploadedFiles.filter(f => f.name !== name);
        setUploadedFiles(updated);
        notifyParent(updated);
    };

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        processFiles(e.dataTransfer.files);
    };
    const handleFileChange = (e) => {
        processFiles(e.target.files);
        e.target.value = ''; // reset so same file can be re-added after removal
    };

    const hasFiles = uploadedFiles.length > 0;

    return (
        <div style={{ marginBottom: '2rem' }} className="fade-in no-print">
            <div
                style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '24px',
                    padding: hasFiles ? '1.75rem 2rem' : '3rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isDragging ? 'inset 0 0 0 4px var(--accent-primary)' : 'var(--shadow-sm)',
                    minHeight: hasFiles ? 'auto' : '280px',
                    justifyContent: 'center',
                    cursor: hasFiles ? 'default' : 'pointer',
                    opacity: isProcessing ? 0.75 : 1,
                }}
                onDragOver={isLocked ? undefined : handleDragOver}
                onDragLeave={isLocked ? undefined : handleDragLeave}
                onDrop={isLocked ? undefined : handleDrop}
                onClick={() => !hasFiles && !isProcessing && !isLocked && fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".txt,.md,.csv,.json,.docx,.pdf,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileChange}
                    multiple
                />

                {isProcessing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
                        <div className="spinner" />
                        <h3 style={{ margin: 0 }}>Processing Files…</h3>
                    </div>

                ) : hasFiles ? (
                    <>
                        {/* File chip list */}
                        {/* File summary + upload counter badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle size={22} color="var(--success)" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                    {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} uploaded
                                </span>
                            </div>
                            {/* Upload counter pill */}
                            <UploadCounterBadge plan={userPlan} used={uploadsUsed} />
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                            {uploadedFiles.map(f => (
                                <div key={f.name} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                                    borderRadius: '999px', padding: '0.35rem 0.85rem 0.35rem 0.65rem',
                                    fontSize: '0.875rem', maxWidth: '260px'
                                }}>
                                    <File size={14} style={{ flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>· {f.size}</span>
                                    <button
                                        onClick={(e) => removeFile(e, f.name)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)', flexShrink: 0 }}
                                        title="Remove"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}

                            {/* Add more button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    background: 'var(--bg-glass)', border: '1px dashed var(--border-color)',
                                    borderRadius: '999px', padding: '0.35rem 0.85rem',
                                    fontSize: '0.875rem', cursor: 'pointer', color: 'var(--text-secondary)',
                                    fontWeight: 500, transition: 'all 0.2s'
                                }}
                            >
                                <Plus size={14} /> Add More
                            </button>
                        </div>
                    </>

                ) : isLocked ? (
                    <div className="upload-inner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%', gap: '1rem', padding: '2rem 0' }}>
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1.25rem', borderRadius: '50%', color: 'var(--error)' }}>
                            <Lock size={32} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Upload Limit Reached</h2>
                            <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
                                {userPlan === 'cram'
                                    ? "You've used all 5 of your Cram Pass uploads."
                                    : "You've used all 3 of your free uploads."}
                            </p>
                            {quotaResetsAt && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(245,158,11,0.1)', color: '#D97706', padding: '0.4rem 1rem', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <Clock size={14} />
                                    Resets in {formatTimeUntil(quotaResetsAt)}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="upload-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1.5rem' }}>
                        <div style={{ flex: 1, maxWidth: '600px', textAlign: 'left' }}>
                            <h2 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>Generate New Materials</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: 0, lineHeight: 1.6 }}>
                                Upload one or more files — Text, CSV, PDF, Word (.docx), or Images — to generate Reviewers, Quizzes, and Flashcards.
                            </p>
                            {/* Upload counter shown in empty state */}
                            <div style={{ marginTop: '1rem' }}>
                                <UploadCounterBadge plan={userPlan} used={uploadsUsed} />
                            </div>
                        </div>
                        <div className="upload-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{
                                background: 'var(--bg-glass)', padding: '1.25rem',
                                borderRadius: '50%', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)'
                            }}>
                                <UploadCloud size={28} />
                            </div>
                            <button className="btn-primary" style={{ padding: '1rem 2.5rem' }}>
                                Browse Files
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Tier-aware upload counter badge component.
 * Renders a pill showing "X / Y uploads used" or "Unlimited".
 */
function UploadCounterBadge({ plan, used }) {
    if (plan === 'premium') {
        return (
            <span className="badge badge-premium" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}>
                ∞ Unlimited AI uploads
            </span>
        );
    }

    const max = plan === 'cram' ? 5 : 3;
    const remaining = Math.max(max - used, 0);
    const pct = Math.min((used / max) * 100, 100);
    const isWarning = remaining <= 1 && remaining > 0;
    const isDanger = remaining === 0;

    const color = isDanger ? 'var(--error)' : isWarning ? 'var(--warning)' : 'var(--success)';
    const bg = isDanger ? 'rgba(239,68,68,0.1)' : isWarning ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)';

    return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.35rem', minWidth: '180px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    background: bg, color,
                    padding: '0.3rem 0.8rem', borderRadius: '99px',
                    fontSize: '0.8rem', fontWeight: 700
                }}>
                    {used} / {max} AI uploads used
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    {remaining} left
                </span>
            </div>
            {/* Mini progress bar */}
            <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.4s ease' }} />
            </div>
        </div>
    );
}
