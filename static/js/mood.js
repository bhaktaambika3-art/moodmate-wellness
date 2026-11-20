/**
 * MoodMate — Mood Tracker JavaScript (mood.js)
 * Emoji selector, intensity slider, tag pills, Chart.js analytics & history timeline.
 */

let weeklyChart = null;
let distributionChart = null;
const MOOD_EMOJIS = {
    happy: '😊',
    calm: '🌿',
    okay: '🙂',
    anxious: '😰',
    sad: '😢',
    exhausted: '🥱',
    lonely: '🥺',
    confused: '😕',
    angry: '😤'
};

const MOOD_COLORS = {
    happy: '#E9C46A',
    calm: '#52B788',
    okay: '#8B72DE',
    anxious: '#F4A261',
    sad: '#6C8EA4',
    exhausted: '#A5978B',
    lonely: '#9A8C98',
    confused: '#C9ADA7',
    angry: '#E07A5F'
};

document.addEventListener('DOMContentLoaded', () => {
    initMoodForm();
    initTagPills();
    loadMoodAnalytics();
    loadMoodTimeline();
    initEditModal();
});

// ==========================================
// FORM CONTROLS & LOGGING
// ==========================================
function initMoodForm() {
    const intensitySlider = document.getElementById('intensitySlider');
    const intensityBadge = document.getElementById('intensityBadge');
    const moodForm = document.getElementById('moodForm');
    const submitBtn = document.getElementById('submitMoodBtn');

    if (intensitySlider && intensityBadge) {
        const getLabel = (val) => {
            if (val <= 2) return `Very Gentle (${val}/10)`;
            if (val <= 4) return `Mild (${val}/10)`;
            if (val <= 6) return `Moderate (${val}/10)`;
            if (val <= 8) return `Strong (${val}/10)`;
            return `Overwhelming (${val}/10)`;
        };

        intensitySlider.addEventListener('input', (e) => {
            intensityBadge.textContent = getLabel(parseInt(e.target.value, 10));
        });
    }

    if (moodForm) {
        moodForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const selectedMood = moodForm.querySelector('input[name="mood_type"]:checked');
            if (!selectedMood) {
                showToast('Please select how you are feeling (choose an emoji).', 'warning');
                return;
            }

            const moodType = selectedMood.value;
            const intensity = parseInt(document.getElementById('intensitySlider').value, 10);
            const tags = document.getElementById('selectedTagsInput').value;
            const note = document.getElementById('moodNote').value.trim();

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Check-In...';

            try {
                const res = await fetch('/api/moods', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mood_type: moodType,
                        intensity: intensity,
                        tags: tags,
                        note: note
                    })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    showToast('Mood check-in saved to your wellness timeline! 🌸', 'success');
                    moodForm.reset();
                    // Reset tags
                    document.querySelectorAll('.tag-pill').forEach(p => p.classList.remove('selected'));
                    document.getElementById('selectedTagsInput').value = '';
                    if (intensityBadge) intensityBadge.textContent = 'Moderate (5/10)';

                    // Reload analytics & timeline
                    loadMoodAnalytics();
                    loadMoodTimeline();
                } else {
                    showToast(data.error || 'Could not save check-in.', 'error');
                }
            } catch (err) {
                showToast('Network error while saving check-in.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-heart"></i> Save Mood Check-In';
            }
        });
    }
}

// Multi-select tags pills
function initTagPills() {
    const pills = document.querySelectorAll('.tag-pill');
    const tagsInput = document.getElementById('selectedTagsInput');

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pill.classList.toggle('selected');
            const selected = Array.from(document.querySelectorAll('.tag-pill.selected')).map(p => p.getAttribute('data-tag'));
            if (tagsInput) tagsInput.value = selected.join(', ');
        });
    });
}

// ==========================================
// CHARTS & ANALYTICS (Chart.js)
// ==========================================
async function loadMoodAnalytics() {
    try {
        const res = await fetch('/api/moods/stats');
        const data = await res.json();

        // Update reflection text
        const reflectionElem = document.getElementById('reflectionText');
        if (reflectionElem && data.reflection) {
            reflectionElem.textContent = data.reflection;
        }

        renderWeeklyChart(data.weekly_labels || [], data.weekly_intensities || []);
        renderDistributionChart(data.frequency || {});
    } catch (err) {
        console.error('Failed to load mood stats:', err);
    }
}

function renderWeeklyChart(labels, intensities) {
    const canvas = document.getElementById('weeklyChart');
    if (!canvas) return;

    if (weeklyChart) weeklyChart.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#ACA4BD' : '#6B627A';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

    weeklyChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['No recent check-ins'],
            datasets: [{
                label: 'Intensity (1-10)',
                data: intensities.length ? intensities : [5],
                borderColor: '#8B72DE',
                backgroundColor: 'rgba(139, 114, 222, 0.12)',
                fill: true,
                tension: 0.35,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#8B72DE'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Intensity: ${ctx.parsed.y}/10`
                    }
                }
            },
            scales: {
                y: {
                    min: 1,
                    max: 10,
                    ticks: { color: textColor, stepSize: 2 },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: { color: textColor },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderDistributionChart(frequency) {
    const canvas = document.getElementById('distributionChart');
    if (!canvas) return;

    if (distributionChart) distributionChart.destroy();

    const keys = Object.keys(frequency);
    const values = Object.values(frequency);

    const labels = keys.map(k => `${k.charAt(0).toUpperCase() + k.slice(1)} ${MOOD_EMOJIS[k] || ''}`);
    const colors = keys.map(k => MOOD_COLORS[k] || '#8B72DE');

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#ACA4BD' : '#6B627A';

    distributionChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['No check-ins yet'],
            datasets: [{
                data: values.length ? values : [1],
                backgroundColor: colors.length ? colors : ['#E8E2D8'],
                borderWidth: 2,
                borderColor: isDark ? '#1E1A29' : '#FFFFFF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor, boxWidth: 12, padding: 12 }
                }
            },
            cutout: '68%'
        }
    });
}

// ==========================================
// TIMELINE HISTORY & EDIT/DELETE
// ==========================================
async function loadMoodTimeline() {
    const timeline = document.getElementById('moodTimeline');
    const countBadge = document.getElementById('historyCount');
    if (!timeline) return;

    try {
        const res = await fetch('/api/moods?limit=30');
        const entries = await res.json();

        if (countBadge) {
            countBadge.textContent = `${entries.length} check-ins recorded`;
        }

        if (!entries || entries.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state-mini">
                    <span>🌱</span>
                    <p>No mood entries recorded yet. Complete your first check-in above!</p>
                </div>
            `;
            return;
        }

        timeline.innerHTML = entries.map(entry => `
            <div class="recent-mood-row" style="margin-bottom: 0.75rem; padding: 1rem;">
                <span class="mood-badge-avatar">${MOOD_EMOJIS[entry.mood_type] || '💭'}</span>
                <div class="mood-row-info">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <strong>${entry.mood_type.charAt(0).toUpperCase() + entry.mood_type.slice(1)}</strong>
                        <span class="intensity-pill">${entry.intensity}/10</span>
                    </div>
                    <small class="text-muted">${entry.formatted_date}</small>
                    ${entry.note ? `<p style="margin-top: 4px; font-size: 0.86rem; color: var(--text-secondary);">"${entry.note}"</p>` : ''}
                    ${entry.tags && entry.tags.length ? `
                        <div style="display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap;">
                            ${entry.tags.map(t => `<span style="font-size: 0.7rem; background: var(--lavender-light); color: var(--lavender-primary); padding: 2px 7px; border-radius: 99px;">${t}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                <div style="display: flex; gap: 0.4rem;">
                    <button class="btn btn-sm btn-subtle" onclick="openEditModal(${entry.id}, ${entry.intensity}, '${encodeURIComponent(entry.note || '')}')" title="Edit entry">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn btn-sm btn-subtle text-danger" onclick="deleteMoodEntry(${entry.id})" title="Delete entry">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        timeline.innerHTML = '<p class="text-muted">Could not load history.</p>';
    }
}

// Edit Modal
function initEditModal() {
    const editSlider = document.getElementById('editIntensitySlider');
    const editVal = document.getElementById('editIntensityVal');
    const editForm = document.getElementById('editMoodForm');

    if (editSlider && editVal) {
        editSlider.addEventListener('input', (e) => {
            editVal.textContent = e.target.value;
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editMoodId').value;
            const intensity = parseInt(editSlider.value, 10);
            const note = document.getElementById('editMoodNote').value.trim();

            try {
                const res = await fetch(`/api/moods/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ intensity, note })
                });
                if (res.ok) {
                    showToast('Check-in updated successfully!', 'success');
                    closeEditModal();
                    loadMoodAnalytics();
                    loadMoodTimeline();
                } else {
                    showToast('Failed to update entry.', 'error');
                }
            } catch (err) {
                showToast('Network error.', 'error');
            }
        });
    }
}

window.openEditModal = function(id, intensity, noteEncoded) {
    const modal = document.getElementById('editMoodModal');
    if (!modal) return;
    document.getElementById('editMoodId').value = id;
    document.getElementById('editIntensitySlider').value = intensity;
    document.getElementById('editIntensityVal').textContent = intensity;
    document.getElementById('editMoodNote').value = decodeURIComponent(noteEncoded);
    modal.style.display = 'flex';
};

window.closeEditModal = function() {
    const modal = document.getElementById('editMoodModal');
    if (modal) modal.style.display = 'none';
};

window.deleteMoodEntry = async function(id) {
    if (!confirm('Are you sure you want to delete this mood check-in?')) return;

    try {
        const res = await fetch(`/api/moods/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Mood check-in deleted.', 'info');
            loadMoodAnalytics();
            loadMoodTimeline();
        } else {
            showToast('Failed to delete.', 'error');
        }
    } catch (err) {
        showToast('Network error.', 'error');
    }
};
