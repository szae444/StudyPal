// Shared helpers for the study desk (timer formatting, day keys, phases).

export const dayKey = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Day key `offset` days before `from` (0 = today). */
export const daysAgoKey = (offset, from = new Date()) => {
    const d = new Date(from);
    d.setDate(d.getDate() - offset);
    return dayKey(d);
};

export const formatClock = (ms) => {
    const total = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** Flow mode: one minute of break for every five minutes of focus, 1–30 min. */
export const earnedBreakMinutes = (focusMs) => Math.min(30, Math.max(1, Math.round(focusMs / 60000 / 5)));

export const PHASES = {
    focus: { label: 'Focus' },
    short: { label: 'Short break' },
    long: { label: 'Long break' },
};
