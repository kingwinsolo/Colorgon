// ==========================================
// COLORGON UI & LOBBY SYSTEM
// ==========================================

if (!window.localSlotSetup || window.localSlotSetup.length === 0) {
    window.localSlotSetup = [
        { name: "Player 1", type: "human", color: "#2ecc71", difficulty: "normal" },
        { name: "Bot 1", type: "bot", color: "#e67e22", difficulty: "normal" }
    ];
}

function switchLobbyTab(tab) {
    ['host', 'join', 'local'].forEach(t => {
        let btn = document.getElementById(`tab-${t}`);
        let panel = document.getElementById(`panel-${t}`);
        if (btn) btn.classList.toggle('active', t === tab);
        if (panel) panel.style.display = (t === tab) ? 'flex' : 'none';
    });
    if (tab === 'local') renderLocalSetupSlots();
}

function renderLocalSetupSlots() {
    let container = document.getElementById('local-player-slots-list');
    if (!container || !window.localSlotSetup) return;
    container.innerHTML = localSlotSetup.map((slot, idx) => `
        <div class="lobby-slot-row">
            <div style="display:flex; gap:6px; align-items:center;">
                ${slot.type === 'human' ? getHumanIconSVG(slot.color) : getBotIconSVG(slot.color, slot.difficulty)}
                <input type="text" value="${slot.name}" onfocus="this.select()" onchange="localSlotSetup[${idx}].name=this.value" class="setup-input" style="padding:2px 6px; font-size:0.75rem; width:100px; min-height:28px;">
                <input type="color" value="${slot.color}" onchange="localSlotSetup[${idx}].color=this.value; renderLocalSetupSlots();" class="setup-input" style="width:32px; padding:1px; min-height:28px; height:28px;">
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
                ${slot.type === 'bot' ? `<span class="bot-diff-badge bot-diff-${slot.difficulty}" onclick="cycleBotDifficulty(${idx})">${slot.difficulty.toUpperCase()}</span>` : ''}
                ${localSlotSetup.length > 1 ? `<button class="remove-slot-btn" onclick="removeLocalPlayerSlot(${idx})">✕</button>` : ''}
            </div>
        </div>
    `).join('');
}

function getHumanIconSVG(colorHex = 'currentColor') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${colorHex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
}

function getBotIconSVG(colorHex = 'currentColor', difficulty = 'normal') {
    let glowClass = `bot-icon-glow-${difficulty}`;
    return `<svg class="${glowClass}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${colorHex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>`;
}

function cycleBotDifficulty(idx) {
    if (!window.localSlotSetup) return;
    let diffs = ['easy', 'normal', 'hard'];
    let cur = localSlotSetup[idx].difficulty || 'normal';
    let nextIdx = (diffs.indexOf(cur) + 1) % diffs.length;
    localSlotSetup[idx].difficulty = diffs[nextIdx];
    renderLocalSetupSlots();
}

function addLocalPlayerSlot(type) {
    if (!window.localSlotSetup) window.localSlotSetup = [];
    let count = localSlotSetup.length + 1;
    let palette = ['#2ecc71', '#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
    localSlotSetup.push({
        name: type === 'human' ? `Player ${count}` : `Bot ${count}`,
        type: type,
        color: palette[localSlotSetup.length % palette.length],
        difficulty: "normal"
    });
    renderLocalSetupSlots();
}

function removeLocalPlayerSlot(idx) {
    if (!window.localSlotSetup || localSlotSetup.length <= 1) return;
    localSlotSetup.splice(idx, 1);
    renderLocalSetupSlots();
}

function toggleSettingsModal() {
    let overlay = document.getElementById('settings-overlay');
    if (overlay) overlay.classList.toggle('visible');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

function showTurnAnnouncement() {
    let el = document.getElementById('turn-announcement');
    if (!el) return;

    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    if (!plist || plist.length === 0) return;

    let curP = plist[activePlayerIdx] || plist[0];
    let canRoll = !hasRolledDiceThisTurn;
    
    let btnHTML = canRoll 
        ? `<button id="billboard-roll-btn" class="highlight-btn" onclick="triggerManualRoll()" style="margin-top: 14px; font-size: 0.85rem; padding: 10px 20px; position: relative; z-index: 700; cursor: pointer;">ROLL DICE 🎲</button>` 
        : '';

    el.style.borderColor = curP.color || '#2ecc71';
    el.innerHTML = `
        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-dim); display:flex; align-items:center; gap:6px; justify-content:center; margin-bottom:4px;">
            ${curP.type === 'human' ? getHumanIconSVG(curP.color) : getBotIconSVG(curP.color, curP.difficulty)}
            <span>${(curP.type || 'HUMAN').toUpperCase()} TURN</span>
        </div>
        <div style="font-size: 1.4rem; font-weight: 900;">IT'S <span style="color:${curP.color || '#2ecc71'};">${curP.name.toUpperCase()}</span>'S TURN!</div>
        ${btnHTML}
    `;
    
    el.classList.remove('hide-billboard'); 
    el.classList.add('show-billboard');
}

function hideTurnAnnouncement() {
    let el = document.getElementById('turn-announcement');
    if (el) { 
        el.classList.remove('show-billboard'); 
        el.classList.add('hide-billboard'); 
    }
}

function renderHand() {
    let handDiv = document.getElementById('hand');
    if (!handDiv) return;
    
    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    if (!plist || plist.length === 0) return;

    handDiv.innerHTML = '';
    let curP = plist[activePlayerIdx] || plist[0];
    let label = document.getElementById('current-player-label');
    if (label) {
        label.innerText = `${curP.name}'s Hand`;
        label.style.color = curP.color || '#2ecc71';
    }

    if (!curP.hand) curP.hand = [];

    // Auto-select first tile if valid hand exists and selection is default
    if (selectedHandIndex === -1 && curP.hand.length > 0) {
        selectedHandIndex = 0;
    }

    curP.hand.forEach((tile, idx) => {
        let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '-50 -50 100 100');
        svg.setAttribute('class', `hand-tile ${selectedHandIndex === idx ? 'selected' : ''}`);
        svg.style.color = curP.color || '#2ecc71';
        
        svg.onclick = () => { 
            if (typeof SFX !== 'undefined' && SFX.select) SFX.select(); 
            selectedHandIndex = idx; 
            renderHand(); 
            if (typeof renderBoard === 'function') renderBoard(); 
        };

        if (typeof createHexGroup === 'function') {
            svg.appendChild(createHexGroup(tile));
        }
        handDiv.appendChild(svg);
    });
}

function updateUI() {
    let goalEl = document.getElementById('goal-display');
    let playsEl = document.getElementById('plays-left');
    let tilesEl = document.getElementById('tiles-played');

    if (goalEl && typeof winTargetValue !== 'undefined') goalEl.innerText = `${winTargetValue} Pts`;
    if (playsEl && typeof playsLeft !== 'undefined') playsEl.innerText = playsLeft; 
    if (tilesEl && typeof tilesPlayedThisTurn !== 'undefined') tilesEl.innerText = tilesPlayedThisTurn;

    let wrapR = document.getElementById('die-wrap-r');
    let wrapB = document.getElementById('die-wrap-b');
    let wrapY = document.getElementById('die-wrap-y');

    if (typeof lastDiceValues !== 'undefined') {
        if (wrapR && typeof getDieSVG === 'function') wrapR.innerHTML = getDieSVG(lastDiceValues.r, colorMap['r']);
        if (wrapB && typeof getDieSVG === 'function') wrapB.innerHTML = getDieSVG(lastDiceValues.b, colorMap['b']);
        if (wrapY && typeof getDieSVG === 'function') wrapY.innerHTML = getDieSVG(lastDiceValues.y, colorMap['y']);
    }

    // Dynamic class assignment for High (active), Low (toxic), and Mid (inactive) dice
    ['r', 'b', 'y'].forEach(c => {
        let wrap = document.getElementById('die-wrap-' + c);
        if (wrap) {
            if (typeof toxicDice !== 'undefined' && toxicDice.includes(c)) {
                wrap.className = 'die-container toxic-die';
            } else if (typeof activeDice !== 'undefined' && activeDice.includes(c)) {
                wrap.className = 'die-container active-die';
            } else {
                wrap.className = 'die-container inactive-die';
            }
        }
    });

    let lb = document.getElementById('leaderboard-list');
    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    if (lb && plist) {
        lb.innerHTML = plist.map((p, idx) => 
            `<div class="lb-card-inner ${idx === activePlayerIdx ? 'active' : ''}" style="color:${p.color};">
                <span class="lb-name" style="color:${p.color};">
                    ${p.type === 'human' ? getHumanIconSVG(p.color) : getBotIconSVG(p.color, p.difficulty)}
                    ${p.name}
                </span>
                <span class="lb-score">${p.score} Pts</span>
            </div>`
        ).join('');
    }
}

function openPlayerSetup() {
    let overlay = document.getElementById('tutorial-overlay');
    if (overlay) overlay.classList.add('visible');
    switchLobbyTab('local');
}

window.toggleSettingsModal = toggleSettingsModal;
window.toggleFullscreen = toggleFullscreen;
window.renderHand = renderHand;
window.updateUI = updateUI;

// Purge orphan debug elements dynamically injected by sandbox.js
function cleanupLegacyDebugPanels() {
    let legacyPanels = document.querySelectorAll('.poison-test-bench, #sandbox-panel:not(:has(.debug-toggle-btn))');
    legacyPanels.forEach(el => el.remove());
}

function toggleDebugMenu() {
    cleanupLegacyDebugPanels();
    let menu = document.getElementById('sandbox-tools-menu');
    let arrow = document.getElementById('debug-arrow');

    if (!menu) return;

    let isVisible = menu.classList.contains('visible');
    if (isVisible) {
        menu.classList.remove('visible');
        menu.style.setProperty('display', 'none', 'important');
        if (arrow) arrow.innerText = '▼';
    } else {
        menu.classList.add('visible');
        menu.style.setProperty('display', 'flex', 'important');
        if (arrow) arrow.innerText = '▲';
    }
}

// Force immediate cleanup and initial hidden state on load
function initDebugMenuState() {
    cleanupLegacyDebugPanels();
    let menu = document.getElementById('sandbox-tools-menu');
    if (menu) {
        menu.classList.remove('visible');
        menu.style.setProperty('display', 'none', 'important');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDebugMenuState);
} else {
    initDebugMenuState();
}

window.toggleDebugMenu = toggleDebugMenu;