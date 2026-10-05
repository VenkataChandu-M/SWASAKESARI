/* ===================================
   SAMPURNA AYURVEDIC - Auth Module
   Handles login, signup, logout, OTP
   verification, and forgot password
   =================================== */

const API_BASE = '';

// =====================
// API Client
// =====================
const ApiClient = {
    getToken() {
        return localStorage.getItem('sampurna_token');
    },

    setToken(token) {
        localStorage.setItem('sampurna_token', token);
    },

    clearToken() {
        localStorage.removeItem('sampurna_token');
        localStorage.removeItem('sampurna_user');
    },

    getUser() {
        const data = localStorage.getItem('sampurna_user');
        return data ? JSON.parse(data) : null;
    },

    setUser(user) {
        localStorage.setItem('sampurna_user', JSON.stringify(user));
    },

    async request(url, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        try {
            const response = await fetch(`${API_BASE}${url}`, {
                ...options,
                headers
            });
            const data = await response.json();
            if (!response.ok) {
                throw { status: response.status, message: data.error || 'Something went wrong' };
            }
            return data;
        } catch (err) {
            if (err.status) throw err;
            throw { status: 0, message: 'Network error. Please check your connection.' };
        }
    },

    get(url) { return this.request(url); },
    post(url, body) { return this.request(url, { method: 'POST', body: JSON.stringify(body) }); },
    put(url, body) { return this.request(url, { method: 'PUT', body: JSON.stringify(body) }); }
};


// =====================
// Auth Manager
// =====================
const AuthManager = {
    isLoggedIn() {
        return !!ApiClient.getToken();
    },

    isAdmin() {
        const user = ApiClient.getUser();
        return user && user.is_admin;
    },

    getCurrentUser() {
        return ApiClient.getUser();
    },

    async signup(name, email, phone, password) {
        const data = await ApiClient.post('/api/auth/signup', { name, email, phone, password });
        ApiClient.setToken(data.token);
        ApiClient.setUser(data.user);
        this.updateUI();
        return data;
    },

    async login(email, password) {
        const data = await ApiClient.post('/api/auth/login', { email, password });
        ApiClient.setToken(data.token);
        ApiClient.setUser(data.user);
        this.updateUI();
        return data;
    },

    async logout() {
        try {
            await ApiClient.post('/api/auth/logout');
        } catch (e) { /* ignore */ }
        ApiClient.clearToken();
        this.updateUI();
    },

    async refreshUser() {
        if (!this.isLoggedIn()) return;
        try {
            const data = await ApiClient.get('/api/auth/me');
            ApiClient.setUser(data.user);
            this.updateUI();
        } catch (e) {
            ApiClient.clearToken();
            this.updateUI();
        }
    },

    updateUI() {
        const loginBtn = document.getElementById('navLoginBtn');
        const userMenu = document.getElementById('navUserMenu');
        const userName = document.getElementById('navUserName');
        const mobileLoginBtn = document.getElementById('mobileLoginBtn');
        const mobileUserInfo = document.getElementById('mobileUserInfo');

        if (this.isLoggedIn()) {
            const user = this.getCurrentUser();
            if (loginBtn) loginBtn.style.display = 'none';
            if (userMenu) userMenu.style.display = 'flex';
            if (userName) userName.textContent = user ? user.name : 'User';
            if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
            if (mobileUserInfo) mobileUserInfo.style.display = 'block';
        } else {
            if (loginBtn) loginBtn.style.display = 'inline-flex';
            if (userMenu) userMenu.style.display = 'none';
            if (mobileLoginBtn) mobileLoginBtn.style.display = 'block';
            if (mobileUserInfo) mobileUserInfo.style.display = 'none';
        }
    }
};


// =====================
// Modal Controller
// =====================
const ModalController = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = '';
        modal.querySelectorAll('.form-error').forEach(el => el.textContent = '');
        modal.querySelectorAll('input').forEach(el => el.classList.remove('input-error'));
    },

    switchTo(fromModal, toModal) {
        this.close(fromModal);
        setTimeout(() => this.open(toModal), 200);
    }
};


// =====================
// Toast Notifications
// =====================
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span class="toast-message">${message}</span>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}


// =====================
// OTP Input Handler
// =====================
function initOtpInputs(containerSelector) {
    const inputs = document.querySelectorAll(`${containerSelector} .otp-input`);
    if (!inputs.length) return;

    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = value.slice(0, 1);
            if (value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '');
            for (let i = 0; i < Math.min(text.length, inputs.length); i++) {
                inputs[i].value = text[i];
            }
            const nextIndex = Math.min(text.length, inputs.length - 1);
            inputs[nextIndex].focus();
        });
    });
}

function getOtpValue(containerSelector) {
    const inputs = document.querySelectorAll(`${containerSelector} .otp-input`);
    return Array.from(inputs).map(i => i.value).join('');
}

function clearOtpInputs(containerSelector) {
    const inputs = document.querySelectorAll(`${containerSelector} .otp-input`);
    inputs.forEach(i => { i.value = ''; });
    if (inputs[0]) inputs[0].focus();
}


// =====================
// Init Auth on Page Load
// =====================
document.addEventListener('DOMContentLoaded', () => {
    // Restore session
    AuthManager.updateUI();
    if (AuthManager.isLoggedIn()) {
        AuthManager.refreshUser();
    }

    // Init OTP inputs
    initOtpInputs('#verifyModal');
    initOtpInputs('#forgotOtpSection');

    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorEl = document.getElementById('loginError');

            try {
                errorEl.textContent = '';
                const data = await AuthManager.login(email, password);
                ModalController.close('loginModal');
                loginForm.reset();

                // Check if user needs verification
                if (!data.user.is_verified && !data.user.is_admin) {
                    showToast(`Welcome back, ${data.user.name}! Please verify your email.`, 'info');
                } else {
                    showToast(`Welcome back, ${data.user.name}! 🌿`);
                }
            } catch (err) {
                errorEl.textContent = err.message;
            }
        });
    }

    // Signup form handler
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const phone = document.getElementById('signupPhone').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('signupConfirmPassword').value;
            const errorEl = document.getElementById('signupError');

            if (password !== confirmPassword) {
                errorEl.textContent = 'Passwords do not match';
                return;
            }

            try {
                errorEl.textContent = '';
                const data = await AuthManager.signup(name, email, phone, password);
                ModalController.close('signupModal');
                signupForm.reset();
                showToast(`Welcome to Sampurna Ayurvedic, ${data.user.name}! 🌿`, 'success');
            } catch (err) {
                errorEl.textContent = err.message;
            }
        });
    }

    // OTP Verify form
    const verifyForm = document.getElementById('verifyForm');
    if (verifyForm) {
        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otp = getOtpValue('#verifyModal');
            const errorEl = document.getElementById('verifyError');

            if (otp.length !== 6) {
                errorEl.textContent = 'Please enter the complete 6-digit code';
                return;
            }

            try {
                errorEl.textContent = '';
                const data = await ApiClient.post('/api/auth/verify-email', {
                    email: window._verifyEmail,
                    otp: otp
                });
                ApiClient.setUser(data.user);
                AuthManager.updateUI();
                ModalController.close('verifyModal');
                showToast('Email verified successfully! 🎉');
            } catch (err) {
                errorEl.textContent = err.message;
                clearOtpInputs('#verifyModal');
            }
        });
    }

    // Forgot password - Step 1: Send OTP
    const forgotEmailForm = document.getElementById('forgotEmailForm');
    if (forgotEmailForm) {
        forgotEmailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgotEmail').value;
            const errorEl = document.getElementById('forgotError');

            try {
                errorEl.textContent = '';
                await ApiClient.post('/api/auth/forgot-password', { email });
                window._resetEmail = email;
                // Show OTP + new password step
                document.getElementById('forgotStep1').style.display = 'none';
                document.getElementById('forgotStep2').style.display = 'block';
                showToast('Reset code sent! Check your email.', 'info');
            } catch (err) {
                errorEl.textContent = err.message;
            }
        });
    }

    // Forgot password - Step 2: Reset with OTP
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otp = getOtpValue('#forgotOtpSection');
            const newPassword = document.getElementById('newPassword').value;
            const confirmNew = document.getElementById('confirmNewPassword').value;
            const errorEl = document.getElementById('resetError');

            if (otp.length !== 6) {
                errorEl.textContent = 'Please enter the complete 6-digit code';
                return;
            }
            if (newPassword !== confirmNew) {
                errorEl.textContent = 'Passwords do not match';
                return;
            }

            try {
                errorEl.textContent = '';
                await ApiClient.post('/api/auth/reset-password', {
                    email: window._resetEmail,
                    otp: otp,
                    new_password: newPassword
                });
                ModalController.close('forgotModal');
                // Reset the modal state
                document.getElementById('forgotStep1').style.display = 'block';
                document.getElementById('forgotStep2').style.display = 'none';
                showToast('Password reset successfully! You can now login.');
                ModalController.open('loginModal');
            } catch (err) {
                errorEl.textContent = err.message;
                clearOtpInputs('#forgotOtpSection');
            }
        });
    }

    // Close modals on backdrop click
    document.querySelectorAll('.auth-modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                ModalController.close(modal.id);
            }
        });
    });

    // Close modals on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.auth-modal.active').forEach(modal => {
                ModalController.close(modal.id);
            });
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown && !e.target.closest('.user-menu')) {
            dropdown.classList.remove('show');
        }
    });
});


// =====================
// Resend OTP
// =====================
async function resendVerifyOtp() {
    if (!window._verifyEmail) return;
    try {
        await ApiClient.post('/api/auth/send-otp', { email: window._verifyEmail });
        showToast('New code sent!', 'info');
        clearOtpInputs('#verifyModal');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function resendResetOtp() {
    if (!window._resetEmail) return;
    try {
        await ApiClient.post('/api/auth/forgot-password', { email: window._resetEmail });
        showToast('New reset code sent!', 'info');
        clearOtpInputs('#forgotOtpSection');
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// =====================
// Dashboard Navigation
// =====================
function goToDashboard() {
    if (!AuthManager.isLoggedIn()) {
        showToast('Please login first to access the dashboard', 'info');
        ModalController.open('loginModal');
        return;
    }
    if (AuthManager.isAdmin()) {
        window.location.href = '/admin';
    } else {
        window.location.href = '/dashboard';
    }
}
