const SHOP_AUTH_STORAGE_KEY = 'cosy-cat-shop-admin-auth-v1';
const SHOP_USERS_OVERRIDE_KEY = 'cosy-cat-shop-users-v1';

document.addEventListener('DOMContentLoaded', () => {
    initializeProfilePage();
});

async function initializeProfilePage() {
    const session = readSession();
    if (!session?.username) {
        window.location.href = './login.html';
        return;
    }

    const form = document.getElementById('profileSettingsForm');
    const displayNameInput = document.getElementById('profileDisplayNameInput');
    const currentPasswordInput = document.getElementById('profileCurrentPassword');
    const newPasswordInput = document.getElementById('profileNewPassword');
    const confirmPasswordInput = document.getElementById('profileConfirmPassword');
    const alertEl = document.getElementById('profileSettingsAlert');

    if (!form || !displayNameInput || !currentPasswordInput || !newPasswordInput || !confirmPasswordInput || !alertEl) {
        return;
    }

    displayNameInput.value = session.displayName || session.username;
    applyProfileMenuState(session);

    const showAlert = (message, type) => {
        alertEl.textContent = message;
        alertEl.className = `alert mt-3 alert-${type}`;
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const displayName = displayNameInput.value.trim();
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!displayName) {
            showAlert('Display name is required.', 'warning');
            return;
        }

        const users = await loadUsers();
        const idx = users.findIndex((user) => user && user.username === session.username);
        if (idx < 0) {
            showAlert('Unable to locate your user profile.', 'danger');
            return;
        }

        if (newPassword || confirmPassword || currentPassword) {
            if (!currentPassword) {
                showAlert('Enter current password to change password.', 'warning');
                return;
            }
            if (users[idx].password !== currentPassword) {
                showAlert('Current password is incorrect.', 'danger');
                return;
            }
            if (!newPassword || newPassword.length < 4) {
                showAlert('New password must be at least 4 characters.', 'warning');
                return;
            }
            if (newPassword !== confirmPassword) {
                showAlert('New password confirmation does not match.', 'warning');
                return;
            }
            users[idx].password = newPassword;
        }

        users[idx].displayName = displayName;
        localStorage.setItem(SHOP_USERS_OVERRIDE_KEY, JSON.stringify(users));

        const updatedSession = {
            ...session,
            displayName
        };
        localStorage.setItem(SHOP_AUTH_STORAGE_KEY, JSON.stringify(updatedSession));
        applyProfileMenuState(updatedSession);

        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        showAlert('Profile updated successfully.', 'success');
    });

    document.querySelectorAll('.js-shop-logout-btn').forEach((button) => {
        button.addEventListener('click', () => {
            localStorage.removeItem(SHOP_AUTH_STORAGE_KEY);
            window.location.href = './index.html';
        });
    });
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
        console.error('Failed to parse user override.', error);
    }

    try {
        const response = await fetch('./data/user.json', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
        const users = await response.json();
        return Array.isArray(users) ? users : [];
    } catch (error) {
        console.error(error);
        return [];
    }
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
