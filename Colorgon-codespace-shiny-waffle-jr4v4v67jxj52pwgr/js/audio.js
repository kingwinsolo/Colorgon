// ==========================================
// COLORGON AUDIO ENGINE & SYNTHESIZER SFX
// ==========================================

let audioCtx = null;
let musicPlaying = true;
let musicHasStarted = false;

window.masterSoundMuted = false;
window.sfxVolume = 1.0;

const bgmPlaylist = [
    "Charting_the_Periphery.mp3",
    "Patterns_Of_A_Distant_Sun.mp3",
    "View_From_The_Far_Rim.mp3",
    "The_Quiet_Birth_Of_Suns.mp3"
];
let currentTrackIdx = 0;

function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
    return audioCtx;
}

// Global user interaction listener to unlock Web Audio Context & BGM instantly
['pointerdown', 'mousedown', 'keydown', 'touchstart', 'click'].forEach(evt => {
    document.addEventListener(evt, () => {
        let ctx = getAudioContext();
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        if (!musicHasStarted && !window.masterSoundMuted && musicPlaying) {
            const player = document.getElementById('bgm-player');
            if (player && player.paused) {
                player.play().then(() => { musicHasStarted = true; }).catch(() => {});
            }
        }
    }, { passive: true });
});

function initMP3AudioPlayer() {
    const player = document.getElementById('bgm-player');
    if (!player) return;
    player.volume = 0.35; 
    player.src = bgmPlaylist[currentTrackIdx];
    
    player.onended = () => {
        currentTrackIdx = (currentTrackIdx + 1) % bgmPlaylist.length;
        player.src = bgmPlaylist[currentTrackIdx];
        if (musicPlaying && !window.masterSoundMuted) player.play().catch(() => {});
    };
    player.onerror = () => {};
}

function updateMusicVolume(val) {
    const player = document.getElementById('bgm-player');
    if (player) player.volume = parseFloat(val);
    document.querySelectorAll('.music-vol-input').forEach(input => input.value = val);
}

function updateSFXVolume(val) {
    window.sfxVolume = parseFloat(val);
    document.querySelectorAll('.sfx-vol-input').forEach(input => input.value = val);
}

function toggleMasterMute() {
    window.masterSoundMuted = !window.masterSoundMuted;
    const player = document.getElementById('bgm-player');
    document.querySelectorAll('.master-mute-toggle-btn').forEach(btn => {
        btn.innerText = window.masterSoundMuted ? "Muted 🔇" : "Unmuted 🔊";
        btn.className = window.masterSoundMuted ? "setting-toggle-btn secondary-btn master-mute-toggle-btn" : "setting-toggle-btn highlight-btn master-mute-toggle-btn";
    });
    if (player) {
        if (window.masterSoundMuted) {
            player.pause();
        } else if (musicPlaying) {
            player.play().then(() => { musicHasStarted = true; }).catch(() => {});
        }
    }
}

const SFX = {
    select() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        [1200, 1800, 2400].forEach((freq, i) => {
            let osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + i * 0.02);
            gain.gain.setValueAtTime(0.12 * window.sfxVolume, now + i * 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.02 + 0.25);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now + i * 0.02); osc.stop(now + i * 0.02 + 0.25);
        });
    },
    rotate(isCW = true) {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;

        let startFreq = isCW ? 420 : 380;
        let peakFreq = isCW ? 680 : 620;

        let osc1 = ctx.createOscillator(), filter1 = ctx.createBiquadFilter(), gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(startFreq, now);
        osc1.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.12);

        filter1.type = 'bandpass';
        filter1.frequency.setValueAtTime(1200, now);
        filter1.Q.setValueAtTime(3.0, now);

        gain1.gain.setValueAtTime(0.22 * window.sfxVolume, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc1.connect(filter1); 
        filter1.connect(gain1); 
        gain1.connect(ctx.destination);
        osc1.start(now); 
        osc1.stop(now + 0.12);

        let snapTime = now + 0.14;
        let osc2 = ctx.createOscillator(), gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(220, snapTime);
        osc2.frequency.exponentialRampToValueAtTime(80, snapTime + 0.10);

        gain2.gain.setValueAtTime(0.35 * window.sfxVolume, snapTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, snapTime + 0.10);

        osc2.connect(gain2); 
        gain2.connect(ctx.destination);
        osc2.start(snapTime); 
        osc2.stop(snapTime + 0.10);
    },
    place() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let sub = ctx.createOscillator(), subGain = ctx.createGain();
        sub.type = 'sine'; sub.frequency.setValueAtTime(160, now); sub.frequency.exponentialRampToValueAtTime(40, now + 0.25);
        subGain.gain.setValueAtTime(0.5 * window.sfxVolume, now); subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        sub.connect(subGain); subGain.connect(ctx.destination);
        sub.start(now); sub.stop(now + 0.25);

        let ring = ctx.createOscillator(), ringGain = ctx.createGain();
        ring.type = 'triangle'; ring.frequency.setValueAtTime(987.77, now);
        ringGain.gain.setValueAtTime(0.2 * window.sfxVolume, now); ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        ring.connect(ringGain); ringGain.connect(ctx.destination);
        ring.start(now); ring.stop(now + 0.35);
    },
    tileDrop() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(210, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.09);
        gain.gain.setValueAtTime(0.4 * window.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.09);
    },
    turnTransition() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.22);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.2 * window.sfxVolume, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.22);
    },
    diceLand() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
        gain.gain.setValueAtTime(0.28 * window.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.12);
    },
    poisonPlace() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(120, now); osc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
        filter.type = 'bandpass'; filter.frequency.setValueAtTime(300, now);
        gain.gain.setValueAtTime(0.35 * window.sfxVolume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.3);
    },
    sideMatch(matchCount = 1) {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        
        const chimeFreqs = [659.25, 830.61, 987.77, 1318.51];
        let notesToPlay = Math.min(matchCount + 1, chimeFreqs.length);
        for (let i = 0; i < notesToPlay; i++) {
            let osc = ctx.createOscillator();
            let gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(chimeFreqs[i], now + i * 0.03);
            
            gain.gain.setValueAtTime(0.22 * window.sfxVolume, now + i * 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.45);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(now + i * 0.03);
            osc.stop(now + i * 0.03 + 0.5);
        }
    },
    cardAnnounce() { 
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return; 
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), gain = ctx.createGain(); 
        osc.type = 'sine'; osc.frequency.setValueAtTime(320, now); osc.frequency.exponentialRampToValueAtTime(640, now + 0.18); 
        gain.gain.setValueAtTime(0.25 * window.sfxVolume, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18); 
        osc.connect(gain); gain.connect(ctx.destination); 
        osc.start(now); osc.stop(now + 0.18); 
    },
    diceRoll() { 
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return; 
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), gain = ctx.createGain(); 
        osc.type = 'triangle'; osc.frequency.setValueAtTime(250 + Math.random() * 200, now); 
        gain.gain.setValueAtTime(0.18 * window.sfxVolume, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05); 
        osc.connect(gain); gain.connect(ctx.destination); 
        osc.start(now); osc.stop(now + 0.05); 
    },
    hover() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, now);
        gain.gain.setValueAtTime(0.04 * window.sfxVolume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.08);
    },
    wedgeStep(stepIndex = 0) {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        const freqs = [329.63, 392.00, 493.88, 587.33, 659.25, 783.99, 987.77, 1174.66];
        let freq = freqs[stepIndex % freqs.length];

        let pOsc = ctx.createOscillator(), pGain = ctx.createGain();
        pOsc.type = 'triangle'; pOsc.frequency.setValueAtTime(freq / 2, now);
        pGain.gain.setValueAtTime(0.3 * window.sfxVolume, now); pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        pOsc.connect(pGain); pGain.connect(ctx.destination);
        pOsc.start(now); pOsc.stop(now + 0.35);
    },
    colorgonChord(totalWedges = 6) {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        const chord = [261.63, 329.63, 392.00, 493.88, 523.25, 659.25, 783.99];
        let count = Math.min(totalWedges + 2, chord.length);
        for (let i = 0; i < count; i++) {
            let osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = (i % 2 === 0) ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(chord[i], now + i * 0.03);
            gain.gain.setValueAtTime(0.001, now + i * 0.03);
            gain.gain.exponentialRampToValueAtTime(0.18 * window.sfxVolume, now + i * 0.03 + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 1.4);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now + i * 0.03); osc.stop(now + i * 0.03 + 1.4);
        }
    },
    poisonMeltdown() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(220, now); osc.frequency.exponentialRampToValueAtTime(55, now + 0.6);
        filter.type = 'lowpass'; filter.frequency.setValueAtTime(800, now); filter.frequency.exponentialRampToValueAtTime(100, now + 0.6);
        gain.gain.setValueAtTime(0.4 * window.sfxVolume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.6);
    },
    victoryStinger() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        const grandChord = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        grandChord.forEach((f, idx) => {
            let osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.type = 'triangle'; osc.frequency.setValueAtTime(f, now + idx * 0.05);
            gain.gain.setValueAtTime(0.001, now + idx * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.25 * window.sfxVolume, now + idx * 0.05 + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 2.8);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now + idx * 0.05); osc.stop(now + idx * 0.05 + 2.8);
        });
    },
    flushStep() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.2);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.frequency.exponentialRampToValueAtTime(180, now + 0.2);

        gain.gain.setValueAtTime(0.35 * window.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.2);
    },
    cleanse() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        const notes = [659.25, 987.77, 1318.51];

        notes.forEach((freq, idx) => {
            let osc = ctx.createOscillator(), gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.09);

            gain.gain.setValueAtTime(0.45 * window.sfxVolume, now + idx * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.7);

            osc.connect(gain); gain.connect(ctx.destination);

            osc.start(now + idx * 0.09); osc.stop(now + idx * 0.09 + 0.7);
        });
    },
    powerDown() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

        gain.gain.setValueAtTime(0.5 * window.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain); gain.connect(ctx.destination);

        osc.start(now); osc.stop(now + 0.35);
    },
    infectWedge() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
        gain.gain.setValueAtTime(0.18 * window.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.12);
    },
    tileInfect() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
        gain.gain.setValueAtTime(0.22 * window.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.22);
    },
    orbLaunch() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.2);
        gain.gain.setValueAtTime(0.12 * window.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.2);
    },
    hudImpact() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;
        let osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);
        gain.gain.setValueAtTime(0.3 * window.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.28);
    },
    colorgonSuccess() {
        if (window.masterSoundMuted || window.sfxVolume <= 0) return;
        let ctx = getAudioContext(); if (!ctx) return;
        let now = ctx.currentTime;

        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            let osc = ctx.createOscillator();
            let gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);

            gain.gain.setValueAtTime(0.2 * window.sfxVolume, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.45);
        });
    }
};

window.SFX = SFX;
window.initMP3AudioPlayer = initMP3AudioPlayer;
window.updateMusicVolume = updateMusicVolume;
window.updateSFXVolume = updateSFXVolume;
window.toggleMasterMute = toggleMasterMute;

document.addEventListener('DOMContentLoaded', initMP3AudioPlayer);