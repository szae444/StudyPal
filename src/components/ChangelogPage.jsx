import React from 'react';
import { BookOpen, ArrowRight } from 'lucide-react';
import LandingNav from './LandingNav';

export default function ChangelogPage({ onEnterApp, setCurrentPage, user }) {
    return (
        <div className="landing-page changelog-page-root">
            {/* ── FLOATING NAV ── */}
            <LandingNav onEnterApp={onEnterApp} activePage="changelog" setCurrentPage={setCurrentPage} user={user} />

            {/* ── HERO / HEADER ── */}
            <div className="about-hero" style={{ paddingBottom: '4rem' }}>
                <div className="about-container">
                    <div className="about-section-split">
                        <div className="about-split-side">
                            <span className="landing-section-label">— CHANGELOG</span>
                        </div>
                        <div className="about-split-main">
                            <h1 className="about-serif-title">
                                What's <em>changed?</em>
                            </h1>
                            <p className="about-hero-lead">
                                We're constantly improving StudyPal to help you study smarter. 
                                Here's a record of our major updates.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CHANGELOG CONTENT ── */}
            <section className="about-section bordered-top" style={{ background: 'var(--bg-primary)' }}>
                <div className="about-container">
                    <div className="changelog-items">
                        
                        {/* Major Feature Release */}
                        <div className="changelog-item">
                            <div className="changelog-left">
                                <h3 className="changelog-version">v2.0.0</h3>
                                <p className="changelog-date">May 19, 2026</p>
                            </div>
                            <div className="changelog-content">
                                <div className="changelog-group">
                                    <span className="changelog-tag">Added</span>
                                    <ul className="changelog-list">
                                        <li>Premium Subscriptions — Free tier, 2-Day Cram Pass, and 1-Month Premium.</li>
                                        <li>Admin Dashboard — Full analytics and manual payment verification system.</li>
                                        <li>AI Model Enhancements — Switched to high-capacity sequential models to guarantee zero repetitive flashcards or quizzes.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Major Feature Release */}
                        <div className="changelog-item">
                            <div className="changelog-left">
                                <h3 className="changelog-version">v1.3.0</h3>
                                <p className="changelog-date">March 10, 2026</p>
                            </div>
                            <div className="changelog-content">
                                <div className="changelog-group">
                                    <span className="changelog-tag">Added</span>
                                    <ul className="changelog-list">
                                        <li>AI Assistant — Chat with your notes using advanced AI.</li>
                                        <li>Search Functionality — Quickly find materials in your library.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Major Feature Release */}
                        <div className="changelog-item">
                            <div className="changelog-left">
                                <h3 className="changelog-version">v1.2.0</h3>
                                <p className="changelog-date">March 05, 2026</p>
                            </div>
                            <div className="changelog-content">
                                <div className="changelog-group">
                                    <span className="changelog-tag">Added</span>
                                    <ul className="changelog-list">
                                        <li>Study Planner — Schedule and track your study sessions.</li>
                                        <li>Export Options — Export your materials as PDF or Text.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FINAL CTA ── */}
            <section className="landing-final-cta bordered-top">
                <div className="final-cta-inner">
                    <h2 className="about-serif-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
                        Ready to start?
                    </h2>
                    <div className="landing-hero-ctas">
                        <button className="landing-cta-primary large" onClick={onEnterApp}>
                            {user ? 'Go to Dashboard' : 'Open StudyPal'} <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="landing-footer">
                <div className="footer-inner">
                    <p className="footer-copy">© 2026 StudyPal. Built for Students Everywhere.</p>
                    <div className="footer-links">
                        <button className="footer-link" onClick={() => window.location.href = '/' }>Home</button>
                        <button className="footer-link" onClick={() => window.open('https://github.com', '_blank')}>Github</button>
                        <button className="footer-link" onClick={() => window.open('https://twitter.com', '_blank')}>Twitter</button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
