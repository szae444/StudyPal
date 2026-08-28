import { useState } from 'react';
import { LogIn, UserPlus, Mail, Lock, Loader2, ArrowLeft, BookOpen } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../services/firebaseService';
import { toast } from 'react-hot-toast';

export default function Auth({ onLogin, onBack, initialMode = 'login' }) {
    const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [focusedField, setFocusedField] = useState(null);

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            const user = await signInWithGoogle();
            if (user) {
                // Desktop popup flow: user returned immediately
                onLogin(user);
            }
            // Mobile redirect flow: signInWithGoogle() returns null and the browser
            // navigates to Google. The page reloads after auth and onAuthStateChanged
            // in App.jsx handles the routing. We keep the spinner active during redirect.
        } catch (error) {
            console.error("Login Failed", error);
            toast.error("Failed to sign in with Google. Please try again.");
            setLoading(false); // Only reset on error; redirect keeps spinner naturally
        }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error("Please enter email and password.");
            return;
        }

        try {
            setLoading(true);
            let user;
            if (isLogin) {
                user = await signInWithEmail(email, password);
            } else {
                user = await signUpWithEmail(email, password);
            }
            
            if (user) onLogin(user);
        } catch (error) {
            console.error("Auth Error:", error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                toast.error("Invalid email or password.");
            } else if (error.code === 'auth/email-already-in-use') {
                toast.error("Email is already in use.");
            } else if (error.code === 'auth/weak-password') {
                toast.error("Password should be at least 6 characters.");
            } else {
                toast.error(error.message || "Authentication failed.");
            }
        } finally {
            setLoading(false);
        }
    };

    const inputWrapperStyle = (fieldName) => ({
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        borderRadius: '10px',
        border: focusedField === fieldName 
            ? '1.5px solid var(--text-primary)' 
            : '1.5px solid var(--border-color)',
        background: 'var(--bg-primary)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: focusedField === fieldName ? '0 0 0 3px rgba(26, 26, 26, 0.05)' : 'none'
    });

    const inputStyle = {
        width: '100%',
        padding: '0.85rem 1rem 0.85rem 2.75rem',
        borderRadius: '10px',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-primary)',
        fontSize: '0.95rem',
        outline: 'none',
        fontFamily: 'inherit'
    };

    const iconStyle = (fieldName) => ({
        position: 'absolute',
        left: '1rem',
        color: focusedField === fieldName ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'color 0.2s ease'
    });

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            background: 'var(--bg-primary)',
            position: 'relative'
        }} className="fade-in">
            
            {/* Top Navigation Row */}
            <div style={{
                position: 'absolute',
                top: '2rem',
                left: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                <button 
                    onClick={onBack}
                    style={{
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-color)',
                        padding: '0.5rem 1rem',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateX(-2px)';
                        e.currentTarget.style.background = 'var(--bg-glass-hover)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateX(0)';
                        e.currentTarget.style.background = 'var(--bg-glass)';
                    }}
                >
                    <ArrowLeft size={16} /> Back to Home
                </button>
            </div>

            {/* Main Auth Container */}
            <div className="glass-panel" style={{
                padding: '3rem 2.5rem',
                maxWidth: '440px',
                width: '100%',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-glass)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch'
            }}>
                
                {/* Branding Icon */}
                <div style={{
                    background: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem auto',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <BookOpen size={28} strokeWidth={2.2} />
                </div>

                <h2 style={{ 
                    marginBottom: '0.35rem', 
                    fontSize: '1.75rem', 
                    textAlign: 'center',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--text-primary)',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                    {isLogin ? 'Welcome back' : 'Create an account'}
                </h2>
                
                <p style={{ 
                    color: 'var(--text-secondary)', 
                    marginBottom: '2rem', 
                    lineHeight: '1.5', 
                    textAlign: 'center',
                    fontSize: '0.92rem',
                    fontWeight: 400
                }}>
                    {isLogin 
                        ? 'Sign in to access your customized study materials and AI assistant.'
                        : 'Sign up to generate customized study materials, quizzes, and flashcards.'}
                </p>

                {/* Form Elements */}
                <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={inputWrapperStyle('email')}>
                        <Mail size={18} style={iconStyle('email')} />
                        <input 
                            type="email" 
                            placeholder="Email Address" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onFocus={() => setFocusedField('email')}
                            onBlur={() => setFocusedField(null)}
                            style={inputStyle}
                            required
                        />
                    </div>
                    
                    <div style={inputWrapperStyle('password')}>
                        <Lock size={18} style={iconStyle('password')} />
                        <input 
                            type="password" 
                            placeholder="Password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => setFocusedField('password')}
                            onBlur={() => setFocusedField(null)}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ 
                            width: '100%', 
                            padding: '0.85rem', 
                            fontSize: '1rem', 
                            marginTop: '0.5rem', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            background: 'var(--text-primary)',
                            color: 'var(--bg-primary)',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                        {loading ? <Loader2 size={20} className="spinner" /> : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                {/* Separator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>or</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                </div>

                {/* Google Sign In */}
                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    style={{ 
                        width: '100%', 
                        padding: '0.85rem', 
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-glass-hover)';
                        e.currentTarget.style.borderColor = 'var(--text-secondary)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-glass)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '10px' }}>
                        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                            <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                            <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                            <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                            <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                        </g>
                    </svg>
                    {loading ? 'Signing in...' : 'Continue with Google'}
                </button>

                {/* Footer Toggle Link */}
                <div style={{ textAlign: 'center', marginTop: '1.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button 
                        onClick={() => setIsLogin(!isLogin)}
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--text-primary)', 
                            cursor: 'pointer',
                            fontWeight: '600',
                            textDecoration: 'underline',
                            fontFamily: 'inherit',
                            padding: '0 0.25rem'
                        }}
                    >
                        {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                </div>
            </div>
        </div>
    );
}
