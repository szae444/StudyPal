import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, SkipForward, PictureInPicture2, Settings2, Timer, X, Plus } from 'lucide-react';
import { useDesk } from '../../desk/useDesk';
import { formatClock, PHASES } from '../../desk/deskUtils';

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

export default function TimerTile({ className = '' }) {
    const {
        settings, updateSettings, timer, display, isFlowFocus,
        start, pause, reset, skip, choosePhase,
        desk, updateDesk, pipSupported, pipWindow, openMiniTimer, closeMiniTimer,
    } = useDesk();
    const [showSettings, setShowSettings] = useState(false);
    const [newSubject, setNewSubject] = useState('');
    const settingsRef = useRef(null);

    const running = timer.status === 'running';
    const isBreak = timer.phase !== 'focus';

    // Space starts and pauses the timer from anywhere on the desk.
    useEffect(() => {
        const onKey = (e) => {
            if (e.code !== 'Space' || isTyping(document.activeElement) || e.target.closest?.('button')) return;
            e.preventDefault();
            if (running) pause(); else start();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [running, pause, start]);

    useEffect(() => {
        if (!showSettings) return;
        const onDown = (e) => { if (!settingsRef.current?.contains(e.target)) setShowSettings(false); };
        const onKey = (e) => { if (e.key === 'Escape') setShowSettings(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [showSettings]);

    const status = running
        ? (isBreak ? 'On a break' : isFlowFocus ? 'In the flow' : 'Focusing')
        : timer.status === 'paused' ? 'Paused' : (isBreak ? 'Break is ready' : 'Ready to focus');

    // Ruler: one tick per minute (classic) or a 60-minute scale (flow).
    const totalMin = isFlowFocus ? 60 : Math.max(1, Math.round((display.total || 60000) / 60000));
    const tick = `${100 / Math.min(totalMin, 60)}%`;
    const pct = Math.min(100, Math.max(0, display.progress * 100));

    const cycleLeft = settings.longEvery - (timer.cycle % settings.longEvery);

    const addSubject = (e) => {
        e.preventDefault();
        const name = newSubject.trim();
        if (!name || desk.subjects.includes(name)) return;
        updateDesk({ subjects: [...desk.subjects, name] });
        updateSettings({ subject: name });
        setNewSubject('');
    };

    const removeSubject = (name) => {
        updateDesk({ subjects: desk.subjects.filter((s) => s !== name) });
        if (settings.subject === name) updateSettings({ subject: '' });
    };

    const numberSetting = (key, label, min, max) => (
        <label className="popover-row">
            <span>{label}</span>
            <input
                className="field mono"
                type="number"
                min={min}
                max={max}
                value={settings[key]}
                onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) updateSettings({ [key]: Math.min(max, Math.max(min, v)) });
                }}
            />
        </label>
    );

    return (
        <section className={`tile timer-tile paper-grid ${running ? 'is-running' : ''} ${className}`} aria-label="Focus timer">
            <div className="tile-head" style={{ flexWrap: 'wrap' }}>
                <div className="segmented-tabs timer-phases" role="tablist" aria-label="Timer phase">
                    {Object.entries(PHASES).map(([id, p]) => (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={timer.phase === id}
                            className={`segmented-tab ${timer.phase === id ? 'active' : ''}`}
                            onClick={() => choosePhase(id)}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }} ref={settingsRef}>
                    <div className="segmented-tabs" role="radiogroup" aria-label="Timer mode">
                        <button
                            role="radio"
                            aria-checked={settings.mode === 'classic'}
                            className={`segmented-tab ${settings.mode === 'classic' ? 'active' : ''}`}
                            onClick={() => updateSettings({ mode: 'classic' })}
                            title="Counts down a fixed block"
                        >
                            Classic
                        </button>
                        <button
                            role="radio"
                            aria-checked={settings.mode === 'flow'}
                            className={`segmented-tab ${settings.mode === 'flow' ? 'active' : ''}`}
                            onClick={() => updateSettings({ mode: 'flow' })}
                            title="Counts up and earns 1 minute of break for every 5 minutes of focus"
                        >
                            Flow
                        </button>
                    </div>
                    <button
                        className="icon-btn"
                        onClick={pipWindow ? closeMiniTimer : openMiniTimer}
                        aria-pressed={!!pipWindow}
                        title={pipSupported ? 'Mini timer: float the timer over your notes' : 'Mini timer works in Chrome and Edge on desktop'}
                        aria-label="Mini timer"
                    >
                        <PictureInPicture2 size={17} />
                    </button>
                    <button className="icon-btn" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings} aria-label="Timer settings">
                        <Settings2 size={17} />
                    </button>

                    {showSettings && (
                        <div className="popover" role="dialog" aria-label="Timer settings">
                            <strong style={{ fontSize: 'var(--fs-md)' }}>Timer settings</strong>
                            {numberSetting('focus', 'Focus (min)', 1, 180)}
                            {numberSetting('short', 'Short break (min)', 1, 60)}
                            {numberSetting('long', 'Long break (min)', 1, 90)}
                            {numberSetting('longEvery', 'Long break every', 2, 10)}
                            <div className="popover-row">
                                <span>Auto-start next block</span>
                                <button
                                    className="switch"
                                    role="switch"
                                    aria-checked={settings.autoStart}
                                    onClick={() => updateSettings({ autoStart: !settings.autoStart })}
                                    aria-label="Auto-start next block"
                                />
                            </div>
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Subjects</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {desk.subjects.length === 0 && <span className="stat-note">Tag sessions to see where your time goes.</span>}
                                    {desk.subjects.map((s) => (
                                        <span key={s} className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                            {s}
                                            <button onClick={() => removeSubject(s)} aria-label={`Remove ${s}`} style={{ display: 'flex', color: 'var(--text-muted)' }}><X size={12} /></button>
                                        </span>
                                    ))}
                                </div>
                                <form onSubmit={addSubject} style={{ display: 'flex', gap: 4 }}>
                                    <input className="field" style={{ padding: '6px 10px', fontSize: 'var(--fs-sm)' }} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g. Anatomy" maxLength={40} />
                                    <button className="btn-secondary btn-sm" type="submit" aria-label="Add subject"><Plus size={14} /></button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="timer-face">
                <span className="timer-status"><span className="dot" />{status}</span>
                <div className="timer-digits" aria-live="off" role="timer">{formatClock(display.ms)}</div>
                <span className="timer-sub">
                    {isFlowFocus
                        ? <>Break earned so far: <strong className="tabular">{display.earned} min</strong></>
                        : isBreak
                            ? 'Stand up, drink water, look at something far away.'
                            : <>{cycleLeft === 1 ? 'Long break after this block' : <>Long break in <strong className="tabular">{cycleLeft}</strong> blocks</>}</>}
                </span>
            </div>

            <div>
                <div className="ruler" style={{ '--tick': tick }}>
                    <div className="ruler-fill" style={{ width: `${pct}%` }} />
                    <div className="ruler-now" style={{ left: `calc(${pct}% - 1px)` }} />
                </div>
                <div className="ruler-labels" aria-hidden="true">
                    <span>0</span>
                    <span>{Math.round(totalMin / 2)}</span>
                    <span>{totalMin} min</span>
                </div>
            </div>

            <div className="timer-controls">
                <button className={`btn-primary ${running ? 'is-running' : ''}`} onClick={running ? pause : start}>
                    {running ? <Pause size={18} /> : <Play size={18} />}
                    {running ? 'Pause' : timer.status === 'paused' ? 'Resume' : 'Start'}
                    <span className="kbd" style={{ marginLeft: 4, background: 'transparent', color: 'inherit', borderColor: 'currentColor', opacity: 0.6 }}>Space</span>
                </button>
                {isFlowFocus && timer.status !== 'idle' ? (
                    <button className="btn-secondary" onClick={skip}>
                        <Timer size={16} /> Take my {display.earned} min break
                    </button>
                ) : (
                    <button className="btn-secondary" onClick={skip} title={isBreak ? 'Skip the break' : 'Finish this block now and log the time'}>
                        <SkipForward size={16} /> {isBreak ? 'Skip break' : 'Finish block'}
                    </button>
                )}
                <button className="btn-ghost" onClick={reset} disabled={timer.status === 'idle'} title="Reset without logging">
                    <RotateCcw size={16} /> Reset
                </button>
            </div>

            <div className="timer-options">
                <label>
                    Studying
                    <select className="select-field" value={settings.subject} onChange={(e) => updateSettings({ subject: e.target.value })}>
                        <option value="">No subject</option>
                        {desk.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>
                <span className="tabular">
                    {settings.focus} / {settings.short} / {settings.long} min
                </span>
                {settings.autoStart && <span>Auto-start on</span>}
            </div>
        </section>
    );
}
