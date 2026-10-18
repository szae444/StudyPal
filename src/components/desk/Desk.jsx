import TimerTile from './TimerTile';
import { StreakTile, TodayTile, ReviewTile, GenerateTile, HeatmapTile, CountdownTile, SoundsTile } from './DeskTiles';

const greeting = () => {
    const h = new Date().getHours();
    if (h < 5) return 'Still up';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
};

export default function Desk({ user, decks, decksLoading, setCurrentView }) {
    const first = (user?.displayName || user?.email || '').split(/[\s@]/)[0];
    const due = decks.reduce((s, d) => s + d.due, 0);
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="fade-in">
            <header className="desk-greeting">
                <div>
                    <span className="desk-date">{today}</span>
                    <h1>{greeting()}{first ? <>, <em>{first}</em></> : ''}.</h1>
                    <p>
                        {due > 0
                            ? `${due} ${due === 1 ? 'card is' : 'cards are'} waiting for review. Start with those, then pick a focus block.`
                            : 'Pick one thing to work on, then start a focus block.'}
                    </p>
                </div>
            </header>

            <div className="desk-grid">
                <TimerTile className="span-8 row-2" />
                <StreakTile className="span-4" />
                <ReviewTile
                    className="span-4"
                    decks={decks}
                    loading={decksLoading}
                    onStart={() => setCurrentView('review')}
                    onGenerate={() => setCurrentView('generator')}
                />
                <TodayTile className="span-4" user={user} onOpenPlanner={() => setCurrentView('planner')} />
                <HeatmapTile className="span-8" />
                <CountdownTile className="span-4" />
                <SoundsTile className="span-4" />
                <GenerateTile className="span-4" onGenerate={() => setCurrentView('generator')} />
            </div>
        </div>
    );
}
