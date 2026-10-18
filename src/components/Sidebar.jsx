import { LayoutGrid, Sparkles, Bookmark, CalendarDays, MessageCircle, Layers, Shield, UserCircle, LogOut, Moon, Sun } from 'lucide-react';
import BrandMark from './BrandMark';
import { useDesk } from '../desk/useDesk';
import { formatClock, PHASES } from '../desk/deskUtils';

const ADMIN_EMAIL = 'etrazalsebastian@gmail.com';

function NavButton({ item, currentView, setCurrentView }) {
    const Icon = item.icon;
    const active = currentView === item.id;
    return (
        <button
            className={`nav-item ${active ? 'active' : ''} ${item.className || ''}`}
            onClick={() => setCurrentView(item.id)}
            aria-current={active ? 'page' : undefined}
        >
            <Icon size={18} strokeWidth={active ? 2.25 : 1.9} />
            {item.label}
            {item.count > 0 && <span className="nav-count" aria-label={`${item.count} due`}>{item.count > 99 ? '99+' : item.count}</span>}
        </button>
    );
}

export default function Sidebar({ currentView, setCurrentView, handleLogout, user, dueCount, theme, toggleTheme }) {
    const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
    const { timer, display } = useDesk();
    const running = timer.status === 'running';

    const study = [
        { id: 'desk', label: 'My desk', icon: LayoutGrid },
        { id: 'generator', label: 'Generate', icon: Sparkles },
        { id: 'review', label: 'Review cards', icon: Layers, count: dueCount },
        { id: 'library', label: 'Library', icon: Bookmark },
        { id: 'planner', label: 'Planner', icon: CalendarDays },
        { id: 'assistant', label: 'Ask StudyPal', icon: MessageCircle },
    ];

    const nav = { currentView, setCurrentView };

    return (
        <div className="sidebar">
            <button className="brand" onClick={() => setCurrentView('desk')} aria-label="StudyPal, go to my desk">
                <span className="brand-mark"><BrandMark size={30} /></span>
                <span className="brand-name">StudyPal</span>
            </button>

            <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {study.map((item) => <NavButton key={item.id} item={item} {...nav} />)}
                {isAdmin && (
                    <>
                        <div className="nav-group-label">Admin</div>
                        <NavButton item={{ id: 'admin', label: 'Admin', icon: Shield, className: 'admin' }} {...nav} />
                    </>
                )}
            </nav>

            {/* The timer follows you around the app */}
            {(timer.status !== 'idle') && (
                <button className={`sidebar-timer ${running ? 'running' : ''}`} onClick={() => setCurrentView('desk')}>
                    <span className="st-dot" />
                    <span>
                        <span className="st-time">{formatClock(display.ms)}</span>
                        <span className="st-label" style={{ display: 'block' }}>
                            {PHASES[timer.phase].label}{running ? '' : ', paused'}
                        </span>
                    </span>
                </button>
            )}

            <div className="sidebar-footer">
                <button className="nav-item" onClick={toggleTheme}>
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    {theme === 'dark' ? 'Day desk' : 'Night desk'}
                </button>
                <NavButton item={{ id: 'account', label: 'Account', icon: UserCircle }} {...nav} />
                <button className="nav-item danger" onClick={handleLogout}>
                    <LogOut size={18} />
                    Log out
                </button>
            </div>
        </div>
    );
}
