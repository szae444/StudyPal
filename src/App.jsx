import { useState, useEffect, useCallback, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, logOut, getGoogleRedirectResult, getUserStudyMaterials } from './services/firebaseService';
import { summarizeDecks } from './utils/srs';
import { DeskProvider } from './desk/DeskContext';

import Sidebar from './components/Sidebar';
import Tabs from './components/Tabs';
import FileUpload from './components/FileUpload';
import ReviewerTab from './components/ReviewerTab';
import QuizTab from './components/QuizTab';
import FlashcardsTab from './components/FlashcardsTab';
import Auth from './components/Auth';
import LibraryDashboard from './components/LibraryDashboard';
import Planner from './components/Planner';
import AIAssistant from './components/AIAssistant';
import LandingPage from './components/LandingPage';
import AboutPage from './components/AboutPage';
import ChangelogPage from './components/ChangelogPage';
import AdminPage from './components/AdminPage';
import AccountPage from './components/AccountPage';
import PaymentPage from './components/PaymentPage';
import Desk from './components/desk/Desk';
import MiniTimer from './components/desk/MiniTimer';
import ReviewSession from './components/ReviewSession';
import BrandMark from './components/BrandMark';

import { Menu } from 'lucide-react';

const initialTheme = () => {
  try {
    const saved = localStorage.getItem('studypal.theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const toasterOptions = {
  style: {
    background: 'var(--bg-glass)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-md)',
    fontSize: '14px',
  },
};

function App() {
  const [theme, setTheme] = useState(initialTheme);
  const [activeTab, setActiveTab] = useState('reviewer');
  const [fileContent, setFileContent] = useState('');

  // Auth and Routing State
  const [user, setUser] = useState(null);
  const [loadingObj, setLoadingObj] = useState(true);
  const [currentView, setCurrentView] = useState('desk'); // 'desk' | 'generator' | 'review' | 'library' | ...
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [currentPage, setCurrentPage] = useState('home'); // 'home' | 'about' | 'changelog'
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup' — which Auth form to open

  // Saved materials, used for the review queue and the desk's due count
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);

  // Opens the Auth screen. `mode` lets each CTA say whether it means "Log In" or "Sign Up"
  // so a new user clicking Sign Up doesn't land on the Sign In form by default.
  const enterApp = (mode = 'login') => {
    setAuthMode(mode);
    setShowLanding(false);
  };

  // Handle SPA routing and browser history navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const page = params.get('page') || 'home';
      setCurrentPage(page);
    };

    window.addEventListener('popstate', handlePopState);
    handlePopState(); // Initial check

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Day desk / night desk
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('studypal.theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // Listen for Auth State Changes + handle Google redirect result (mobile)
  useEffect(() => {
    if (!auth) {
      setLoadingObj(false);
      return;
    }

    // Handle the result of a signInWithRedirect (Google on mobile).
    // This must be called on every page load — if a redirect just completed,
    // it resolves with the user; otherwise it resolves with null silently.
    getGoogleRedirectResult()
      .then((redirectUser) => {
        if (redirectUser) {
          toast.success(`Welcome ${redirectUser.displayName || 'User'}!`);
        }
      })
      .catch((error) => {
        console.error('Google redirect sign-in failed:', error);
        toast.error('Google sign-in failed. Please try again.');
      });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Only flip showLanding when a user IS authenticated.
      // Do NOT set showLanding=true on null — Firebase briefly returns null
      // while restoring a persisted session, which would cause a race condition
      // on mobile, flashing the landing page for an already-logged-in user.
      if (currentUser) {
        setShowLanding(false);
      }
      setLoadingObj(false);
    });
    return () => unsubscribe();
  }, []);

  const refreshMaterials = useCallback(async () => {
    if (!user) return;
    try {
      setMaterials(await getUserStudyMaterials(user.uid));
    } catch (e) {
      console.error('Failed to load materials', e);
    } finally {
      setMaterialsLoading(false);
    }
  }, [user]);

  // Re-read saved decks whenever the desk comes back into view, so a deck saved
  // from Generate or edited in the Library shows up in the due count.
  useEffect(() => {
    if (currentView === 'desk') refreshMaterials();
  }, [currentView, refreshMaterials]);

  const decks = useMemo(() => summarizeDecks(materials), [materials]);
  const dueCount = decks.reduce((s, d) => s + d.due, 0);

  const handleMaterialUpdated = useCallback((updated) => {
    setMaterials((prev) => prev.map((m) => (m.id === updated.id ? { ...m, data: updated.data } : m)));
  }, []);

  const handleLogout = async () => {
    await logOut();
    toast.success("Successfully logged out");
    setCurrentView('desk');
    setFileContent('');
    setMaterials([]);
    setShowLanding(true); // Explicitly go back to landing on logout
  };

  const navigate = (view) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
    window.scrollTo({ top: 0 });
  };

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (loadingObj) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // ── AUTHENTICATED: ALWAYS show the app dashboard ──────────────────────────
  // CRITICAL: This check MUST come before showLanding. An authenticated user
  // should never see the landing page or auth screen, regardless of any other state.
  if (user) {
    return (
      <DeskProvider key={user.uid} user={user}>
        <div className="app-shell">

          {/* Mobile Overlay */}
          <div
            className={`mobile-overlay ${isSidebarOpen ? 'open' : ''}`}
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Sidebar */}
          <div className={`sidebar-container no-print ${isSidebarOpen ? 'open' : ''}`}>
            <Sidebar
              currentView={currentView}
              setCurrentView={navigate}
              handleLogout={handleLogout}
              user={user}
              dueCount={dueCount}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          </div>

          <div className="main-container-wrapper">

            {/* Mobile Header */}
            <div className="mobile-header no-print">
              <button className="brand" style={{ margin: 0 }} onClick={() => navigate('desk')}>
                <span className="brand-mark"><BrandMark size={26} /></span>
                <span className="brand-name" style={{ fontSize: 21 }}>StudyPal</span>
              </button>
              <button className="icon-btn" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
                <Menu size={22} />
              </button>
            </div>

            <Toaster position="top-right" toastOptions={toasterOptions} />

            <main className="main-content">
              {currentView === 'desk' && (
                <Desk user={user} decks={decks} decksLoading={materialsLoading} setCurrentView={navigate} />
              )}
              {currentView === 'review' && (
                <ReviewSession
                  materials={materials}
                  onMaterialUpdated={handleMaterialUpdated}
                  onExit={() => navigate('desk')}
                  onGenerate={() => navigate('generator')}
                />
              )}
              {currentView === 'generator' && (
                <>
                  <div className="no-print">
                    <FileUpload onTextExtracted={setFileContent} user={user} />
                  </div>
                  {fileContent && (
                    <div className="fade-in">
                      <div className="no-print">
                        <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
                      </div>
                      <div className="glass-panel" style={{ padding: '2rem', minHeight: '400px' }}>
                        {activeTab === 'reviewer' && <ReviewerTab fileContent={fileContent} user={user} />}
                        {activeTab === 'quiz' && <QuizTab fileContent={fileContent} user={user} />}
                        {activeTab === 'flashcards' && <FlashcardsTab fileContent={fileContent} user={user} />}
                      </div>
                    </div>
                  )}
                </>
              )}
              {currentView === 'library' && <LibraryDashboard user={user} />}
              {currentView === 'planner' && <Planner user={user} />}
              {currentView === 'assistant' && <AIAssistant user={user} />}
              {currentView === 'admin' && <AdminPage user={user} />}
              {currentView === 'account' && <AccountPage user={user} setCurrentView={navigate} />}
              {currentView === 'payment' && <PaymentPage user={user} setCurrentView={navigate} />}
            </main>
          </div>
        </div>
        <MiniTimer />
      </DeskProvider>
    );
  }

  // ── NOT AUTHENTICATED: landing pages (showLanding=true) or auth form (showLanding=false) ──
  if (showLanding) {
    const pageProps = { onEnterApp: enterApp, setCurrentPage, user: null, theme, toggleTheme };
    if (currentPage === 'about') {
      return <AboutPage {...pageProps} />;
    }
    if (currentPage === 'changelog') {
      return <ChangelogPage {...pageProps} />;
    }
    return <LandingPage {...pageProps} />;
  }

  // ── AUTH FORM ─────────────────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-right" toastOptions={toasterOptions} />
      <Auth
        initialMode={authMode}
        onLogin={(u) => {
          toast.success(`Welcome ${u.displayName || 'User'}!`);
          // No need to setShowLanding here — onAuthStateChanged will fire,
          // set user, and the "if (user)" block above will render the app.
        }}
        onBack={() => setShowLanding(true)}
      />
    </>
  );
}

export default App;
