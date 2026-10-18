import { ArrowRight } from 'lucide-react';
import LandingNav from './LandingNav';
import SiteFooter from './SiteFooter';

export default function AboutPage({ onEnterApp, setCurrentPage, user, theme, toggleTheme }) {
    return (
        <div className="landing-page about-page-root">
            {/* ── FLOATING NAV ── */}
            <LandingNav onEnterApp={onEnterApp} activePage="about" setCurrentPage={setCurrentPage} user={user} theme={theme} toggleTheme={toggleTheme} />

            {/* ── HERO ── */}
            <div className="about-hero">
                <div className="about-container">
                    <div className="about-section-split">
                        <div className="about-split-side">
                            <span className="landing-section-label">About</span>
                        </div>
                        <div className="about-split-main">
                            <h1 className="about-serif-title">
                                A study tool that takes <br />
                                <em>focus seriously.</em>
                            </h1>
                            <p className="about-hero-lead">
                                StudyPal is an AI-powered productivity platform built for 
                                students, researchers, and lifelong learners who need to turn 
                                complex information into masterable knowledge.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── THE NAME ── */}
            <section className="about-section bordered-top">
                <div className="about-container">
                    <div className="about-section-split">
                        <div className="about-split-side">
                            <span className="landing-section-label">The mission</span>
                        </div>
                        <div className="about-split-main">
                            <h2 className="about-split-title">Study + Companion</h2>
                            <p className="about-text">
                                The name reflects our philosophy: your study tools should be 
                                as reliable and helpful as a best friend. We believe that 
                                artificial intelligence should augment human intelligence, 
                                not replace it.
                            </p>
                            <p className="about-text">
                                The interface is designed to stay out of your way. Your desk is
                                laid out like a bento: the timer, today's plan, the cards due
                                for review and your study history each sit in their own box.
                                No clutter, no distractions—just you and your material.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── THE PHILOSOPHY ── */}
            <section className="about-section bordered-top">
                <div className="about-container">
                    <div className="about-section-split">
                        <div className="about-split-side">
                            <span className="landing-section-label">Philosophy</span>
                        </div>
                        <div className="about-split-main">
                            <div className="about-grid-3col">
                                <div className="about-grid-item">
                                    <span className="about-col-tag">Atomic</span>
                                    <h3 className="about-col-title">Modular Learning</h3>
                                    <p className="about-col-text">
                                        Break down big subjects into small, manageable pieces. 
                                        Our AI identifies key concepts so you don't have to.
                                    </p>
                                </div>
                                <div className="about-grid-item">
                                    <span className="about-col-tag">Active</span>
                                    <h3 className="about-col-title">Active Recall</h3>
                                    <p className="about-col-text">
                                        Don't just read. Quiz yourself. StudyPal transforms passive 
                                        notes into active retrieval practice instantly.
                                    </p>
                                </div>
                                <div className="about-grid-item">
                                    <span className="about-col-tag">Simple</span>
                                    <h3 className="about-col-title">Intentional Design</h3>
                                    <p className="about-col-text">
                                        Everything looks like something from a real study desk:
                                        cream paper, black ink, one highlighter and a red pen.
                                        Calm enough to work in for hours.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── WHO IT'S FOR ── */}
            <section className="about-section bordered-top">
                <div className="about-container">
                    <div className="about-section-split">
                        <div className="about-split-side">
                            <span className="landing-section-label">Who it's for</span>
                        </div>
                        <div className="about-split-main">
                            <div className="about-grid-2x2">
                                <div className="about-grid-cell">
                                    <h4 className="grid-cell-title">Board Reviewees</h4>
                                    <p className="grid-cell-text">
                                        Master thousands of pages of review material by transforming 
                                        them into structured flashcards and timed quizzes.
                                    </p>
                                </div>
                                <div className="about-grid-cell">
                                    <h4 className="grid-cell-title">University Students</h4>
                                    <p className="grid-cell-text">
                                        Keep up with the overwhelming pace of lectures. Turn 
                                        last-minute cramming into long-term retention.
                                    </p>
                                </div>
                                <div className="about-grid-cell">
                                    <h4 className="grid-cell-title">Researchers</h4>
                                    <p className="grid-cell-text">
                                        Quickly synthesize dense papers into high-level summaries 
                                        and extraction-ready study guides.
                                    </p>
                                </div>
                                <div className="about-grid-cell">
                                    <h4 className="grid-cell-title">Self-Learners</h4>
                                    <p className="grid-cell-text">
                                        Build your own curriculum around any topic. Upload any 
                                        PDF or text and start your journey.
                                    </p>
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
