// Firebase Configuration for VeriChat
// REPLACE THESE VALUES WITH YOUR FIREBASE PROJECT CREDENTIALS

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();

// Enable Firestore offline persistence
db.enablePersistence({ synchronizeTabs: true })
    .catch(err => {
        if (err.code === 'failed-precondition') {
            console.log('Multiple tabs open, persistence enabled in first tab only');
        } else if (err.code === 'unimplemented') {
            console.log('Browser doesn\'t support persistence');
        }
    });

// Firebase Auth State Observer
let currentUser = null;
let authStateListeners = [];

auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    
    if (user) {
        console.log('User logged in:', user.uid);
        
        // Update user's online status
        const userRef = db.collection('users').doc(user.uid);
        await userRef.update({
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            online: true,
            status: 'online'
        });
        
        // Set up presence system
        setupPresence(user.uid);
        
        // Load user data
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            window.userData = userDoc.data();
        }
        
        // Notify listeners
        authStateListeners.forEach(listener => listener(true, user));
        
    } else {
        console.log('User logged out');
        
        // Notify listeners
        authStateListeners.forEach(listener => listener(false, null));
    }
});

// Presence System
function setupPresence(uid) {
    const userStatusRef = db.collection('users').doc(uid);
    const userRef = db.collection('users').doc(uid);
    
    // Update online status when window closes
    window.addEventListener('beforeunload', async () => {
        await userRef.update({
            online: false,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'offline'
        });
    });
    
    // Update last seen periodically
    setInterval(async () => {
        if (currentUser) {
            await userRef.update({
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }, 30000);
}

// Helper Functions
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, duration);
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
}

function generateChatId(user1, user2) {
    return [user1, user2].sort().join('_');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Error handling utility
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    let message = 'An error occurred';
    switch (error.code) {
        case 'auth/email-already-in-use':
            message = 'Email already registered';
            break;
        case 'auth/invalid-email':
            message = 'Invalid email address';
            break;
        case 'auth/weak-password':
            message = 'Password should be at least 6 characters';
            break;
        case 'auth/user-not-found':
            message = 'User not found';
            break;
        case 'auth/wrong-password':
            message = 'Wrong password';
            break;
        case 'permission-denied':
            message = 'You don\'t have permission for this action';
            break;
        default:
            message = error.message || 'Something went wrong';
    }
    
    showToast(message, 'error');
    return message;
}

// Export for use in other files
window.verichat = {
    auth,
    db,
    storage,
    functions,
    currentUser: () => currentUser,
    showToast,
    showModal,
    hideModal,
    formatTime,
    generateChatId,
    handleError,
    debounce,
    throttle
};

console.log('Firebase initialized and ready');