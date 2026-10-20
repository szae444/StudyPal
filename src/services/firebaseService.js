import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, serverTimestamp, orderBy, limit, getDoc, setDoc, onSnapshot, Timestamp, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Your web app's Firebase configuration
// These need to be filled in by the user in .env.local
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
};

// Initialize Firebase only if config exists to prevent app crash if user hasn't set it up yet
let app, auth, db, googleProvider, storage, functions;

try {
    if (firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        // Must match the region in functions/index.js
        functions = getFunctions(app, 'asia-southeast1');
        googleProvider = new GoogleAuthProvider();
    }
} catch (error) {
    console.error("Firebase initialization error:", error);
}

// Detect mobile browsers — popups are blocked on mobile, so we use redirect instead
const isMobileBrowser = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;

// Auth functions

/**
 * Sign in with Google.
 * Uses redirect on mobile (popup is blocked), popup on desktop.
 * On mobile, returns null — auth state is resolved by onAuthStateChanged after redirect.
 */
export const signInWithGoogle = async () => {
    if (!auth) throw new Error("Firebase is not configured. Please add your credentials to .env.local");
    try {
        if (isMobileBrowser()) {
            // On mobile, redirect to Google then back to the app.
            // The page will reload and onAuthStateChanged will fire with the user.
            await signInWithRedirect(auth, googleProvider);
            return null; // browser navigates away — this line is never reached
        } else {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        }
    } catch (error) {
        console.error("Error signing in with Google", error);
        throw error;
    }
};

/**
 * Call this once on app start to retrieve the result of a signInWithRedirect flow.
 * Returns the user if a redirect just completed, or null otherwise.
 */
export const getGoogleRedirectResult = async () => {
    if (!auth) return null;
    try {
        const result = await getRedirectResult(auth);
        return result ? result.user : null;
    } catch (error) {
        console.error("Error getting redirect result", error);
        throw error;
    }
};

export const signUpWithEmail = async (email, password) => {
    if (!auth) throw new Error("Firebase is not configured. Please add your credentials to .env.local");
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        return result.user;
    } catch (error) {
        console.error("Error signing up with email", error);
        throw error;
    }
};

export const signInWithEmail = async (email, password) => {
    if (!auth) throw new Error("Firebase is not configured. Please add your credentials to .env.local");
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
    } catch (error) {
        console.error("Error signing in with email", error);
        throw error;
    }
};

export const logOut = async () => {
    if (!auth) return;
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out", error);
        throw error;
    }
};

// Firestore Database functions

/**
 * Save generated study material to the library
 * @param {string} userId - Auth User ID
 * @param {string} title - Title of the document
 * @param {string} type - 'reviewer', 'quiz', or 'flashcards'
 * @param {object|string} data - The actual content payload
 */
export const saveStudyMaterial = async (userId, title, type, data) => {
    if (!db) throw new Error("Firebase is not configured.");
    
    // Check limits
    const profile = await getUserProfile(userId);
    // Free: 3 saves, Cram: 5 saves, Premium: unlimited
    const limit = profile.plan === 'premium' ? Infinity : (profile.plan === 'cram' ? 5 : 3);
    
    const existing = await getUserStudyMaterials(userId);
    if (existing.length >= limit) {
        throw new Error(`Library limit reached (${limit}). Please upgrade to save more materials.`);
    }

    try {
        const docRef = await addDoc(collection(db, 'studyMaterials'), {
            userId,
            title,
            type,
            data,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding document: ", error);
        throw error;
    }
};

/**
 * Fetch a user's saved library materials
 * @param {string} userId - Auth User ID
 */
export const getUserStudyMaterials = async (userId) => {
    if (!db) return [];
    try {
        const q = query(collection(db, 'studyMaterials'), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        const materials = [];
        querySnapshot.forEach((doc) => {
            materials.push({ id: doc.id, ...doc.data() });
        });
        // Sort by dates descending locally since Firestore requires composite indexes for complex sorting
        return materials.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
    } catch (error) {
        console.error("Error fetching documents: ", error);
        throw error;
    }
};

/**
 * Delete an item from the library
 * @param {string} documentId - The document ID to remove
 */
export const deleteStudyMaterial = async (documentId) => {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        await deleteDoc(doc(db, 'studyMaterials', documentId));
    } catch (error) {
        console.error("Error deleting document: ", error);
        throw error;
    }
};

/**
 * Update a study material item (e.g., rename)
 * @param {string} documentId - The document ID to update
 * @param {object} data - The data to update (e.g., { title: 'New Name' })
 */
export const updateStudyMaterial = async (documentId, data) => {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        const docRef = doc(db, 'studyMaterials', documentId);
        await updateDoc(docRef, data);
    } catch (error) {
        console.error("Error updating document: ", error);
        throw error;
    }
};

// Planner / To-Do functions

/**
 * Add a new to-do item
 */
export const addTodo = async (userId, title, description, priority, dueDate) => {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        const docRef = await addDoc(collection(db, 'todos'), {
            userId,
            title,
            description: description || '',
            priority: priority || 'medium',
            dueDate: dueDate || null,
            completed: false,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding todo: ", error);
        throw error;
    }
};

/**
 * Fetch a user's to-do items
 */
export const getUserTodos = async (userId) => {
    if (!db) return [];
    try {
        const q = query(collection(db, 'todos'), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        const todos = [];
        querySnapshot.forEach((doc) => {
            todos.push({ id: doc.id, ...doc.data() });
        });
        return todos.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
    } catch (error) {
        console.error("Error fetching todos: ", error);
        throw error;
    }
};

/**
 * Update a to-do item
 */
export const updateTodo = async (todoId, data) => {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        const todoRef = doc(db, 'todos', todoId);
        await updateDoc(todoRef, data);
    } catch (error) {
        console.error("Error updating todo: ", error);
        throw error;
    }
};

/**
 * Delete a to-do item
 */
export const deleteTodo = async (todoId) => {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        await deleteDoc(doc(db, 'todos', todoId));
    } catch (error) {
        console.error("Error deleting todo: ", error);
        throw error;
    }
};

// AI Chat History functions

/**
 * Save or update an AI chat session
 */
export const saveAIChat = async (userId, chatId, title, messages) => {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        if (chatId) {
            // Update existing
            const chatRef = doc(db, 'aiChats', chatId);
            await updateDoc(chatRef, {
                messages,
                updatedAt: serverTimestamp()
            });
            return chatId;
        } else {
            // Create new
            const docRef = await addDoc(collection(db, 'aiChats'), {
                userId,
                title,
                messages,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp()
            });
            return docRef.id;
        }
    } catch (error) {
        console.error("Error saving AI chat: ", error);
        throw error;
    }
};

/**
 * Fetch user's AI chat history
 */
export const getUserAIChats = async (userId) => {
    if (!db) return [];
    try {
        const q = query(collection(db, 'aiChats'), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        const chats = [];
        querySnapshot.forEach((doc) => {
            chats.push({ id: doc.id, ...doc.data() });
        });
        // Sort by updatedAt descending
        return chats.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
    } catch (error) {
        console.error("Error fetching AI chats: ", error);
        throw error;
    }
};

/**
 * Delete an AI chat session
 */
export const deleteAIChat = async (chatId) => {
    if (!db) throw new Error("Firebase is not configured.");
    try {
        await deleteDoc(doc(db, 'aiChats', chatId));
    } catch (error) {
        console.error("Error deleting AI chat: ", error);
        throw error;
    }
};

// Study Desk functions (focus log, countdowns, goals)
// Stored on the user's own profile doc under `desk`, so no new collection or rules are needed.

/**
 * Fetch the user's desk data: { log, countdowns, subjects, dailyGoal }.
 */
export const getDesk = async (userId) => {
    if (!db) return null;
    try {
        const snap = await getDoc(doc(db, 'userProfiles', userId));
        return snap.exists() ? (snap.data().desk || null) : null;
    } catch (error) {
        console.error("Error fetching desk: ", error);
        return null;
    }
};

/**
 * Add one finished focus session to the day's log.
 * @param {string} day - 'YYYY-MM-DD' in the user's local time
 */
export const logFocusSession = async (userId, day, minutes, subject) => {
    if (!db) return;
    const entry = { minutes: increment(minutes), sessions: increment(1) };
    if (subject) entry.bySubject = { [subject]: increment(minutes) };
    await setDoc(doc(db, 'userProfiles', userId), { desk: { log: { [day]: entry } } }, { merge: true });
};

/**
 * Save desk settings (countdowns, subjects, dailyGoal). Arrays are replaced whole.
 */
export const saveDeskSettings = async (userId, data) => {
    if (!db) return;
    await setDoc(doc(db, 'userProfiles', userId), { desk: data }, { merge: true });
};

// Export instances to use manually if needed
export { app, auth, db, storage, functions };

// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions & Payments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a user's profile which contains their subscription plan and usage.
 * Defaults to 'free' tier if no profile exists.
 */
export const getUserProfile = async (userId) => {
    if (!db) return { plan: 'free', uploadsUsed: 0 };
    try {
        const docRef = doc(db, 'userProfiles', userId);
        const snap = await getDoc(docRef);
        
        let profile = { plan: 'free', uploadsUsed: 0 };
        if (snap.exists()) {
            profile = snap.data();
            // Check if plan expired
            if (profile.expiresAt && profile.expiresAt.toMillis() < Date.now()) {
                await updateDoc(docRef, { plan: 'free', expiresAt: null });
                profile = { ...profile, plan: 'free', expiresAt: null };
            }
        }
        
        // Ensure admin always has premium access
        if (auth.currentUser && auth.currentUser.uid === userId && auth.currentUser.email && auth.currentUser.email.toLowerCase() === 'etrazalsebastian@gmail.com') {
            profile.plan = 'premium';
        }
        
        return profile;
    } catch (e) {
        console.error("Error fetching user profile", e);
        return { plan: 'free', uploadsUsed: 0 };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Quota Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the reset window in milliseconds for a given plan.
 * Free → 7 days, Cram → 6 hours, Premium → no reset needed.
 */
const getResetWindowMs = (plan) => {
    if (plan === 'cram') return 6 * 60 * 60 * 1000;       // 6 hours
    return 7 * 24 * 60 * 60 * 1000;                        // 7 days (free)
};

/**
 * Returns max allowed uploads per plan period.
 */
const getUploadLimit = (plan) => {
    if (plan === 'premium') return Infinity;
    if (plan === 'cram') return 5;
    return 3; // free
};

/**
 * Returns max allowed AI messages per plan period.
 */
const getAIMessageLimit = (plan) => {
    if (plan === 'premium') return Infinity;
    if (plan === 'cram') return 10;
    return 5; // free
};

/**
 * Check if a quota field needs resetting, reset it if so, and increment.
 * @param {string} userId
 * @param {string} usedField      - e.g. 'uploadsUsed' or 'aiMessagesUsed'
 * @param {string} resetAtField   - e.g. 'uploadsResetAt' or 'aiMessagesResetAt'
 * @param {number} limit          - max allowed per period
 * @param {number} resetWindowMs  - ms before quota resets
 * @returns {{ allowed: boolean, used: number, resetsAt: Date|null }}
 */
const checkAndIncrementQuota = async (userId, usedField, resetAtField, limit, resetWindowMs) => {
    if (!db) return { allowed: false, used: 0, resetsAt: null };
    if (limit === Infinity) return { allowed: true, used: 0, resetsAt: null };

    const docRef = doc(db, 'userProfiles', userId);
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : {};

    const now = Date.now();
    const resetAtTs = data[resetAtField];
    const resetAtMs = resetAtTs ? resetAtTs.toMillis() : 0;
    const nextResetMs = resetAtMs + resetWindowMs;

    let used = data[usedField] || 0;

    // Auto-reset if the window has passed
    if (now >= nextResetMs) {
        used = 0;
        await setDoc(docRef, {
            [usedField]: 0,
            [resetAtField]: Timestamp.fromMillis(now)
        }, { merge: true });
    }

    if (used >= limit) {
        // Quota exhausted — return when it resets
        const resetsAt = new Date(now >= nextResetMs ? now + resetWindowMs : nextResetMs);
        return { allowed: false, used, resetsAt };
    }

    // Increment the counter
    const newUsed = used + 1;
    const update = { [usedField]: newUsed };
    // Set the reset anchor on first use in a fresh window
    if (used === 0) update[resetAtField] = Timestamp.fromMillis(now);
    await setDoc(docRef, update, { merge: true });

    return { allowed: true, used: newUsed, resetsAt: null };
};

/**
 * Check and increment the file-upload quota for a user.
 * Returns { allowed, used, resetsAt }.
 */
export const checkAndIncrementUploads = async (userId) => {
    try {
        const profile = await getUserProfile(userId);
        const limit = getUploadLimit(profile.plan);
        const windowMs = getResetWindowMs(profile.plan);
        return await checkAndIncrementQuota(userId, 'uploadsUsed', 'uploadsResetAt', limit, windowMs);
    } catch (e) {
        console.error('Error checking upload quota', e);
        return { allowed: false, used: 0, resetsAt: null };
    }
};

/**
 * Check and increment the AI-message quota for a user.
 * Returns { allowed, used, resetsAt }.
 */
export const checkAndIncrementAIMessages = async (userId) => {
    try {
        const profile = await getUserProfile(userId);
        const limit = getAIMessageLimit(profile.plan);
        const windowMs = getResetWindowMs(profile.plan);
        return await checkAndIncrementQuota(userId, 'aiMessagesUsed', 'aiMessagesResetAt', limit, windowMs);
    } catch (e) {
        console.error('Error checking AI message quota', e);
        return { allowed: false, used: 0, resetsAt: null };
    }
};

/**
 * Submit manual payment with receipt image.
 */
export const submitPaymentProof = async (userId, userEmail, plan, file, refNumber) => {
    if (!db || !storage) throw new Error("Firebase not fully configured for payments.");
    
    // 1. Upload receipt to Storage
    const ext = file.name.split('.').pop();
    const fileName = `receipts/${userId}_${Date.now()}.${ext}`;
    const storageRef = ref(storage, fileName);
    
    await uploadBytes(storageRef, file);
    const receiptUrl = await getDownloadURL(storageRef);
    
    // 2. Create Payment Record
    await addDoc(collection(db, 'payments'), {
        userId,
        userEmail,
        planRequested: plan,
        receiptUrl,
        refNumber,
        status: 'pending',
        createdAt: serverTimestamp()
    });
    
    // 3. Mark user profile as having pending payment
    const profileRef = doc(db, 'userProfiles', userId);
    await setDoc(profileRef, { paymentStatus: 'pending' }, { merge: true });
};

/**
 * Get pending payments for Admin.
 */
export const getPendingPayments = async () => {
    if (!db) return [];
    try {
        const q = query(collection(db, 'payments'), where('status', '==', 'pending'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Error fetching pending payments", e);
        return [];
    }
};

/**
 * Resolve payment (Approve or Reject).
 */
export const resolvePayment = async (paymentId, userId, newStatus, planRequested, rejectionReason = '') => {
    if (!db) return;
    try {
        // Update payment doc
        const paymentRef = doc(db, 'payments', paymentId);
        await updateDoc(paymentRef, { status: newStatus, processedAt: serverTimestamp(), rejectionReason });
        
        // Update user profile
        const profileRef = doc(db, 'userProfiles', userId);
        if (newStatus === 'approved') {
            // Calculate expiry
            let expiryDate = new Date();
            if (planRequested === 'cram') {
                expiryDate.setDate(expiryDate.getDate() + 2);
            } else if (planRequested === 'premium') {
                expiryDate.setMonth(expiryDate.getMonth() + 1);
            }
            
            await setDoc(profileRef, {
                plan: planRequested,
                expiresAt: expiryDate,
                paymentStatus: 'approved',
                uploadsUsed: 0 // Reset uploads on upgrade
            }, { merge: true });
        } else {
            await setDoc(profileRef, {
                paymentStatus: 'rejected',
                rejectionReason
            }, { merge: true });
        }
    } catch (e) {
        console.error("Error resolving payment", e);
        throw e;
    }
};

// AI usage logs (aiUsageLogs, userStats) are written by the `ai` Cloud Function.

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only read functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch aggregated per-user stats for the admin dashboard.
 */
export const getAllUserStats = async () => {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'userStats'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Fetch the most recent AI usage log entries.
 */
export const getAIUsageLogs = async (maxEntries = 200) => {
    if (!db) return [];
    try {
        const q = query(collection(db, 'aiUsageLogs'), orderBy('timestamp', 'desc'), limit(maxEntries));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
        // Likely a missing Firestore index on first run — fall back to unordered
        const snap = await getDocs(collection(db, 'aiUsageLogs'));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, maxEntries);
    }
};

/**
 * Fetch all study materials across all users for the admin dashboard.
 */
export const getAllStudyMaterials = async () => {
    if (!db) return [];
    const snap = await getDocs(collection(db, 'studyMaterials'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Real-time Listeners for Admin Dashboard
export const subscribeToUserStats = (callback) => {
    if (!db) return () => {};
    const q = collection(db, 'userStats');
    return onSnapshot(q, (snap) => {
        const stats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(stats);
    });
};

export const subscribeToAIUsageLogs = (callback, maxEntries = 500) => {
    if (!db) return () => {};
    let q;
    try {
        q = query(collection(db, 'aiUsageLogs'), orderBy('timestamp', 'desc'), limit(maxEntries));
    } catch {
        q = collection(db, 'aiUsageLogs');
    }
    return onSnapshot(q, (snap) => {
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort locally just in case index is missing and orderBy fails silently or we fell back
        const sortedLogs = logs.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
            return timeB - timeA;
        });
        callback(sortedLogs.slice(0, maxEntries));
    }, (error) => {
        console.error("AI Logs snapshot error, falling back to unordered", error);
        // Fallback in case orderBy requires index and fails
        const fallbackQuery = collection(db, 'aiUsageLogs');
        onSnapshot(fallbackQuery, (snap) => {
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(logs.slice(0, maxEntries));
        });
    });
};

export const subscribeToStudyMaterials = (callback) => {
    if (!db) return () => {};
    const q = collection(db, 'studyMaterials');
    return onSnapshot(q, (snap) => {
        const mats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(mats);
    });
};

export const subscribeToPendingPayments = (callback) => {
    if (!db) return () => {};
    const q = query(collection(db, 'payments'), where('status', '==', 'pending'));
    return onSnapshot(q, (snap) => {
        const payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(payments);
    });
};
