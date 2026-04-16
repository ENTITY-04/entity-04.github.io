const SHOP_AUTH_STORAGE_KEY = 'cosy-cat-shop-admin-auth-v1';
const SHOP_USERS_OVERRIDE_KEY = 'cosy-cat-shop-users-v1';

document.addEventListener('DOMContentLoaded', () => {
    initializeLoginPage();
});

function initializeLoginPage() {
    const form = document.getElementById('shopLoginForm');
    const usernameInput = document.getElementById('shopAdminUsername');
    const passwordInput = document.getElementById('shopAdminPassword');
    const loginBtn = document.getElementById('shopLoginBtn');
    const inlineLogoutBtn = document.getElementById('shopLogoutBtn');
    const alertEl = document.getElementById('shopLoginAlert');

    if (!form || !usernameInput || !passwordInput || !loginBtn || !inlineLogoutBtn || !alertEl) {
        return;
    }

    const session = readSession();
    applyProfileMenuState(session);

    const showAlert = (message, type) => {
        alertEl.textContent = message;
        alertEl.className = `alert mt-3 alert-${type}`;
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showAlert('Enter both username and password.', 'warning');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Checking...';

        try {
            const users = await loadUsers();
            const matchedUser = users.find((user) => user && user.username === username && user.password === password);

            if (!matchedUser) {
                showAlert('Invalid username or password.', 'danger');
                return;
            }

            const nextSession = {
                username: matchedUser.username,
                displayName: matchedUser.displayName || matchedUser.username,
                role: matchedUser.role || 'admin',
                loginAt: Date.now()
            };

            localStorage.setItem(SHOP_AUTH_STORAGE_KEY, JSON.stringify(nextSession));
            window.location.href = './index.html';
        } catch (error) {
            console.error('Login failed.', error);
            showAlert('Login service is unavailable right now. Try again shortly.', 'danger');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log in';
        }
    });

    inlineLogoutBtn.addEventListener('click', () => {
        localStorage.removeItem(SHOP_AUTH_STORAGE_KEY);
        applyProfileMenuState(null);
        showAlert('You have been logged out.', 'info');
        usernameInput.disabled = false;
        passwordInput.disabled = false;
        form.reset();
    });

    document.querySelectorAll('.js-shop-logout-btn').forEach((button) => {
        button.addEventListener('click', () => {
            localStorage.removeItem(SHOP_AUTH_STORAGE_KEY);
            window.location.reload();
        });
    });

    if (session?.username) {
        usernameInput.disabled = true;
        passwordInput.disabled = true;
        showAlert(`Already logged in as ${session.displayName || session.username}.`, 'info');
    }
}

async function loadUsers() {
    try {
        const raw = localStorage.getItem(SHOP_USERS_OVERRIDE_KEY);
        if (raw !== null) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (error) {
        console.error('Unable to parse user overrides.', error);
    }

    const response = await fetch('./data/user.json', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('Unable to load users.');
    }

    const users = await response.json();
    return Array.isArray(users) ? users : [];
}

function applyProfileMenuState(session) {
    const isLoggedIn = !!session?.username;
    const isAdmin = isLoggedIn && session.role === 'admin';

    document.querySelectorAll('.js-shop-login-item').forEach((item) => {
        item.classList.toggle('d-none', isLoggedIn);
    });
    document.querySelectorAll('.js-shop-profile-item').forEach((item) => {
        item.classList.toggle('d-none', !isLoggedIn);
    });
    document.querySelectorAll('.js-shop-dashboard-item').forEach((item) => {
        item.classList.toggle('d-none', !isAdmin);
    });
    document.querySelectorAll('.js-shop-product-management-item').forEach((item) => {
        item.classList.toggle('d-none', !isAdmin);
    });
    document.querySelectorAll('.js-shop-auth-divider').forEach((item) => {
        item.classList.toggle('d-none', !isLoggedIn);
    });
    document.querySelectorAll('.js-shop-logout-btn').forEach((item) => {
        item.classList.toggle('d-none', !isLoggedIn);
    });

    const inlineLoginBtn = document.getElementById('shopLoginBtn');
    const inlineLogoutBtn = document.getElementById('shopLogoutBtn');
    if (inlineLoginBtn && inlineLogoutBtn) {
        inlineLoginBtn.classList.toggle('d-none', isLoggedIn);
        inlineLogoutBtn.classList.toggle('d-none', !isLoggedIn);
    }
}

function readSession() {
    try {
        const raw = localStorage.getItem(SHOP_AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error('Failed to parse session.', error);
        return null;
    }
}
