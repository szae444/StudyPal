import { useEffect, useState } from 'react';
import { getUserStudyMaterials, deleteStudyMaterial, getUserProfile } from '../services/firebaseService';
import { Loader2, Trash2, FileText, HelpCircle, Layers, ExternalLink, HardDrive } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LibraryViewer from './LibraryViewer';

export default function Library({ user }) {
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [profile, setProfile] = useState({ plan: 'free', uploadsUsed: 0 });

    const fetchMaterials = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getUserStudyMaterials(user.uid);
            setMaterials(data);
            const prof = await getUserProfile(user.uid);
            setProfile(prof);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load your library.');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchMaterials();
    }, [user]);

    const handleDelete = async (id) => {
        try {
            await deleteStudyMaterial(id);
            setMaterials((prev) => prev.filter((m) => m.id !== id));
            toast.success('Deleted from library');
        } catch (err) {
            toast.error('Failed to delete item');
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'reviewer':
                return <FileText size={20} className="gradient-text" style={{ color: 'var(--accent-primary)' }} />;
            case 'quiz':
                return <HelpCircle size={20} className="gradient-text" style={{ color: 'var(--accent-secondary)' }} />;
            case 'flashcards':
                return <Layers size={20} className="gradient-text" style={{ color: 'var(--success)' }} />;
            default:
                return <FileText size={20} />;
        }
    };

    const getPreviewText = (material) => {
        if (material.type === 'reviewer') {
            return material.data.substring(0, 100) + '...';
        } else if (material.type === 'quiz') {
            return `${material.data.length} Questions Quiz`;
        } else if (material.type === 'flashcards') {
            return `${material.data.length} Flashcards Deck`;
        }
        return 'Study Material';
    };

    const getPlanLimit = () => {
        if (profile.plan === 'premium') return 'Unlimited';
        if (profile.plan === 'cram') return 100;
        return 15; // Free
    };

    const maxLimit = getPlanLimit();
    const usedCount = materials.length;
    const isUnlimited = maxLimit === 'Unlimited';
    const percent = isUnlimited ? 0 : Math.min((usedCount / maxLimit) * 100, 100);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                <Loader2 className="spinner" size={48} color="var(--accent-primary)" />
                <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>Loading your library...</h3>
            </div>
        );
    }

    if (selectedMaterial) {
        return <LibraryViewer material={selectedMaterial} onBack={() => setSelectedMaterial(null)} />;
    }

    return (
        <div className="fade-in">
            <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
                <h2 className="gradient-text" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Your Library</h2>
                <p style={{ color: 'var(--text-muted)' }}>All your saved customized learning resources.</p>
            </div>

            {/* Storage Progress Bar */}
            <div style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '1rem 1.5rem',
                marginBottom: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HardDrive size={18} color="var(--accent-primary)" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Library Storage</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {isUnlimited ? 'Unlimited storage active' : `${maxLimit - usedCount} slots remaining`}
                        </div>
                    </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, maxWidth: '400px', width: '100%' }}>
                    <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '99px', overflow: 'hidden', flex: 1 }}>
                        <div style={{ height: '100%', width: `${isUnlimited ? 100 : percent}%`, background: 'var(--accent-primary)', borderRadius: '99px' }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {usedCount} / {isUnlimited ? '∞' : maxLimit}
                    </span>
                </div>
            </div>

            {materials.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-glass)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                    <Layers size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                    <h3 style={{ marginBottom: '0.5rem' }}>Your library is empty</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Generate some reviewers, quizzes, or flashcards and save them here!</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
                    {materials.map((item, index) => (
                        <div
                            key={item.id}
                            className="glass-panel slide-up"
                            style={{
                                animationDelay: `${index * 0.05}s`,
                                padding: '1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                {getTypeIcon(item.type)}
                                <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                    {item.type}
                                </span>
                            </div>

                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.title || 'Untitled Material'}
                            </h3>

                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flex: 1, marginBottom: '2rem', lineHeight: '1.5' }}>
                                {getPreviewText(item)}
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', position: 'relative', zIndex: 10 }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                                </span>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className="btn-secondary"
                                        style={{ padding: '0.5rem', borderRadius: '8px' }}
                                        onClick={() => setSelectedMaterial(item)}
                                        title="View"
                                    >
                                        <ExternalLink size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="btn-secondary"
                                        style={{ padding: '0.5rem', borderRadius: '8px', color: 'var(--error)', borderColor: 'var(--border-color)' }}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
