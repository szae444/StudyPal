import { useState } from 'react';
import { BookOpen, ArrowRight, Menu, X } from 'lucide-react';

export default function LandingNav({ onEnterApp, activePage = 'home', setCurrentPage, user }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
    
    return (
        <div className="about-pill-nav-container">
            <nav className="about-pill-nav">
                <div className="landing-logo" onClick={() => { setCurrentPage('home'); window.history.pushState({}, '', '/'); }} style={{ cursor: 'pointer' }}>
                    <div className="landing-logo-icon">
                        <BookOpen size={18} strokeWidth={2.5} />
                    </div>
                    <span className="landing-logo-text">StudyPal</span>
                </div>
                
                <div className="about-pill-links desktop-only">
                    <button className={`about-nav-link ${activePage === 'home' ? 'active' : ''}`} onClick={() => { setCurrentPage('home'); window.history.pushState({}, '', '/'); }}>Home</button>
                    <button className={`about-nav-link ${activePage === 'changelog' ? 'active' : ''}`} onClick={() => { setCurrentPage('changelog'); window.history.pushState({}, '', '/?page=changelog'); }}>Changelog</button>
                    <button className={`about-nav-link ${activePage === 'about' ? 'active' : ''}`} onClick={() => { setCurrentPage('about'); window.history.pushState({}, '', '/?page=about'); }}>About</button>
                </div>

                <div className="nav-actions">
                    {user ? (
                        <button className="about-nav-cta" onClick={onEnterApp}>
                            Go to Dashboard <ArrowRight size={14} />
                        </button>
                    ) : (
                        <>
                            <button className="about-nav-cta desktop-only" onClick={() => onEnterApp('login')} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', marginRight: '0.5rem' }}>
                                Log In
                            </button>
                            <button className="about-nav-cta desktop-only" onClick={() => onEnterApp('signup')}>
                                Sign Up <ArrowRight size={14} />
                            </button>
                        </>
                    )}
                    <button className="mobile-menu-btn" onClick={toggleMenu} aria-label="Toggle menu">
                        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Dropdown */}
            {isMobileMenuOpen && (
                <div className="mobile-nav-dropdown fade-in">
                    <button className={`mobile-nav-link ${activePage === 'home' ? 'active' : ''}`} onClick={() => { setCurrentPage('home'); window.history.pushState({}, '', '/'); setIsMobileMenuOpen(false); }}>Home</button>
                    <button className={`mobile-nav-link ${activePage === 'changelog' ? 'active' : ''}`} onClick={() => { setCurrentPage('changelog'); window.history.pushState({}, '', '/?page=changelog'); setIsMobileMenuOpen(false); }}>Changelog</button>
                    <button className={`mobile-nav-link ${activePage === 'about' ? 'active' : ''}`} onClick={() => { setCurrentPage('about'); window.history.pushState({}, '', '/?page=about'); setIsMobileMenuOpen(false); }}>About</button>
                    
                    {user ? (
                        <button className="mobile-nav-cta" onClick={onEnterApp} style={{ width: '100%', marginTop: '0.5rem' }}>
                            Go to Dashboard <ArrowRight size={14} />
                        </button>
                    ) : (
                        <>
                            <button className="mobile-nav-cta" onClick={() => onEnterApp('login')} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', marginBottom: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
                                Log In
                            </button>
                            <button className="mobile-nav-cta" onClick={() => onEnterApp('signup')} style={{ width: '100%' }}>
                                Sign Up <ArrowRight size={14} />
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
