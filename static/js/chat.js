/**
 * MoodMate — AI Companion Chat JavaScript (chat.js)
 * Multi-turn Groq conversational memory, speech-to-text (STT),
 * customizable natural text-to-speech (TTS) voice personalities, audio controls.
 */

let activeConversationId = null;
let currentVoicePersonality = 'warm_female';
let voiceSpeed = 1.0;
let voiceRepliesEnabled = true;
let availableVoices = [];
let recognition = null;
let isRecognizing = false;

// Voice Profiles Mapping
const VOICE_PROFILES = {
    warm_female: {
        name: 'Aria',
        pitch: 1.05,
        rate: 0.95,
        preferredNames: ['Google UK English Female', 'Microsoft Jenny', 'Microsoft Zira', 'Samantha', 'Victoria']
    },
    calm_male: {
        name: 'Julian',
        pitch: 0.9,
        rate: 0.9,
        preferredNames: ['Google UK English Male', 'Microsoft Ryan', 'Microsoft David', 'Alex', 'Daniel']
    },
    gentle_female: {
        name: 'Serena',
        pitch: 1.0,
        rate: 0.85,
        preferredNames: ['Google US English', 'Microsoft Sonia', 'Karen', 'Tessa']
    },
    cheerful_female: {
        name: 'Maya',
        pitch: 1.15,
        rate: 1.0,
        preferredNames: ['Google US English', 'Microsoft Jenny', 'Moira']
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initSpeechSynthesis();
    initSpeechRecognition();
    initChatInterface();
    loadConversations();
});

// ==========================================
// SPEECH SYNTHESIS (TTS)
// ==========================================
function initSpeechSynthesis() {
    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported in this browser.');
        const voiceToggle = document.getElementById('voiceRepliesToggle');
        if (voiceToggle) voiceToggle.style.display = 'none';
        return;
    }

    const loadVoices = () => {
        availableVoices = window.speechSynthesis.getVoices();
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Voice replies toggle
    const toggleBtn = document.getElementById('voiceRepliesToggle');
    const toggleIcon = document.getElementById('voiceToggleIcon');
    const toggleText = document.getElementById('voiceToggleText');

    if (toggleBtn) {
        // Load preference from localStorage or user settings
        const storedPref = localStorage.getItem('moodmate_voice_replies');
        if (storedPref !== null) {
            voiceRepliesEnabled = storedPref === 'true';
        }
        updateVoiceToggleButton();

        toggleBtn.addEventListener('click', () => {
            voiceRepliesEnabled = !voiceRepliesEnabled;
            localStorage.setItem('moodmate_voice_replies', voiceRepliesEnabled);
            updateVoiceToggleButton();
            if (!voiceRepliesEnabled) {
                stopSpeaking();
            } else {
                showToast('Voice replies turned ON 🌸', 'info');
            }
        });
    }

    function updateVoiceToggleButton() {
        if (!toggleBtn) return;
        if (voiceRepliesEnabled) {
            toggleBtn.classList.add('voice-active');
            if (toggleIcon) toggleIcon.className = 'fa-solid fa-volume-high';
            if (toggleText) toggleText.textContent = 'Voice On';
        } else {
            toggleBtn.classList.remove('voice-active');
            if (toggleIcon) toggleIcon.className = 'fa-solid fa-volume-xmark';
            if (toggleText) toggleText.textContent = 'Voice Off';
        }
    }

    // Stop speaking button
    const stopBtn = document.getElementById('stopAudioBtn');
    if (stopBtn) {
        stopBtn.addEventListener('click', stopSpeaking);
    }

    // Voice picker dropdown
    const pickerBtn = document.getElementById('voicePickerBtn');
    const menu = document.getElementById('voiceDropdownMenu');
    const speedSlider = document.getElementById('voiceSpeedSlider');
    const speedDisplay = document.getElementById('speedValueDisplay');
    const voiceLabel = document.getElementById('currentVoiceLabel');

    if (pickerBtn && menu) {
        pickerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && e.target !== pickerBtn) {
                menu.classList.remove('show');
            }
        });
    }

    // Voice option rows click
    document.querySelectorAll('.voice-option-row').forEach(row => {
        row.addEventListener('click', () => {
            const vId = row.getAttribute('data-voice-id');
            const vName = row.getAttribute('data-voice-name');
            currentVoicePersonality = vId;
            if (voiceLabel) voiceLabel.textContent = vName.split('(')[0].trim();
            document.querySelectorAll('.voice-option-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            showToast(`Voice set to ${vName}`, 'info');
        });
    });

    // Preview voice sample buttons
    document.querySelectorAll('.btn-preview-voice').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const vId = btn.getAttribute('data-voice-id');
            speakText(`Hello, I'm MoodMate. I am right here with you.`, vId, true);
        });
    });

    // Speed slider
    if (speedSlider && speedDisplay) {
        speedSlider.addEventListener('input', (e) => {
            voiceSpeed = parseFloat(e.target.value);
            speedDisplay.textContent = `${voiceSpeed.toFixed(2)}x`;
        });
    }
}

function findBestVoiceMatch(personalityKey) {
    if (!availableVoices.length) {
        availableVoices = window.speechSynthesis.getVoices();
    }
    const profile = VOICE_PROFILES[personalityKey] || VOICE_PROFILES.warm_female;

    // Try matching preferred names
    for (const prefName of profile.preferredNames) {
        const match = availableVoices.find(v => v.name.toLowerCase().includes(prefName.toLowerCase()));
        if (match) return match;
    }

    // Match by lang (en-US, en-GB, en-IN)
    const enMatch = availableVoices.find(v => v.lang.startsWith('en'));
    return enMatch || availableVoices[0] || null;
}

function speakText(text, personalityKey = null, force = false) {
    if (!('speechSynthesis' in window)) return;
    if (!voiceRepliesEnabled && !force) return;

    window.speechSynthesis.cancel(); // Stop ongoing speech

    // Clean markdown symbols from speech
    const cleanText = text
        .replace(/\*\*|__|\*|_|`|#|>|\[.*?\]\(.*?\)/g, '')
        .replace(/🌸|🌿|✨|😊|🙂|😢|😰/g, '')
        .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const key = personalityKey || currentVoicePersonality;
    const profile = VOICE_PROFILES[key] || VOICE_PROFILES.warm_female;

    const matchedVoice = findBestVoiceMatch(key);
    if (matchedVoice) {
        utterance.voice = matchedVoice;
    }

    utterance.pitch = profile.pitch;
    utterance.rate = (profile.rate || 1.0) * voiceSpeed;

    const stopBtn = document.getElementById('stopAudioBtn');
    utterance.onstart = () => {
        if (stopBtn) stopBtn.style.display = 'inline-flex';
    };

    utterance.onend = utterance.onerror = () => {
        if (stopBtn) stopBtn.style.display = 'none';
    };

    window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    const stopBtn = document.getElementById('stopAudioBtn');
    if (stopBtn) stopBtn.style.display = 'none';
}

// ==========================================
// SPEECH RECOGNITION (STT)
// ==========================================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micBtn = document.getElementById('micBtn');
    const sttIndicator = document.getElementById('sttIndicator');
    const cancelSttBtn = document.getElementById('cancelSttBtn');
    const chatInput = document.getElementById('chatInputText');

    if (!SpeechRecognition) {
        if (micBtn) {
            micBtn.title = 'Speech recognition not supported in this browser. Please use Chrome/Edge.';
            micBtn.style.opacity = '0.5';
        }
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Multi-accent English / Hinglish friendly

    recognition.onstart = () => {
        isRecognizing = true;
        if (micBtn) micBtn.classList.add('recording');
        if (sttIndicator) sttIndicator.style.display = 'flex';
    };

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        if (chatInput) {
            chatInput.value = transcript;
            chatInput.style.height = 'auto';
            chatInput.style.height = (chatInput.scrollHeight) + 'px';
        }
    };

    recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        stopRecognition();
        if (event.error === 'not-allowed') {
            showToast('Microphone access blocked. Please enable mic permissions in your browser bar.', 'error');
        }
    };

    recognition.onend = () => {
        stopRecognition();
    };

    const stopRecognition = () => {
        isRecognizing = false;
        if (micBtn) micBtn.classList.remove('recording');
        if (sttIndicator) sttIndicator.style.display = 'none';
    };

    if (micBtn) {
        micBtn.addEventListener('click', () => {
            if (isRecognizing) {
                recognition.stop();
            } else {
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Recognition start error:', e);
                }
            }
        });
    }

    if (cancelSttBtn) {
        cancelSttBtn.addEventListener('click', () => {
            if (recognition) recognition.stop();
            stopRecognition();
        });
    }
}

// ==========================================
// CHAT INTERFACE & MESSAGES
// ==========================================
function initChatInterface() {
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInputText');
    const newChatBtn = document.getElementById('newChatBtn');
    const toggleSidebarBtn = document.getElementById('toggleConvSidebarBtn');
    const chatSidebar = document.getElementById('chatSidebar');
    const delConvBtn = document.getElementById('deleteCurrentConvBtn');

    // Auto-expand textarea & Enter to send
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    // Starter chips click
    document.querySelectorAll('.starter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const text = chip.getAttribute('data-text');
            if (chatInput) {
                chatInput.value = text;
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    });

    // New conversation button
    if (newChatBtn) {
        newChatBtn.addEventListener('click', createNewConversation);
    }

    // Mobile sidebar toggle
    if (toggleSidebarBtn && chatSidebar) {
        toggleSidebarBtn.addEventListener('click', () => {
            chatSidebar.classList.toggle('open');
        });
    }

    // Delete current conversation
    if (delConvBtn) {
        delConvBtn.addEventListener('click', async () => {
            if (!activeConversationId) return;
            if (!confirm('Are you sure you want to delete this conversation?')) return;

            try {
                const res = await fetch(`/api/conversations/${activeConversationId}`, { method: 'DELETE' });
                if (res.ok) {
                    showToast('Conversation deleted.', 'info');
                    loadConversations();
                }
            } catch (e) {
                showToast('Failed to delete conversation.', 'error');
            }
        });
    }

    // Submit message
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (!message) return;

            // Clear input
            chatInput.value = '';
            chatInput.style.height = 'auto';

            // Hide placeholder if visible
            const placeholder = document.getElementById('chatWelcomePlaceholder');
            if (placeholder) placeholder.style.display = 'none';

            // Append user bubble
            appendMessageBubble('user', message, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            scrollToBottom();

            // Show typing indicator
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) typingIndicator.style.display = 'block';

            try {
                const res = await fetch('/api/chat/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation_id: activeConversationId,
                        message: message
                    })
                });

                const data = await res.json();
                if (typingIndicator) typingIndicator.style.display = 'none';

                if (res.ok && data.success) {
                    activeConversationId = data.conversation_id;
                    appendMessageBubble('assistant', data.assistant_message.content, data.assistant_message.formatted_time);
                    scrollToBottom();

                    // Speak response if voice is on
                    if (voiceRepliesEnabled) {
                        speakText(data.assistant_message.content);
                    }

                    // Refresh conversation list to show updated title
                    loadConversations(activeConversationId);
                } else {
                    appendMessageBubble('assistant', "I'm having a brief moment of connection difficulty. Please take a gentle breath and try asking me again. 🌿", '');
                    scrollToBottom();
                }
            } catch (err) {
                if (typingIndicator) typingIndicator.style.display = 'none';
                appendMessageBubble('assistant', "I couldn't reach the server just now. Please check your internet connection.", '');
                scrollToBottom();
            }
        });
    }
}

// ==========================================
// CONVERSATIONS MANAGEMENT
// ==========================================
async function loadConversations(selectId = null) {
    const list = document.getElementById('conversationsList');
    if (!list) return;

    try {
        const res = await fetch('/api/conversations');
        const convs = await res.json();

        if (!convs || !convs.length) {
            // Automatically create first conversation
            await createNewConversation();
            return;
        }

        list.innerHTML = convs.map(c => `
            <div class="conv-item ${c.id === (selectId || convs[0].id) ? 'active' : ''}" data-conv-id="${c.id}" onclick="selectConversation(${c.id})">
                <span class="conv-title">${escapeHtml(c.title || 'New Conversation')}</span>
                <button class="conv-del-btn" onclick="deleteConversationItem(event, ${c.id})" title="Delete">&times;</button>
            </div>
        `).join('');

        const targetId = selectId || convs[0].id;
        selectConversation(targetId);
    } catch (e) {
        list.innerHTML = '<p class="text-muted" style="padding: 0.5rem;">Could not load chats.</p>';
    }
}

async function createNewConversation() {
    try {
        const res = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Conversation' })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            loadConversations(data.conversation.id);
        }
    } catch (e) {
        showToast('Error starting new conversation.', 'error');
    }
}

window.selectConversation = async function(convId) {
    activeConversationId = convId;
    document.querySelectorAll('.conv-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.getAttribute('data-conv-id'), 10) === convId);
    });

    // Close mobile sidebar if open
    const chatSidebar = document.getElementById('chatSidebar');
    if (chatSidebar) chatSidebar.classList.remove('open');

    // Fetch messages
    const container = document.getElementById('chatMessagesContainer');
    container.innerHTML = '<div class="chat-loading-item"><i class="fa-solid fa-spinner fa-spin"></i> Loading messages...</div>';

    try {
        const res = await fetch(`/api/conversations/${convId}/messages`);
        const data = await res.json();

        container.innerHTML = '';
        if (data.messages && data.messages.length) {
            data.messages.forEach(m => {
                appendMessageBubble(m.sender, m.content, m.formatted_time);
            });
            scrollToBottom();
        } else {
            container.innerHTML = `
                <div class="chat-welcome-placeholder" id="chatWelcomePlaceholder">
                    <div class="placeholder-icon">🌸</div>
                    <h3>Conversation started</h3>
                    <p>What's on your mind right now?</p>
                </div>
            `;
        }
    } catch (e) {
        container.innerHTML = '<p class="text-muted">Failed to load messages.</p>';
    }
};

window.deleteConversationItem = async function(e, convId) {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;

    try {
        const res = await fetch(`/api/conversations/${convId}`, { method: 'DELETE' });
        if (res.ok) {
            loadConversations();
        }
    } catch (err) {
        showToast('Error deleting.', 'error');
    }
};

// ==========================================
// RENDER BUBBLES
// ==========================================
function appendMessageBubble(sender, text, timestamp) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = `message-row message-${sender}`;

    const isUser = sender === 'user';
    const avatar = isUser ? '👤' : '🌸';

    // Format markdown-like bold and bullet lines safely
    const formattedContent = formatChatMessage(text);

    row.innerHTML = `
        <span class="message-avatar">${avatar}</span>
        <div class="message-content-wrap">
            <div class="message-bubble">${formattedContent}</div>
            <div class="message-footer">
                <span class="message-time">${timestamp || ''}</span>
                ${!isUser ? `
                    <button class="message-speak-btn" onclick="speakText('${escapeSingleQuotes(text)}', null, true)" title="Listen to this message">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    container.appendChild(row);
}

function formatChatMessage(text) {
    let clean = escapeHtml(text);
    // Bold **text**
    clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    clean = clean.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Linebreaks
    clean = clean.replace(/\n/g, '<br>');
    return clean;
}

function scrollToBottom() {
    const container = document.getElementById('chatMessagesContainer');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function escapeHtml(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeSingleQuotes(str) {
    return (str || '').replace(/'/g, "\\'").replace(/\n/g, ' ');
}
