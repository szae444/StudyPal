import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, logOut, getGoogleRedirectResult } from './services/firebaseService';

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

import { LogOut, Home, Bookmark, Menu, BookOpen } from 'lucide-react';

function App() {
  const theme = 'light';
  const [activeTab, setActiveTab] = useState('reviewer');
  const [fileContent, setFileContent] = useState('');

  // Auth and Routing State
  const [user, setUser] = useState(null);
  const [loadingObj, setLoadingObj] = useState(true);
  const [currentView, setCurrentView] = useState('generator'); // 'generator' | 'library'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [currentPage, setCurrentPage] = useState('home'); // 'home' | 'about' | 'changelog'

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

  // Force Light Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

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

  const handleLogout = async () => {
    await logOut();
    toast.success("Successfully logged out");
    setCurrentView('generator');
    setFileContent('');
    setShowLanding(true); // Explicitly go back to landing on logout
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
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', overflowX: 'hidden' }}>
        
        {/* Mobile Overlay */}
        <div 
          className={`mobile-overlay ${isSidebarOpen ? 'open' : ''}`} 
          onClick={() => setIsSidebarOpen(false)}
        />

        {/* Sidebar */}
        <div className={`sidebar-container no-print ${isSidebarOpen ? 'open' : ''}`}>
          <Sidebar
            currentView={currentView}
            setCurrentView={(view) => { setCurrentView(view); setIsSidebarOpen(false); }}
            handleLogout={handleLogout}
            user={user}
          />
        </div>

        <div className="main-container-wrapper" style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          width: '100%', 
          minWidth: 0,
          marginLeft: '260px'
        }}>
          
          {/* Mobile Header */}
          <div className="mobile-header no-print">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ background: 'var(--text-primary)', padding: '0.4rem', borderRadius: '8px', color: 'var(--bg-primary)', display: 'flex', alignItems: 'center' }}>
                 <BookOpen size={18} strokeWidth={2.5} />
              </div>
              <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>StudyPal</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(true)} style={{ color: 'var(--text-primary)', padding: '0.5rem' }}>
              <Menu size={24} />
            </button>
          </div>

          <Toaster position="top-right" toastOptions={{
            style: {
              background: 'var(--bg-glass)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)'
            }
          }} />

          <main className="main-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '3rem 4rem 4rem 4rem', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
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
            {currentView === 'account' && <AccountPage user={user} setCurrentView={setCurrentView} />}
            {currentView === 'payment' && <PaymentPage user={user} setCurrentView={setCurrentView} />}
          </main>
        </div>
      </div>
    );
  }

  // ── NOT AUTHENTICATED: landing pages (showLanding=true) or auth form (showLanding=false) ──
  if (showLanding) {
    if (currentPage === 'about') {
      return <AboutPage onEnterApp={() => setShowLanding(false)} setCurrentPage={setCurrentPage} user={null} />;
    }
    if (currentPage === 'changelog') {
      return <ChangelogPage onEnterApp={() => setShowLanding(false)} setCurrentPage={setCurrentPage} user={null} />;
    }
    return <LandingPage onEnterApp={() => setShowLanding(false)} setCurrentPage={setCurrentPage} user={null} />;
  }

  // ── AUTH FORM ─────────────────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-right" />
      <Auth 
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
