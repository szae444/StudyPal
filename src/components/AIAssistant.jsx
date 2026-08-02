import { useState, useRef, useEffect } from 'react';
import { createChatSession } from '../services/geminiService';
import { saveAIChat, getUserAIChats, deleteAIChat, getUserProfile, checkAndIncrementAIMessages } from '../services/firebaseService';
import { Send, Bot, User, Loader2, Sparkles, Trash2, Paperclip, X, FileText, Image, MessageSquare, Plus, ChevronLeft, Lock, Clock, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { toast } from 'react-hot-toast';
import * as mammoth from 'mammoth';
import { extractTextFromPDF } from '../utils/fileParser';

export default function AIAssistant({ user }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatSession, setChatSession] = useState(null);
    const [attachedFile, setAttachedFile] = useState(null); 
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    
    // History states
    const [chatHistory, setChatHistory] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [showSidebar, setShowSidebar] = useState(true);
    const [isShortConcise, setIsShortConcise] = useState(false);

    const [isLocked, setIsLocked] = useState(false);
    const [aiMessagesUsed, setAiMessagesUsed] = useState(0);
    const [aiMessagesMax, setAiMessagesMax] = useState(null); // null = unlimited
    const [aiQuotaResetsAt, setAiQuotaResetsAt] = useState(null);
    const [userPlan, setUserPlan] = useState('free');

    /** Format a future Date as "Xh Ym" or "Xd Yh" */
    const formatTimeUntil = (date) => {
        if (!date) return '';
        const ms = date - Date.now();
        if (ms <= 0) return 'soon';
        const totalMins = Math.floor(ms / 60000);
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        if (h >= 24) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h`; }
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Initial load: Fetch history and check mobile
    useEffect(() => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) setShowSidebar(false);

        const fetchHistory = async () => {
            if (!user) return;
            setIsLoadingHistory(true);
            try {
                const history = await getUserAIChats(user.uid);
                setChatHistory(history);

                // ── Check AI message quota (read-only, no increment) ──────────────
                const profile = await getUserProfile(user.uid);
                setUserPlan(profile.plan);

                if (profile.plan === 'premium') {
                    // Unlimited — no lock needed
                    setAiMessagesMax(null);
                } else {
                    const max = profile.plan === 'cram' ? 10 : 5;
                    const resetWindowMs = profile.plan === 'cram'
                        ? 6 * 60 * 60 * 1000
                        : 7 * 24 * 60 * 60 * 1000;
                    setAiMessagesMax(max);
                    const used = profile.aiMessagesUsed || 0;
                    setAiMessagesUsed(used);
                    if (used >= max) {
                        const resetAtMs = profile.aiMessagesResetAt?.toMillis?.() || 0;
                        if (Date.now() < resetAtMs + resetWindowMs) {
                            setIsLocked(true);
                            setAiQuotaResetsAt(new Date(resetAtMs + resetWindowMs));
                        }
                        // else: window passed — auto-resets on next send
                    }
                }
            } catch (err) {
                console.error(err);
            }
            setIsLoadingHistory(false);
        };
        fetchHistory();
    }, [user]);

    if (isLocked) {
        return (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '4rem', textAlign: 'center' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1.5rem', borderRadius: '50%', color: 'var(--error)', marginBottom: '1.5rem' }}>
                    <Lock size={48} />
                </div>
                <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.75rem' }}>Message Limit Reached</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '400px', marginBottom: '1.25rem' }}>
                    {userPlan === 'cram'
                        ? "You've used all 10 messages in your Cram Pass period."
                        : "You've used all 5 messages in your Free Tier period."}
                </p>
                {aiQuotaResetsAt && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(245,158,11,0.1)', color: '#D97706', padding: '0.5rem 1.25rem', borderRadius: '99px', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                        <Clock size={16} />
                        Resets in {formatTimeUntil(aiQuotaResetsAt)}
                    </div>
                )}
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Upgrade to Premium for unlimited AI conversations.</p>
            </div>
        );
    }

    // Initialize/Reset chat session
    const resetSession = (history = []) => {
        try {
            // Google Generative AI history format: [{ role: 'user' | 'model', parts: [{ text: '...' }] }]
            const formattedHistory = history.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));
            const session = createChatSession(formattedHistory, user?.uid, user?.email);
            setChatSession(session);
        } catch (error) {
            console.error("Failed to initialize chat:", error);
            toast.error("AI Assistant is currently unavailable.");
        }
    };

    // Load active chat or start new
    useEffect(() => {
        if (!activeChatId) {
            setMessages([{
                role: 'model',
                text: "Hi there! I'm StudyPal's AI Assistant. You can chat with me or attach a file (PDF, image, document, etc.) for me to analyze!",
                isWelcome: true
            }]);
            resetSession();
        } else {
            const chat = chatHistory.find(c => c.id === activeChatId);
            if (chat) {
                setMessages(chat.messages);
                resetSession(chat.messages.filter(m => !m.isWelcome));
            }
        }
    }, [activeChatId, chatHistory]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleNewChat = () => {
        setActiveChatId(null);
        setMessages([]);
        setAttachedFile(null);
        setInput('');
    };

    const handleDeleteChat = async (e, chatId) => {
        e.stopPropagation();
        if (!window.confirm("Delete this conversation?")) return;
        try {
            await deleteAIChat(chatId);
            setChatHistory(prev => prev.filter(c => c.id !== chatId));
            if (activeChatId === chatId) handleNewChat();
            toast.success("Chat deleted");
        } catch (err) {
            toast.error("Failed to delete chat");
        }
    };

    // -------------------------------------------------------
    // File Processing
    // -------------------------------------------------------
    const processFile = async (file) => {
        if (!file) return;
        setIsProcessingFile(true);
        const ext = file.name.split('.').pop().toLowerCase();

        try {
            if (['txt', 'md', 'csv', 'json', 'js', 'py', 'html', 'css', 'ts', 'jsx', 'tsx'].includes(ext)) {
                const text = await file.text();
                setAttachedFile({
                    name: file.name,
                    fileType: 'text',
                    payload: { type: 'text', data: `File: ${file.name}\n\n${text}` }
                });
            } else if (ext === 'docx') {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                setAttachedFile({
                    name: file.name,
                    fileType: 'text',
                    payload: { type: 'text', data: `File: ${file.name}\n\n${result.value}` }
                });
            } else if (ext === 'pdf') {
                const arrayBuffer = await file.arrayBuffer();
                const text = await extractTextFromPDF(arrayBuffer);
                setAttachedFile({
                    name: file.name,
                    fileType: 'text',
                    payload: { type: 'text', data: `File: ${file.name}\n\n${text}` }
                });
            } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                const base64Data = dataUrl.split(',')[1];
                setAttachedFile({
                    name: file.name,
                    fileType: 'image',
                    payload: { type: 'inline', data: base64Data, mimeType: file.type || `image/${ext}` }
                });
            } else {
                try {
                    const text = await file.text();
                    setAttachedFile({
                        name: file.name,
                        fileType: 'text',
                        payload: { type: 'text', data: `File: ${file.name}\n\n${text}` }
                    });
                } catch {
                    toast.error(`Unsupported file type: .${ext}`);
                }
            }
        } catch (error) {
            console.error("File processing error:", error);
            toast.error("Failed to process the file.");
        }
        setIsProcessingFile(false);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) await processFile(file);
        e.target.value = '';
    };

    const removeAttachment = () => setAttachedFile(null);

    // -------------------------------------------------------
    // Chat Sending  
    // -------------------------------------------------------
    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();

        const userText = input.trim();
        const hasFile = !!attachedFile;
        if (!userText && !hasFile) return;
        if (!chatSession) return;

        // ── Check AI message quota before sending ────────────────────────────
        if (userPlan !== 'premium' && user) {
            const quota = await checkAndIncrementAIMessages(user.uid);
            if (!quota.allowed) {
                setIsLocked(true);
                setAiQuotaResetsAt(quota.resetsAt);
                toast.error('Message limit reached. Your quota will reset automatically.');
                return;
            }
            setAiMessagesUsed(quota.used);
        }
        const displayText = userText || `[Attached: ${attachedFile?.name}]`;
        const fileToSend = attachedFile;

        const newUserMessage = {
            role: 'user',
            text: displayText,
            attachment: fileToSend ? { name: fileToSend.name, fileType: fileToSend.fileType } : null
        };

        const updatedMessages = [...messages, newUserMessage];
        setMessages(updatedMessages);
        setInput('');
        setAttachedFile(null);
        setIsTyping(true);

        try {
            let messageParts;
            if (fileToSend) {
                const { payload } = fileToSend;
                if (payload.type === 'text') {
                    const combined = userText
                        ? `${userText}\n\n---\n${payload.data}`
                        : `Please analyze this file:\n\n${payload.data}`;
                    messageParts = combined;
                } else if (payload.type === 'inline') {
                    messageParts = [
                        ...(userText ? [{ text: userText }] : [{ text: 'Please analyze this file.' }]),
                        { inlineData: { data: payload.data, mimeType: payload.mimeType } }
                    ];
                }
            } else {
                messageParts = userText;
            }

            // Append brevity instruction if toggle is active
            if (isShortConcise) {
                const brevityInstruction = "\n\n(Please make your response short and concise.)";
                if (typeof messageParts === 'string') {
                    messageParts += brevityInstruction;
                } else if (Array.isArray(messageParts)) {
                    messageParts.push({ text: brevityInstruction });
                }
            }

            const result = await chatSession.sendMessage(messageParts);
            const responseText = result.response.text();
            const modelMessage = { role: 'model', text: responseText };
            const finalMessages = [...updatedMessages, modelMessage];
            setMessages(finalMessages);

            // Save to Firestore
            // Use the first user message as title if new chat
            const chatTitle = activeChatId 
                ? chatHistory.find(c => c.id === activeChatId)?.title 
                : (userText.length > 30 ? userText.substring(0, 30) + '...' : userText) || 'New Conversation';

            // We only want to save actual conversation messages, not the welcome message if possible, 
            // but for simplicity we save the whole array.
            const savedId = await saveAIChat(user.uid, activeChatId, chatTitle, finalMessages.filter(m => !m.isWelcome));
            
            if (!activeChatId) {
                setActiveChatId(savedId);
                // Refresh history list
                const refreshedHistory = await getUserAIChats(user.uid);
                setChatHistory(refreshedHistory);
            } else {
                setChatHistory(prev => prev.map(c => c.id === savedId ? { ...c, messages: finalMessages } : c));
            }

        } catch (error) {
            console.error("Failed to get AI response:", error);
            toast.error("Sorry, I encountered an error answering that.");
            setMessages(prev => [...prev, {
                role: 'model',
                text: "I'm sorry, I encountered an error while processing your request. Please try again.",
                isError: true
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const getFileIcon = (fileType) => {
        if (fileType === 'image') return <Image size={14} />;
        return <FileText size={14} />;
    };

    return (
        <div className="fade-in ai-assistant-container" style={{ flex: 1, minHeight: 0, display: 'flex', gap: '1.5rem', maxHeight: '100%', position: 'relative' }}>
            
            {/* Mobile Sidebar Overlay */}
            {showSidebar && (
                <div 
                    className="ai-sidebar-overlay"
                    onClick={() => setShowSidebar(false)}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.2)',
                        backdropFilter: 'blur(2px)',
                        zIndex: 15,
                        display: 'none' // Controlled by CSS media query
                    }}
                />
            )}

            {/* History Sidebar */}
            {showSidebar && (
                <div className="glass-panel ai-history-sidebar slide-right" style={{
                    width: '280px',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-glass)',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    zIndex: 20
                }}>
                    <div style={{ padding: '1.15rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button 
                            className="ai-history-close-btn mobile-only"
                            onClick={() => setShowSidebar(false)}
                            style={{
                                padding: '0.4rem',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <X size={16} />
                        </button>
                        <button 
                            onClick={handleNewChat}
                            className="btn-primary" 
                            style={{ 
                                flex: 1, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0.5rem',
                                padding: '0.75rem',
                                borderRadius: '12px',
                                fontSize: '0.9rem'
                            }}
                        >
                            <Plus size={18} /> New Chat
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                        <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem', paddingLeft: '0.5rem' }}>Recent Conversations</h4>
                        {isLoadingHistory ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                <Loader2 size={24} className="spinner" style={{ margin: '0 auto' }} />
                            </div>
                        ) : chatHistory.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem' }}>No recent chats</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {chatHistory.map(chat => (
                                    <div 
                                        key={chat.id}
                                        onClick={() => setActiveChatId(chat.id)}
                                        className={activeChatId === chat.id ? 'active-chat-item' : 'chat-item'}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            transition: 'all 0.2s',
                                            position: 'relative',
                                            background: activeChatId === chat.id ? 'var(--bg-secondary)' : 'transparent',
                                            border: '1px solid ' + (activeChatId === chat.id ? 'var(--border-color)' : 'transparent')
                                        }}
                                    >
                                        <MessageSquare size={16} color={activeChatId === chat.id ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                                        <span style={{ 
                                            fontSize: '0.9rem', 
                                            whiteSpace: 'nowrap', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis', 
                                            flex: 1,
                                            color: activeChatId === chat.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            fontWeight: activeChatId === chat.id ? 600 : 400
                                        }}>
                                            {chat.title}
                                        </span>
                                        <button 
                                            onClick={(e) => handleDeleteChat(e, chat.id)}
                                            style={{ 
                                                background: 'transparent', 
                                                border: 'none', 
                                                color: 'var(--text-muted)', 
                                                cursor: 'pointer',
                                                padding: '0.2rem',
                                                opacity: activeChatId === chat.id ? 0.5 : 0,
                                                transform: 'scale(0.8)'
                                            }}
                                            className="delete-chat-btn"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Main Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Header */}
                <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button 
                            onClick={() => setShowSidebar(!showSidebar)}
                            style={{ 
                                padding: '0.5rem', 
                                borderRadius: '10px', 
                                background: 'var(--bg-secondary)', 
                                border: '1px solid var(--border-color)', 
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <ChevronLeft size={20} style={{ transform: showSidebar ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }} />
                        </button>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Sparkles color="var(--accent-primary)" size={24} />
                            {activeChatId ? chatHistory.find(c => c.id === activeChatId)?.title : 'New Chat'}
                        </h2>
                    </div>
                </div>

                {/* Chat Display Panel */}
                <div className="glass-panel" style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', position: 'relative', borderRadius: '24px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-glass)'
                }}>
                    {/* Message list */}
                    <div style={{
                        flex: 1, overflowY: 'auto', padding: '1.5rem 2rem',
                        display: 'flex', flexDirection: 'column', gap: '2rem'
                    }}>
                        {messages.length === 0 && !isTyping && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', gap: '1rem' }}>
                                <div style={{ 
                                    width: '80px', height: '80px', borderRadius: '24px', 
                                    background: 'var(--bg-secondary)', display: 'flex', 
                                    alignItems: 'center', justifyContent: 'center',
                                    border: '1px solid var(--border-color)',
                                    marginBottom: '0.5rem'
                                }}>
                                    <Bot size={40} style={{ opacity: 0.5 }} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>How can I help you?</h3>
                                    <p style={{ maxWidth: '350px', fontSize: '1rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                        Ask me anything about your studies, or upload a document to get a summary and explanation.
                                    </p>
                                </div>
                            </div>
                        )}

                        {messages.map((msg, idx) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div key={idx} className={`slide-up chat-bubble`} style={{
                                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%', display: 'flex', gap: '1rem',
                                    flexDirection: isUser ? 'row-reverse' : 'row'
                                }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: '36px', height: '36px', flexShrink: 0, borderRadius: '50%',
                                        background: isUser ? 'var(--bg-secondary)' : 'var(--accent-primary)',
                                        color: isUser ? 'var(--text-primary)' : 'var(--bg-primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: isUser ? '1px solid var(--border-color)' : 'none'
                                    }}>
                                        {isUser ? <User size={18} /> : <Bot size={18} />}
                                    </div>

                                    {/* Bubble */}
                                    <div style={{
                                        background: isUser ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        color: msg.isError ? 'var(--error)' : 'var(--text-primary)',
                                        padding: '1.25rem 1.5rem', borderRadius: '20px',
                                        borderTopLeftRadius: isUser ? '20px' : '4px',
                                        borderTopRightRadius: isUser ? '4px' : '20px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)', 
                                        lineHeight: '1.6', fontSize: '1rem',
                                        position: 'relative'
                                    }}>
                                        {msg.attachment && (
                                            <div style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                                background: 'var(--bg-glass)', padding: '0.4rem 0.8rem',
                                                borderRadius: '8px', fontSize: '0.85rem', marginBottom: '0.75rem',
                                                color: 'var(--text-secondary)', border: '1px solid var(--border-color)'
                                            }}>
                                                {getFileIcon(msg.attachment.fileType)}
                                                {msg.attachment.name}
                                            </div>
                                        )}
                                        {isUser ? (
                                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text !== `[Attached: ${msg.attachment?.name}]` ? msg.text : ''}</div>
                                        ) : (
                                            <div className="markdown-body" style={{ color: 'inherit' }}>
                                                {msg.isError && <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: '-2px' }} />}
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {isTyping && (
                            <div className="fade-in" style={{ alignSelf: 'flex-start', display: 'flex', gap: '1rem' }}>
                                <div style={{
                                    width: '36px', height: '36px', flexShrink: 0, borderRadius: '50%',
                                    background: 'var(--accent-primary)', color: 'var(--bg-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Bot size={18} />
                                </div>
                                <div style={{
                                    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                                    padding: '1.25rem 1.5rem', borderRadius: '20px', borderTopLeftRadius: '4px',
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)',
                                    fontSize: '0.95rem'
                                }}>
                                    <Loader2 size={16} className="spinner" /> 
                                    <span>StudyPal is thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="chat-input-area" style={{
                        padding: '1.25rem 2.5rem',
                        borderTop: '1px solid var(--border-color)',
                        background: 'rgba(0,0,0,0.01)',
                        display: 'flex', flexDirection: 'column', gap: '0.75rem'
                    }}>
                        {/* Prompt Shortcuts */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <button
                                onClick={() => setIsShortConcise(!isShortConcise)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '100px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    background: isShortConcise ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                    color: isShortConcise ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                    border: `1px solid ${isShortConcise ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    boxShadow: isShortConcise ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                                }}
                            >
                                <Sparkles size={14} />
                                Short & Concise
                            </button>
                        </div>

                        {attachedFile && (
                            <div className="fade-in" style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                padding: '0.5rem 0.9rem', borderRadius: '10px',
                                fontSize: '0.9rem', color: 'var(--text-primary)', width: 'fit-content'
                            }}>
                                {isProcessingFile ? <Loader2 size={16} className="spinner" /> : getFileIcon(attachedFile.fileType)}
                                <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.name}</span>
                                {!isProcessingFile && (
                                    <button onClick={removeAttachment} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isTyping || isProcessingFile}
                                style={{
                                    padding: '0.9rem', borderRadius: '14px', border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)', color: 'var(--text-muted)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    height: '54px'
                                }}
                            >
                                <Paperclip size={22} />
                            </button>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type your message..."
                                    style={{
                                        width: '100%', minHeight: '54px', maxHeight: '150px', padding: '0.9rem 1.25rem', paddingRight: '1rem',
                                        borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)', fontSize: '1rem', resize: 'none', outline: 'none',
                                        fontFamily: 'inherit', lineHeight: '1.5'
                                    }}
                                />
                            </div>
                            <button
                                onClick={() => handleSendMessage()}
                                disabled={(!input.trim() && !attachedFile) || isTyping || isProcessingFile}
                                className="btn-primary"
                                style={{ 
                                    width: '54px', height: '54px', padding: 0, borderRadius: '16px', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}
                            >
                                {isTyping ? <Loader2 size={24} className="spinner" /> : <Send size={24} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .chat-item:hover { background: var(--bg-secondary) !important; opacity: 1; }
                .chat-item:hover .delete-chat-btn { opacity: 0.8 !important; }
                .active-chat-item .delete-chat-btn { opacity: 0.4 !important; }
                .active-chat-item .delete-chat-btn:hover { opacity: 1 !important; color: var(--error) !important; }
                .markdown-body p { margin-bottom: 0.85rem; }
                .markdown-body p:last-child { margin-bottom: 0; }
                .markdown-body ul, .markdown-body ol { margin-left: 1.5rem; margin-bottom: 0.85rem; }
                .markdown-body pre { background: var(--bg-secondary); padding: 1rem; border-radius: 12px; margin: 1rem 0; overflow-x: auto; }
                .markdown-body code { background: rgba(0,0,0,0.05); padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9em; }

                .mobile-only { display: none !important; }

                @media (max-width: 1024px) {
                    .ai-assistant-container { gap: 1rem !important; }
                    .ai-history-sidebar { width: 240px !important; }
                }

                @media (max-width: 768px) {
                    .mobile-only { display: flex !important; }
                    .ai-assistant-container { gap: 0 !important; }
                    .ai-sidebar-overlay { 
                        display: block !important; 
                        background: rgba(0,0,0,0.4) !important;
                        backdrop-filter: blur(4px) !important;
                    }
                    .ai-history-sidebar { 
                        position: absolute !important;
                        left: 0;
                        top: 0;
                        bottom: 0;
                        width: 280px !important;
                        box-shadow: 10px 0 30px rgba(0,0,0,0.15) !important;
                        border-radius: 0 24px 24px 0 !important;
                        border-left: none !important;
                    }
                    .chat-input-area { padding: 1rem 1.5rem !important; }
                    .chat-message-list { padding: 1rem 1.25rem !important; }
                }
            `}</style>
        </div>
    );
}
