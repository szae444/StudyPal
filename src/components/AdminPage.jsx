import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { subscribeToUserStats, subscribeToAIUsageLogs, subscribeToStudyMaterials, subscribeToPendingPayments, resolvePayment } from '../services/firebaseService';
import { Loader2, Users, Zap, BookOpen, MessageSquare, RefreshCw, Brain, FileText, Star, Clock, TrendingUp, Shield, Activity, BarChart3, Database } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

const ADMIN_EMAIL = 'etrazalsebastian@gmail.com';

const MODEL_LABELS = {
    'nvidia/nemotron-3-nano-30b-a3b:free': 'Nemotron Nano',
    'openai/gpt-oss-20b:free': 'GPT-OSS 20B',
    'openai/gpt-oss-120b:free': 'GPT-OSS 120B',
    'nvidia/nemotron-3-super-120b-a12b:free': 'Nemotron Super',
    'gemini-1.5-flash': 'Gemini 1.5 Flash',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
};

// Monochrome + single accent categorical scale — keeps the four features
// distinguishable without reintroducing a rainbow palette.
const FEATURE_COLORS = {
    quiz: 'var(--accent-premium)',
    flashcards: 'var(--text-primary)',
    reviewer: 'var(--text-secondary)',
    chat: 'var(--text-muted)',
};

const FEATURE_ICONS = {
    quiz: Brain,
    flashcards: BookOpen,
    reviewer: FileText,
    chat: MessageSquare,
};

function StatCard({ icon: Icon, label, value, sub, trend }) {
    return (
        <div style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'default'
        }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.04)';
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '14px', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color="var(--text-primary)" strokeWidth={2.5} />
                </div>
                {trend && (
                    <div className="badge badge-success">
                        <TrendingUp size={12} strokeWidth={3} /> {trend}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            </div>
            {sub && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>{sub}</div>}
        </div>
    );
}

function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const isToday = d.toDateString() === new Date().toDateString();
    if (isToday) {
        return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AdminPage({ user }) {
    const [loading, setLoading] = useState(true);
    const [userStats, setUserStats] = useState([]);
    const [usageLogs, setUsageLogs] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [lastRefresh, setLastRefresh] = useState(null);
    const [pendingPayments, setPendingPayments] = useState([]);
    const [rejectDialog, setRejectDialog] = useState(null);

    // Guard
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '6rem 2rem', textAlign: 'center' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
                    <Shield size={48} color="var(--error)" strokeWidth={2} />
                </div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Restricted Area</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Admin privileges are required to access this dashboard.</p>
            </div>
        );
    }

    const triggerManualSync = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setLastRefresh(new Date());
        }, 500);
    };

    useEffect(() => {
        setLoading(true);
        let activeListeners = 0;
        const totalListeners = 4;

        const checkLoading = () => {
            activeListeners++;
            if (activeListeners >= totalListeners) {
                setLoading(false);
            }
        };

        const unsubStats = subscribeToUserStats((stats) => {
            setUserStats(stats);
            setLastRefresh(new Date());
            checkLoading();
        });

        const unsubLogs = subscribeToAIUsageLogs((logs) => {
            setUsageLogs(logs);
            checkLoading();
        }, 500);

        const unsubMaterials = subscribeToStudyMaterials((mats) => {
            setMaterials(mats);
            checkLoading();
        });

        const unsubPayments = subscribeToPendingPayments((payments) => {
            setPendingPayments(payments);
            checkLoading();
        });

        return () => {
            unsubStats();
            unsubLogs();
            unsubMaterials();
            unsubPayments();
        };
    }, []);

    const handleApprove = async (paymentId, userId, plan) => {
        try {
            await resolvePayment(paymentId, userId, 'approved', plan, '');
            toast.success('Payment approved successfully!');
        } catch (e) {
            toast.error('Error resolving payment: ' + e.message);
        }
    };

    const confirmReject = async (reason) => {
        const { paymentId, userId, plan } = rejectDialog;
        setRejectDialog(null);
        try {
            await resolvePayment(paymentId, userId, 'rejected', plan, reason || 'Receipt invalid or amount incorrect. Please try again.');
            toast.success('Payment rejected.');
        } catch (e) {
            toast.error('Error resolving payment: ' + e.message);
        }
    };

    // ── Derived metrics ────────────────────────────────────────────────────────
    const totalUsers = userStats.length;
    const totalAICalls = usageLogs.length;
    const totalMaterials = materials.length;

    const callsByFeature = usageLogs.reduce((acc, l) => {
        acc[l.feature] = (acc[l.feature] || 0) + 1;
        return acc;
    }, {});

    const callsByModel = usageLogs.reduce((acc, l) => {
        const label = MODEL_LABELS[l.model] || l.model;
        acc[label] = (acc[label] || 0) + 1;
        return acc;
    }, {});

    const topUsers = [...userStats]
        .sort((a, b) => (b.totalCalls || 0) - (a.totalCalls || 0))
        .slice(0, 15); // Show top 15

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'approvals', label: 'Approvals', icon: Shield, badge: pendingPayments.length },
        { id: 'users', label: 'User Directory', icon: Users, badge: totalUsers },
        { id: 'usage', label: 'Usage Logs', icon: Database, badge: totalAICalls },
        { id: 'activity', label: 'Live Activity', icon: Activity },
    ];

    return (
        <div className="fade-in" style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem 0 5rem', width: '100%' }}>

            {/* ── Dashboard Header (Premium Banner) ──────────────────────────── */}
            <div style={{
                background: 'linear-gradient(135deg, var(--accent-premium-soft) 0%, transparent 100%)',
                border: '1px solid var(--border-color)',
                borderRadius: '24px',
                padding: '2rem 2.5rem',
                marginBottom: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.5rem',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--accent-premium), var(--text-primary))' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)', padding: '1rem', borderRadius: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
                        <Shield size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0 0 0.25rem 0', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                            Command Center
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%', boxShadow: '0 0 8px var(--success)' }} />
                            System active and monitoring {totalUsers} users
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Synced</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{lastRefresh ? lastRefresh.toLocaleTimeString() : '—'}</div>
                    </div>
                    <button
                        onClick={triggerManualSync}
                        disabled={loading}
                        style={{
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            padding: '0.75rem 1.25rem',
                            borderRadius: '12px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                        onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--bg-primary)'; }}
                    >
                        <RefreshCw size={18} className={loading ? 'spinner' : ''} />
                        Refresh Data
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8rem 0', gap: '1.5rem' }}>
                    <Loader2 size={56} className="spinner" color="var(--accent-premium)" />
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: 500 }}>Synchronizing telemetry data…</p>
                </div>
            ) : (
                <>
                    {/* ── Segmented Navigation ───────────────────────────────────────────── */}
                    <div style={{
                        display: 'inline-flex',
                        background: 'var(--bg-secondary)',
                        borderRadius: '16px',
                        padding: '0.35rem',
                        marginBottom: '2.5rem',
                        border: '1px solid var(--border-color)',
                        maxWidth: '100%',
                        overflowX: 'auto'
                    }}>
                        {tabs.map(t => {
                            const Icon = t.icon;
                            const isActive = activeTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontWeight: isActive ? 700 : 600,
                                        fontSize: '0.95rem',
                                        whiteSpace: 'nowrap',
                                        background: isActive ? 'var(--bg-primary)' : 'transparent',
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                        boxShadow: isActive ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                >
                                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} color={isActive ? 'var(--accent-premium)' : 'currentColor'} />
                                    {t.label}
                                    {t.badge !== undefined && (
                                        <span className={isActive ? 'badge badge-premium' : 'badge'} style={!isActive ? { background: 'var(--bg-glass)', color: 'var(--text-muted)' } : undefined}>
                                            {t.badge > 999 ? '999+' : t.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── APPROVALS TAB ───────────────────────────────────────── */}
                    {activeTab === 'approvals' && (
                        <div className="slide-up">
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>Pending Verifications</h3>
                            {pendingPayments.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-glass)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                    <Shield size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: 'var(--text-primary)' }}>All Caught Up!</h4>
                                    <p style={{ color: 'var(--text-muted)' }}>There are no pending payments to review.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {pendingPayments.map(p => (
                                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                                <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer">
                                                    <img src={p.receiptUrl} alt="Receipt" style={{ width: '80px', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }} />
                                                </a>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{p.userEmail}</div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Requested: <span style={{ fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'capitalize' }}>{p.planRequested} Plan</span></div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Ref Number: <span style={{ fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>{p.refNumber}</span></div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Submitted: {formatDate(p.createdAt)}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                <button
                                                    onClick={() => setRejectDialog({ paymentId: p.id, userId: p.userId, plan: p.planRequested, email: p.userEmail })}
                                                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(p.id, p.userId, p.planRequested)}
                                                    style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
                                                >
                                                    Approve
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── OVERVIEW TAB ───────────────────────────────────────── */}
                    {activeTab === 'overview' && (
                        <div className="slide-up">
                            {/* KPI Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                                <StatCard icon={Users} label="Total Users" value={totalUsers} trend="+12%" sub="Registered accounts across all platforms" />
                                <StatCard icon={Zap} label="Total AI Calls" value={totalAICalls.toLocaleString()} trend="+34%" sub="Generations across all LLM models" />
                                <StatCard icon={Star} label="Library Saves" value={totalMaterials.toLocaleString()} sub="Materials retained by users" />
                                <StatCard icon={Activity} label="Avg Calls/User" value={totalUsers > 0 ? (totalAICalls / totalUsers).toFixed(1) : '0'} sub="Average engagement depth" />
                            </div>

                            {/* Complex Charts/Breakdowns */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>

                                {/* Feature Breakdown */}
                                <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ background: 'var(--accent-premium-soft)', padding: '0.4rem', borderRadius: '8px' }}><Zap size={16} color="var(--accent-premium)" /></div>
                                            AI Usage by Feature
                                        </h3>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        {Object.entries(callsByFeature).length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)' }}>No data available.</p>
                                        ) : (
                                            Object.entries(callsByFeature).sort((a, b) => b[1] - a[1]).map(([feat, count]) => {
                                                const pct = Math.round((count / totalAICalls) * 100);
                                                const FeatIcon = FEATURE_ICONS[feat] || Zap;
                                                const color = FEATURE_COLORS[feat] || 'var(--text-muted)';
                                                return (
                                                    <div key={feat} className="group">
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 700, textTransform: 'capitalize' }}>
                                                                <FeatIcon size={16} color={color} /> {feat}
                                                            </span>
                                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                                {count} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8rem' }}>({pct}%)</span>
                                                            </span>
                                                        </div>
                                                        <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '99px', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Model Breakdown */}
                                <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ background: 'var(--accent-premium-soft)', padding: '0.4rem', borderRadius: '8px' }}><Brain size={16} color="var(--accent-premium)" /></div>
                                            API Model Distribution
                                        </h3>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        {Object.entries(callsByModel).length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)', gridColumn: 'span 2' }}>No data available.</p>
                                        ) : (
                                            Object.entries(callsByModel).sort((a, b) => b[1] - a[1]).map(([model, count]) => (
                                                <div key={model} style={{
                                                    background: 'var(--bg-secondary)',
                                                    borderRadius: '16px',
                                                    padding: '1.25rem',
                                                    border: '1px solid var(--border-color)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.5rem'
                                                }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{model}</div>
                                                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                                                        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-premium)', letterSpacing: '-0.02em' }}>{count}</span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Reqs</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* ── USERS TAB ─────────────────────────────────────────── */}
                    {activeTab === 'users' && (
                        <div className="slide-up">
                            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
                                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.01)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ background: 'var(--accent-premium-soft)', padding: '0.5rem', borderRadius: '10px' }}><Users size={20} color="var(--accent-premium)" /></div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>User Directory</h3>
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Showing top {topUsers.length}</span>
                                </div>

                                {userStats.length === 0 ? (
                                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No user stats recorded yet.</div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                                    {['User Email', 'Total AI Calls', 'Quiz', 'Cards', 'Reviewer', 'Chat', 'Last Active'].map(h => (
                                                        <th key={h} style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {topUsers.map((u, i) => (
                                                    <tr key={u.id} style={{
                                                        borderBottom: '1px solid var(--border-color)',
                                                        transition: 'background 0.2s ease',
                                                    }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                <div className="avatar-tile" style={{ width: '32px', height: '32px', borderRadius: '50%', fontSize: '0.85rem' }}>
                                                                    {u.email ? u.email.charAt(0).toUpperCase() : '?'}
                                                                </div>
                                                                {u.email}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                                            <span className="badge badge-premium">
                                                                {u.totalCalls || 0}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1.25rem 1.5rem', color: FEATURE_COLORS.quiz, fontWeight: 700 }}>{u.quizCalls || 0}</td>
                                                        <td style={{ padding: '1.25rem 1.5rem', color: FEATURE_COLORS.flashcards, fontWeight: 700 }}>{u.flashcardsCalls || 0}</td>
                                                        <td style={{ padding: '1.25rem 1.5rem', color: FEATURE_COLORS.reviewer, fontWeight: 700 }}>{u.reviewerCalls || 0}</td>
                                                        <td style={{ padding: '1.25rem 1.5rem', color: FEATURE_COLORS.chat, fontWeight: 700 }}>{u.chatCalls || 0}</td>
                                                        <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{formatDate(u.lastActiveAt)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── USAGE LOGS TAB ──────────────────────────────────────── */}
                    {activeTab === 'usage' && (
                        <div className="slide-up">
                            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
                                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.01)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ background: 'var(--accent-premium-soft)', padding: '0.5rem', borderRadius: '10px' }}><Database size={20} color="var(--accent-premium)" /></div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Raw Telemetry Data</h3>
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Latest {usageLogs.length} events</span>
                                </div>

                                {usageLogs.length === 0 ? (
                                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No logs available.</div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                                    {['Timestamp', 'User', 'Feature', 'API Model', 'Generated Items'].map(h => (
                                                        <th key={h} style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {usageLogs.map((log, i) => {
                                                    const FeatIcon = FEATURE_ICONS[log.feature] || Zap;
                                                    const color = FEATURE_COLORS[log.feature] || 'var(--text-muted)';
                                                    return (
                                                        <tr key={log.id} style={{
                                                            borderBottom: '1px solid var(--border-color)',
                                                            transition: 'background 0.2s ease',
                                                        }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                                                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: 600 }}>{log.userEmail}</td>
                                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', color: color, borderRadius: '99px', padding: '0.3rem 0.75rem', fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize' }}>
                                                                    <FeatIcon size={14} strokeWidth={2.5} />{log.feature}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                                <span style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                                                                    {MODEL_LABELS[log.model] || log.model}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '1rem 1.5rem', fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem' }}>{log.itemCount > 0 ? log.itemCount : '—'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── ACTIVITY FEED TAB ─────────────────────────────────── */}
                    {activeTab === 'activity' && (
                        <div className="slide-up" style={{ maxWidth: '800px', margin: '0 auto' }}>
                            <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                                {/* Continuous timeline line */}
                                <div style={{ position: 'absolute', left: '27px', top: '24px', bottom: '24px', width: '2px', background: 'var(--border-color)', zIndex: 0 }} />

                                {usageLogs.length === 0 && (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No activity yet.</div>
                                )}

                                {usageLogs.slice(0, 100).map((log, index) => {
                                    const FeatIcon = FEATURE_ICONS[log.feature] || Zap;
                                    const color = FEATURE_COLORS[log.feature] || 'var(--text-muted)';

                                    let actionHtml;
                                    if (log.feature === 'quiz') actionHtml = <>generated a <strong>{log.itemCount}-question</strong> quiz</>;
                                    else if (log.feature === 'flashcards') actionHtml = <>created a <strong>{log.itemCount}-card</strong> flashcard deck</>;
                                    else if (log.feature === 'reviewer') actionHtml = <>generated a <strong>study reviewer</strong> document</>;
                                    else if (log.feature === 'chat') actionHtml = <>used the <strong>AI assistant</strong></>;
                                    else actionHtml = <>used an AI feature</>;

                                    return (
                                        <div key={log.id} style={{ position: 'relative', display: 'flex', gap: '1.5rem', marginBottom: '2rem', zIndex: 1 }}>

                                            {/* Timeline Node */}
                                            <div style={{
                                                width: '16px', height: '16px', borderRadius: '50%',
                                                background: color, border: '4px solid var(--bg-primary)',
                                                marginTop: '1.25rem', flexShrink: 0,
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                            }} />

                                            {/* Content Card */}
                                            <div style={{
                                                flex: 1, background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
                                                borderRadius: '20px', padding: '1.25rem 1.5rem',
                                                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                                                display: 'flex', alignItems: 'center', gap: '1.25rem',
                                                transition: 'transform 0.2s',
                                                cursor: 'default'
                                            }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                                                onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                                            >
                                                <div style={{ background: 'var(--bg-secondary)', borderRadius: '14px', padding: '0.8rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                                    <FeatIcon size={24} color={color} strokeWidth={2} />
                                                </div>

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{log.userEmail}</span> {actionHtml}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                            <Clock size={14} />{formatDate(log.timestamp)}
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 500 }}>
                                                            {MODEL_LABELS[log.model] || log.model}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            <ConfirmDialog
                key={rejectDialog?.paymentId || 'reject-dialog'}
                open={!!rejectDialog}
                title="Reject Payment"
                message={`Reject the payment from ${rejectDialog?.email || 'this user'}? You can add an optional reason below — it will be shown to the user.`}
                showInput
                inputPlaceholder="Receipt invalid or amount incorrect. Please try again."
                confirmLabel="Reject Payment"
                danger
                onConfirm={confirmReject}
                onCancel={() => setRejectDialog(null)}
            />
        </div>
    );
}
