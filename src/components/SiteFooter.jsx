import BrandMark from './BrandMark';

export default function SiteFooter({ onEnterApp, user }) {
    return (
        <footer className="landing-footer">
            <div className="footer-inner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
                    <BrandMark size={24} />
                    <p className="footer-copy">© 2026 StudyPal. Built for students everywhere.</p>
                </div>
                <div className="footer-links">
                    <a href="/" className="footer-link">Home</a>
                    <a href="/?page=changelog" className="footer-link">Changelog</a>
                    <a href="/?page=about" className="footer-link">About</a>
                    <button onClick={() => onEnterApp(user ? 'login' : 'signup')} className="footer-link">{user ? 'My desk' : 'Open StudyPal'}</button>
                </div>
            </div>
        </footer>
    );
}
