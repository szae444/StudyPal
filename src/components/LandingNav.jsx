import { useState } from 'react';
import { ArrowRight, Menu, X, Moon, Sun } from 'lucide-react';
import BrandMark from './BrandMark';

const PAGES = [
    { id: 'home', label: 'Home', href: '/' },
    { id: 'changelog', label: 'Changelog', href: '/?page=changelog' },
    { id: 'about', label: 'About', href: '/?page=about' },
];

export default function LandingNav({ onEnterApp, activePage = 'home', setCurrentPage, user, theme, toggleTheme }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const go = (page) => {
        setCurrentPage(page.id);
        window.history.pushState({}, '', page.href);
        window.scrollTo({ top: 0 });
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="about-pill-nav-container">
            <nav className="about-pill-nav" aria-label="Site">
                <button className="brand" style={{ margin: 0, padding: 0 }} onClick={() => go(PAGES[0])} aria-label="StudyPal home">
                    <span className="brand-mark"><BrandMark size={28} /></span>
                    <span className="brand-name" style={{ fontSize: 22 }}>StudyPal</span>
                </button>

                <div className="about-pill-links desktop-only">
                    {PAGES.map((p) => (
                        <button key={p.id} className={`about-nav-link ${activePage === p.id ? 'active' : ''}`} onClick={() => go(p)} aria-current={activePage === p.id ? 'page' : undefined}>
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="nav-actions">
                    {toggleTheme && (
                        <button className="icon-btn desktop-only" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to day desk' : 'Switch to night desk'}>
                            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                        </button>
                    )}
                    {user ? (
                        <button className="about-nav-cta" onClick={onEnterApp}>
                            Go to my desk <ArrowRight size={14} />
                        </button>
                    ) : (
                        <>
                            <button className="about-nav-cta quiet desktop-only" onClick={() => onEnterApp('login')}>Log in</button>
                            <button className="about-nav-cta desktop-only" onClick={() => onEnterApp('signup')}>Sign up free</button>
                        </>
                    )}
                    <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen((v) => !v)} aria-label="Toggle menu" aria-expanded={isMobileMenuOpen}>
                        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </nav>

            {isMobileMenuOpen && (
                <div className="mobile-nav-dropdown fade-in">
                    {PAGES.map((p) => (
                        <button key={p.id} className={`mobile-nav-link ${activePage === p.id ? 'active' : ''}`} onClick={() => go(p)}>{p.label}</button>
                    ))}
                    {toggleTheme && (
                        <button className="mobile-nav-link" onClick={toggleTheme}>{theme === 'dark' ? 'Day desk (light)' : 'Night desk (dark)'}</button>
                    )}
                    {user ? (
                        <button className="mobile-nav-cta" onClick={onEnterApp}>Go to my desk <ArrowRight size={14} /></button>
                    ) : (
                        <>
                            <button className="mobile-nav-cta quiet" onClick={() => onEnterApp('login')}>Log in</button>
                            <button className="mobile-nav-cta" onClick={() => onEnterApp('signup')} style={{ marginTop: 0 }}>Sign up free</button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
