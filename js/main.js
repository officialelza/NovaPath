/* ============================================
   NovaPath — Main JavaScript
   Shared across all pages
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initMusicToggle();
    initPageEnter();
});

/* --- Navbar --- */
function initNavbar() {
    const hamburger = document.querySelector('.nav-hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('mobile-open');
            hamburger.classList.toggle('active');
        });

        // Close mobile menu on link click
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('mobile-open');
                hamburger.classList.remove('active');
            });
        });
    }

    // Mark active page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
}

/* --- Ambient Space Music (Generated via Web Audio API) --- */
let audioCtx = null;
let ambientNodes = [];
let musicPlaying = false;

function createAmbientSound() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(audioCtx.destination);

    // Deep space drone — low frequency pad
    const drone1 = audioCtx.createOscillator();
    drone1.type = 'sine';
    drone1.frequency.value = 55;
    const droneGain1 = audioCtx.createGain();
    droneGain1.gain.value = 0.3;
    drone1.connect(droneGain1).connect(masterGain);

    // Subtle LFO modulating the drone
    const lfo1 = audioCtx.createOscillator();
    lfo1.type = 'sine';
    lfo1.frequency.value = 0.05;
    const lfoGain1 = audioCtx.createGain();
    lfoGain1.gain.value = 5;
    lfo1.connect(lfoGain1).connect(drone1.frequency);

    // Second harmonic layer
    const drone2 = audioCtx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 82.41;
    const droneGain2 = audioCtx.createGain();
    droneGain2.gain.value = 0.15;
    drone2.connect(droneGain2).connect(masterGain);

    // Ethereal high pad
    const pad = audioCtx.createOscillator();
    pad.type = 'sine';
    pad.frequency.value = 220;
    const padGain = audioCtx.createGain();
    padGain.gain.value = 0.05;
    const padFilter = audioCtx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 400;
    padFilter.Q.value = 2;
    pad.connect(padFilter).connect(padGain).connect(masterGain);

    // Slow LFO on pad
    const lfo2 = audioCtx.createOscillator();
    lfo2.type = 'sine';
    lfo2.frequency.value = 0.02;
    const lfoGain2 = audioCtx.createGain();
    lfoGain2.gain.value = 30;
    lfo2.connect(lfoGain2).connect(pad.frequency);

    // Noise layer for space texture
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 0.5;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.02;
    noise.connect(noiseFilter).connect(noiseGain).connect(masterGain);

    // Start all
    const now = audioCtx.currentTime;
    drone1.start(now);
    drone2.start(now);
    pad.start(now);
    lfo1.start(now);
    lfo2.start(now);
    noise.start(now);

    ambientNodes = [drone1, drone2, pad, lfo1, lfo2, noise];

    return masterGain;
}

function initMusicToggle() {
    const btn = document.querySelector('.music-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
        if (!musicPlaying) {
            if (!audioCtx) {
                createAmbientSound();
            } else {
                audioCtx.resume();
            }
            btn.classList.add('playing');
            musicPlaying = true;
        } else {
            if (audioCtx) {
                audioCtx.suspend();
            }
            btn.classList.remove('playing');
            musicPlaying = false;
        }
    });
}

/* --- Page enter animation --- */
function initPageEnter() {
    const content = document.querySelector('.page-content');
    if (content) {
        content.classList.add('page-enter');
    }
}
