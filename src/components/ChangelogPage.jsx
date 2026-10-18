import { ArrowRight } from 'lucide-react';
import LandingNav from './LandingNav';
import SiteFooter from './SiteFooter';

export default function ChangelogPage({ onEnterApp, setCurrentPage, user, theme, toggleTheme }) {
    return (
        <div className="landing-page changelog-page-root">
            {/* ── FLOATING NAV ── */}
            <LandingNav onEnterApp={onEnterApp} activePage="changelog" setCurrentPage={setCurrentPage} user={user} theme={theme} toggleTheme={toggleTheme} />

            {/* ── HERO / HEADER ── */}
            <div className="about-hero" style={{ paddingBottom: '4rem' }}>
                <div className="about-container">
                    <div className="about-section-split">
                        <div className="about-split-side">
                            <span className="landing-section-label">Changelog</span>
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

                        <div className="changelog-item">
                            <div className="changelog-left">
                                <h3 className="changelog-version">v3.0.0</h3>
                                <p className="changelog-date">October 18, 2026</p>
                            </div>
                            <div className="changelog-content">
                                <div className="changelog-group">
                                    <span className="changelog-tag new">New</span>
                                    <ul className="changelog-list">
                                        <li><span><b>My desk.</b> A new home screen laid out like a bento: timer, today's plan, cards due, streak, study history, countdowns and focus sounds in one view.</span></li>
                                        <li><span><b>Focus timer.</b> Classic blocks with short and long breaks, or Flow mode that counts up and earns your break. Tag sessions by subject.</span></li>
                                        <li><span><b>Mini timer.</b> Float the timer over your notes or lecture video (Chrome and Edge on desktop).</span></li>
                                        <li><span><b>Spaced review.</b> Saved flashcards are now scheduled with FSRS. Rate cards Again, Hard, Good or Easy and they come back right on time.</span></li>
                                        <li><span><b>Study history.</b> A heatmap of your focus time, a daily goal and a streak.</span></li>
                                        <li><span><b>Exam countdowns</b> and <b>focus sounds</b> (rain, brown noise, desk fan).</span></li>
                                    </ul>
                                </div>
                                <div className="changelog-group">
                                    <span className="changelog-tag improved">Improved</span>
                                    <ul className="changelog-list">
                                        <li><span>A new look: cream paper, black ink, a highlighter and a red pen. Includes a night desk dark mode.</span></li>
                                        <li><span>The timer keeps running while you move around the app, and shows in the sidebar and the browser tab.</span></li>
                                    </ul>
                                </div>
                            </div>
                        </div>

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
            <section className="landing-final-cta">
                <div className="final-cta-inner">
                    <h2 className="final-cta-title">Ready to <em>sit down?</em></h2>
                    <button className="landing-cta-primary large" onClick={() => onEnterApp(user ? 'login' : 'signup')}>
                        {user ? 'Go to my desk' : 'Open StudyPal'} <ArrowRight size={18} />
                    </button>
                </div>
            </section>

            <SiteFooter onEnterApp={onEnterApp} user={user} />
        </div>
    );
}
