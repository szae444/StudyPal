import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { getDesk, logFocusSession, saveDeskSettings } from '../services/firebaseService';
import { playChime, playSound, stopSound, setVolume as setSoundVolume } from './sounds';
import { DeskContext } from './useDesk';
import { dayKey, formatClock, earnedBreakMinutes, PHASES } from './deskUtils';

// ── Helpers ──────────────────────────────────────────────────────────────────

const readJSON = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
        return fallback;
    }
};

const writeJSON = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

const DEFAULT_SETTINGS = { focus: 25, short: 5, long: 15, longEvery: 4, autoStart: false, mode: 'classic', subject: '' };
const DEFAULT_TIMER = { phase: 'focus', status: 'idle', endsAt: null, remainingMs: null, startedAt: null, elapsedMs: 0, cycle: 0, flowBreakMs: null };
const DEFAULT_DESK = { log: {}, countdowns: [], subjects: [], dailyGoal: 120 };

// ── Provider ─────────────────────────────────────────────────────────────────

export function DeskProvider({ user, children }) {
    const uid = user?.uid;
    const deskKey = uid ? `studypal.desk.${uid}` : null;

    const [settings, setSettings] = useState(() => readJSON('studypal.timerSettings', DEFAULT_SETTINGS));
    const [timer, setTimer] = useState(() => readJSON('studypal.timer', DEFAULT_TIMER));
    const [desk, setDesk] = useState(() => (deskKey ? readJSON(deskKey, DEFAULT_DESK) : DEFAULT_DESK));
    const [now, setNow] = useState(() => Date.now());
    const [sound, setSound] = useState({ id: null, volume: 0.5 });
    const [pipWindow, setPipWindow] = useState(null);

    // Latest values for callbacks and the tick interval, without re-subscribing them.
    const timerRef = useRef(timer);
    const settingsRef = useRef(settings);
    useLayoutEffect(() => {
        timerRef.current = timer;
        settingsRef.current = settings;
    }, [timer, settings]);

    useEffect(() => writeJSON('studypal.timerSettings', settings), [settings]);
    useEffect(() => writeJSON('studypal.timer', timer), [timer]);
    useEffect(() => { if (deskKey) writeJSON(deskKey, desk); }, [deskKey, desk]);

    // Load the remote desk once per user; Firestore is the source of truth.
    useEffect(() => {
        if (!uid) return;
        let cancelled = false;
        getDesk(uid).then((remote) => {
            if (cancelled || !remote) return;
            setDesk((local) => ({ ...local, ...remote, log: { ...local.log, ...(remote.log || {}) } }));
        });
        return () => { cancelled = true; };
    }, [uid]);

    // ── Logging ──
    const recordFocus = useCallback((ms) => {
        const minutes = Math.round(ms / 60000);
        if (minutes < 1) return;
        const day = dayKey();
        const subject = settingsRef.current.subject || '';
        setDesk((d) => {
            const prev = d.log[day] || { minutes: 0, sessions: 0, bySubject: {} };
            const bySubject = { ...(prev.bySubject || {}) };
            if (subject) bySubject[subject] = (bySubject[subject] || 0) + minutes;
            return { ...d, log: { ...d.log, [day]: { minutes: prev.minutes + minutes, sessions: prev.sessions + 1, bySubject } } };
        });
        if (uid) {
            logFocusSession(uid, day, minutes, subject).catch((e) => {
                console.error('Failed to save focus session', e);
                toast.error('Saved on this device only. Check your connection.');
            });
        }
    }, [uid]);

    const updateDesk = useCallback((patch) => {
        setDesk((d) => ({ ...d, ...patch }));
        if (uid) {
            saveDeskSettings(uid, patch).catch((e) => {
                console.error('Failed to save desk settings', e);
                toast.error('Could not save that change. Check your connection.');
            });
        }
    }, [uid]);

    // ── Timer transitions ──
    const phaseMs = useCallback((phase) => settingsRef.current[phase] * 60000, []);

    const enterPhase = useCallback((phase, { autoStart, breakMs } = {}) => {
        const length = breakMs ?? phaseMs(phase);
        const start = autoStart ?? settingsRef.current.autoStart;
        setTimer((t) => ({
            ...t,
            phase,
            status: start ? 'running' : 'idle',
            endsAt: start ? Date.now() + length : null,
            remainingMs: length,
            startedAt: start ? Date.now() : null,
            elapsedMs: 0,
            flowBreakMs: breakMs ?? null,
        }));
    }, [phaseMs]);

    const nextAfterFocus = useCallback((cycle) => (cycle % settingsRef.current.longEvery === 0 ? 'long' : 'short'), []);

    const finishPhase = useCallback((t, { early = false } = {}) => {
        if (t.phase === 'focus') {
            const isFlow = settingsRef.current.mode === 'flow';
            let focusMs;
            if (isFlow) {
                focusMs = t.elapsedMs + (t.status === 'running' ? Date.now() - t.startedAt : 0);
            } else if (early) {
                const total = phaseMs('focus');
                const remaining = t.status === 'running' ? Math.max(0, t.endsAt - Date.now()) : (t.remainingMs ?? total);
                focusMs = total - remaining;
            } else {
                focusMs = phaseMs('focus');
            }
            recordFocus(focusMs);
            // Skipping an untouched focus block shouldn't count toward the long-break cycle.
            if (early && focusMs < 60000 && !isFlow) {
                enterPhase('short');
                return;
            }
            const cycle = t.cycle + 1;
            setTimer((cur) => ({ ...cur, cycle }));
            if (settingsRef.current.mode === 'flow') {
                const breakMs = earnedBreakMinutes(focusMs) * 60000;
                enterPhase(nextAfterFocus(cycle) === 'long' ? 'long' : 'short', { breakMs, autoStart: true });
                toast(`Break earned: ${breakMs / 60000} min`, { icon: '☕' });
            } else {
                enterPhase(nextAfterFocus(cycle));
            }
        } else {
            enterPhase('focus');
        }
    }, [enterPhase, nextAfterFocus, phaseMs, recordFocus]);

    // Tick. Remaining time is always derived from timestamps, so a sleeping tab can't drift.
    useEffect(() => {
        if (timer.status !== 'running') return;
        const id = setInterval(() => {
            const t = timerRef.current;
            setNow(Date.now());
            const counting = !(t.phase === 'focus' && settingsRef.current.mode === 'flow');
            if (counting && t.endsAt && Date.now() >= t.endsAt) {
                playChime();
                toast.success(t.phase === 'focus' ? 'Focus block done. Take a breather.' : 'Break over. Back to the desk.');
                finishPhase(t);
            }
        }, 250);
        return () => clearInterval(id);
    }, [timer.status, timer.phase, finishPhase]);

    const isFlowFocus = timer.phase === 'focus' && settings.mode === 'flow';

    const display = useMemo(() => {
        if (isFlowFocus) {
            const elapsed = timer.elapsedMs + (timer.status === 'running' ? now - timer.startedAt : 0);
            return { ms: elapsed, progress: (elapsed % 3600000) / 3600000, earned: earnedBreakMinutes(elapsed), elapsed };
        }
        const total = timer.flowBreakMs ?? settings[timer.phase] * 60000;
        const remaining = timer.status === 'running' ? Math.max(0, timer.endsAt - now) : (timer.remainingMs ?? total);
        return { ms: remaining, progress: total ? 1 - remaining / total : 0, total, elapsed: total - remaining };
    }, [isFlowFocus, timer, now, settings]);

    const start = useCallback(() => {
        const t = timerRef.current;
        if (t.status === 'running') return;
        if (t.phase === 'focus' && settingsRef.current.mode === 'flow') {
            setTimer({ ...t, status: 'running', startedAt: Date.now() });
        } else {
            const remaining = t.remainingMs ?? (t.flowBreakMs ?? phaseMs(t.phase));
            setTimer({ ...t, status: 'running', endsAt: Date.now() + remaining, startedAt: Date.now() });
        }
        setNow(Date.now());
    }, [phaseMs]);

    const pause = useCallback(() => {
        const t = timerRef.current;
        if (t.status !== 'running') return;
        if (t.phase === 'focus' && settingsRef.current.mode === 'flow') {
            setTimer({ ...t, status: 'paused', elapsedMs: t.elapsedMs + (Date.now() - t.startedAt), startedAt: null });
        } else {
            setTimer({ ...t, status: 'paused', remainingMs: Math.max(0, t.endsAt - Date.now()), endsAt: null });
        }
    }, []);

    const reset = useCallback(() => {
        setTimer((t) => ({ ...DEFAULT_TIMER, phase: t.phase, cycle: t.cycle }));
    }, []);

    /** Skip ahead. A focus block with at least a minute in it still counts. */
    const skip = useCallback(() => {
        const t = timerRef.current;
        if (t.phase === 'focus') {
            finishPhase(t, { early: true });
        } else {
            enterPhase('focus', { autoStart: false });
        }
    }, [enterPhase, finishPhase]);

    const choosePhase = useCallback((phase) => {
        setTimer((t) => ({ ...DEFAULT_TIMER, phase, cycle: t.cycle }));
    }, []);

    const updateSettings = useCallback((patch) => {
        setSettings((s) => ({ ...s, ...patch }));
        const t = timerRef.current;
        // Changing lengths or mode while idle should show the new length immediately.
        if (t.status === 'idle' && ('focus' in patch || 'short' in patch || 'long' in patch || 'mode' in patch)) {
            setTimer((cur) => ({ ...cur, remainingMs: null, flowBreakMs: null, elapsedMs: 0 }));
        }
    }, []);

    // Show the countdown in the tab title while it runs.
    useEffect(() => {
        const base = 'StudyPal';
        if (timer.status === 'running') {
            document.title = `${formatClock(display.ms)} ${PHASES[timer.phase].label} | ${base}`;
        } else {
            document.title = base;
        }
    }, [display.ms, timer.status, timer.phase]);

    // ── Sounds ──
    const chooseSound = useCallback((id) => {
        if (!id || id === sound.id) {
            stopSound();
            setSound((s) => ({ ...s, id: null }));
        } else {
            playSound(id);
            setSoundVolume(sound.volume);
            setSound((s) => ({ ...s, id }));
        }
    }, [sound.id, sound.volume]);

    const changeVolume = useCallback((volume) => {
        setSoundVolume(volume);
        setSound((s) => ({ ...s, volume }));
    }, []);

    useEffect(() => () => stopSound(), []);

    // ── Mini timer (Document Picture-in-Picture) ──
    const pipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

    const openMiniTimer = useCallback(async () => {
        if (!pipSupported) {
            toast('The mini timer works in Chrome and Edge on desktop.');
            return;
        }
        if (pipWindow) { pipWindow.focus(); return; }
        try {
            const win = await window.documentPictureInPicture.requestWindow({ width: 280, height: 168 });
            // Copy the app's styles so the mini timer matches.
            [...document.styleSheets].forEach((sheet) => {
                try {
                    const style = win.document.createElement('style');
                    style.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n');
                    win.document.head.appendChild(style);
                } catch {
                    if (sheet.href) {
                        const link = win.document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = sheet.href;
                        win.document.head.appendChild(link);
                    }
                }
            });
            win.document.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || 'light');
            win.addEventListener('pagehide', () => setPipWindow(null));
            setPipWindow(win);
        } catch (e) {
            console.error('Mini timer failed', e);
            toast.error('Could not open the mini timer.');
        }
    }, [pipSupported, pipWindow]);

    const closeMiniTimer = useCallback(() => {
        pipWindow?.close();
        setPipWindow(null);
    }, [pipWindow]);

    // ── Derived stats ──
    const stats = useMemo(() => {
        const log = desk.log || {};
        const today = log[dayKey()] || { minutes: 0, sessions: 0 };
        let streak = 0;
        const cursor = new Date();
        // A streak survives until the end of today even if today has no study yet.
        if (!(log[dayKey(cursor)]?.minutes > 0)) cursor.setDate(cursor.getDate() - 1);
        while (log[dayKey(cursor)]?.minutes > 0) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }
        let week = 0;
        const w = new Date();
        for (let i = 0; i < 7; i++) {
            week += log[dayKey(w)]?.minutes || 0;
            w.setDate(w.getDate() - 1);
        }
        const totalMinutes = Object.values(log).reduce((sum, d) => sum + (d.minutes || 0), 0);
        return { today, streak, week, totalMinutes };
    }, [desk.log]);

    const value = {
        user,
        settings, updateSettings,
        timer, display, isFlowFocus, start, pause, reset, skip, choosePhase,
        desk, updateDesk, stats,
        sound, chooseSound, changeVolume,
        pipSupported, pipWindow, openMiniTimer, closeMiniTimer,
    };

    return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}
