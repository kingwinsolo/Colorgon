// ==========================================
// COLORGON CAMERA & VIEWPORT CONTROLLER
// ==========================================

window.panX = window.panX || 0;
window.panY = window.panY || 0;
window.currentBoardScale = window.currentBoardScale || 1.0;

let isPanning = false;
let startPanMouseX = 0, startPanMouseY = 0;
let startPanX = 0, startPanY = 0;

function updateMasterPanTransform() {
    let masterPan = document.getElementById('master-pan');
    if (!masterPan) return;
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let px = typeof window.panX !== 'undefined' ? window.panX : 0;
    let py = typeof window.panY !== 'undefined' ? window.panY : 0;
    let scale = typeof window.currentBoardScale !== 'undefined' ? window.currentBoardScale : 1.0;
    masterPan.setAttribute('transform', `translate(${cx + px}, ${cy + py}) scale(${scale}) translate(${-cx}, ${-cy})`);
}

function hexToScreen(q, r) {
    const size = 40;
    const w = size * 1.5;
    const h = size * Math.sqrt(3);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    const currentPx = (typeof window.panX !== 'undefined') ? window.panX : 0;
    const currentPy = (typeof window.panY !== 'undefined') ? window.panY : 0;
    const scale = (typeof window.currentBoardScale !== 'undefined') ? window.currentBoardScale : 1.0;

    const x = cx + currentPx + (w * q * scale);
    const y = cy + currentPy + (h * (r + q / 2) * scale);
    return { x, y };
}

function screenToHex(x, y) {
    const size = 40;
    const w = size * 1.5;
    const h = size * Math.sqrt(3);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    const currentPx = (typeof window.panX !== 'undefined') ? window.panX : 0;
    const currentPy = (typeof window.panY !== 'undefined') ? window.panY : 0;
    const scale = (typeof window.currentBoardScale !== 'undefined') ? window.currentBoardScale : 1.0;

    let relX = (x - cx - currentPx) / scale;
    let relY = (y - cy - currentPy) / scale;

    let q = relX / w;
    let r = (relY / h) - (q / 2);

    return hexRound(q, r);
}

function hexRound(q, r) {
    let s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    let qDiff = Math.abs(rq - q);
    let rDiff = Math.abs(rr - r);
    let sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
        rq = -rr - rs;
    } else if (rDiff > sDiff) {
        rr = -rq - rs;
    }
    return { q: rq, r: rr };
}

async function animateCameraTo(q, r, targetScale = 1.5, duration = 750) {
    const size = 40;
    const w = size * 1.5;
    const h = size * Math.sqrt(3);

    let targetPanX = -(w * q) * targetScale;
    let targetPanY = -(h * (r + q / 2)) * targetScale;

    let startPanX = window.panX || 0;
    let startPanY = window.panY || 0;
    let startScale = window.currentBoardScale || 1.0;

    let startTime = performance.now();

    return new Promise(resolve => {
        function step(now) {
            let elapsed = now - startTime;
            let progress = Math.min(elapsed / duration, 1.0);

            let ease = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            window.panX = startPanX + (targetPanX - startPanX) * ease;
            window.panY = startPanY + (targetPanY - startPanY) * ease;
            window.currentBoardScale = startScale + (targetScale - startScale) * ease;

            if (typeof renderBoard === 'function') renderBoard();

            if (progress < 1.0) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}

function initBoardPanAndZoom() {
    const board = document.getElementById('board');
    if (!board) return;

    board.addEventListener('wheel', (e) => {
        e.preventDefault();

        const oldScale = window.currentBoardScale || 1.0;
        const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
        const newScale = Math.min(Math.max(oldScale * zoomFactor, 0.4), 3.0);

        if (newScale === oldScale) return;

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const mouseRelX = e.clientX - cx;
        const mouseRelY = e.clientY - cy;

        const scaleRatio = newScale / oldScale;

        window.panX = mouseRelX * (1 - scaleRatio) + (window.panX || 0) * scaleRatio;
        window.panY = mouseRelY * (1 - scaleRatio) + (window.panY || 0) * scaleRatio;
        window.currentBoardScale = newScale;

        updateMasterPanTransform();
        if (typeof updateHoverPreview === 'function') updateHoverPreview();
    }, { passive: false });

    board.addEventListener('pointerdown', (e) => {
        let isBackgroundTarget = (e.target.id === 'board' || e.target.id === 'master-pan' || e.target.tagName === 'svg');
        if (e.button === 1 || (e.button === 0 && isBackgroundTarget)) {
            isPanning = true;
            startPanMouseX = e.clientX;
            startPanMouseY = e.clientY;
            startPanX = window.panX || 0;
            startPanY = window.panY || 0;
            board.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (!isPanning) return;
        window.panX = startPanX + (e.clientX - startPanMouseX);
        window.panY = startPanY + (e.clientY - startPanMouseY);
        updateMasterPanTransform();
        if (typeof updateHoverPreview === 'function') updateHoverPreview();
    });

    window.addEventListener('pointerup', () => {
        if (isPanning) {
            setTimeout(() => { isPanning = false; }, 50);
            const board = document.getElementById('board');
            if (board) board.style.cursor = 'default';
        }
    });
}

function zoomIn() {
    window.currentBoardScale = Math.min((window.currentBoardScale || 1.0) * 1.2, 3.0);
    updateMasterPanTransform();
    if (typeof updateHoverPreview === 'function') updateHoverPreview();
}

function zoomOut() {
    window.currentBoardScale = Math.max((window.currentBoardScale || 1.0) / 1.2, 0.4);
    updateMasterPanTransform();
    if (typeof updateHoverPreview === 'function') updateHoverPreview();
}

window.hexToScreen = hexToScreen;
window.screenToHex = screenToHex;
window.animateCameraTo = animateCameraTo;
window.updateMasterPanTransform = updateMasterPanTransform;
window.initBoardPanAndZoom = initBoardPanAndZoom;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;