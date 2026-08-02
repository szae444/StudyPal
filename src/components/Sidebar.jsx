import { Home, Bookmark, LogOut, Moon, Sun, BookOpen, ListTodo, Sparkles, Heart, Shield, UserCircle } from 'lucide-react';

const ADMIN_EMAIL = 'etrazalsebastian@gmail.com';

export default function Sidebar({ currentView, setCurrentView, handleLogout, user }) {
    const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

    const navItems = [
        { id: 'generator', label: 'Dashboard', icon: Home },
        { id: 'library', label: 'Library', icon: Bookmark },
        { id: 'planner', label: 'Planner', icon: ListTodo },
        { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
        ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: Shield, adminOnly: true }] : [])
    ];

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: 'var(--bg-glass)',
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem 1.5rem',
            overflow: 'hidden', // Enforce no scrolling
            userSelect: 'none'  // Prevent text selection for a cleaner feel
        }}>
            {/* Brand Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem', padding: '0 0.5rem' }}>
                <div style={{
                    background: 'var(--text-primary)',
                    padding: '0.6rem',
                    borderRadius: '10px',
                    color: 'var(--bg-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <BookOpen size={20} strokeWidth={2.5} />
                </div>
                <h1 style={{ fontSize: '1.5rem', margin: 0, letterSpacing: '-0.03em', fontWeight: 800, color: 'var(--text-primary)' }}>StudyPal</h1>
            </div>

            {/* Main Navigation */}
            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => setCurrentView(item.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                padding: '0.8rem 1rem',
                                borderRadius: '12px',
                                width: '100%',
                                textAlign: 'left',
                                background: isActive ? (item.adminOnly ? 'var(--accent-premium)' : 'var(--bg-secondary)') : 'transparent',
                                color: isActive ? (item.adminOnly ? '#fff' : 'var(--text-primary)') : (item.adminOnly ? 'var(--accent-premium-hover)' : 'var(--text-secondary)'),
                                fontWeight: isActive ? 600 : 500,
                                transition: 'all 0.2s ease',
                                fontFamily: 'Plus Jakarta Sans',
                                border: item.adminOnly ? `1px solid ${isActive ? 'transparent' : 'var(--accent-premium-soft)'}` : 'none',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) { e.currentTarget.style.color = item.adminOnly ? 'var(--accent-premium-hover)' : 'var(--text-primary)'; }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) { e.currentTarget.style.color = item.adminOnly ? 'var(--accent-premium-hover)' : 'var(--text-secondary)'; }
                            }}
                        >
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            {item.label}
                            {item.adminOnly && (
                                <span className="badge badge-premium" style={{ marginLeft: 'auto' }}>Admin</span>
                            )}
                        </button>
                    )
                })}
            </nav>

            {/* Footer Area (Theme & User) */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                <button
                    onClick={() => setCurrentView('account')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '0.8rem 1rem', borderRadius: '12px', width: '100%',
                        textAlign: 'left', background: currentView === 'account' ? 'var(--bg-secondary)' : 'transparent',
                        color: currentView === 'account' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: currentView === 'account' ? 700 : 500, fontFamily: 'Plus Jakarta Sans', cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        if (currentView !== 'account') e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        if (currentView !== 'account') e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                >
                    <UserCircle size={20} />
                    Account
                </button>



                <button
                    onClick={handleLogout}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '0.8rem 1rem', borderRadius: '12px', width: '100%',
                        textAlign: 'left', background: 'transparent', color: 'var(--error)',
                        fontWeight: 500, fontFamily: 'Plus Jakarta Sans', cursor: 'pointer',
                        transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <LogOut size={20} />
                    Log Out
                </button>

            </div>
        </div>
    );
}
