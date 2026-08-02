import { useState, useEffect } from 'react';
import { getUserProfile, getAllStudyMaterials } from '../services/firebaseService';
import { Shield, Clock, HardDrive, Zap, CreditCard, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function AccountPage({ user, setCurrentView }) {
    const [profile, setProfile] = useState({ plan: 'free', uploadsUsed: 0 });
    const [materialsCount, setMaterialsCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            try {
                const p = await getUserProfile(user.uid);
                setProfile(p);
                
                // Hack: We don't have a getUserStudyMaterials exposed that easily returns just count, 
                // but we can fetch them all and filter by user to get the count, 
                // or just assume we have a way. Actually we can use getAllStudyMaterials and filter
                // since the user only has access to their own materials due to Firestore rules (hopefully)
                // Wait, firebaseService has `getAllStudyMaterials` which is an admin function.
                // Let's implement fetching user's materials count properly.
                // Actually, I can just use a query if I import `getDocs, collection, query, where, db`.
                const { db } = await import('../services/firebaseService');
                const { getDocs, collection, query, where } = await import('firebase/firestore');
                
                const q = query(collection(db, 'studyMaterials'), where('userId', '==', user.uid));
                const snap = await getDocs(q);
                setMaterialsCount(snap.docs.length);

            } catch (err) {
                console.error("Error loading account data:", err);
            }
            setLoading(false);
        };
        loadData();
    }, [user]);

    const getPlanLimit = () => {
        if (profile.plan === 'premium') return 'Unlimited';
        if (profile.plan === 'cram') return 5;
        return 0; // Free
    };

    const getPlanName = () => {
        if (profile.plan === 'premium') return 'Premium (1 Month)';
        if (profile.plan === 'cram') return '2-Day Cram Pass';
        return 'Free Tier';
    };

    const isPremium = profile.plan === 'premium';
    const isCram = profile.plan === 'cram';
    const hasPaidPlan = isPremium || isCram;
    const libLimit = getPlanLimit();
    const libPercent = libLimit === 'Unlimited' ? 0 : (libLimit === 0 ? 100 : Math.min((materialsCount / libLimit) * 100, 100));

    const getReviewerLimit = () => {
        if (isPremium) return 'Unlimited';
        if (isCram) return 5;
        return 3; // Free
    };
    const reviewerLimit = getReviewerLimit();
    const reviewerPercent = isPremium ? 0 : Math.min((profile.uploadsUsed / reviewerLimit) * 100, 100);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '4rem' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem 0 5rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>Account & Billing</h1>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage your subscription and track your usage.</p>
            </div>

            {/* Current Plan Card */}
            <div style={{
                background: hasPaidPlan ? 'linear-gradient(135deg, var(--accent-premium-soft), transparent)' : 'var(--bg-glass)',
                border: `1px solid ${hasPaidPlan ? 'var(--accent-premium)' : 'var(--border-color)'}`,
                borderRadius: '24px',
                padding: '2rem',
                marginBottom: '2rem',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {hasPaidPlan && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--accent-premium), var(--text-primary))' }} />}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <Shield size={24} color={hasPaidPlan ? 'var(--accent-premium)' : 'var(--text-muted)'} />
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{getPlanName()}</h2>
                        </div>
                        {hasPaidPlan && profile.expiresAt ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '1rem' }}>
                                <Clock size={16} />
                                Expires on {profile.expiresAt.toDate ? profile.expiresAt.toDate().toLocaleDateString() : new Date(profile.expiresAt).toLocaleDateString()}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                You are currently on the Free Tier with limited access.
                            </p>
                        )}

                        {profile.paymentStatus === 'pending' && (
                            <div className="badge badge-warning" style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                                <Clock size={16} /> Payment Pending Verification
                            </div>
                        )}
                        {profile.paymentStatus === 'rejected' && (
                            <div style={{ marginTop: '1rem', background: 'rgba(239, 68, 68, 0.08)', color: 'var(--error)', padding: '1rem', borderRadius: '12px', fontSize: '0.9rem' }}>
                                <strong>Payment Rejected:</strong> {profile.rejectionReason || 'Receipt invalid or amount incorrect. Please try again.'}
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => setCurrentView('payment')}
                        style={{
                            background: 'var(--text-primary)',
                            color: 'var(--bg-primary)',
                            border: 'none',
                            padding: '0.8rem 1.5rem',
                            borderRadius: '12px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                    >
                        <Zap size={18} /> {hasPaidPlan ? 'Extend Plan' : 'Upgrade Plan'}
                    </button>
                </div>
            </div>

            {/* Usage Limits */}
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>Usage Limits</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                
                {/* Library Storage */}
                <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: 'var(--bg-secondary)', padding: '0.6rem', borderRadius: '10px' }}>
                            <HardDrive size={20} color="var(--text-primary)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '1rem', fontWeight: 700 }}>Library Storage</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saved study materials</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                        <span>{materialsCount} saved</span>
                        <span>{libLimit} max</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${libPercent}%`, background: 'var(--accent-premium)', borderRadius: '99px' }} />
                    </div>
                </div>

                {/* Reviewer Uploads */}
                <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: 'var(--bg-secondary)', padding: '0.6rem', borderRadius: '10px' }}>
                            <Zap size={20} color="var(--text-primary)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '1rem', fontWeight: 700 }}>AI Reviewer Uploads</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Document generations</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                        <span>{isPremium ? 'Unlimited' : `${profile.uploadsUsed} used`}</span>
                        <span>{isPremium ? '∞' : `${reviewerLimit} max`}</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${isPremium ? 0 : reviewerPercent}%`, background: 'var(--accent-premium)', borderRadius: '99px' }} />
                    </div>
                </div>

            </div>
            
            {!isPremium && (
                <div style={{ marginTop: '3rem', background: 'var(--bg-secondary)', borderRadius: '20px', padding: '2rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>Unlock Full Access</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start', maxWidth: '300px', margin: '0 auto 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={16} color="var(--success)" /> Unlimited Reviewer uploads</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={16} color="var(--success)" /> Unlimited Quiz generations (30 max per gen)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={16} color="var(--success)" /> Unlimited Flashcards (40 max per gen)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={16} color="var(--success)" /> Access to AI Assistant</div>
                    </div>
                    <button
                        onClick={() => setCurrentView('payment')}
                        style={{ background: 'var(--accent-premium)', color: 'white', border: 'none', padding: '0.8rem 2rem', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s ease' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-premium-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-premium)'}
                    >
                        View Upgrade Options
                    </button>
                </div>
            )}
        </div>
    );
}
