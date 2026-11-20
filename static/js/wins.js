/**
 * MoodMate — Tiny Wins JavaScript (wins.js)
 * Celebrating small milestones, confetti bursts, filter by category, add & delete.
 */

let allWinsCache = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    initAddWinCard();
    initCategoryFilters();
    loadWins();
});

// ==========================================
// ADD TINY WIN CARD
// ==========================================
function initAddWinCard() {
    const openBtn = document.getElementById('openAddWinBtn');
    const closeBtn = document.getElementById('closeAddWinBtn');
    const cancelBtn = document.getElementById('cancelWinBtn');
    const card = document.getElementById('addWinCard');
    const form = document.getElementById('addWinForm');
    const titleInput = document.getElementById('winTitle');
    const categoryChips = document.querySelectorAll('.category-chip');
    const selectedCatInput = document.getElementById('selectedCategory');

    if (openBtn && card) {
        openBtn.addEventListener('click', () => {
            card.style.display = 'block';
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            if (titleInput) titleInput.focus();
        });
    }

    const closeCard = () => {
        if (card) card.style.display = 'none';
        if (form) form.reset();
    };

    if (closeBtn) closeBtn.addEventListener('click', closeCard);
    if (cancelBtn) cancelBtn.addEventListener('click', closeCard);

    // Category chips click
    categoryChips.forEach(chip => {
        chip.addEventListener('click', () => {
            categoryChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            if (selectedCatInput) {
                selectedCatInput.value = chip.getAttribute('data-cat');
            }
        });
    });

    // Form submit
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = titleInput.value.trim();
            const category = selectedCatInput ? selectedCatInput.value : 'general';

            if (!title) {
                showToast('Please enter your achievement.', 'warning');
                return;
            }

            const saveBtn = document.getElementById('saveWinBtn');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Celebrating...';

            try {
                const res = await fetch('/api/wins', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, category })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    // Trigger confetti explosion!
                    triggerConfettiCelebration();

                    showToast(`Hooray! "${title}" celebrated and saved! 🌟`, 'success');
                    closeCard();
                    loadWins();
                } else {
                    showToast(data.error || 'Failed to save win.', 'error');
                }
            } catch (err) {
                showToast('Network error while saving win.', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Celebrate & Save!';
            }
        });
    }
}

function triggerConfettiCelebration() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#8B72DE', '#52B788', '#F4A261', '#E9C46A', '#E07A5F']
        });
    }
}

// ==========================================
// CATEGORY FILTERS
// ==========================================
function initCategoryFilters() {
    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.getAttribute('data-filter');
            renderWinsGrid();
        });
    });
}

// ==========================================
// LOAD & RENDER WINS
// ==========================================
async function loadWins() {
    const grid = document.getElementById('winsGrid');
    const totalCounter = document.getElementById('totalWinsCounter');
    const recentCounter = document.getElementById('recentWinsCounter');
    if (!grid) return;

    try {
        const res = await fetch('/api/wins');
        const wins = await res.json();
        allWinsCache = wins;

        if (totalCounter) totalCounter.textContent = wins.length;
        if (recentCounter) {
            // Wins within last 7 days
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const recentCount = wins.filter(w => new Date(w.created_at) >= weekAgo).length;
            recentCounter.textContent = recentCount;
        }

        renderWinsGrid();
    } catch (err) {
        grid.innerHTML = '<p class="text-muted">Could not load tiny wins.</p>';
    }
}

function renderWinsGrid() {
    const grid = document.getElementById('winsGrid');
    if (!grid) return;

    let filtered = allWinsCache;
    if (currentFilter !== 'all') {
        filtered = allWinsCache.filter(w => w.category === currentFilter);
    }

    if (!filtered || !filtered.length) {
        grid.innerHTML = `
            <div class="empty-state-mini" style="grid-column: 1 / -1;">
                <span>✨</span>
                <p>${currentFilter === 'all' ? 'No Tiny Wins recorded yet. Even getting out of bed or drinking water is a win!' : 'No wins in this category yet.'}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(w => `
        <div class="win-card">
            <div class="win-card-top">
                <span class="win-category-badge badge-${w.category}">${w.category}</span>
                <button class="win-del-btn" onclick="deleteWinItem(${w.id})" title="Delete">&times;</button>
            </div>
            <h4 class="win-card-title">${escapeHtml(w.title)}</h4>
            <div class="win-card-footer">
                <span>${w.formatted_date}</span>
                <button class="win-celebrate-btn" onclick="triggerMiniConfetti()">
                    Celebrate ✨
                </button>
            </div>
        </div>
    `).join('');
}

window.deleteWinItem = async function(id) {
    if (!confirm('Are you sure you want to remove this win?')) return;

    try {
        const res = await fetch(`/api/wins/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Win removed.', 'info');
            loadWins();
        } else {
            showToast('Failed to delete.', 'error');
        }
    } catch (err) {
        showToast('Network error.', 'error');
    }
};

window.triggerMiniConfetti = function() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 40,
            spread: 45,
            origin: { y: 0.7 }
        });
    }
};

function escapeHtml(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
