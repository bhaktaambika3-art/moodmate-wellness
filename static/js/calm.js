/**
 * MoodMate — Calm Corner JavaScript (calm.js)
 * Guided breathing animation with audio cue, procedural Web Audio API soundscapes,
 * interactive 5-4-3-2-1 grounding exercise, positive affirmations.
 */

document.addEventListener('DOMContentLoaded', () => {
    initCalmTabs();
    initGuidedBreathing();
    initProceduralSoundscapes();
    initGroundingExercise();
    initAffirmations();
});

// ==========================================
// CALM CORNER TABS
// ==========================================
function initCalmTabs() {
    const tabs = document.querySelectorAll('.calm-tab-btn');
    const panes = document.querySelectorAll('.calm-tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const targetId = `tab-${tab.getAttribute('data-tab')}`;
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');
        });
    });
}

// ==========================================
// GUIDED BREATHING ENGINE
// ==========================================
function initGuidedBreathing() {
    const startBtn = document.getElementById('startBreathingBtn');
    const pauseBtn = document.getElementById('pauseBreathingBtn');
    const resetBtn = document.getElementById('resetBreathingBtn');
    const circle = document.getElementById('breathingCircleOuter');
    const phaseText = document.getElementById('breathingPhaseText');
    const timerNumber = document.getElementById('breathingTimerNumber');
    const instructionText = document.getElementById('breathingInstruction');
    const techniqueSelect = document.getElementById('breathingTechniqueSelect');
    const cycleDisplay = document.getElementById('cycleCounter');

    let isRunning = false;
    let timerInterval = null;
    let currentStepIndex = 0;
    let secondsLeft = 4;
    let cycleCount = 0;

    const TECHNIQUES = {
        box: [
            { name: 'Inhale', duration: 4, class: 'inhale', text: 'Breathe in slowly through your nose...' },
            { name: 'Hold', duration: 4, class: 'hold', text: 'Hold your breath gently and softly...' },
            { name: 'Exhale', duration: 4, class: 'exhale', text: 'Release gently through your mouth...' },
            { name: 'Hold', duration: 4, class: 'hold', text: 'Rest in the pause before the next breath...' }
        ],
        relax: [
            { name: 'Inhale', duration: 4, class: 'inhale', text: 'Inhale quietly through your nose for 4s...' },
            { name: 'Hold', duration: 7, class: 'hold', text: 'Hold your breath gently for 7s...' },
            { name: 'Exhale', duration: 8, class: 'exhale', text: 'Exhale completely through your mouth for 8s...' }
        ],
        calm: [
            { name: 'Inhale', duration: 5, class: 'inhale', text: 'Deep slow inhale filling your lungs...' },
            { name: 'Exhale', duration: 5, class: 'exhale', text: 'Smooth, balanced exhale releasing tension...' }
        ]
    };

    function playSoftChime() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(432, ctx.currentTime); // 432 Hz healing tone
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 1.2);
        } catch (e) {}
    }

    function runBreathingTick() {
        const pattern = TECHNIQUES[techniqueSelect ? techniqueSelect.value : 'box'];
        const step = pattern[currentStepIndex];

        if (secondsLeft > 0) {
            timerNumber.textContent = secondsLeft;
            secondsLeft--;
        } else {
            // Next step in pattern
            currentStepIndex = (currentStepIndex + 1) % pattern.length;
            if (currentStepIndex === 0) {
                cycleCount++;
                if (cycleDisplay) cycleDisplay.innerHTML = `<span>Cycles: <strong>${cycleCount}</strong></span>`;
            }

            const nextStep = pattern[currentStepIndex];
            phaseText.textContent = nextStep.name;
            instructionText.textContent = nextStep.text;
            secondsLeft = nextStep.duration;
            timerNumber.textContent = secondsLeft;

            // Update circle class
            circle.className = `breathing-circle-outer ${nextStep.class}`;
            circle.style.transitionDuration = `${nextStep.duration}s`;

            playSoftChime();
            secondsLeft--;
        }
    }

    function startBreathing() {
        if (isRunning) return;
        isRunning = true;
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-flex';

        const pattern = TECHNIQUES[techniqueSelect ? techniqueSelect.value : 'box'];
        const step = pattern[currentStepIndex];
        phaseText.textContent = step.name;
        instructionText.textContent = step.text;
        circle.className = `breathing-circle-outer ${step.class}`;
        circle.style.transitionDuration = `${step.duration}s`;
        playSoftChime();

        timerInterval = setInterval(runBreathingTick, 1000);
    }

    function pauseBreathing() {
        isRunning = false;
        clearInterval(timerInterval);
        startBtn.style.display = 'inline-flex';
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        pauseBtn.style.display = 'none';
        instructionText.textContent = 'Breathing paused. Resume whenever you are ready.';
    }

    function resetBreathing() {
        isRunning = false;
        clearInterval(timerInterval);
        currentStepIndex = 0;
        secondsLeft = 4;
        cycleCount = 0;
        if (cycleDisplay) cycleDisplay.innerHTML = `<span>Cycles: <strong>0</strong></span>`;

        startBtn.style.display = 'inline-flex';
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Breathing';
        pauseBtn.style.display = 'none';

        phaseText.textContent = 'Ready';
        timerNumber.textContent = '4';
        instructionText.textContent = 'Press Start to begin your guided calming breath cycle.';
        circle.className = 'breathing-circle-outer';
    }

    if (startBtn) startBtn.addEventListener('click', startBreathing);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseBreathing);
    if (resetBtn) resetBtn.addEventListener('click', resetBreathing);
    if (techniqueSelect) techniqueSelect.addEventListener('change', resetBreathing);
}

// ==========================================
// PROCEDURAL SOUNDSCAPES (Web Audio API)
// ==========================================
function initProceduralSoundscapes() {
    let audioCtx = null;
    const activeNodes = {}; // soundName -> { gainNode, stopFn }

    function getAudioContext() {
        if (!audioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioCtx();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // Generator 1: Rain (white noise filtered through bandpass)
    function createRainSound(ctx, gainNode) {
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(gainNode);
        whiteNoise.start();

        return () => {
            whiteNoise.stop();
            whiteNoise.disconnect();
        };
    }

    // Generator 2: Ocean Waves (pink noise modulated by LFO)
    function createOceanSound(ctx, gainNode) {
        const bufferSize = ctx.sampleRate * 3;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            output[i] = (b0 + b1 + b2) * 0.1;
        }

        const pinkNoise = ctx.createBufferSource();
        pinkNoise.buffer = noiseBuffer;
        pinkNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, ctx.currentTime);

        // LFO for wave swelling
        const waveGain = ctx.createGain();
        waveGain.gain.setValueAtTime(0.5, ctx.currentTime);

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // ~8 sec ocean swell
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.35, ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(waveGain.gain);

        pinkNoise.connect(filter);
        filter.connect(waveGain);
        waveGain.connect(gainNode);

        pinkNoise.start();
        lfo.start();

        return () => {
            pinkNoise.stop();
            lfo.stop();
            pinkNoise.disconnect();
        };
    }

    // Generator 3: Forest Breeze (filtered resonant noise)
    function createForestSound(ctx, gainNode) {
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(550, ctx.currentTime);
        filter.Q.setValueAtTime(1.5, ctx.currentTime);

        source.connect(filter);
        filter.connect(gainNode);
        source.start();

        return () => {
            source.stop();
            source.disconnect();
        };
    }

    // Generator 4: Warm Fireplace (low rumble + random crackle)
    function createFireSound(ctx, gainNode) {
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            // occasional crackle spike
            if (Math.random() < 0.003) {
                output[i] = (Math.random() * 2 - 1) * 0.9;
            } else {
                output[i] = (Math.random() * 2 - 1) * 0.08;
            }
        }

        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, ctx.currentTime);

        source.connect(filter);
        filter.connect(gainNode);
        source.start();

        return () => {
            source.stop();
            source.disconnect();
        };
    }

    // Toggle button listeners
    document.querySelectorAll('.sound-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sound = btn.getAttribute('data-sound');
            const card = btn.closest('.sound-channel-card');
            const volumeInput = card.querySelector('.sound-volume');
            const volume = volumeInput ? parseFloat(volumeInput.value) : 0.6;

            if (activeNodes[sound]) {
                // Stop sound
                activeNodes[sound].stopFn();
                delete activeNodes[sound];
                card.classList.remove('playing');
                btn.innerHTML = '<i class="fa-solid fa-play"></i>';
            } else {
                // Start sound
                const ctx = getAudioContext();
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(volume, ctx.currentTime);
                gain.connect(ctx.destination);

                let stopFn = () => {};
                if (sound === 'rain') stopFn = createRainSound(ctx, gain);
                else if (sound === 'ocean') stopFn = createOceanSound(ctx, gain);
                else if (sound === 'forest') stopFn = createForestSound(ctx, gain);
                else if (sound === 'fire') stopFn = createFireSound(ctx, gain);

                activeNodes[sound] = { gainNode: gain, stopFn: stopFn };
                card.classList.add('playing');
                btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            }
        });
    });

    // Volume sliders
    document.querySelectorAll('.sound-volume').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const sound = slider.getAttribute('data-sound');
            if (activeNodes[sound]) {
                const vol = parseFloat(e.target.value);
                const ctx = getAudioContext();
                activeNodes[sound].gainNode.gain.setValueAtTime(vol, ctx.currentTime);
            }
        });
    });

    // Silence all button
    const stopAllBtn = document.getElementById('stopAllSoundsBtn');
    if (stopAllBtn) {
        stopAllBtn.addEventListener('click', () => {
            Object.keys(activeNodes).forEach(sound => {
                activeNodes[sound].stopFn();
                delete activeNodes[sound];
            });
            document.querySelectorAll('.sound-channel-card').forEach(c => c.classList.remove('playing'));
            document.querySelectorAll('.sound-toggle-btn').forEach(b => b.innerHTML = '<i class="fa-solid fa-play"></i>');
            showToast('All ambient sounds paused.', 'info');
        });
    }
}

// ==========================================
// 5-4-3-2-1 GROUNDING EXERCISE
// ==========================================
function initGroundingExercise() {
    const stepBadge = document.getElementById('groundingStepBadge');
    const stepTitle = document.getElementById('groundingStepTitle');
    const stepDesc = document.getElementById('groundingStepDesc');
    const itemsList = document.getElementById('groundingItemsList');
    const prevBtn = document.getElementById('prevGroundingStepBtn');
    const nextBtn = document.getElementById('nextGroundingStepBtn');
    const resetBtn = document.getElementById('resetGroundingBtn');

    if (!itemsList) return;

    let currentStep = 1;

    const STEPS = [
        {
            num: 5,
            title: '5 Things You Can See',
            desc: 'Look around you. Notice five things you can see — notice their shapes, shadows, or colors.',
            items: ['First object you see', 'Second object you see', 'Third object you see', 'Fourth object you see', 'Fifth object you see']
        },
        {
            num: 4,
            title: '4 Things You Can Touch',
            desc: 'Bring awareness to physical touch. Notice the texture of your clothes, the floor under your feet, or a cool surface.',
            items: ['First texture you feel', 'Second sensation you notice', 'Third physical contact point', 'Fourth physical touch']
        },
        {
            num: 3,
            title: '3 Things You Can Hear',
            desc: 'Listen gently to the background sounds. Birds, a distant vehicle, your computer fan, or your own breath.',
            items: ['First sound you hear', 'Second subtle ambient noise', 'Third background rhythm']
        },
        {
            num: 2,
            title: '2 Things You Can Smell',
            desc: 'Notice scents in the air, your clothing, soap, or coffee. If nothing is noticeable, imagine your favorite comforting aroma.',
            items: ['First scent you notice', 'Second scent or comforting fragrance']
        },
        {
            num: 1,
            title: '1 Thing You Can Taste',
            desc: 'Notice the lingering taste in your mouth, take a mindful sip of water, or focus on one thing you appreciate about yourself.',
            items: ['One taste or self-appreciation reflection']
        }
    ];

    function renderStep(stepIndex) {
        const step = STEPS[stepIndex - 1];
        if (!step) return;

        stepBadge.textContent = `Step ${stepIndex} of 5`;
        stepTitle.textContent = step.title;
        stepDesc.textContent = step.desc;

        itemsList.innerHTML = step.items.map((item, idx) => `
            <label class="grounding-checkbox-row">
                <input type="checkbox" class="grounding-item-chk" data-idx="${idx}">
                <span>${idx + 1}. ${item}</span>
            </label>
        `).join('');

        if (prevBtn) prevBtn.style.display = stepIndex > 1 ? 'inline-flex' : 'none';
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.innerHTML = stepIndex === 5 ? '<i class="fa-solid fa-check"></i> Complete Grounding' : 'Next Step &rarr;';
        }

        // Attach checkbox change listener
        itemsList.querySelectorAll('.grounding-item-chk').forEach(chk => {
            chk.addEventListener('change', () => {
                const allChecked = Array.from(itemsList.querySelectorAll('.grounding-item-chk')).every(c => c.checked);
                if (nextBtn) nextBtn.disabled = !allChecked;
            });
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentStep < 5) {
                currentStep++;
                renderStep(currentStep);
            } else {
                // Completed!
                if (typeof confetti === 'function') {
                    confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
                }
                showToast('Grounding complete! You are grounded, safe, and right here in this present moment. 🌸', 'success');
                currentStep = 1;
                renderStep(1);
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                renderStep(currentStep);
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentStep = 1;
            renderStep(1);
        });
    }

    renderStep(1);
}

// ==========================================
// POSITIVE AFFIRMATIONS
// ==========================================
function initAffirmations() {
    const textElem = document.getElementById('affirmationText');
    const tagElem = document.getElementById('affirmationTag');
    const nextBtn = document.getElementById('nextAffirmationBtn');

    const AFFIRMATIONS = [
        { text: "I am doing the best I can today, and that is more than enough.", tag: "🌸 Self-Compassion" },
        { text: "My feelings are valid, but they do not define my entire reality.", tag: "🌿 Emotional Clarity" },
        { text: "I give myself permission to rest without feeling guilty.", tag: "🛋️ Rest & Recovery" },
        { text: "I can take things one gentle breath and one moment at a time.", tag: "🌊 Inner Stillness" },
        { text: "Healing is not a race. Small progress is still meaningful progress.", tag: "🌱 Growth" },
        { text: "I am safe in this present moment. I let go of what I cannot control.", tag: "🍃 Grounding" },
        { text: "It is okay to ask for help, and it is okay to protect my peace.", tag: "✨ Boundaries" },
        { text: "I deserve the same kindness and empathy that I give so freely to others.", tag: "💛 Love & Care" }
    ];

    let currentIndex = 0;

    if (nextBtn && textElem) {
        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % AFFIRMATIONS.length;
            const item = AFFIRMATIONS[currentIndex];

            textElem.style.opacity = '0';
            setTimeout(() => {
                textElem.textContent = `"${item.text}"`;
                if (tagElem) tagElem.textContent = item.tag;
                textElem.style.opacity = '1';
            }, 200);
        });
    }
}
