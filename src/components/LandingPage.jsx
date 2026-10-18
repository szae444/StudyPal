import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileText, ClipboardList, Layers, Play, Pause, RotateCcw } from 'lucide-react';
import LandingNav from './LandingNav';
import SiteFooter from './SiteFooter';
import { formatClock } from '../desk/deskUtils';

// ── A working timer anyone can use, no account needed ───────────────────────

const DEMO_MODES = { focus: { label: 'Focus', min: 25 }, short: { label: 'Break', min: 5 } };

function DemoTimer() {
    const [mode, setMode] = useState('focus');
    const [remaining, setRemaining] = useState(DEMO_MODES.focus.min * 60000);
    const [endsAt, setEndsAt] = useState(null);
    const tick = useRef(null);

    const total = DEMO_MODES[mode].min * 60000;
    const running = endsAt !== null;

    useEffect(() => {
        if (!running) return;
        tick.current = setInterval(() => {
            const left = Math.max(0, endsAt - Date.now());
            setRemaining(left);
            if (left === 0) {
                setEndsAt(null);
                const next = mode === 'focus' ? 'short' : 'focus';
                setMode(next);
                setRemaining(DEMO_MODES[next].min * 60000);
            }
        }, 250);
        return () => clearInterval(tick.current);
    }, [running, endsAt, mode]);

    const choose = (m) => { setMode(m); setEndsAt(null); setRemaining(DEMO_MODES[m].min * 60000); };
    const toggle = () => {
        if (running) { setRemaining(Math.max(0, endsAt - Date.now())); setEndsAt(null); }
        else setEndsAt(Date.now() + remaining);
    };
    const pct = (1 - remaining / total) * 100;

    return (
        <div className={`lp-demo-timer paper-grid ${running ? 'is-running' : ''}`} aria-label="Try the focus timer">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div className="segmented-tabs lp-demo-modes" role="tablist" aria-label="Timer phase">
                    {Object.entries(DEMO_MODES).map(([id, m]) => (
                        <button key={id} role="tab" aria-selected={mode === id} className={`segmented-tab ${mode === id ? 'active' : ''}`} onClick={() => choose(id)}>
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="timer-digits" role="timer">{formatClock(remaining)}</div>
            <div className="ruler" style={{ '--tick': `${100 / DEMO_MODES[mode].min}%` }}>
                <div className="ruler-fill" style={{ width: `${pct}%` }} />
                <div className="ruler-now" style={{ left: `calc(${pct}% - 1px)` }} />
            </div>
            <div className="timer-controls">
                <button className={`btn-primary ${running ? 'is-running' : ''}`} onClick={toggle}>
                    {running ? <Pause size={18} /> : <Play size={18} />} {running ? 'Pause' : 'Start'}
                </button>
                <button className="btn-ghost" onClick={() => choose(mode)} aria-label="Reset timer"><RotateCcw size={16} /> Reset</button>
                <span className="timer-status" style={{ marginLeft: 'auto' }}><span className="dot" />{running ? (mode === 'focus' ? 'Focusing' : 'On a break') : 'Try it now'}</span>
            </div>
        </div>
    );
}

// Deterministic "study history" pattern for the illustration tile.
const heatPattern = Array.from({ length: 7 * 26 }, (_, i) => {
    const v = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const ramp = i / (7 * 26);
    return v < 0.28 - ramp * 0.15 ? 0 : Math.min(4, Math.floor(v * 3 + ramp * 2.2));
});

const FAQS = [
    {
        q: 'Is StudyPal free?',
        a: 'Yes. The timer, planner, countdowns, streaks and spaced review are free with no limits. The free plan also includes 3 AI uploads and 5 AI assistant messages a week, and 3 saved materials. A 2-day Cram Pass (₱30) and monthly Premium (₱150) raise or remove those limits.',
    },
    {
        q: 'What can I upload?',
        a: 'PDF, Word (.docx), plain text, Markdown, CSV and images such as photos of your notes or slides. Upload several files at once and StudyPal reads them together.',
    },
    {
        q: 'What is Flow mode?',
        a: 'Classic mode counts down a fixed block, 25 minutes by default. Flow mode counts up instead, so you never get cut off mid-thought, and earns you one minute of break for every five minutes of focus, up to 30.',
    },
    {
        q: 'How does spaced review decide what I see?',
        a: 'Saved flashcards are scheduled with FSRS, an open-source algorithm used by modern flashcard apps. After each card you rate it Again, Hard, Good or Easy, and StudyPal brings it back right before you would likely forget it. Each session adds up to 20 new cards.',
    },
    {
        q: 'Does the timer keep running if I switch pages?',
        a: 'Yes. It follows you to the sidebar while you read your reviewer or take a quiz. In Chrome and Edge on a computer you can also pop out a mini timer that floats over your PDF or lecture video.',
    },
    {
        q: 'Can I use it on my phone?',
        a: 'Yes, StudyPal works in any modern browser. The floating mini timer is desktop-only because phone browsers do not support it yet.',
    },
];

export default function LandingPage({ onEnterApp, setCurrentPage, user, theme, toggleTheme }) {
    const primary = () => onEnterApp(user ? 'login' : 'signup');

    return (
        <div className="landing-page">
            <LandingNav onEnterApp={onEnterApp} activePage="home" setCurrentPage={setCurrentPage} user={user} theme={theme} toggleTheme={toggleTheme} />

            {/* ── HERO ── */}
            <section className="lp-hero">
                <div className="site-wrap lp-hero-grid">
                    <div>
                        <span className="lp-kicker">for review season, and every day before it</span>
                        <h1 className="lp-title">
                            Your whole study day, on <span className="hl hl-sweep">one desk</span>.
                        </h1>
                        <p className="lp-sub">
                            Upload your notes and get a reviewer, a quiz and flashcards in seconds. Then focus with the timer,
                            review cards right before you'd forget them, and watch your streak grow.
                        </p>
                        <div className="landing-hero-ctas">
                            <button className="landing-cta-primary" onClick={primary}>
                                {user ? 'Go to my desk' : 'Start studying free'} <ArrowRight size={17} />
                            </button>
                            <a href="#desk" className="landing-cta-secondary">See what's on the desk</a>
                        </div>
                        <p className="lp-note">The focus timer here works right now, no account needed.</p>
                    </div>

                    <div className="lp-desk" aria-label="A preview of the StudyPal desk">
                        <div className="lp-sticky" aria-hidden="true">
                            Today
                            <ul>
                                <li className="done">Pharmaco ch. 4</li>
                                <li className="done">20 flashcards</li>
                                <li>Mock exam, set B</li>
                            </ul>
                        </div>
                        <DemoTimer />
                        <div className="lp-index" aria-hidden="true">
                            <small>Question</small>
                            <p>What does the loop of Henle concentrate?</p>
                            <div className="lp-grades"><span>Again</span><span>Hard</span><span>Good</span><span>Easy</span></div>
                        </div>
                        <div className="lp-stamp" aria-hidden="true">
                            <div><b>31</b><span>DAY STREAK</span></div>
                        </div>
                        <div className="lp-pencil" aria-hidden="true" />
                    </div>
                </div>
            </section>

            {/* ── FACTS ── */}
            <section className="lp-facts" aria-label="StudyPal at a glance">
                <div className="site-wrap lp-facts-row">
                    <div className="lp-fact"><b>3 in 1</b><span>A reviewer, a quiz and a flashcard deck from one upload.</span></div>
                    <div className="lp-fact"><b className="mono" style={{ fontSize: 34 }}>25:00</b><span>Classic focus blocks, or Flow mode that earns your breaks.</span></div>
                    <div className="lp-fact"><b>FSRS</b><span>Cards come back right before you'd forget them.</span></div>
                    <div className="lp-fact"><b>₱0</b><span>to start. Timer, planner and review are always free.</span></div>
                </div>
            </section>

            {/* ── THE DESK (bento) ── */}
            <section className="lp-section" id="desk">
                <div className="site-wrap">
                    <div className="lp-section-head">
                        <div>
                            <span className="landing-section-label">What's on the desk</span>
                            <h2 className="lp-h2">Everything for a study day, <em>in its own box.</em></h2>
                        </div>
                        <p className="lp-lead">
                            Like a bento, every tool has its own compartment, so your desk stays tidy. Your notes,
                            timer, cards and plans all sit on one screen.
                        </p>
                    </div>

                    <div className="lp-bento">
                        <article className="lp-tile lp-t-gen">
                            <span className="lp-tag">Generate</span>
                            <h3>Drop in a lecture. Get three ways to study it.</h3>
                            <p>StudyPal reads your PDF, Word file or photos of the board, then writes a printable two-column reviewer, a quiz in the format you choose, and a flashcard deck.</p>
                            <div className="lp-gen-flow" aria-hidden="true">
                                <div className="lp-page">
                                    <b>Renal Physiology</b>
                                    The nephron is the functional unit of the kidney. Filtrate passes from the <mark>glomerulus</mark> into the proximal tubule, where most reabsorption happens. The <mark>loop of Henle</mark> sets up a concentration gradient in the medulla…
                                </div>
                                <span className="lp-arrow">→</span>
                                <div className="lp-outputs">
                                    <div className="lp-output"><FileText size={17} /> Reviewer <small>6 pages</small></div>
                                    <div className="lp-output"><ClipboardList size={17} /> Quiz <small>15 items</small></div>
                                    <div className="lp-output"><Layers size={17} /> Flashcards <small>24 cards</small></div>
                                </div>
                            </div>
                        </article>

                        <article className="lp-tile lp-t-review">
                            <span className="lp-tag">Spaced review</span>
                            <h3>Cards that come back on time.</h3>
                            <p>Rate each card and the scheduler picks the day it returns. Hard ones come back tomorrow; easy ones not for weeks.</p>
                            <div className="lp-cardstack" aria-hidden="true">
                                <div /><div />
                                <div>Normal GFR in adults?</div>
                            </div>
                            <div className="lp-intervals" aria-hidden="true">
                                <span>Again<small>1m</small></span>
                                <span>Hard<small>8m</small></span>
                                <span>Good<small>1d</small></span>
                                <span>Easy<small>4d</small></span>
                            </div>
                        </article>

                        <article className="lp-tile lp-t-plan">
                            <span className="lp-tag">Planner + countdown</span>
                            <h3>Know what's next.</h3>
                            <p>Tasks on a calendar, moved to tomorrow in one click, with your exam day counting down.</p>
                            <div className="lp-month" aria-hidden="true">
                                {Array.from({ length: 28 }, (_, i) => (
                                    <i key={i} className={i === 23 ? 'exam' : i === 15 ? 'today task' : [3, 6, 9, 12, 16, 18, 20].includes(i) ? 'task' : ''}>{i + 1}</i>
                                ))}
                            </div>
                        </article>

                        <article className="lp-tile lp-t-heat">
                            <span className="lp-tag">Study history</span>
                            <h3>Every day you study, the page gets a little more highlighted.</h3>
                            <p>A heatmap of your focus time, your streak, and where the hours went by subject.</p>
                            <div className="lp-heat" aria-hidden="true">
                                {heatPattern.map((l, i) => <i key={i} data-l={l} />)}
                            </div>
                        </article>

                        <article className="lp-tile lp-t-sound">
                            <span className="lp-tag">Focus sounds</span>
                            <h3>Rain, brown noise or a desk fan.</h3>
                            <p>Built-in background sound that plays under your timer. No playlists to find, no ads.</p>
                            <div className="lp-wave" aria-hidden="true">
                                {Array.from({ length: 36 }, (_, i) => <i key={i} style={{ animationDelay: `${-(i * 0.13) % 1.4}s`, height: `${30 + ((i * 37) % 60)}%` }} />)}
                            </div>
                        </article>

                        <article className="lp-tile lp-t-ask">
                            <span className="lp-tag">Ask StudyPal</span>
                            <h3>A tutor that explains it again, differently.</h3>
                            <p>Ask follow-up questions, attach a photo of a problem, and keep the whole conversation.</p>
                            <div className="lp-chat" aria-hidden="true">
                                <div className="lp-bubble me">Why does the loop of Henle need to be a loop?</div>
                                <div className="lp-bubble pal">The hairpin lets the two limbs exchange salt and water, so the gradient multiplies as fluid flows down and back up…</div>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            {/* ── A STUDY DAY ── */}
            <section className="lp-section lp-day">
                <div className="site-wrap lp-day-grid">
                    <div className="lp-day-sticky">
                        <span className="landing-section-label">A day at the desk</span>
                        <h2 className="lp-h2">From last night's slides to <em>a streak you keep.</em></h2>
                        <p className="lp-lead">StudyPal is built around how a review day actually goes, not around a single tool.</p>
                    </div>
                    <ol className="lp-timeline">
                        <li className="lp-step">
                            <time>7:30</time>
                            <div>
                                <h3>Upload yesterday's lecture</h3>
                                <p>Drop in the PDF and the photos of the whiteboard. Generate a reviewer to read over breakfast and a deck of flashcards to save.</p>
                            </div>
                        </li>
                        <li className="lp-step">
                            <time>8:00</time>
                            <div>
                                <h3>Clear the cards that are due</h3>
                                <p>Ten minutes of spaced review before anything new. Press Space to flip and 1 to 4 to rate.</p>
                            </div>
                        </li>
                        <li className="lp-step hl-step">
                            <time>8:15</time>
                            <div>
                                <h3>Focus in blocks</h3>
                                <p>Tag the session with a subject, put on rain sounds, and pop out the mini timer beside your PDF. Four blocks, then a long break.</p>
                            </div>
                        </li>
                        <li className="lp-step">
                            <time>15:00</time>
                            <div>
                                <h3>Test yourself</h3>
                                <p>Take the quiz you generated this morning. Miss something? Ask StudyPal to explain it a different way.</p>
                            </div>
                        </li>
                        <li className="lp-step">
                            <time>21:00</time>
                            <div>
                                <h3>Close the day</h3>
                                <p>Tick off the sticky note, move what's left to tomorrow, and see today's square fill in. Twenty-three days to the boards.</p>
                            </div>
                        </li>
                    </ol>
                </div>
            </section>

            {/* ── WHY I BUILT THIS ── */}
            <section className="lp-section">
                <div className="site-wrap lp-letter-grid">
                    <div>
                        <span className="landing-section-label">The story</span>
                        <h2 className="lp-h2">Built for the <em>late-night grinders.</em></h2>
                    </div>
                    <article className="lp-letter">
                        <h3>A note from the person who made this</h3>
                        <p>
                            I built StudyPal because I know what it feels like to drown in endless lecture slides, dense textbooks, and impending exam deadlines. Watching dedicated students spend countless late nights manually compiling reviewers, quizzes, and flashcards instead of actually mastering the material felt like an exhausting battle.
                        </p>
                        <p>
                            StudyPal was created to give students their time, focus, and energy back. By leveraging modern AI to automate the tedious parts of studying—generating structured reviewers, active-recall quizzes, and smart flashcard decks in seconds—learners can focus on what truly matters: understanding concepts deeply, reducing burnout, and acing their goals.
                        </p>
                        <span className="lp-sign">Sebastian Lazarte</span>
                        <span className="lp-sign-role">Creator of StudyPal</span>
                    </article>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section className="lp-section" style={{ paddingTop: 0 }}>
                <div className="site-wrap lp-faq-grid">
                    <div>
                        <span className="landing-section-label">Questions</span>
                        <h2 className="lp-h2">Before you <em>sit down.</em></h2>
                    </div>
                    <div className="lp-faq">
                        {FAQS.map((f) => (
                            <details key={f.q}>
                                <summary>{f.q}</summary>
                                <p>{f.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FINAL CTA ── */}
            <section className="landing-final-cta">
                <div className="final-cta-inner">
                    <h2 className="final-cta-title">Your exam is next. <em>Your desk is ready.</em></h2>
                    <div>
                        <button className="landing-cta-primary large" onClick={primary}>
                            {user ? 'Open my desk' : 'Create your free account'} <ArrowRight size={18} />
                        </button>
                        <p className="final-cta-note">Sign up to save your materials, streak and cards across devices.</p>
                    </div>
                </div>
            </section>

            <SiteFooter onEnterApp={onEnterApp} user={user} />
        </div>
    );
}
