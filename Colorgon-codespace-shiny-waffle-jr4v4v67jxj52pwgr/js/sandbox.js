// ==========================================
// COLORGON DEBUG SANDBOX & TEST HARNESS
// ==========================================

function safeRenderBoard() { if (typeof renderBoard === 'function') renderBoard(); }
function safeRenderHand() { if (typeof renderHand === 'function') renderHand(); }
function safeUpdateUI() { if (typeof updateUI === 'function') updateUI(); }

function ensureActiveMatch() {
    let overlay = document.getElementById('tutorial-overlay');
    if (overlay) overlay.classList.remove('visible');

    if (typeof confirmLocalSetup === 'function' && (!window.playersList || window.playersList.length === 0)) {
        confirmLocalSetup();
    }

    if (typeof activePlayerIdx === 'undefined' || activePlayerIdx < 0) window.activePlayerIdx = 0;
    if (typeof grid === 'undefined' || !grid) window.grid = new Map();
    if (typeof initBackgroundEngine === 'function') initBackgroundEngine();
}

async function prepareDebugTurnSequence() {
    if (typeof deselectHandTile === 'function') deselectHandTile();

    if (typeof showTurnAnnouncement === 'function') showTurnAnnouncement();
    await new Promise(res => setTimeout(res, 1200));

    if (typeof executeDiceRollAnimation === 'function') {
        await executeDiceRollAnimation();
    } else {
        if (typeof hasRolledDiceThisTurn !== 'undefined') hasRolledDiceThisTurn = true;
        if (typeof window.hasRolledDiceThisTurn !== 'undefined') window.hasRolledDiceThisTurn = true;
    }
}

// ==========================================
// DEBUG POISON BENCH FUNCTIONS
// ==========================================

function debugAddPoisonToBank(pIdx = 0) {
    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    let player = plist[pIdx];
    if (!player) return;

    if (!player.poisonBank) player.poisonBank = [];

    if (player.poisonBank.length < 3) {
        let testPoisonTile = ['b', 'r', 'r', 'r', 'b', 'b'];
        testPoisonTile.isPoison = true;
        player.poisonBank.push(testPoisonTile);

        if (typeof spawnSVGText === 'function') {
            spawnSVGText(0, 0, `+1 POISON BANK (${player.name}) 💀`, 22, "#55efc4", 1200);
        }
    } else {
        player.score = Math.max(0, (player.score || 0) - 2);
        if (typeof spawnSVGText === 'function') {
            spawnSVGText(0, 0, `BANK OVERFLOW! -2 PTS (${player.name}) ⚠️`, 24, "#ff7675", 1500);
        }
    }

    if (typeof renderPoisonBankUI === 'function') renderPoisonBankUI();
    if (typeof renderBoard === 'function') renderBoard();
}

function debugTestOverflowPenalty() {
    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    let curP = plist[0];
    if (!curP) return;

    curP.poisonBank = [
        ['r','r','r','r','r','r'],
        ['b','b','b','b','b','b'],
        ['y','y','y','y','y','y']
    ];
    curP.poisonBank.forEach(t => t.isPoison = true);

    debugAddPoisonToBank(0);
}

function debugTestEndTurnPenalty() {
    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    let pIdx = (typeof activePlayerIdx !== 'undefined') ? activePlayerIdx : 0;
    let curP = plist[pIdx];
    if (!curP) return;

    let bCount = (curP.poisonBank || []).length;
    let penalty = 0;

    if (bCount === 3) {
        penalty = 5;
    } else if (bCount > 0) {
        penalty = bCount * 1;
    }

    if (penalty > 0) {
        curP.score = Math.max(0, (curP.score || 0) - penalty);
        if (typeof spawnSVGText === 'function') {
            spawnSVGText(0, 0, `END TURN PENALTY: -${penalty} PTS! 💀`, 26, "#ff7675", 1600);
        }
    } else {
        if (typeof spawnSVGText === 'function') {
            spawnSVGText(0, 0, "NO POISON PENALTY ✨", 22, "#55efc4", 1200);
        }
    }

    if (typeof renderPoisonBankUI === 'function') renderPoisonBankUI();
    if (typeof renderBoard === 'function') renderBoard();
}

// ==========================================
// TEST SCENARIOS
// ==========================================

function debugLoadLowDieScenario() {
    ensureActiveMatch();
    if (typeof grid === 'undefined' || !grid) return;
    grid.clear();

    grid.set('0,0', ['r', 'r', 'r', 'r', 'r', 'r']);

    grid.set('1,-1', ['b', 'b', 'b', 'r', 'b', 'b']);
    grid.set('1,0',  ['b', 'b', 'b', 'b', 'r', 'b']);
    grid.set('0,-1', ['b', 'b', 'r', 'b', 'b', 'b']);
    grid.set('-1,0', ['b', 'r', 'b', 'b', 'b', 'b']);
    grid.set('-1,1', ['r', 'b', 'b', 'b', 'b', 'b']);

    let solutionTile = ['b', 'b', 'b', 'b', 'b', 'r'];
    
    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    if (plist[0]) {
        plist[0].hand = [solutionTile];
    }

    window.hasRolledDiceThisTurn = true;
    window.selectedHandIndex = 0;

    window.activeDice = [];
    window.inactiveDice = ['b', 'y'];
    window.toxicDice = ['r'];

    if (typeof spawnSVGText === 'function') {
        spawnSVGText(0, 0, "RED LOW DIE ACTIVE! PLACE AT (0,1) 🎲", 24, "#55efc4", 1800);
    }

    if (typeof renderHand === 'function') renderHand();
    if (typeof renderBoard === 'function') renderBoard();
    safeUpdateUI();
}

function debugLoadRegularColorgonScenario() {
    ensureActiveMatch();
    if (typeof grid === 'undefined' || !grid) return;
    grid.clear();

    window.hasRolledDiceThisTurn = true;
    window.activeDice = ['r'];
    window.inactiveDice = ['b'];
    window.toxicDice = ['y'];

    let r = 'r', b = 'b';

    grid.set('0,0', [r, r, r, r, r, r]);

    grid.set('1,-1', [b, b, b, r, b, b]);
    grid.set('1,0',  [b, b, b, b, r, b]);
    grid.set('-1,1', [r, b, b, b, b, b]);
    grid.set('-1,0', [b, r, b, b, b, b]);
    grid.set('0,-1', [b, b, r, b, b, b]);

    let validTile = [b, b, b, b, b, r];

    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    if (plist[0]) {
        plist[0].hand = [validTile];
    }

    window.selectedHandIndex = 0;

    if (typeof centerCameraOn === 'function') centerCameraOn(0, 0, 1.4);
    if (typeof renderBoard === 'function') renderBoard();
    if (typeof renderHand === 'function') renderHand();
    safeUpdateUI();

    if (typeof spawnSVGText === 'function') {
        spawnSVGText(0, 0, "READY! Place Hand Tile at (0,1) 🎯", 24, "#ff7675", 2200);
    }
}

function debugLoadIslandDetachment() {
    ensureActiveMatch();
    if (typeof grid === 'undefined' || !grid) return;
    grid.clear();

    grid.set('0,0', ['b', 'b', 'b', 'b', 'b', 'b']);
    grid.set('1,0', ['b', 'b', 'b', 'b', 'b', 'b']);
    grid.set('2,0', ['y', 'y', 'y', 'y', 'y', 'y']);

    if (typeof spawnSVGText === 'function') {
        spawnSVGText(0, 0, "ISLAND DETACHMENT SCENARIO LOADED 🏝️", 24, "#f1c40f", 1400);
    }

    if (typeof renderBoard === 'function') renderBoard();
    safeUpdateUI();
}

// ==========================================
// DROPDOWN TOGGLE HANDLER
// ==========================================

function toggleDebugMenu() {
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

// Global Exports
window.toggleDebugMenu = toggleDebugMenu;
window.debugAddPoisonToBank = debugAddPoisonToBank;
window.debugTestOverflowPenalty = debugTestOverflowPenalty;
window.debugTestEndTurnPenalty = debugTestEndTurnPenalty;
window.debugLoadLowDieScenario = debugLoadLowDieScenario;
window.debugLoadRegularColorgonScenario = debugLoadRegularColorgonScenario;
window.debugLoadIslandDetachment = debugLoadIslandDetachment;


// ==========================================
// TOP-LEVEL SVG TILE & WEDGE INSPECTOR OVERLAY
// ==========================================

window.showDebugOverlay = false;

function toggleDebugInspectorOverlay() {
    window.showDebugOverlay = !window.showDebugOverlay;
    
    let overlayLayer = document.getElementById('debug-overlay-layer');

    if (!window.showDebugOverlay) {
        if (overlayLayer) overlayLayer.remove();
        return;
    }

    attachDebugOverlayToTiles();
}

function attachDebugOverlayToTiles() {
    if (!window.showDebugOverlay || typeof grid === 'undefined' || !grid) return;

    // Find main SVG pan container
    let container = document.getElementById('master-pan') || 
                      document.getElementById('board-svg') || 
                      document.querySelector('svg g');

    if (!container) return;

    // Create dedicated top-level SVG overlay layer if missing
    let overlayLayer = document.getElementById('debug-overlay-layer');
    if (!overlayLayer) {
        overlayLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        overlayLayer.setAttribute('id', 'debug-overlay-layer');
        overlayLayer.setAttribute('pointer-events', 'none');
        container.appendChild(overlayLayer);
    }

    overlayLayer.innerHTML = ''; // Reset layer graphics

    const labelRadius = 26; 
    // SVG Angles for flat-topped tile wedge directions [0..5] (2 o'clock to 12 o'clock)
    const wedgeAnglesDeg = [-30, 30, 90, 150, 210, 270];

    grid.forEach((tile, key) => {
        let [q, r] = key.split(',').map(Number);
        let center = { x: 0, y: 0 };

        // Use engine hex coordinate math or fallback projection
        if (typeof hexToScreen === 'function') {
            center = hexToScreen(q, r);
        } else if (typeof hexToPixel === 'function') {
            center = hexToPixel(q, r);
        } else {
            const size = 52; 
            center.x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
            center.y = size * (3/2 * r);
        }

        let tileGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        tileGroup.setAttribute('transform', `translate(${center.x}, ${center.y})`);

        // 1. Center Coordinate Label (q,r)
        let coordText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        coordText.setAttribute('x', '0');
        coordText.setAttribute('y', '4');
        coordText.setAttribute('text-anchor', 'middle');
        coordText.setAttribute('fill', '#ffffff');
        coordText.setAttribute('font-size', '12px');
        coordText.setAttribute('font-weight', '900');
        coordText.setAttribute('stroke', '#000000');
        coordText.setAttribute('stroke-width', '2.5px');
        coordText.setAttribute('paint-order', 'stroke fill');
        coordText.textContent = key;
        tileGroup.appendChild(coordText);

        // 2. Perimeter Wedge Index & Color Labels [0..5]
        for (let dir = 0; dir < 6; dir++) {
            let rad = wedgeAnglesDeg[dir] * (Math.PI / 180);
            let lx = Math.cos(rad) * labelRadius;
            let ly = Math.sin(rad) * labelRadius;

            let colorCode = (tile[dir] || '?').toUpperCase();

            let labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('x', lx.toFixed(1));
            labelText.setAttribute('y', (ly + 3).toFixed(1));
            labelText.setAttribute('text-anchor', 'middle');
            labelText.setAttribute('fill', getOverlayColorHex(tile[dir]));
            labelText.setAttribute('font-size', '9.5px');
            labelText.setAttribute('font-weight', '900');
            labelText.setAttribute('stroke', '#000000');
            labelText.setAttribute('stroke-width', '2px');
            labelText.setAttribute('paint-order', 'stroke fill');
            labelText.textContent = `[${dir}]${colorCode}`;

            tileGroup.appendChild(labelText);
        }

        overlayLayer.appendChild(tileGroup);
    });
}

function getOverlayColorHex(c) {
    switch (c) {
        case 'r': return '#ff5252';
        case 'b': return '#40c4ff';
        case 'y': return '#ffd740';
        case 'k': return '#8196a8';
        case 'w': return '#ffffff';
        default: return '#2ecc71';
    }
}

// Global Exports
window.toggleDebugInspectorOverlay = toggleDebugInspectorOverlay;
window.attachDebugOverlayToTiles = attachDebugOverlayToTiles;