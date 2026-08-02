import { useState } from 'react';
import { submitPaymentProof } from '../services/firebaseService';
import { CreditCard, Upload, CheckCircle, ChevronLeft, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PaymentPage({ user, setCurrentView }) {
    const [plan, setPlan] = useState('cram');
    const [refNumber, setRefNumber] = useState('');
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [qrError, setQrError] = useState(false);
    const [filePreview, setFilePreview] = useState(null);

    const handleFileChange = (e) => {
        const selected = e.target.files && e.target.files[0];
        if (selected) {
            setFile(selected);
            // Revoke old preview URL to avoid memory leaks
            if (filePreview) URL.revokeObjectURL(filePreview);
            setFilePreview(URL.createObjectURL(selected));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!refNumber || refNumber.length !== 4) {
            toast.error('Please enter the last 4 digits of the reference number.');
            return;
        }
        if (!file) {
            toast.error('Please upload a screenshot of your payment receipt.');
            return;
        }
        
        setIsSubmitting(true);
        try {
            await submitPaymentProof(user.uid, user.email, plan, file, refNumber);
            setSuccess(true);
            toast.success('Payment submitted successfully! Please wait for admin verification.');
        } catch (error) {
            console.error(error);
            toast.error('Failed to submit payment. Make sure Firebase Storage is enabled.');
        }
        setIsSubmitting(false);
    };

    if (success) {
        return (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '4rem 2rem', textAlign: 'center' }}>
                <CheckCircle size={64} color="var(--success)" style={{ marginBottom: '1.5rem' }} />
                <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>Payment Submitted</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '400px', marginBottom: '2rem' }}>
                    Your proof of payment has been uploaded. An admin will verify it shortly. You will get access once approved.
                </p>
                <button 
                    onClick={() => setCurrentView('account')}
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.8rem 2rem', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                    Back to Account
                </button>
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem 0 5rem' }}>
            <button 
                onClick={() => setCurrentView('account')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '2rem', padding: 0 }}
            >
                <ChevronLeft size={16} /> Back to Account
            </button>

            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Upgrade Plan</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>Select your plan, scan the QR code to pay, and upload your receipt.</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* 1. Plan Selection */}
                <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>1. Select Plan</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div
                            onClick={() => setPlan('cram')}
                            style={{
                                border: `2px solid ${plan === 'cram' ? 'var(--accent-premium)' : 'var(--border-color)'}`,
                                background: plan === 'cram' ? 'var(--accent-premium-soft)' : 'var(--bg-glass)',
                                borderRadius: '16px', padding: '1.5rem', cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>2-Day Cram Pass</div>
                                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>₱30</div>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Perfect for finals week. Up to 100 library saves.</div>
                        </div>
                        <div
                            onClick={() => setPlan('premium')}
                            style={{
                                border: `2px solid ${plan === 'premium' ? 'var(--accent-premium)' : 'var(--border-color)'}`,
                                background: plan === 'premium' ? 'var(--accent-premium-soft)' : 'var(--bg-glass)',
                                borderRadius: '16px', padding: '1.5rem', cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Premium (1 Month)</div>
                                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>₱150</div>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Unlimited library storage and full features.</div>
                        </div>
                    </div>
                </div>

                {/* 2. Payment details (QR) */}
                <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>2. Scan QR to Pay</h3>
                    <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        {/* QR Code Container with Image loader and fallback */}
                        <div style={{ width: '200px', height: '200px', background: 'var(--bg-secondary)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', border: qrError ? '1px dashed var(--border-color)' : '1px solid var(--border-color)', overflow: 'hidden', position: 'relative' }}>
                            {!qrError ? (
                                <img 
                                    src="/payment-qr.png" 
                                    onError={() => setQrError(true)} 
                                    alt="GCash / PayMaya Payment QR Code" 
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', height: '100%' }}>
                                    <QrCode size={48} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, margin: 0 }}>
                                        To set up, save your GCash/PayMaya QR image as:
                                    </p>
                                    <code style={{ display: 'block', background: 'var(--bg-primary)', padding: '0.2rem 0.4rem', borderRadius: '4px', marginTop: '0.5rem', fontSize: '0.7rem', wordBreak: 'break-all', border: '1px solid var(--border-color)' }}>
                                        public/payment-qr.png
                                    </code>
                                </div>
                            )}
                        </div>
                        <p style={{ fontWeight: 600, fontSize: '1rem', margin: 0 }}>Pay exact amount for {plan === 'cram' ? '2-Day Cram Pass' : 'Premium'}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Save the screenshot of your transaction receipt.</p>
                    </div>
                </div>

                {/* 3. Verification Details */}
                <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>3. Verification</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Reference Number (Last 4 Digits)</label>
                            <input 
                                type="text" 
                                value={refNumber}
                                onChange={(e) => setRefNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="e.g. 1234"
                                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.8rem 1rem', borderRadius: '10px', fontSize: '1rem', fontFamily: 'inherit' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Proof of Payment</label>
                            
                            {/* Upload tap zone */}
                            <label style={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0.5rem',
                                width: '100%', 
                                background: filePreview ? 'var(--bg-secondary)' : 'var(--bg-glass)',
                                border: filePreview ? '2px solid var(--success)' : '2px dashed var(--border-color)',
                                color: 'var(--text-muted)', 
                                padding: filePreview ? '1rem' : '2rem 1rem', 
                                borderRadius: '12px', 
                                fontSize: '0.9rem', 
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxSizing: 'border-box'
                            }}>
                                {filePreview ? (
                                    // ── Image preview after selection ──
                                    <>
                                        <img 
                                            src={filePreview} 
                                            alt="Payment proof preview"
                                            style={{ 
                                                width: '100%', 
                                                maxHeight: '280px', 
                                                objectFit: 'contain', 
                                                borderRadius: '8px',
                                                marginBottom: '0.5rem'
                                            }} 
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>
                                            <CheckCircle size={16} />
                                            {file.name} &nbsp;·&nbsp; {(file.size / 1024).toFixed(0)} KB
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Tap to change image</span>
                                    </>
                                ) : (
                                    // ── Empty state ──
                                    <>
                                        <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }} />
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Tap to upload screenshot</span>
                                        <span style={{ fontSize: '0.8rem' }}>JPG, PNG, or HEIC supported</span>
                                    </>
                                )}
                                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                            </label>
                        </div>
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                        background: 'var(--text-primary)',
                        color: 'var(--bg-primary)',
                        border: 'none',
                        padding: '1rem',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        opacity: isSubmitting ? 0.7 : 1,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                >
                    {isSubmitting ? <span className="spinner" style={{ width: '20px', height: '20px', border: '2px solid var(--bg-primary)', borderTopColor: 'transparent', borderRadius: '50%' }} /> : 'Submit for Verification'}
                </button>

            </form>
        </div>
    );
}
