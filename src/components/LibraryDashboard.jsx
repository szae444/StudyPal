import { useEffect, useState } from 'react';
import { getUserStudyMaterials, deleteStudyMaterial, updateStudyMaterial, getUserProfile } from '../services/firebaseService';
import { Loader2, Trash2, FileText, HelpCircle, Layers, ExternalLink, Edit2, Check, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LibraryViewer from './LibraryViewer';

export default function LibraryDashboard({ user }) {
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [planLimit, setPlanLimit] = useState(0);
    const [isPremium, setIsPremium] = useState(false);
    const [isFree, setIsFree] = useState(false);

    const fetchMaterials = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getUserStudyMaterials(user.uid);
            setMaterials(data);
            
            const profile = await getUserProfile(user.uid);
            const isPrem = profile.plan === 'premium';
            const isCram = profile.plan === 'cram';
            setIsPremium(isPrem);
            setIsFree(!isPrem && !isCram);
            setPlanLimit(isPrem ? 'Unlimited' : (isCram ? 5 : 3));
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
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            await deleteStudyMaterial(id);
            setMaterials((prev) => prev.filter((m) => m.id !== id));
            toast.success('Deleted from library');
        } catch (err) {
            toast.error('Failed to delete item');
        }
    };

    const handleRename = async (id) => {
        if (!editingTitle.trim()) {
            toast.error('Title cannot be empty');
            return;
        }
        try {
            await updateStudyMaterial(id, { title: editingTitle.trim() });
            setMaterials((prev) => prev.map((m) => m.id === id ? { ...m, title: editingTitle.trim() } : m));
            setEditingId(null);
            toast.success('Material renamed successfully');
        } catch (err) {
            toast.error('Failed to rename material');
        }
    };

    const startEditing = (e, item) => {
        e.stopPropagation();
        setEditingId(item.id);
        setEditingTitle(item.title || '');
    };

    const cancelEditing = (e) => {
        e.stopPropagation();
        setEditingId(null);
        setEditingTitle('');
    };

    const filteredMaterials = materials
        .filter(m => activeTab === 'all' || m.type === activeTab)
        .filter(m => m.title?.toLowerCase().includes(searchQuery.toLowerCase()));

    const getPreviewText = (material) => {
        if (material.type === 'reviewer') {
            return material.data?.substring(0, 100) + '...';
        } else if (material.type === 'quiz') {
            return `${material.data?.length || 0} Questions Quiz`;
        } else if (material.type === 'flashcards') {
            return `${material.data?.length || 0} Flashcards Deck`;
        }
        return 'Study Material';
    };

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
            <div className="library-header" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div className="library-title-group">
                    <h2 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)' }}>My Library</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        Access and manage your generated study materials.
                        <span style={{ marginLeft: '1rem', background: 'var(--bg-glass)', border: '1px solid var(--border-color)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 600 }}>
                            Storage: {materials.length} / {planLimit}
                        </span>
                    </p>
                </div>

                <div className="library-search-container" style={{ position: 'relative', width: '300px' }}>
                    <input
                        type="text"
                        placeholder="Search materials..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            paddingRight: '2.5rem',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.95rem',
                            outline: 'none',
                            transition: 'all 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                    />
                    <FileText size={18} style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
                {[
                    { id: 'all', label: 'All Materials', icon: <Layers size={16} /> },
                    { id: 'reviewer', label: 'Reviewers', icon: <FileText size={16} /> },
                    { id: 'quiz', label: 'Quizzes', icon: <HelpCircle size={16} /> },
                    { id: 'flashcards', label: 'Flashcards', icon: <Layers size={16} /> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem 1.25rem',
                            borderRadius: '10px 10px 0 0',
                            border: 'none',
                            background: activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
                            color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                            fontWeight: activeTab === tab.id ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {tab.icon}
                        {tab.label}
                        <span style={{ 
                            fontSize: '0.7rem', 
                            background: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--bg-glass)', 
                            color: activeTab === tab.id ? 'var(--bg-primary)' : 'var(--text-muted)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '6px',
                            marginLeft: '0.25rem'
                        }}>
                            {materials.filter(m => tab.id === 'all' || m.type === tab.id).length}
                        </span>
                    </button>
                ))}
            </div>

            {filteredMaterials.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-glass)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                    <Layers size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                    <h3 style={{ marginBottom: '0.5rem' }}>No materials found</h3>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {searchQuery ? `No results for "${searchQuery}" in ${activeTab}` : `You haven't added any ${activeTab === 'all' ? '' : activeTab} items yet!`}
                    </p>
                </div>
            ) : (
                <div className="library-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {filteredMaterials.map((item, index) => {
                        const iconColor = item.type === 'reviewer' ? 'var(--accent-primary)' : 
                                         item.type === 'quiz' ? 'var(--accent-secondary)' : 
                                         'var(--success)';

                        return (
                            <div
                                key={item.id}
                                className="glass-panel slide-up"
                                style={{
                                    animationDelay: `${index * 0.05}s`,
                                    padding: '1.75rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    border: '1px solid var(--border-color)',
                                    minHeight: '220px',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSelectedMaterial(item)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{
                                        padding: '0.5rem',
                                        borderRadius: '10px',
                                        background: 'var(--bg-secondary)',
                                        color: iconColor,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {item.type === 'reviewer' && <FileText size={20} />}
                                        {item.type === 'quiz' && <HelpCircle size={20} />}
                                        {item.type === 'flashcards' && <Layers size={20} />}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={(e) => startEditing(e, item)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                                            title="Rename"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                                            title="Delete"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {editingId === item.id ? (
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editingTitle}
                                            onChange={(e) => setEditingTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRename(item.id);
                                                if (e.key === 'Escape') cancelEditing(e);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '0.4rem 0.6rem',
                                                borderRadius: '6px',
                                                border: '1px solid var(--accent-primary)',
                                                background: 'var(--bg-primary)',
                                                color: 'var(--text-primary)',
                                                fontSize: '1rem',
                                                outline: 'none'
                                            }}
                                        />
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRename(item.id); }}
                                            style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        >
                                            <Check size={16} />
                                        </button>
                                        <button 
                                            onClick={cancelEditing}
                                            style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-muted)', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0', lineHeight: 1.3 }}>
                                        {item.title || 'Untitled Material'}
                                    </h3>
                                )}

                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', flex: 1, marginBottom: '1.5rem', lineHeight: '1.5' }}>
                                    {getPreviewText(item)}
                                </p>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {item.type}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                            {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently'}
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>
                                        Open <ExternalLink size={14} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <style>{`
                @media (max-width: 768px) {
                    .library-header { 
                        flex-direction: column !important; 
                        align-items: flex-start !important;
                        gap: 1rem !important;
                        margin-bottom: 2rem !important;
                    }
                    .library-search-container { 
                        width: 100% !important; 
                    }
                    .library-grid {
                        grid-template-columns: 1fr !important;
                        gap: 1rem !important;
                    }
                }
            `}</style>
        </div>
    );
}
