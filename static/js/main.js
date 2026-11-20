/**
 * MoodMate — Main Global JavaScript (main.js)
 * Theme toggle, mobile drawer navigation, flash messages, utilities.
 */

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileDrawer();
    initFlashAutoDismiss();
});

// ==========================================
// THEME MANAGEMENT (System, Light, Dark)
// ==========================================
function initTheme() {
    const htmlElem = document.documentElement;
    const desktopToggleBtn = document.getElementById('themeToggleBtn');
    const mobileToggleBtn = document.getElementById('themeToggleBtnMobile');

    // 1. Get stored or user preference
    let savedTheme = localStorage.getItem('moodmate_theme');
    
    // If user has specific theme in data-theme attribute from backend, respect it
    const serverTheme = htmlElem.getAttribute('data-theme');
    if (serverTheme && serverTheme !== 'system') {
        savedTheme = serverTheme;
    }

    if (!savedTheme || savedTheme === 'system') {
        // Respect system preference
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light', false);
    } else {
        applyTheme(savedTheme, false);
    }

    // Toggle click listeners
    const handleToggle = () => {
        const currentTheme = htmlElem.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme, true);
    };

    if (desktopToggleBtn) desktopToggleBtn.addEventListener('click', handleToggle);
    if (mobileToggleBtn) mobileToggleBtn.addEventListener('click', handleToggle);

    // Listen for OS system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            const currentPref = localStorage.getItem('moodmate_theme');
            if (!currentPref || currentPref === 'system') {
                applyTheme(e.matches ? 'dark' : 'light', false);
            }
        });
    }
}

function applyTheme(theme, save = true) {
    document.documentElement.setAttribute('data-theme', theme);
    if (save) {
        localStorage.setItem('moodmate_theme', theme);
        // Optionally sync to user profile if logged in
        if (window.fetch) {
            fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme_preference: theme })
            }).catch(() => {});
        }
    }
}

// ==========================================
// MOBILE DRAWER NAVIGATION
// ==========================================
function initMobileDrawer() {
    const moreBtn = document.getElementById('mobileMoreBtn');
    const drawerOverlay = document.getElementById('mobileDrawerOverlay');
    const closeBtn = document.getElementById('drawerCloseBtn');

    if (!moreBtn || !drawerOverlay) return;

    const openDrawer = () => drawerOverlay.classList.add('open');
    const closeDrawer = () => drawerOverlay.classList.remove('open');

    moreBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    // Close when clicking outside drawer
    drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) {
            closeDrawer();
        }
    });
}

// ==========================================
// FLASH NOTIFICATION AUTO-DISMISS
// ==========================================
function initFlashAutoDismiss() {
    const alerts = document.querySelectorAll('.flash-alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(() => alert.remove(), 400);
        }, 5500);
    });
}

// ==========================================
// HELPER: Show dynamic toast notification
// ==========================================
function showToast(message, type = 'info') {
    let container = document.getElementById('flashContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'flashContainer';
        container.className = 'flash-container';
        document.querySelector('.page-content').prepend(container);
    }

    const toast = document.createElement('div');
    toast.className = `flash-alert flash-${type}`;

    let icon = 'circle-info';
    if (type === 'success') icon = 'circle-check';
    if (type === 'error') icon = 'circle-exclamation';
    if (type === 'warning') icon = 'triangle-exclamation';

    toast.innerHTML = `
        <span class="flash-icon"><i class="fa-solid fa-${icon}"></i></span>
        <span class="flash-text">${message}</span>
        <button class="flash-close-btn" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}
