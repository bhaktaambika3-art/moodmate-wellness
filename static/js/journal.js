/**
 * MoodMate — Personal Journal JavaScript (journal.js)
 * Distraction-free writing, word counter, prompts shuffle, autosave, search, read/edit modal.
 */

let journalEntriesCache = [];
let currentViewingEntryId = null;

document.addEventListener('DOMContentLoaded', () => {
    initJournalForm();
    initPrompts();
    initSearch();
    loadJournals();
});

// ==========================================
// FORM, DRAFT AUTOSAVE & WORD COUNT
// ==========================================
function initJournalForm() {
    const form = document.getElementById('journalForm');
    const titleInput = document.getElementById('journalTitle');
    const contentInput = document.getElementById('journalContent');
    const moodTagSelect = document.getElementById('journalMoodTag');
    const wordCountBadge = document.getElementById('wordCountBadge');
    const draftStatus = document.getElementById('draftStatus');
    const clearBtn = document.getElementById('clearEditorBtn');
    const toggleWriteBtn = document.getElementById('toggleWriteBtn');
    const editorCard = document.getElementById('journalEditorCard');

    // Restore draft if exists
    const savedDraft = localStorage.getItem('moodmate_journal_draft');
    if (savedDraft) {
        try {
            const parsed = JSON.parse(savedDraft);
            if (titleInput && parsed.title) titleInput.value = parsed.title;
            if (contentInput && parsed.content) contentInput.value = parsed.content;
            if (moodTagSelect && parsed.moodTag) moodTagSelect.value = parsed.moodTag;
            updateWordCount();
        } catch (e) {}
    }

    // Toggle Write View
    if (toggleWriteBtn && editorCard) {
        toggleWriteBtn.addEventListener('click', () => {
            editorCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (titleInput) titleInput.focus();
        });
    }

    // Word count & local autosave on input
    function updateWordCount() {
        if (!contentInput || !wordCountBadge) return;
        const text = contentInput.value.trim();
        const words = text ? text.split(/\s+/).length : 0;
        const readingTime = Math.ceil(words / 200);
        wordCountBadge.textContent = `${words} words • ${readingTime} min read`;

        // Save draft locally
        const draft = {
            title: titleInput ? titleInput.value : '',
            content: text,
            moodTag: moodTagSelect ? moodTagSelect.value : ''
        };
        localStorage.setItem('moodmate_journal_draft', JSON.stringify(draft));
        if (draftStatus) draftStatus.innerHTML = '<span class="autosave-dot"></span> Autosaved locally';
    }

    if (contentInput) {
        contentInput.addEventListener('input', updateWordCount);
    }
    if (titleInput) {
        titleInput.addEventListener('input', updateWordCount);
    }

    // Clear Button
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear the current writing space?')) {
                form.reset();
                localStorage.removeItem('moodmate_journal_draft');
                document.getElementById('editingEntryId').value = '';
                updateWordCount();
            }
        });
    }

    // Submit form (Save / Update)
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = titleInput.value.trim();
            const content = contentInput.value.trim();
            const moodTag = moodTagSelect.value;
            const editingId = document.getElementById('editingEntryId').value;

            if (!title || !content) {
                showToast('Please provide both title and thoughts for your entry.', 'warning');
                return;
            }

            const saveBtn = document.getElementById('saveJournalBtn');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                let url = '/api/journals';
                let method = 'POST';

                if (editingId) {
                    url = `/api/journals/${editingId}`;
                    method = 'PUT';
                }

                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content, mood_tag: moodTag })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    showToast(editingId ? 'Reflection updated! ✨' : 'Journal entry saved safely in your sanctuary! 🌸', 'success');
                    form.reset();
                    document.getElementById('editingEntryId').value = '';
                    localStorage.removeItem('moodmate_journal_draft');
                    updateWordCount();
                    loadJournals();
                } else {
                    showToast(data.error || 'Failed to save entry.', 'error');
                }
            } catch (err) {
                showToast('Network error while saving journal.', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Journal Entry';
            }
        });
    }
}

// ==========================================
// WRITING PROMPTS
// ==========================================
function initPrompts() {
    const shuffleBtn = document.getElementById('shufflePromptBtn');
    const useBtn = document.getElementById('usePromptBtn');
    const promptText = document.getElementById('activePromptText');
    const titleInput = document.getElementById('journalTitle');

    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/journals/prompts');
                const data = await res.json();
                if (data.random && promptText) {
                    promptText.style.opacity = '0';
                    setTimeout(() => {
                        promptText.textContent = `"${data.random}"`;
                        promptText.style.opacity = '1';
                    }, 200);
                }
            } catch (err) {}
        });
    }

    if (useBtn && promptText && titleInput) {
        useBtn.addEventListener('click', () => {
            const raw = promptText.textContent.replace(/^"|"$/g, '');
            titleInput.value = raw;
            titleInput.focus();
            showToast('Prompt placed into title! ✨', 'info');
        });
    }
}

// ==========================================
// SEARCH & FILTER
// ==========================================
function initSearch() {
    const searchInput = document.getElementById('searchJournalInput');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (!searchInput) return;

    let debounceTimer = null;
    searchInput.addEventListener('input', () => {
        if (clearBtn) clearBtn.style.display = searchInput.value ? 'block' : 'none';

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            loadJournals(searchInput.value.trim());
        }, 350);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            loadJournals();
        });
    }
}

// ==========================================
// LOAD & RENDER ENTRIES
// ==========================================
async function loadJournals(query = '') {
    const grid = document.getElementById('journalGrid');
    const countPill = document.getElementById('entriesCountPill');
    if (!grid) return;

    try {
        const url = query ? `/api/journals?search=${encodeURIComponent(query)}` : '/api/journals';
        const res = await fetch(url);
        const entries = await res.json();
        journalEntriesCache = entries;

        if (countPill) countPill.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

        if (!entries || entries.length === 0) {
            grid.innerHTML = `
                <div class="empty-state-mini" style="grid-column: 1 / -1;">
                    <span>📖</span>
                    <p>${query ? 'No entries match your search.' : 'Your sanctuary journal is waiting for your reflections.'}</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = entries.map(e => `
            <article class="journal-card" onclick="openReadModal(${e.id})">
                <div class="journal-card-top">
                    ${e.mood_tag ? `<span class="card-mood-tag">${e.mood_tag}</span>` : '<span></span>'}
                    <span class="card-date">${e.formatted_date}</span>
                </div>
                <h3 class="journal-card-title">${escapeHtml(e.title)}</h3>
                <p class="journal-card-snippet">${escapeHtml(e.content)}</p>
                <div class="journal-card-footer">
                    <span>${Math.ceil(e.content.split(/\s+/).length / 200)} min read</span>
                    <span>Tap to open &rarr;</span>
                </div>
            </article>
        `).join('');
    } catch (err) {
        grid.innerHTML = '<p class="text-muted">Could not load journal entries.</p>';
    }
}

// ==========================================
// MODAL READ / EDIT / DELETE
// ==========================================
window.openReadModal = function(id) {
    const entry = journalEntriesCache.find(e => e.id === id);
    if (!entry) return;

    currentViewingEntryId = id;

    const modal = document.getElementById('readJournalModal');
    document.getElementById('readTitle').textContent = entry.title;
    document.getElementById('readDate').textContent = entry.formatted_date;
    document.getElementById('readContent').textContent = entry.content;

    const moodBadge = document.getElementById('readMoodTag');
    if (entry.mood_tag) {
        moodBadge.style.display = 'inline-block';
        moodBadge.textContent = entry.mood_tag;
    } else {
        moodBadge.style.display = 'none';
    }

    modal.style.display = 'flex';
};

window.closeReadModal = function() {
    const modal = document.getElementById('readJournalModal');
    if (modal) modal.style.display = 'none';
    currentViewingEntryId = null;
};

// Edit button inside read modal
document.getElementById('editCurrentEntryBtn')?.addEventListener('click', () => {
    if (!currentViewingEntryId) return;
    const entry = journalEntriesCache.find(e => e.id === currentViewingEntryId);
    if (!entry) return;

    closeReadModal();

    document.getElementById('editingEntryId').value = entry.id;
    document.getElementById('journalTitle').value = entry.title;
    document.getElementById('journalContent').value = entry.content;
    document.getElementById('journalMoodTag').value = entry.mood_tag || '';

    const editorCard = document.getElementById('journalEditorCard');
    editorCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Editing reflection in editor above.', 'info');
});

// Delete button inside read modal
document.getElementById('deleteCurrentEntryBtn')?.addEventListener('click', async () => {
    if (!currentViewingEntryId) return;
    if (!confirm('Are you sure you want to permanently delete this journal reflection?')) return;

    try {
        const res = await fetch(`/api/journals/${currentViewingEntryId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Journal entry deleted.', 'info');
            closeReadModal();
            loadJournals();
        } else {
            showToast('Failed to delete entry.', 'error');
        }
    } catch (err) {
        showToast('Network error.', 'error');
    }
});

function escapeHtml(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
