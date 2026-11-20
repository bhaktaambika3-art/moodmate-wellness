/**
 * MoodMate — Profile & Settings JavaScript (profile.js)
 * User profile, avatar picker, theme sync, AI voice preferences, password change, data export & deletion.
 */

document.addEventListener('DOMContentLoaded', () => {
    initAvatarPicker();
    initProfileForm();
    initVoiceSettings();
    initChangePassword();
    initDeleteAccount();
});

// ==========================================
// AVATAR PICKER
// ==========================================
function initAvatarPicker() {
    const avatarBtns = document.querySelectorAll('.avatar-option');
    const selectedInput = document.getElementById('selectedAvatar');

    avatarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            avatarBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (selectedInput) {
                selectedInput.value = btn.getAttribute('data-emoji');
            }
        });
    });
}

// ==========================================
// PROFILE DETAILS FORM
// ==========================================
function initProfileForm() {
    const form = document.getElementById('profileForm');
    const nameInput = document.getElementById('profileName');
    const selectedAvatar = document.getElementById('selectedAvatar');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const avatar = selectedAvatar.value;
        const themeRadio = form.querySelector('input[name="theme_pref"]:checked');
        const theme = themeRadio ? themeRadio.value : 'system';

        if (!name) {
            showToast('Please enter your preferred name.', 'warning');
            return;
        }

        const saveBtn = document.getElementById('saveProfileBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    avatar: avatar,
                    theme_preference: theme
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Sanctuary profile updated successfully! 🌸', 'success');
                // Apply theme immediately
                applyTheme(theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme, true);
                setTimeout(() => window.location.reload(), 1000);
            } else {
                showToast(data.error || 'Failed to update profile.', 'error');
            }
        } catch (err) {
            showToast('Network error while saving profile.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Profile Details';
        }
    });
}

// ==========================================
// AI VOICE COMPANION SETTINGS
// ==========================================
function initVoiceSettings() {
    const form = document.getElementById('voiceSettingsForm');
    const voiceSelect = document.getElementById('voicePrefSelect');
    const speedRange = document.getElementById('speedRange');
    const speedLabel = document.getElementById('speedValLabel');
    const autoSpeakCheck = document.getElementById('autoSpeakCheck');
    const testVoiceBtn = document.getElementById('testVoiceBtn');
    const testStatus = document.getElementById('testVoiceStatus');

    if (speedRange && speedLabel) {
        speedRange.addEventListener('input', (e) => {
            speedLabel.textContent = `${parseFloat(e.target.value).toFixed(2)}x`;
        });
    }

    if (testVoiceBtn && voiceSelect) {
        testVoiceBtn.addEventListener('click', () => {
            const voiceId = voiceSelect.value;
            const speed = speedRange ? parseFloat(speedRange.value) : 1.0;

            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance("Hello! I am your MoodMate companion. It is wonderful to speak with you today.");
                utter.rate = speed;
                utter.onstart = () => { if (testStatus) testStatus.textContent = 'Speaking sample...'; };
                utter.onend = () => { if (testStatus) testStatus.textContent = 'Sample complete.'; };
                window.speechSynthesis.speak(utter);
            } else {
                showToast('Speech synthesis not supported in this browser.', 'warning');
            }
        });
    }

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const voicePreference = voiceSelect.value;
        const voiceSpeed = speedRange ? parseFloat(speedRange.value) : 1.0;
        const autoSpeak = autoSpeakCheck ? autoSpeakCheck.checked : false;

        const saveBtn = document.getElementById('saveVoiceSettingsBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voice_preference: voicePreference,
                    voice_speed: voiceSpeed,
                    auto_speak: autoSpeak
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Voice preferences saved! ✨', 'success');
            } else {
                showToast(data.error || 'Failed to save voice preferences.', 'error');
            }
        } catch (err) {
            showToast('Network error.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Voice Preferences';
        }
    });
}

// ==========================================
// CHANGE PASSWORD
// ==========================================
function initChangePassword() {
    const form = document.getElementById('changePasswordForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match.', 'error');
            return;
        }

        const saveBtn = document.getElementById('changePasswordBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Updating...';

        try {
            const res = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Password updated successfully! 🔐', 'success');
                form.reset();
            } else {
                showToast(data.error || 'Failed to update password.', 'error');
            }
        } catch (err) {
            showToast('Network error.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Update Password';
        }
    });
}

// ==========================================
// DELETE ACCOUNT
// ==========================================
function initDeleteAccount() {
    const openBtn = document.getElementById('openDeleteAccountBtn');
    const modal = document.getElementById('deleteAccountModal');
    const form = document.getElementById('deleteAccountForm');

    if (openBtn && modal) {
        openBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    }

    window.closeDeleteModal = function() {
        if (modal) modal.style.display = 'none';
        if (form) form.reset();
    };

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('deleteConfirmPassword').value;

            try {
                const res = await fetch('/api/user/delete-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    alert('Your account and personal data have been permanently erased. Farewell! 🌿');
                    window.location.href = '/';
                } else {
                    showToast(data.error || 'Password incorrect.', 'error');
                }
            } catch (err) {
                showToast('Network error while deleting account.', 'error');
            }
        });
    }
}
