import { createPortal } from 'react-dom';
import { useDesk } from '../../desk/useDesk';
import { formatClock, PHASES } from '../../desk/deskUtils';

/** Renders the timer into the floating Picture-in-Picture window while it is open. */
export default function MiniTimer() {
    const { pipWindow, timer, display, isFlowFocus, start, pause, skip } = useDesk();
    if (!pipWindow) return null;

    const running = timer.status === 'running';
    const pct = Math.min(100, Math.max(0, display.progress * 100));

    return createPortal(
        <div className="mini-timer paper-grid">
            <div className="mt-top">
                <span>{PHASES[timer.phase].label}{running ? '' : timer.status === 'paused' ? ', paused' : ''}</span>
                {isFlowFocus && <span className="tabular">+{display.earned} min break</span>}
            </div>
            <div className="mt-digits">{formatClock(display.ms)}</div>
            <div className="mt-bar"><span style={{ width: `${pct}%` }} /></div>
            <div className="mt-actions">
                <button className={running ? 'btn-secondary' : 'btn-primary'} onClick={running ? pause : start}>
                    {running ? 'Pause' : timer.status === 'paused' ? 'Resume' : 'Start'}
                </button>
                <button className="btn-secondary" onClick={skip}>{timer.phase === 'focus' ? (isFlowFocus ? 'Break' : 'Finish') : 'Skip'}</button>
            </div>
        </div>,
        pipWindow.document.body,
    );
}
