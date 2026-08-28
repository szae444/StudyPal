import { BookOpen, Brain, Library, Calendar, Sparkles, ArrowRight, Mail, Github, Layers, ClipboardList, GraduationCap, Flame } from 'lucide-react';
import LandingNav from './LandingNav';

export default function LandingPage({ onEnterApp, setCurrentPage, user }) {
    return (
        <div className="landing-page">
            {/* ── FLOATING NAV ── */}
            <LandingNav 
                onEnterApp={onEnterApp} 
                activePage="home" 
                setCurrentPage={setCurrentPage} 
                user={user}
            />

            {/* ── HERO ── */}
            <section className="landing-hero">
                <div className="landing-hero-inner">
                    <div className="landing-badge">AI-Powered Study Platform</div>
                    <h1 className="landing-hero-title">
                        Study smarter,<br />
                        <em>not harder.</em>
                    </h1>
                    <p className="landing-hero-sub">
                        Upload your notes and let AI generate reviewers, quizzes, and flashcards
                        in seconds. Built for students who mean business.
                    </p>
                    <div className="landing-hero-ctas">
                        <button className="landing-cta-primary" onClick={() => onEnterApp(user ? 'login' : 'signup')}>
                            {user ? 'Go to Dashboard' : 'Sign up for free'} <ArrowRight size={16} />
                        </button>
                        <a href="#features" className="landing-cta-secondary">
                            See how it works
                        </a>
                    </div>
                    <p className="landing-hero-note">Sign in or sign up to save materials &nbsp;·&nbsp; Free & Premium Tiers &nbsp;·&nbsp; Works on any device</p>
                </div>

                {/* Hero mockup card */}
                <div className="landing-hero-visual">
                    <div className="hero-card-mockup">
                        <div className="hero-card-bar">
                            <span className="hero-dot" /><span className="hero-dot" /><span className="hero-dot" />
                        </div>
                        <div className="hero-card-content">
                            <div className="hero-card-label">AI Generated Reviewer</div>
                            <div className="hero-card-lines">
                                <div className="hero-line w-full" />
                                <div className="hero-line w-3/4" />
                                <div className="hero-line w-5/6" />
                                <div className="hero-line w-2/3" />
                                <div className="hero-line w-full" />
                                <div className="hero-line w-4/5" />
                            </div>
                            <div className="hero-card-grid">
                                <div className="hero-mini-card">
                                    <div className="hero-mini-icon"><Layers size={20} strokeWidth={2.25} /></div>
                                    <div className="hero-mini-label">Flashcards</div>
                                    <div className="hero-mini-count">24 cards</div>
                                </div>
                                <div className="hero-mini-card">
                                    <div className="hero-mini-icon"><ClipboardList size={20} strokeWidth={2.25} /></div>
                                    <div className="hero-mini-label">Quiz</div>
                                    <div className="hero-mini-count">15 questions</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── WHY I BUILT THIS ── */}
            <section className="landing-why">
                <div className="landing-why-inner">
                    <div className="why-content">
                        <span className="landing-section-label">The Story</span>
                        <h2 className="why-title">Built for the late-night grinders.</h2>
                        <p className="why-text">
                            I built StudyPal because I know what it feels like to drown in endless lecture slides, dense textbooks, and impending exam deadlines. Watching dedicated students spend countless late nights manually compiling reviewers, quizzes, and flashcards instead of actually mastering the material felt like an exhausting battle.
                        </p>
                        <p className="why-text">
                            StudyPal was created to give students their time, focus, and energy back. By leveraging modern AI to automate the tedious parts of studying—generating structured reviewers, active-recall quizzes, and smart flashcard decks in seconds—learners can focus on what truly matters: understanding concepts deeply, reducing burnout, and acing their goals.
                        </p>
                        <div className="why-author">
                            <span className="author-name">— Sebastian Lazarte</span>
                            <span className="author-desc">Creator of StudyPal</span>
                        </div>
                    </div>
                    <div className="why-stats">
                        <div className="why-stat-card">
                            <div className="why-stat-icon"><GraduationCap size={28} strokeWidth={2} /></div>
                            <div className="why-stat-label">University Finals</div>
                            <div className="why-stat-val">Aced</div>
                        </div>
                        <div className="why-stat-card">
                            <div className="why-stat-icon"><Flame size={28} strokeWidth={2} /></div>
                            <div className="why-stat-label">Study Hours Saved</div>
                            <div className="why-stat-val">100+</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── BENTO FEATURES ── */}
            <section className="landing-features" id="features">
                <div className="landing-section-header">
                    <span className="landing-section-label">Features</span>
                    <h2 className="landing-section-title">Everything you need to ace your exams.</h2>
                </div>

                <div className="bento-grid">
                    {/* Large card — AI Generator */}
                    <div className="bento-card bento-card-lg bento-dark">
                        <div className="bento-icon-wrap">
                            <Sparkles size={24} />
                        </div>
                        <h3 className="bento-title">AI Study Materials</h3>
                        <p className="bento-desc">
                            Upload any PDF, Word doc, or text file. Get a comprehensive reviewer,
                            quiz, or flashcard deck generated in seconds by advanced Gemini AI.
                        </p>
                        <div className="bento-tags">
                            <span>Reviewer</span><span>Quiz</span><span>Flashcards</span>
                        </div>
                    </div>

                    {/* Medium card — Library */}
                    <div className="bento-card bento-card-md bento-light">
                        <div className="bento-icon-wrap dark">
                            <Library size={22} />
                        </div>
                        <h3 className="bento-title dark">Library</h3>
                        <p className="bento-desc dark">
                            Save all your generated materials and access them anytime. 
                            Organize by type, search, and rename.
                        </p>
                        <div className="bento-shelf">
                            <div className="shelf-item reviewer">Reviewer</div>
                            <div className="shelf-item quiz">Quiz</div>
                            <div className="shelf-item flash">Flashcards</div>
                        </div>
                    </div>

                    {/* Medium card — Planner */}
                    <div className="bento-card bento-card-md bento-light">
                        <div className="bento-icon-wrap dark">
                            <Calendar size={22} />
                        </div>
                        <h3 className="bento-title dark">Study Planner</h3>
                        <p className="bento-desc dark">
                            Schedule tasks on a calendar, track completion, and transfer plans to different days with one click.
                        </p>
                        <div className="bento-calendar-preview">
                            {['M','T','W','T','F','S','S'].map((d,i) => (
                                <div key={i} className="cal-day-label">{d}</div>
                            ))}
                            {Array.from({ length: 28 }, (_, i) => (
                                <div key={i} className={`cal-day ${i === 9 || i === 14 || i === 20 ? 'has-task' : ''} ${i === 14 ? 'today' : ''}`}>
                                    {i + 1}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Wide card — AI Assistant */}
                    <div className="bento-card bento-card-wide bento-dark">
                        <div className="bento-icon-wrap">
                            <Brain size={24} />
                        </div>
                        <h3 className="bento-title">AI Assistant</h3>
                        <p className="bento-desc">
                            Chat with an AI tutor about any topic. Ask for explanations, summaries,
                            or quick answers. Full conversation history saved automatically.
                        </p>
                        <div className="bento-chat-preview">
                            <div className="chat-bubble user">What is the difference between osmosis and diffusion?</div>
                            <div className="chat-bubble ai">Osmosis is the movement of water through a semipermeable membrane, while diffusion is the movement of any molecule from high to low concentration...</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── STATS ── */}
            <section className="landing-stats">
                <div className="stats-grid">
                    <div className="stat-item">
                        <div className="stat-number">3</div>
                        <div className="stat-label">AI-powered outputs per upload</div>
                    </div>
                    <div className="stat-divider" />
                    <div className="stat-item">
                        <div className="stat-number">∞</div>
                        <div className="stat-label">Materials you can save</div>
                    </div>
                    <div className="stat-divider" />
                    <div className="stat-item">
                        <div className="stat-number">Free Tier</div>
                        <div className="stat-label">Start studying for free</div>
                    </div>
                    <div className="stat-divider" />
                    <div className="stat-item">
                        <div className="stat-number">AI</div>
                        <div className="stat-label">Powered by GPT, Gemini, and Nvidia AI.</div>
                    </div>
                </div>
            </section>

            {/* ── FINAL CTA ── */}
            <section className="landing-final-cta">
                <div className="final-cta-inner">
                    <p className="final-cta-eyebrow">Your exam is next.</p>
                    <h2 className="final-cta-title">Start studying with AI today.</h2>
                    <button className="landing-cta-primary large" onClick={() => onEnterApp(user ? 'login' : 'signup')}>
                        {user ? 'Open your Dashboard' : 'Create your free account'} <ArrowRight size={18} />
                    </button>
                    <p className="final-cta-note">Create an account to securely save and access your study materials anytime.</p>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="landing-footer">
                <div className="footer-inner">
                    <div className="landing-logo">
                        <div className="landing-logo-icon">
                            <BookOpen size={16} strokeWidth={2.5} />
                        </div>
                        <span className="landing-logo-text">StudyPal</span>
                    </div>
                    <p className="footer-copy">© 2026 StudyPal. Built for Students Everywhere.</p>
                    <div className="footer-links">
                        <a href="/?page=changelog" className="footer-link">Changelog</a>
                        <a href="/?page=about" className="footer-link">About</a>
                        <button onClick={onEnterApp} className="footer-link">{user ? 'Dashboard' : 'Open App'}</button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
