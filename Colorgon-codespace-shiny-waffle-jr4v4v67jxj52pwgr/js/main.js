// ==========================================
// COLORGON 2D SVG BOARD ENGINE
// ==========================================

let boardSvg, boardGroup, previewGroup, floatingTextContainer;
let mouseX = -999, mouseY = -999;
let hoverSocketKey = null;

const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;

// Safe fallback bindings
const activeColorMap = (typeof colorMap !== 'undefined') ? colorMap : { 'r': '#e74c3c', 'b': '#3498db', 'y': '#f1c40f', 'w': '#ffffff', 'k': '#2c3e50' };
const activeVibrantColorMap = (typeof vibrantColorMap !== 'undefined') ? vibrantColorMap : { 'r': '#ff0033', 'b': '#00e5ff', 'y': '#ffe600' };
const activeWedges = (typeof wedges !== 'undefined') ? wedges : [
    "M0,0 L20,-34.64 L40,0 Z", 
    "M0,0 L40,0 L20,34.64 Z", 
    "M0,0 L20,34.64 L-20,34.64 Z", 
    "M0,0 L-20,34.64 L-40,0 Z", 
    "M0,0 L-40,0 L-20,-34.64 Z", 
    "M0,0 L-20,-34.64 L20,-34.64 Z"
];
const activeNeighbors = (typeof neighbors !== 'undefined') ? neighbors : [
    { dq: 1, dr: -1, edge: 0, opp: 3 }, 
    { dq: 1, dr: 0, edge: 1, opp: 4 }, 
    { dq: 0, dr: 1, edge: 2, opp: 5 }, 
    { dq: -1, dr: 1, edge: 3, opp: 0 }, 
    { dq: -1, dr: 0, edge: 4, opp: 1 }, 
    { dq: 0, dr: -1, edge: 5, opp: 2 }
];

function showTurnAnnouncement() {
    let el = document.getElementById('turn-announcement');
    let centerContainer = document.getElementById('center-dice-container');
    if (centerContainer) { centerContainer.classList.remove('visible'); centerContainer.style.display = 'none'; }
    if (!el) return;

    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    let pIdx = (typeof activePlayerIdx !== 'undefined') ? activePlayerIdx : 0;
    let curP = plist[pIdx] || { name: 'Player 1', color: '#2ecc71', type: 'human' };

    let canRoll = (typeof hasRolledDiceThisTurn !== 'undefined') ? !hasRolledDiceThisTurn : true;
    let btnHTML = canRoll 
        ? `<button id="billboard-roll-btn" class="highlight-btn" onclick="triggerManualRoll()" style="margin-top: 14px; font-size: 0.85rem; padding: 8px 18px; position: relative; z-index: 700;">ROLL DICE 🎲</button>` 
        : '';

    let humanIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${curP.color || '#2ecc71'}" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

    el.style.borderColor = curP.color || '#2ecc71';
    el.innerHTML = `
        <div style="font-size:0.7rem; text-transform:uppercase; color:var(--text-dim, #a0aab0); display:flex; align-items:center; gap:6px; justify-content:center;">
            ${humanIcon}
            <span>${(curP.type || 'human').toUpperCase()} TURN</span>
        </div>
        <div>IT'S <span style="color:${curP.color || '#2ecc71'};">${(curP.name || 'PLAYER 1').toUpperCase()}</span>'S TURN!</div>
        ${btnHTML}
    `;

    if (typeof SFX !== 'undefined' && SFX.cardAnnounce) SFX.cardAnnounce();
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

function getActiveTile() {
    if (typeof hasRolledDiceThisTurn !== 'undefined' && !hasRolledDiceThisTurn) {
        return null;
    }
    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    let pIdx = (typeof activePlayerIdx !== 'undefined') ? activePlayerIdx : 0;
    let hIdx = (typeof selectedHandIndex !== 'undefined') ? selectedHandIndex : -1;
    if (hIdx !== -1 && plist && plist[pIdx] && plist[pIdx].hand && plist[pIdx].hand[hIdx]) {
        return plist[pIdx].hand[hIdx];
    }
    return null;
}

function deselectHandTile() {
    if (typeof selectedHandIndex !== 'undefined') window.selectedHandIndex = -1;
    if (typeof selectedHandIndex !== 'undefined') selectedHandIndex = -1;
    hoverSocketKey = null;
    let previewLayer = document.getElementById('preview-layer');
    if (previewLayer) previewLayer.innerHTML = '';
    if (typeof renderHand === 'function') renderHand();
}

function injectGlobalSvgDefs(svgElement) {
    if (svgElement.querySelector('defs#colorgon-reference-defs')) return;

    let defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.id = 'colorgon-reference-defs';

    let linGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    linGrad.id = 'wedgeLight';
    linGrad.setAttribute('x1', '0%'); linGrad.setAttribute('y1', '0%');
    linGrad.setAttribute('x2', '100%'); linGrad.setAttribute('y2', '100%');

    const stops = [
        { offset: '0%', color: '#ffffff', opacity: '0.28' },
        { offset: '45%', color: '#ffffff', opacity: '0.05' },
        { offset: '70%', color: '#000000', opacity: '0.10' },
        { offset: '100%', color: '#000000', opacity: '0.38' }
    ];
    stops.forEach(s => {
        let stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop.setAttribute('offset', s.offset);
        stop.setAttribute('stop-color', s.color);
        stop.setAttribute('stop-opacity', s.opacity);
        linGrad.appendChild(stop);
    });
    defs.appendChild(linGrad);

    let filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.id = 'colorgonBrightGlow';
    filter.setAttribute('x', '-50%'); filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%'); filter.setAttribute('height', '200%');

    let blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '6'); blur.setAttribute('result', 'blur');
    filter.appendChild(blur);

    let ct = document.createElementNS('http://www.w3.org/2000/svg', 'feComponentTransfer');
    ct.setAttribute('in', 'blur'); ct.setAttribute('result', 'glow1');
    let fa = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncA');
    fa.setAttribute('type', 'linear'); fa.setAttribute('slope', '2.5');
    ct.appendChild(fa); filter.appendChild(ct);

    let merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    let m1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode'); m1.setAttribute('in', 'glow1');
    let m2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode'); m2.setAttribute('in', 'SourceGraphic');
    merge.appendChild(m1); merge.appendChild(m2); filter.appendChild(merge);

    defs.appendChild(filter);
    svgElement.insertBefore(defs, svgElement.firstChild);
}

function createHexGroup(tile, q = null, r = null, isNewlyPlaced = false, isCenterLogoTile = false, isSecretBack = false) {
    let outerG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    outerG.style.pointerEvents = 'none';

    let innerG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    innerG.style.pointerEvents = 'none';

    if (isNewlyPlaced) innerG.classList.add('placed-tile-animated'); 

    if (isSecretBack) {
        let backHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        backHex.setAttribute('points', "20,-34.64 40,0 20,34.64 -20,34.64 -40,0 -20,-34.64");
        backHex.setAttribute('fill', '#12121a'); 
        backHex.setAttribute('stroke', '#2c3e50'); 
        backHex.setAttribute('stroke-width', '2');
        innerG.appendChild(backHex);

        let lockCap = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        lockCap.setAttribute('points', "4,-6.93 8,0 4,6.93 -4,6.93 -8,0 -4,-6.93");
        lockCap.setAttribute('fill', '#2c3e50');
        innerG.appendChild(lockCap);

        outerG.appendChild(innerG);
        return outerG;
    }

    let recColorgon = window.recentColorgonWedges || new Set();
    let recMatch = window.recentMatchWedges || new Set();
    let recFlush = window.activeFlushWedges || new Set();
    let actColor = window.activeColorgonColor || null;

    for (let i = 0; i < 6; i++) {
        let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', activeWedges[i]); 
        path.style.pointerEvents = 'none';

        let rawColorKey = tile[i];
        let wedgeKey = `${q},${r},${i}`;
        let isWedgeColorgonActive = q !== null && recColorgon.has(wedgeKey);
        let isWedgeFlushActive = q !== null && recFlush.has(wedgeKey);

        if (isWedgeFlushActive) {
            path.setAttribute('fill', '#00ff88');
            path.setAttribute('filter', 'url(#colorgonBrightGlow)');
            path.classList.add('wedge-colorgon-active');
            path.classList.add('colorgon-wedge-lifted');
        } else if (isWedgeColorgonActive) {
            let vibrantColor = activeVibrantColorMap[rawColorKey] || activeVibrantColorMap[actColor] || '#ffffff';
            path.setAttribute('fill', vibrantColor);
            path.setAttribute('filter', 'url(#colorgonBrightGlow)');
            path.classList.add('wedge-colorgon-active');
            path.classList.add('colorgon-wedge-lifted');
        } else if (q !== null && recMatch.has(wedgeKey)) {
            let vibrantColor = activeVibrantColorMap[rawColorKey] || '#ffffff';
            path.setAttribute('fill', vibrantColor);
            path.setAttribute('filter', 'url(#colorgonBrightGlow)');
            path.classList.add('wedge-match');
        } else {
            path.setAttribute('fill', activeColorMap[rawColorKey] || '#2c3e50');
        }

        if (rawColorKey === 'w') path.classList.add('wildcard-shimmer');
        path.setAttribute('stroke', '#111'); 
        innerG.appendChild(path);

        let lightPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        lightPath.setAttribute('d', activeWedges[i]); 
        lightPath.setAttribute('fill', 'url(#wedgeLight)'); 
        lightPath.style.pointerEvents = 'none';
        if (isWedgeColorgonActive || isWedgeFlushActive) lightPath.classList.add('colorgon-wedge-lifted');
        innerG.appendChild(lightPath);
    }

// 2. TOXIC OVERLAY: Render glowing border & subtle tint ON TOP of original wedge colors
// 2. TOXIC OVERLAY: Render glowing border with ultra-subtle transparent tint over original wedge colors
    if (tile && tile.isPoison) {
        let borderHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        borderHex.setAttribute('points', "20,-34.64 40,0 20,34.64 -20,34.64 -40,0 -20,-34.64");
        borderHex.setAttribute('fill', 'rgba(85, 239, 196, 0.06)'); // Reduced to 6% opacity for crystal-clear wedge visibility
        borderHex.setAttribute('stroke', '#55efc4');
        borderHex.setAttribute('stroke-width', '2.5');
        borderHex.setAttribute('filter', 'url(#colorgonBrightGlow)');
        borderHex.setAttribute('class', 'poison-tile-border');
        borderHex.style.pointerEvents = 'none';
        innerG.appendChild(borderHex);
    }

    let isDissolving = (q !== null && r !== null && window.dissolvingPoisonKey === `${q},${r}`);
    let isStrobeActive = (q !== null && r !== null && window.strobePoisonKey === `${q},${r}`);

    if (tile && (tile.isPoison || isDissolving || isStrobeActive)) {
        let poisonCap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        poisonCap.setAttribute('class', 'poison-skull-cap');
        
        let bgHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        bgHex.setAttribute('points', "8,-13.86 16,0 8,13.86 -8,13.86 -16,0 -8,-13.86");
        
        if (isStrobeActive) {
            bgHex.setAttribute('fill', '#ffffff');
            bgHex.setAttribute('stroke', '#00ff88');
            bgHex.setAttribute('stroke-width', '3');
            bgHex.setAttribute('filter', 'url(#colorgonBrightGlow)');
        } else {
            bgHex.setAttribute('fill', isDissolving ? '#00ff88' : '#0d1728');
            bgHex.setAttribute('stroke', isDissolving ? '#ffffff' : '#55efc4');
            bgHex.setAttribute('stroke-width', '2');
        }

        let skullText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        skullText.setAttribute('x', '0'); 
        skullText.setAttribute('y', '0');
        skullText.setAttribute('font-size', '14'); 
        skullText.setAttribute('text-anchor', 'middle');
        skullText.setAttribute('dominant-baseline', 'central');
        skullText.textContent = (isDissolving || isStrobeActive) ? '✨' : '💀';

        poisonCap.appendChild(bgHex); 
        poisonCap.appendChild(skullText);
        innerG.appendChild(poisonCap);
    } else {
        let centerCap = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        centerCap.setAttribute('points', "4,-6.93 8,0 4,6.93 -4,6.93 -8,0 -4,-6.93");
        centerCap.setAttribute('fill', '#0a0a12'); 
        centerCap.setAttribute('stroke', '#1d1d28'); 
        centerCap.setAttribute('stroke-width', '1');
        centerCap.style.pointerEvents = 'none'; 
        innerG.appendChild(centerCap);
    }
    
    outerG.appendChild(innerG);
    return outerG;
}

function isSpaceBlockedByBlack(sq, sr) {
    for (let n of activeNeighbors) {
        let nq = sq + n.dq, nr = sr + n.dr, nKey = `${nq},${nr}`;
        if (typeof grid !== 'undefined' && grid.has(nKey) && grid.get(nKey)[n.opp] === 'k') return true;
    }
    return false;
}

function init2DEngine() {
    const container = document.getElementById('board-container');
    if (!container) return;

    let webglCanvas = document.getElementById('webgl-canvas');
    if (webglCanvas) webglCanvas.remove();

    boardSvg = document.getElementById('board');
    if (!boardSvg) {
        boardSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        boardSvg.id = 'board';
        boardSvg.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:auto;';
        container.appendChild(boardSvg);
    }

    injectGlobalSvgDefs(boardSvg);

    let masterPan = document.getElementById('master-pan');
    if (!masterPan) {
        masterPan = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        masterPan.id = 'master-pan';
        boardSvg.appendChild(masterPan);
    }

    if (!document.getElementById('floating-text-container')) {
        floatingTextContainer = document.createElement('div');
        floatingTextContainer.id = 'floating-text-container';
        floatingTextContainer.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:10; overflow:hidden;';
        container.appendChild(floatingTextContainer);
    }

    window.addEventListener('resize', onWindowResize);
    boardSvg.addEventListener('pointermove', onPointerMove, { passive: true });
    boardSvg.addEventListener('pointerdown', onPointerClick);

    if (typeof initBackgroundEngine === 'function') initBackgroundEngine();
    if (typeof initBoardPanAndZoom === 'function') initBoardPanAndZoom();
    
    renderBoard();
}

function renderBoard() {
    const board = document.getElementById('board');
    if (!board) return;

    injectGlobalSvgDefs(board);

    let masterPan = document.getElementById('master-pan');
    if (!masterPan) {
        masterPan = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        masterPan.id = 'master-pan';
        board.appendChild(masterPan);
    }
    masterPan.innerHTML = '';

    const cx = window.innerWidth / 2, cy = window.innerHeight / 2, size = 40, w = size * 1.5, h = size * Math.sqrt(3);
    if (typeof updateMasterPanTransform === 'function') updateMasterPanTransform();

    let socketsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    let baseTilesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    let topActiveLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    let previewLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    previewLayer.id = 'preview-layer';
    previewLayer.style.pointerEvents = 'none';

    masterPan.appendChild(socketsLayer);
    masterPan.appendChild(baseTilesLayer);
    masterPan.appendChild(topActiveLayer);
    masterPan.appendChild(previewLayer);

    if (typeof grid === 'undefined' || !grid) return;

    let empty = new Set();
    let voidSpotKeys = new Set();

    grid.forEach((tile, k) => {
        let [q, r] = k.split(',').map(Number);
        activeNeighbors.forEach((n, idx) => {
            let nk = `${q + n.dq},${r + n.dr}`;
            if (!grid.has(nk)) {
                empty.add(nk);
                if (tile[idx] === 'k') voidSpotKeys.add(nk);
            }
        });
    });

    grid.forEach((tile, key) => {
        const [q, r] = key.split(',').map(Number);
        let x = cx + w * q, y = cy + h * (r + q/2);
        let isNewlyPlaced = (key === window.newlyPlacedKey);
        let isCenterLogoTile = (q === 0 && r === 0);

        let g = createHexGroup(tile, q, r, isNewlyPlaced, isCenterLogoTile);
        g.setAttribute('transform', `translate(${x}, ${y})`);
        if (isNewlyPlaced) topActiveLayer.appendChild(g);
        else baseTilesLayer.appendChild(g);
    });

    voidSpotKeys.forEach(k => {
        let [q, r] = k.split(',').map(Number);
        let x = cx + w * q, y = cy + h * (r + q/2);

        let g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${x}, ${y})`);

        let lip = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        lip.setAttribute('points', "20,-34.64 40,0 20,34.64 -20,34.64 -40,0 -20,-34.64");
        lip.setAttribute('fill', 'rgba(20, 10, 20, 0.95)'); 
        lip.setAttribute('stroke-width', '2.5'); 
        lip.classList.add('void-neon-pulse'); 
        g.appendChild(lip);

        let voidHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        voidHex.setAttribute('points', "17,-29.44 34,0 17,29.44 -17,29.44 -34,0 -17,-29.44");
        voidHex.setAttribute('fill', '#0c0408'); 
        voidHex.setAttribute('stroke', '#000000'); 
        voidHex.setAttribute('stroke-width', '1.5');
        g.appendChild(voidHex);

        let text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0'); text.setAttribute('y', '8'); 
        text.setAttribute('text-anchor', 'middle'); 
        text.setAttribute('fill', '#ff2a4b'); 
        text.setAttribute('font-size', '26'); 
        text.setAttribute('font-weight', '900'); 
        text.classList.add('void-neon-pulse'); 
        text.textContent = '✕';
        g.appendChild(text); 

        socketsLayer.appendChild(g);
    });

    let activeTile = getActiveTile();
    if (activeTile) {
        empty.forEach(k => {
            if (voidSpotKeys.has(k)) return;
            let [q, r] = k.split(',').map(Number);

            if (isSpaceBlockedByBlack(q, r)) return;
            if (typeof isValidPlacement === 'function' && !isValidPlacement(q, r, activeTile)) return;

            let x = cx + w * q, y = cy + h * (r + q/2);
            let hexSpot = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            hexSpot.setAttribute('points', "20,-34.64 40,0 20,34.64 -20,34.64 -40,0 -20,-34.64");
            hexSpot.setAttribute('transform', `translate(${x}, ${y})`);
            hexSpot.setAttribute('class', 'legal-socket-pulse');
            hexSpot.setAttribute('stroke-width', '1.5');
            hexSpot.style.cursor = 'pointer';
            hexSpot.style.pointerEvents = 'auto';

            hexSpot.onclick = (e) => {
                e.stopPropagation();
                if (typeof attemptPlacement === 'function') {
                    attemptPlacement(q, r);
                    deselectHandTile();
                    renderBoard();
                }
            };
            hexSpot.onpointerdown = (e) => { e.stopPropagation(); };

            socketsLayer.appendChild(hexSpot);
        });
    }

    updateHoverPreview();
    if (typeof renderPoisonBankUI === 'function') renderPoisonBankUI();
}

function updateHoverPreview() {
    let previewLayer = document.getElementById('preview-layer');
    if (!previewLayer) return;
    previewLayer.innerHTML = '';

    let activeTile = getActiveTile();
    if (!activeTile) {
        hoverSocketKey = null;
        return;
    }

    let hexCoords = (typeof screenToHex === 'function') ? screenToHex(mouseX, mouseY) : { q: 0, r: 0 };
    let targetKey = `${hexCoords.q},${hexCoords.r}`;

    if (typeof isValidPlacement !== 'function' || !isValidPlacement(hexCoords.q, hexCoords.r, activeTile)) {
        hoverSocketKey = null;
        return;
    }

    hoverSocketKey = targetKey;

    const cx = window.innerWidth / 2, cy = window.innerHeight / 2, size = 40;
    const w = size * 1.5, h = size * Math.sqrt(3);
    let x = cx + w * hexCoords.q;
    let y = cy + h * (hexCoords.r + hexCoords.q / 2);

    let previewTileG = createHexGroup(activeTile, hexCoords.q, hexCoords.r, false);
    previewTileG.setAttribute('transform', `translate(${x}, ${y})`);
    previewTileG.setAttribute('opacity', '0.85');
    previewTileG.style.pointerEvents = 'none';

    let innerG = previewTileG.querySelector('g');
    if (innerG) {
        innerG.classList.add('hover-preview-animated');
        innerG.style.pointerEvents = 'none';
    }

    previewLayer.appendChild(previewTileG);
}

async function rotateSelectedTileCW() {
    let hIdx = (typeof selectedHandIndex !== 'undefined') ? selectedHandIndex : -1;
    if (hIdx === -1 || window.isRotatingHandTile) return;

    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    let pIdx = (typeof activePlayerIdx !== 'undefined') ? activePlayerIdx : 0;
    let curP = plist[pIdx];
    if (!curP || !curP.hand || !curP.hand[hIdx]) return;

    window.isRotatingHandTile = true;

    if (typeof SFX !== 'undefined' && SFX.rotate) SFX.rotate(true); 
    trigger3DRotationAnim(true);

    await new Promise(res => setTimeout(res, 320));

    let tile = curP.hand[hIdx]; 
    tile.unshift(tile.pop());

    if (typeof renderHand === 'function') renderHand();
    renderBoard();

    window.isRotatingHandTile = false;
}

async function rotateSelectedTileCCW() {
    let hIdx = (typeof selectedHandIndex !== 'undefined') ? selectedHandIndex : -1;
    if (hIdx === -1 || window.isRotatingHandTile) return;

    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    let pIdx = (typeof activePlayerIdx !== 'undefined') ? activePlayerIdx : 0;
    let curP = plist[pIdx];
    if (!curP || !curP.hand || !curP.hand[hIdx]) return;

    window.isRotatingHandTile = true;

    if (typeof SFX !== 'undefined' && SFX.rotate) SFX.rotate(false); 
    trigger3DRotationAnim(false);

    await new Promise(res => setTimeout(res, 320));

    let tile = curP.hand[hIdx]; 
    tile.push(tile.shift());

    if (typeof renderHand === 'function') renderHand();
    renderBoard();

    window.isRotatingHandTile = false;
}

function trigger3DRotationAnim(isCW) {
    let selectedTile = document.querySelector('#hand .hand-tile.selected, .hand-tile.selected');
    if (selectedTile) {
        let animTarget = selectedTile.querySelector('g') || selectedTile;
        let animClass = isCW ? 'gear-snap-cw' : 'gear-snap-ccw';
        animTarget.classList.remove('gear-snap-cw', 'gear-snap-ccw');
        void animTarget.offsetWidth;
        animTarget.classList.add(animClass);
    }
}

async function triggerPoisonFlushAnim(q, r, flushWedgeKeys = [], pointsText = "+11 PTS!") {
    let pKey = `${q},${r}`;
    let poisonTile = (typeof grid !== 'undefined') ? grid.get(pKey) : null;

    let voidCoord = null;
    if (typeof activeNeighbors !== 'undefined') {
        for (let n of activeNeighbors) {
            let nq = q + n.dq, nr = r + n.dr;
            let nKey = `${nq},${nr}`;
            if (typeof grid !== 'undefined' && grid.has(nKey)) {
                let t = grid.get(nKey);
                if (t.includes('k')) { voidCoord = { q: nq, r: nr }; break; }
            }
        }
    }
    if (!voidCoord) voidCoord = { q: 1, r: -1 };

    if (typeof animateCameraTo === 'function') await animateCameraTo(voidCoord.q, voidCoord.r, 1.65, 450);

    const w = 60, h = 40 * Math.sqrt(3);
    let voidX = w * voidCoord.q;
    let voidY = h * (voidCoord.r + voidCoord.q / 2);

    let getWedgeWorldPos = (keyStr) => {
        let [wq, wr, wdir] = keyStr.split(',').map(Number);
        let hx = w * wq;
        let hy = h * (wr + wq / 2);
        let rad = (wdir * 60 + 30) * (Math.PI / 180);
        return { x: hx + 20 * Math.cos(rad), y: hy + 20 * Math.sin(rad) };
    };

    let sortedWedgeKeys = [...flushWedgeKeys].sort((a, b) => {
        let posA = getWedgeWorldPos(a);
        let posB = getWedgeWorldPos(b);
        let distA = Math.hypot(posA.x - voidX, posA.y - voidY);
        let distB = Math.hypot(posB.x - voidX, posB.y - voidY);
        return distA - distB;
    });

    try {
        window.activeFlushWedges = new Set();

        window.strobePoisonKey = `${voidCoord.q},${voidCoord.r}`;
        if (typeof renderBoard === 'function') renderBoard();
        await new Promise(resolve => setTimeout(resolve, 200));
        window.strobePoisonKey = null;

        if (typeof animateCameraTo === 'function') animateCameraTo(q, r, 1.7, 550);

for (let i = 0; i < sortedWedgeKeys.length; i++) {
            window.activeFlushWedges.add(sortedWedgeKeys[i]);
            if (typeof renderBoard === 'function') renderBoard();

            try {
                if (typeof SFX !== 'undefined' && typeof SFX.colorgonChord === 'function') {
                    SFX.colorgonChord(Math.min(i + 1, 6));
                }
            } catch (sfxErr) {}

            await new Promise(resolve => setTimeout(resolve, 160)); // Slowed down from 85ms
        }

        window.strobePoisonKey = pKey;
        if (typeof renderBoard === 'function') renderBoard();
        await new Promise(resolve => setTimeout(resolve, 350));
        window.strobePoisonKey = null;

        window.activeFlushColor = '#ffffff';
        sortedWedgeKeys.forEach(k => window.activeFlushWedges.add(k));
        if (poisonTile) poisonTile.isPoison = false;
        window.dissolvingPoisonKey = pKey;
        if (typeof renderBoard === 'function') renderBoard();

        if (typeof spawnSpringPoisonText === 'function') {
            spawnSpringPoisonText(q, r, "TILE CLEANSED ✨", "#ffffff");
        } else if (typeof spawnSVGText === 'function') {
            spawnSVGText(q, r, "TILE CLEANSED ✨", 36, "#ffffff", 1600);
        }

        await new Promise(resolve => setTimeout(resolve, 850));

        if (typeof spawnSVGText === 'function') {
            spawnSVGText(q, r - 0.4, pointsText, 42, "#55efc4", 2000);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        window.activeFlushColor = null;
        if (typeof renderBoard === 'function') renderBoard();

        await new Promise(resolve => setTimeout(resolve, 400));

    } catch (err) {
        console.error("Void poison flush execution error:", err);
        if (poisonTile) poisonTile.isPoison = false;
    } finally {
        window.dissolvingPoisonKey = null;
        window.strobePoisonKey = null;
        window.activeFlushColor = null;
        if (window.activeFlushWedges) window.activeFlushWedges.clear();

        if (typeof animateCameraTo === 'function') await animateCameraTo(0, 0, 1.25, 500);
        if (typeof renderBoard === 'function') renderBoard();
    }
}

function spawnSpringPoisonText(q, r, text, colorHex = '#55efc4') {
    if (!floatingTextContainer) return;

    let pos = (typeof hexToScreen === 'function') ? hexToScreen(q, r) : { x: 0, y: 0 };

    let toastNode = document.createElement('div');
    toastNode.style.cssText = `
        position: absolute;
        left: ${pos.x}px;
        top: ${pos.y}px;
        transform: translate(-50%, -50%) scale(0.2);
        font-family: 'Montserrat', sans-serif;
        font-weight: 900;
        font-size: 32px;
        color: ${colorHex};
        text-shadow: 0 0 16px rgba(85, 239, 196, 0.9), 0 4px 12px rgba(0,0,0,0.9);
        pointer-events: none;
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease-out;
        z-index: 100;
        opacity: 0;
    `;
    toastNode.textContent = text;
    floatingTextContainer.appendChild(toastNode);

    requestAnimationFrame(() => {
        toastNode.style.transform = `translate(-50%, -140%) scale(1.15)`;
        toastNode.style.opacity = '1';
    });

    setTimeout(() => {
        toastNode.style.transform = `translate(-50%, -180%) scale(0.9)`;
        toastNode.style.opacity = '0';
    }, 850);

    setTimeout(() => { if (toastNode.parentNode) toastNode.parentNode.removeChild(toastNode); }, 1250);
}

async function triggerDebugScenario(scenarioCallback) {
    deselectHandTile();

    showTurnAnnouncement();
    await new Promise(resolve => setTimeout(resolve, 1200));

    if (typeof executeDiceRollAnimation === 'function') {
        await executeDiceRollAnimation();
    } else {
        if (typeof hasRolledDiceThisTurn !== 'undefined') hasRolledDiceThisTurn = true;
        if (typeof window.hasRolledDiceThisTurn !== 'undefined') window.hasRolledDiceThisTurn = true;
    }

    if (typeof scenarioCallback === 'function') {
        scenarioCallback();
    }

    if (typeof renderHand === 'function') renderHand();
    renderBoard();
}

function onPointerMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
    updateHoverPreview();
}

function onPointerClick(event) {
    if (event.button !== 0) return;

    if (event.target.closest('button, .hand-tile, #sandbox-panel, #center-dice-container, #tutorial-overlay')) {
        return;
    }

    if (typeof screenToHex !== 'function') return;

    if (typeof hasRolledDiceThisTurn !== 'undefined' && !hasRolledDiceThisTurn) {
        let hexCoords = screenToHex(event.clientX, event.clientY);
        if (typeof spawnSVGText === 'function') {
            spawnSVGText(hexCoords.q, hexCoords.r, "ROLL DICE FIRST! 🎲", 24, "#f1c40f", 1000);
        }
        return;
    }

    let hexCoords = screenToHex(event.clientX, event.clientY);
    let activeTile = getActiveTile();

    if (activeTile && typeof isValidPlacement === 'function' && isValidPlacement(hexCoords.q, hexCoords.r, activeTile)) {
        if (typeof attemptPlacement === 'function') {
            attemptPlacement(hexCoords.q, hexCoords.r);
            deselectHandTile();
            renderBoard();
        }
    }
}

function spawnSVGText(q, r, text, fontSize = 28, colorHex = '#ffffff', duration = 800) {
    if (!floatingTextContainer) return;

    let pos = (typeof hexToScreen === 'function') ? hexToScreen(q, r) : { x: 0, y: 0 };

    let toastNode = document.createElement('div');
    toastNode.style.cssText = `
        position: absolute;
        left: ${pos.x}px;
        top: ${pos.y}px;
        transform: translate(-50%, -50%);
        font-family: 'Montserrat', sans-serif;
        font-weight: 900;
        font-size: ${fontSize}px;
        color: ${colorHex};
        text-shadow: 0 4px 10px rgba(0,0,0,0.8);
        pointer-events: none;
        transition: transform ${duration / 1000}s ease-out, opacity ${duration / 1000}s ease-out;
        z-index: 100;
    `;
    toastNode.textContent = text;
    floatingTextContainer.appendChild(toastNode);

    requestAnimationFrame(() => {
        toastNode.style.transform = `translate(-50%, -120%)`;
        toastNode.style.opacity = '0';
    });

    setTimeout(() => { if (toastNode.parentNode) toastNode.parentNode.removeChild(toastNode); }, duration);
}

function renderBackgroundEngine() {
    if (!bgCtx || !bgCanvas) return;
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

    bgCtx.globalCompositeOperation = 'lighter';
    if (window.ambientOrbs) {
        window.ambientOrbs.forEach(orb => {
            orb.x += orb.vx; orb.y += orb.vy;
            if (orb.x < -100 || orb.x > bgCanvas.width + 100) orb.vx *= -1;
            if (orb.y < -100 || orb.y > bgCanvas.height + 100) orb.vy *= -1;
            let grad = bgCtx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
            grad.addColorStop(0, `hsla(${orb.hue}, 90%, 65%, 0.18)`);
            grad.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
            bgCtx.fillStyle = grad; 
            bgCtx.beginPath(); bgCtx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2); bgCtx.fill();
        });
    }
    bgCtx.globalCompositeOperation = 'source-over';

    if (window.ambientStars) {
        window.ambientStars.forEach(s => {
            s.alpha += s.speed; 
            if (s.alpha > 1 || s.alpha < 0.1) s.speed *= -1;
            bgCtx.fillStyle = `rgba(255, 255, 255, ${Math.abs(s.alpha)})`; 
            bgCtx.beginPath(); bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2); bgCtx.fill();
        });
    }
    requestAnimationFrame(renderBackgroundEngine);
}

function onWindowResize() {
    if (bgCanvas) {
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
    }
    renderBoard();
}

function safeRenderBoard() { renderBoard(); }

window.createHexGroup = createHexGroup;
window.renderBoard = renderBoard;
window.safeRenderBoard = safeRenderBoard;
window.init3DEngine = init2DEngine;
window.trigger3DRotationAnim = trigger3DRotationAnim;
window.rotateSelectedTileCW = rotateSelectedTileCW;
window.rotateSelectedTileCCW = rotateSelectedTileCCW;
window.deselectHandTile = deselectHandTile;
window.triggerDebugScenario = triggerDebugScenario;
window.triggerPoisonFlushAnim = triggerPoisonFlushAnim;
window.showTurnAnnouncement = showTurnAnnouncement;
window.hideTurnAnnouncement = hideTurnAnnouncement;
window.spawnSVGText = spawnSVGText;

window.initBackgroundEngine = function() {
    if (!bgCanvas) return;
    bgCanvas.width = window.innerWidth; 
    bgCanvas.height = window.innerHeight;
    window.ambientStars = []; window.ambientOrbs = [];
    for (let i = 0; i < 75; i++) {
        window.ambientStars.push({ x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height, r: Math.random() * 1.5 + 0.5, alpha: Math.random(), speed: Math.random() * 0.02 + 0.005 });
    }
    for (let i = 0; i < 6; i++) {
        window.ambientOrbs.push({ x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height, r: Math.random() * 140 + 100, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, hue: Math.floor(Math.random() * 360) });
    }
    renderBackgroundEngine();
};

function renderPoisonBankUI() {
    let handContainer = document.getElementById('hand-container');
    if (!handContainer) return;

    let bankWrapper = document.getElementById('poison-bank-wrapper');
    if (!bankWrapper) {
        bankWrapper = document.createElement('div');
        bankWrapper.id = 'poison-bank-wrapper';
        handContainer.insertBefore(bankWrapper, handContainer.firstChild);
    }

    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    let pIdx = (typeof activePlayerIdx !== 'undefined') ? activePlayerIdx : 0;
    let curP = plist[pIdx] || { name: 'Player 1', poisonBank: [] };

    if (!curP.poisonBank) curP.poisonBank = [];
    let bankCount = curP.poisonBank.length;

    let slotsHTML = '';
    for (let i = 0; i < 3; i++) {
        let isFilled = i < bankCount;
        slotsHTML += `
            <div class="pb-slot ${isFilled ? 'filled' : 'empty'}" 
                 title="${isFilled ? 'Click to draw from Poison Bank into Hand' : 'Empty Poison Slot (Max 3)'}"
                 onclick="onPoisonSlotClick(${i})">
                ${isFilled ? '💀' : '•'}
            </div>
        `;
    }

    bankWrapper.innerHTML = `
        <div class="pb-label">POISON BANK [${bankCount}/3]</div>
        <div class="pb-slots-grid">${slotsHTML}</div>
    `;

    let lbCards = document.querySelectorAll('#leaderboard-list .lb-card-inner');
    lbCards.forEach((card, idx) => {
        let player = plist[idx];
        if (!player) return;

        let badge = card.querySelector('.lb-poison-badge');
        let pCount = (player.poisonBank || []).length;

        if (pCount > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'lb-poison-badge';
                card.insertBefore(badge, card.querySelector('.lb-score'));
            }
            badge.innerHTML = `💀 ${pCount}/3`;
        } else if (badge) {
            badge.remove();
        }
    });
}

function onPoisonSlotClick(slotIndex) {
    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    let pIdx = (typeof activePlayerIdx !== 'undefined') ? activePlayerIdx : 0;
    let curP = plist[pIdx];

    if (!curP || !curP.poisonBank || !curP.poisonBank[slotIndex]) return;

    if (typeof drawPoisonTileToHand === 'function') {
        drawPoisonTileToHand(slotIndex);
    }
}

function animateToxicOrbFlight(startQ, startR, targetElement) {
    return new Promise((resolve) => {
        let startPos = (typeof hexToScreen === 'function') ? hexToScreen(startQ, startR) : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        
        let canvas = document.getElementById('board-canvas') || document.querySelector('svg');
        let startX = startPos.x;
        let startY = startPos.y;

        if (canvas) {
            let rect = canvas.getBoundingClientRect();
            let cPanX = (typeof panX !== 'undefined') ? panX : 0;
            let cPanY = (typeof panY !== 'undefined') ? panY : 0;
            let cScale = (typeof currentBoardScale !== 'undefined') ? currentBoardScale : 1;
            
            startX = rect.left + rect.width / 2 + (startPos.x + cPanX) * cScale;
            startY = rect.top + rect.height / 2 + (startPos.y + cPanY) * cScale;
        }

        let endX = 220; 
        let endY = window.innerHeight - 80; 

        if (targetElement) {
            let tRect = targetElement.getBoundingClientRect();
            if (tRect.width > 0 && tRect.height > 0) {
                endX = tRect.left + tRect.width / 2;
                endY = tRect.top + tRect.height / 2;
            }
        }

        let orb = document.createElement('div');
        orb.className = 'toxic-flying-orb';
        orb.innerHTML = '💀';
        document.body.appendChild(orb);

        let startTime = performance.now();
        let duration = 550;

        function step(now) {
            let elapsed = now - startTime;
            let p = Math.min(1, elapsed / duration);
            
            let easeP = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
            let curX = startX + (endX - startX) * easeP;
            let arcHeight = -60 * Math.sin(p * Math.PI);
            let curY = startY + (endY - startY) * easeP + arcHeight;

            orb.style.left = `${curX - 12}px`;
            orb.style.top = `${curY - 12}px`;

            if (p < 1) {
                requestAnimationFrame(step);
            } else {
                orb.remove();
                if (targetElement) {
                    targetElement.classList.add('pb-slot-impact');
                    setTimeout(() => targetElement.classList.remove('pb-slot-impact'), 400);
                }
                resolve();
            }
        }

        requestAnimationFrame(step);
    });
}

window.renderPoisonBankUI = renderPoisonBankUI;
window.onPoisonSlotClick = onPoisonSlotClick;
window.animateToxicOrbFlight = animateToxicOrbFlight;

document.addEventListener('DOMContentLoaded', init2DEngine);
function spawnPoisonMistFX(q, r) {
    if (!floatingTextContainer) return;

    let pos = (typeof hexToScreen === 'function') ? hexToScreen(q, r) : { x: 0, y: 0 };
    const particleCount = 14;

    for (let i = 0; i < particleCount; i++) {
        let particle = document.createElement('div');
        
        let angle = Math.random() * Math.PI * 2;
        let distance = 25 + Math.random() * 45;
        let targetX = pos.x + Math.cos(angle) * distance;
        let targetY = pos.y + Math.sin(angle) * distance - (15 + Math.random() * 30); // Drifts outward & floats up
        
        let size = 22 + Math.random() * 26;
        let duration = 750 + Math.random() * 450;

        particle.style.cssText = `
            position: absolute;
            left: ${pos.x}px;
            top: ${pos.y}px;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(85, 239, 196, 0.85) 0%, rgba(0, 255, 136, 0.4) 55%, rgba(0,0,0,0) 80%);
            filter: blur(8px);
            pointer-events: none;
            transform: translate(-50%, -50%) scale(0.3);
            opacity: 0.95;
            transition: transform ${duration}ms cubic-bezier(0.15, 0.85, 0.35, 1), opacity ${duration}ms ease-out;
            z-index: 95;
        `;

        floatingTextContainer.appendChild(particle);

        requestAnimationFrame(() => {
            particle.style.transform = `translate(${targetX - pos.x - size / 2}px, ${targetY - pos.y - size / 2}px) scale(2.4)`;
            particle.style.opacity = '0';
        });

        setTimeout(() => {
            if (particle.parentNode) particle.parentNode.removeChild(particle);
        }, duration + 50);
    }
}

window.spawnPoisonMistFX = spawnPoisonMistFX;