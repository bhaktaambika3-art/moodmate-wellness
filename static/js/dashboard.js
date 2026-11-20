/**
 * MoodMate — Dashboard JavaScript (dashboard.js)
 * Quick Mood Check-in widget handling, intensity slider, API saving.
 */

document.addEventListener('DOMContentLoaded', () => {
    initQuickMoodWidget();
});

function initQuickMoodWidget() {
    const moodBtns = document.querySelectorAll('.mood-choice-btn');
    const expandBox = document.getElementById('quickCheckinExpand');
    const intensitySlider = document.getElementById('quickIntensitySlider');
    const intensityVal = document.getElementById('quickIntensityVal');
    const noteInput = document.getElementById('quickNoteInput');
    const saveBtn = document.getElementById('saveQuickMoodBtn');
    const cancelBtn = document.getElementById('cancelQuickMoodBtn');

    if (!moodBtns.length || !expandBox) return;

    let selectedMood = null;

    // Mood button click
    moodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            moodBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedMood = btn.getAttribute('data-mood');

            // Open details drawer
            expandBox.style.display = 'block';
            expandBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    });

    // Slider listener
    if (intensitySlider && intensityVal) {
        intensitySlider.addEventListener('input', (e) => {
            intensityVal.textContent = e.target.value;
        });
    }

    // Cancel
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            expandBox.style.display = 'none';
            moodBtns.forEach(b => b.classList.remove('selected'));
            selectedMood = null;
            if (noteInput) noteInput.value = '';
        });
    }

    // Save
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!selectedMood) {
                showToast('Please select how you are feeling first.', 'warning');
                return;
            }

            const intensity = intensitySlider ? parseInt(intensitySlider.value, 10) : 5;
            const note = noteInput ? noteInput.value.trim() : '';

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                const response = await fetch('/api/moods', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mood_type: selectedMood,
                        intensity: intensity,
                        note: note
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showToast(`Logged "${selectedMood.toUpperCase()}" (${intensity}/10). Thank you for checking in with yourself! 🌸`, 'success');
                    
                    // Reset UI
                    expandBox.style.display = 'none';
                    moodBtns.forEach(b => b.classList.remove('selected'));
                    if (noteInput) noteInput.value = '';

                    // Reload page after a brief moment to update dashboard stats & charts
                    setTimeout(() => {
                        window.location.reload();
                    }, 1200);
                } else {
                    showToast(data.error || 'Failed to save mood. Please try again.', 'error');
                }
            } catch (err) {
                showToast('Network error while saving mood. Please check your connection.', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Log Mood';
            }
        });
    }
}
