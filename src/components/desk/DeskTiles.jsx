import { useEffect, useMemo, useState } from 'react';
import { Flame, StickyNote, Layers, Sparkles, CalendarClock, Headphones, Activity, Check, Plus, X, Volume1, Volume2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDesk } from '../../desk/useDesk';
import { dayKey, daysAgoKey } from '../../desk/deskUtils';
import { SOUNDS } from '../../desk/sounds';
import { addTodo, getUserTodos, updateTodo } from '../../services/firebaseService';

const DAY_MS = 86400000;
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const fmtMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${m}m`);

// ── Streak + today's goal ────────────────────────────────────────────────────

export function StreakTile({ className = '' }) {
    const { stats, desk, updateDesk } = useDesk();
    const goal = desk.dailyGoal || 120;
    const pct = Math.min(100, Math.round((stats.today.minutes / goal) * 100));

    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = dayKey(d);
        days.push({ key, label: WEEKDAY[d.getDay()], done: (desk.log[key]?.minutes || 0) > 0, today: i === 0 });
    }

    return (
        <section className={`tile ${className}`} aria-label="Streak and daily goal">
            <div className="tile-head">
                <h2 className="tile-title"><Flame size={16} /> Streak</h2>
                <span className="stat-note tabular">{fmtMinutes(stats.week)} this week</span>
            </div>
            <div>
                <span className="stat-big">{stats.streak}</span>
                <span className="stat-unit">{stats.streak === 1 ? 'day' : 'days'} in a row</span>
            </div>
            <div className="streak-week">
                {days.map((d) => (
                    <div key={d.key} className={`streak-day ${d.done ? 'done' : ''} ${d.today ? 'today' : ''}`} title={d.key}>
                        <span className="mark" />
                        {d.label}
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s-2)', fontSize: 'var(--fs-sm)' }}>
                    <span>
                        Today <strong className="tabular">{fmtMinutes(stats.today.minutes)}</strong>
                        <span style={{ color: 'var(--text-muted)' }}> of </span>
                    </span>
                    <select
                        className="select-field"
                        style={{ padding: '4px 1.9rem 4px 8px', fontSize: 'var(--fs-sm)' }}
                        value={goal}
                        onChange={(e) => updateDesk({ dailyGoal: Number(e.target.value) })}
                        aria-label="Daily goal"
                    >
                        {[30, 60, 90, 120, 180, 240, 300, 360].map((m) => <option key={m} value={m}>{fmtMinutes(m)} goal</option>)}
                    </select>
                </div>
                <div className="goal-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
                <span className="stat-note">
                    {pct >= 100 ? 'Goal met. Anything more is a bonus.' : `${stats.today.sessions} ${stats.today.sessions === 1 ? 'session' : 'sessions'} so far`}
                </span>
            </div>
        </section>
    );
}

// ── Today's plan (sticky note) ───────────────────────────────────────────────

export function TodayTile({ className = '', user, onOpenPlanner }) {
    const [todos, setTodos] = useState(null);
    const [title, setTitle] = useState('');
    const today = dayKey();

    useEffect(() => {
        if (!user) return;
        getUserTodos(user.uid).then(setTodos).catch(() => setTodos([]));
    }, [user]);

    const todays = (todos || []).filter((t) => t.dueDate === today);
    const overdue = (todos || []).filter((t) => t.dueDate && t.dueDate < today && !t.completed).length;

    const add = async (e) => {
        e.preventDefault();
        const text = title.trim();
        if (!text) return;
        setTitle('');
        try {
            const id = await addTodo(user.uid, text, '', 'medium', today);
            setTodos((prev) => [{ id, title: text, priority: 'medium', dueDate: today, completed: false }, ...(prev || [])]);
        } catch {
            toast.error('Could not add that task.');
            setTitle(text);
        }
    };

    const toggle = async (todo) => {
        setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: !t.completed } : t)));
        try {
            await updateTodo(todo.id, { completed: !todo.completed });
        } catch {
            toast.error('Could not update that task.');
            setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: todo.completed } : t)));
        }
    };

    return (
        <section className={`tile tile-note ${className}`} aria-label="Today's plan">
            <div className="tile-head">
                <h2 className="tile-title"><StickyNote size={16} /> Today's plan</h2>
                <button className="note-link" onClick={onOpenPlanner}>Planner</button>
            </div>
            {todos === null ? (
                <p className="tile-empty">Reading your planner…</p>
            ) : todays.length === 0 ? (
                <p className="tile-empty">Nothing planned for today. Write one small thing you'll finish.</p>
            ) : (
                <ul className="note-list">
                    {todays.slice(0, 6).map((t) => (
                        <li key={t.id} className={`note-item ${t.completed ? 'done' : ''}`}>
                            <button className="check" onClick={() => toggle(t)} aria-label={t.completed ? `Mark "${t.title}" as not done` : `Mark "${t.title}" as done`}>
                                {t.completed && <Check size={13} strokeWidth={3} />}
                            </button>
                            <span>{t.title}</span>
                        </li>
                    ))}
                    {todays.length > 6 && <li className="stat-note" style={{ paddingTop: 6, color: 'inherit' }}>+{todays.length - 6} more in the planner</li>}
                </ul>
            )}
            {overdue > 0 && <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--pen)' }}>{overdue} overdue from earlier days</span>}
            <form className="note-add" onSubmit={add} style={{ marginTop: 'auto' }}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task for today" maxLength={120} aria-label="New task for today" />
                <button className="icon-btn" type="submit" aria-label="Add task" style={{ color: 'var(--note-text)' }}><Plus size={18} /></button>
            </form>
        </section>
    );
}

// ── Review due (index card) ──────────────────────────────────────────────────

export function ReviewTile({ className = '', decks, loading, onStart, onGenerate }) {
    const due = decks.reduce((s, d) => s + d.due, 0);
    const total = decks.reduce((s, d) => s + d.total, 0);
    const top = [...decks].sort((a, b) => b.due - a.due).slice(0, 3);

    return (
        <section className={`tile tile-card ${className}`} aria-label="Cards due for review">
            <div className="tile-head">
                <h2 className="tile-title"><Layers size={16} /> Due for review</h2>
                {total > 0 && <span className="stat-note tabular">{total} cards saved</span>}
            </div>
            {loading ? (
                <p className="stat-note">Counting your cards…</p>
            ) : decks.length === 0 ? (
                <>
                    <p style={{ fontSize: 'var(--fs-md)', lineHeight: '26px', color: 'var(--card-text-2)' }}>
                        Save a flashcard deck and StudyPal will bring each card back right before you'd forget it.
                    </p>
                    <button className="btn-primary" onClick={onGenerate} style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>Make flashcards</button>
                </>
            ) : (
                <>
                    <div>
                        <span className="stat-big" style={{ color: due ? 'var(--pen)' : 'var(--card-text)' }}>{due}</span>
                        <span className="stat-unit" style={{ color: 'var(--card-text-2)' }}>{due === 1 ? 'card' : 'cards'} due</span>
                    </div>
                    <ul className="deck-list">
                        {top.map((d) => (
                            <li key={d.id}>
                                <span>{d.title}</span>
                                <span className="due">{d.due ? `${d.due} due` : 'done'}</span>
                            </li>
                        ))}
                    </ul>
                    <button className="btn-primary" onClick={onStart} disabled={!due} style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
                        {due ? 'Start review' : 'All caught up'}
                    </button>
                </>
            )}
        </section>
    );
}

// ── Generate (ink) ───────────────────────────────────────────────────────────

export function GenerateTile({ className = '', onGenerate }) {
    return (
        <section className={`tile tile-ink ${className}`} aria-label="Generate study materials">
            <h2 className="tile-title"><Sparkles size={16} /> Generate</h2>
            <h3>Turn this week's notes into something you can test yourself on.</h3>
            <div className="output-chips"><span>Reviewer</span><span>Quiz</span><span>Flashcards</span></div>
            <p>PDF, Word, slides as images, or plain text.</p>
            <button className="btn-primary" onClick={onGenerate} style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>Upload notes</button>
        </section>
    );
}

// ── Study history heatmap ────────────────────────────────────────────────────

const level = (m) => (!m ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4);

export function HeatmapTile({ className = '', weeks = 30 }) {
    const { desk, stats } = useDesk();

    const { columns, months } = useMemo(() => {
        const today = startOfDay(new Date());
        const start = new Date(today);
        start.setDate(start.getDate() - ((weeks - 1) * 7 + today.getDay()));
        const cols = [];
        const labels = [];
        let lastMonth = -1;
        let lastLabel = -3;
        for (let w = 0; w < weeks; w++) {
            const col = [];
            for (let d = 0; d < 7; d++) {
                const date = new Date(start);
                date.setDate(start.getDate() + w * 7 + d);
                const key = dayKey(date);
                col.push({ key, date, minutes: desk.log[key]?.minutes || 0, future: date > today, today: date.getTime() === today.getTime() });
            }
            const m = col[0].date.getMonth();
            // Label a month where it starts, unless the previous label is too close to fit.
            const show = m !== lastMonth && w - lastLabel >= 3;
            labels.push(show ? MONTHS[m] : '');
            if (show) lastLabel = w;
            lastMonth = m;
            cols.push(col);
        }
        return { columns: cols, months: labels };
    }, [desk.log, weeks]);

    const subjects = useMemo(() => {
        const totals = {};
        for (let i = 0; i < 7; i++) {
            const day = desk.log[daysAgoKey(i)];
            Object.entries(day?.bySubject || {}).forEach(([s, m]) => { totals[s] = (totals[s] || 0) + m; });
        }
        const list = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const max = list[0]?.[1] || 1;
        return list.map(([name, minutes]) => ({ name, minutes, pct: (minutes / max) * 100 }));
    }, [desk.log]);

    const activeDays = Object.values(desk.log).filter((d) => d.minutes > 0).length;

    return (
        <section className={`tile ${className}`} aria-label="Study history">
            <div className="tile-head">
                <h2 className="tile-title"><Activity size={16} /> Study history</h2>
                <span className="stat-note tabular">{fmtMinutes(stats.totalMinutes)} over {activeDays} {activeDays === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="heatmap-wrap">
                <div className="heat-months" aria-hidden="true">{months.map((m, i) => <span key={i}>{m}</span>)}</div>
                <div className="heatmap" role="img" aria-label={`Study minutes per day for the last ${weeks} weeks`}>
                    {columns.flat().map((c) => (
                        <span
                            key={c.key}
                            className={`cell ${c.future ? 'future' : ''} ${c.today ? 'today' : ''}`}
                            data-l={c.future ? undefined : level(c.minutes)}
                            title={c.future ? undefined : `${c.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${c.minutes ? fmtMinutes(c.minutes) : 'no study'}`}
                        />
                    ))}
                </div>
            </div>
            <div className="heat-legend-row">
                <span className="stat-note">{subjects.length > 0 ? 'This week by subject' : 'Each square is a day. Tag sessions with a subject to see a weekly breakdown.'}</span>
                <span className="heat-legend" aria-hidden="true">
                    Less
                    {[0, 1, 2, 3, 4].map((l) => <span key={l} className="cell" data-l={l} style={{ background: l ? `var(--hl-${l})` : 'var(--bg-secondary)' }} />)}
                    More
                </span>
            </div>
            {subjects.length > 0 && (
                <div className="subject-bars">
                    {subjects.map((s) => (
                        <div className="subject-bar" key={s.name}>
                            <span className="name">{s.name}</span>
                            <span className="bar"><span style={{ width: `${s.pct}%` }} /></span>
                            <span className="mins">{fmtMinutes(s.minutes)}</span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

// ── Exam countdowns ──────────────────────────────────────────────────────────

export function CountdownTile({ className = '' }) {
    const { desk, updateDesk } = useDesk();
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const today = startOfDay(new Date());

    const items = (desk.countdowns || [])
        .map((c) => ({ ...c, days: Math.round((startOfDay(new Date(`${c.date}T00:00:00`)) - today) / DAY_MS) }))
        .filter((c) => c.days >= 0)
        .sort((a, b) => a.days - b.days);

    const add = (e) => {
        e.preventDefault();
        if (!name.trim() || !date) return;
        updateDesk({ countdowns: [...(desk.countdowns || []), { id: `${Date.now()}`, title: name.trim(), date }] });
        setName('');
        setDate('');
    };

    const remove = (id) => updateDesk({ countdowns: desk.countdowns.filter((c) => c.id !== id) });

    return (
        <section className={`tile ${className}`} aria-label="Exam countdowns">
            <div className="tile-head">
                <h2 className="tile-title"><CalendarClock size={16} /> Countdown</h2>
            </div>
            {items.length === 0 ? (
                <p className="tile-empty">Add your next exam, defense or board date and keep it in view.</p>
            ) : (
                <ul className="countdown-list">
                    {items.slice(0, 3).map((c) => (
                        <li key={c.id} className={`countdown-item ${c.days <= 7 ? 'soon' : ''}`}>
                            <span className="countdown-days">
                                <b>{c.days}</b>
                                <small>{c.days === 0 ? 'today' : c.days === 1 ? 'day' : 'days'}</small>
                            </span>
                            <span style={{ minWidth: 0 }}>
                                <span className="countdown-name" style={{ display: 'block' }}>{c.title}</span>
                                <span className="countdown-date">{new Date(`${c.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </span>
                            <button className="icon-btn" onClick={() => remove(c.id)} aria-label={`Remove ${c.title}`}><X size={15} /></button>
                        </li>
                    ))}
                </ul>
            )}
            <form className="inline-form" onSubmit={add} style={{ marginTop: 'auto' }}>
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Exam name" maxLength={60} aria-label="Exam name" />
                <input className="field mono" type="date" value={date} min={dayKey()} onChange={(e) => setDate(e.target.value)} aria-label="Exam date" />
                <button className="btn-secondary btn-sm" type="submit" disabled={!name.trim() || !date}>Add</button>
            </form>
        </section>
    );
}

// ── Focus sounds ─────────────────────────────────────────────────────────────

export function SoundsTile({ className = '' }) {
    const { sound, chooseSound, changeVolume } = useDesk();
    return (
        <section className={`tile ${className}`} aria-label="Focus sounds">
            <div className="tile-head">
                <h2 className="tile-title"><Headphones size={16} /> Focus sounds</h2>
                {sound.id && <button className="btn-ghost btn-sm" onClick={() => chooseSound(null)}>Stop</button>}
            </div>
            <div className="sound-list">
                {SOUNDS.map((s) => (
                    <button key={s.id} className="sound-btn" aria-pressed={sound.id === s.id} onClick={() => chooseSound(s.id)}>
                        {s.label}
                        <span className="sound-bars" aria-hidden="true"><i /><i /><i /></span>
                    </button>
                ))}
            </div>
            <label className="volume">
                <Volume1 size={16} />
                <input type="range" min="0" max="1" step="0.01" value={sound.volume} onChange={(e) => changeVolume(Number(e.target.value))} aria-label="Volume" />
                <Volume2 size={16} />
            </label>
        </section>
    );
}
