// Global tracking set to prevent re-scoring already completed Colorgons
if (!window.completedColorgonSignatures) {
    window.completedColorgonSignatures = new Set();
}

// ==========================================
// COLORGON GAME ENGINE & SCORING LOGIC
// ==========================================

window.activeFlushWedges = window.activeFlushWedges || new Set();
window.recentColorgonWedges = window.recentColorgonWedges || new Set();
window.dissolvingPoisonKey = null;

(function syncNeighborsMap() {
    const faceNeighbors = [
        { dq:  1, dr: -1, opp: 3, edge: 0 },
        { dq:  1, dr:  0, opp: 4, edge: 1 },
        { dq:  0, dr:  1, opp: 5, edge: 2 },
        { dq: -1, dr:  1, opp: 0, edge: 3 },
        { dq: -1, dr:  0, opp: 1, edge: 4 },
        { dq:  0, dr: -1, opp: 2, edge: 5 }
    ];

    if (typeof window.neighbors !== 'undefined' && Array.isArray(window.neighbors)) {
        window.neighbors.length = 0;
        window.neighbors.push(...faceNeighbors);
    } else {
        window.neighbors = faceNeighbors;
    }
})();

function confirmLocalSetup() {
    myPlayerId = 0;
    winConditionType = document.getElementById('local-win-condition-type') ? document.getElementById('local-win-condition-type').value : 'score';
    winTargetValue = 100; targetHandSize = 3;
    let slots = (window.localSlotSetup && window.localSlotSetup.length > 0) ? window.localSlotSetup : [
        { name: "Player 1", type: "human", color: "#2ecc71", difficulty: "normal" },
        { name: "Bot 1", type: "bot", color: "#e67e22", difficulty: "normal" }
    ];
    playersList = slots.map((slot, i) => ({
        id: i, name: slot.name, score: 0, hand: [], color: slot.color, type: slot.type, difficulty: slot.difficulty || 'normal', poisonBank: []
    }));
    confirmPlayerSetup();
}

function confirmPlayerSetup() {
    let overlay = document.getElementById('tutorial-overlay');
    if (overlay) overlay.classList.remove('visible');
    if (typeof grid !== 'undefined' && grid) grid.clear(); 
    placeTile(0, 0, generateStarterTile());
    
    totalTilesPlaced = 0; isGameOver = false; panX = 0; panY = 0; currentBoardScale = 1.0; activePlayerIdx = 0; 
    if (typeof initBackgroundEngine === 'function') initBackgroundEngine();
    safeRenderBoard(); safeRenderHand(); safeUpdateUI(); 
    startTurnLogic();
}

function startTurnLogic() {
    let curP = playersList[activePlayerIdx];
    if (curP) {
        if (!curP.hand) curP.hand = [];
        while (curP.hand.length < targetHandSize) curP.hand.push(generateRandomTile());
    }

    hasRolledDiceThisTurn = false;
    playsLeft = (totalTilesPlaced === 0) ? 2 : 1; 
    tilesPlayedThisTurn = 0; 
    selectedHandIndex = (curP && curP.hand && curP.hand.length > 0) ? 0 : -1;

    if (typeof SFX !== 'undefined') {
        if (typeof SFX.turnTransition === 'function') SFX.turnTransition();
        else if (typeof SFX.cardAnnounce === 'function') SFX.cardAnnounce();
    }

    safeRenderHand(); safeUpdateUI(); 
    if (typeof showTurnAnnouncement === 'function') showTurnAnnouncement();

    if (curP && curP.type === 'bot' && typeof executeBotTurnSequence === 'function') {
        setTimeout(() => { executeBotTurnSequence(); }, 1000);
    }
}

function triggerManualRoll() {
    if (hasRolledDiceThisTurn || isGameOver) return;
    executeDiceRollAnimation();
}

async function executeDiceRollAnimation() {
    isRolling = true; 
    if (typeof hideTurnAnnouncement === 'function') hideTurnAnnouncement(); 

    let centerContainer = document.getElementById('center-dice-container');
    let dieR = document.getElementById('center-die-r');
    let dieB = document.getElementById('center-die-b');
    let dieY = document.getElementById('center-die-y');

    let wrappers = document.querySelectorAll('.center-die-wrapper');

    if (centerContainer) { 
        centerContainer.classList.remove('fly-to-panel');
        centerContainer.style.display = 'flex'; 
        centerContainer.classList.add('visible'); 
    }

    wrappers.forEach(w => w.classList.add('rolling'));

    let rollInterval = setInterval(() => {
        if (typeof SFX !== 'undefined' && typeof SFX.diceRoll === 'function') SFX.diceRoll();
        if (dieR) dieR.innerHTML = getDieSVG(Math.ceil(Math.random() * 6), colorMap['r']);
        if (dieB) dieB.innerHTML = getDieSVG(Math.ceil(Math.random() * 6), colorMap['b']);
        if (dieY) dieY.innerHTML = getDieSVG(Math.ceil(Math.random() * 6), colorMap['y']);
    }, 60);

    const sleep = ms => new Promise(res => setTimeout(res, ms));
    await sleep(1100); 
    clearInterval(rollInterval);

    let r = Math.ceil(Math.random() * 6);
    let b = Math.ceil(Math.random() * 6);
    let y = Math.ceil(Math.random() * 6);
    let vals = [r, b, y].sort((a, b) => b - a);
    let high = vals[0], low = vals[2];
    
    activeDice = []; inactiveDice = []; toxicDice = [];
    let mapDice = (val, colorStr) => {
        if (val === high) activeDice.push(colorStr);
        else if (val === low) toxicDice.push(colorStr);
        else inactiveDice.push(colorStr);
    };
    mapDice(r, 'r'); mapDice(b, 'b'); mapDice(y, 'y');
    
    diceActive = activeDice; 
    lastDiceValues = { r, b, y };

    wrappers.forEach(w => {
        w.classList.remove('rolling');
        w.classList.add('settled');
    });

    if (dieR) dieR.innerHTML = getDieSVG(r, colorMap['r']);
    if (dieB) dieB.innerHTML = getDieSVG(b, colorMap['b']);
    if (dieY) dieY.innerHTML = getDieSVG(y, colorMap['y']);

    if (typeof SFX !== 'undefined') {
        if (typeof SFX.diceLand === 'function') SFX.diceLand();
        else if (typeof SFX.place === 'function') SFX.place();
    }

    await sleep(1600); // Readout hold

    wrappers.forEach(w => w.classList.remove('settled'));
    
    // Trigger swoosh flight animation
    if (centerContainer) centerContainer.classList.add('fly-to-panel');
    if (typeof SFX !== 'undefined' && typeof SFX.turnTransition === 'function') SFX.turnTransition();

    // 1. Wait for swoosh trajectory to reach the HUD panel (~380ms)
    await sleep(380);

    // 2. INSTANT UPDATE: Refresh HUD right panel right on impact!
    hasRolledDiceThisTurn = true; 
    safeUpdateUI(); 
    if (typeof SFX !== 'undefined' && typeof SFX.hudImpact === 'function') SFX.hudImpact();

    // 3. Complete remaining travel transition before cleaning up center container
    await sleep(320);

    if (centerContainer) { 
        centerContainer.classList.remove('visible', 'fly-to-panel'); 
        centerContainer.style.display = 'none'; 
    }

    isRolling = false; 
    
    let curP = playersList[activePlayerIdx];
    if (curP && curP.hand && curP.hand.length > 0 && selectedHandIndex === -1) {
        selectedHandIndex = 0;
    }

    safeRenderHand(); 
    safeRenderBoard();
}

function isValidPlacement(q, r, tile) {
    let key = `${q},${r}`;
    if (grid.has(key)) return false;

    let hasAtLeastOneMatch = false;

    for (let i = 0; i < 6; i++) {
        let nInfo = neighbors[i];
        let nKey = `${q + nInfo.dq},${r + nInfo.dr}`;

        if (grid.has(nKey)) {
            let neighborTile = grid.get(nKey);
            let myWedge = tile[i];
            let neighborWedge = neighborTile[nInfo.opp];

            if (myWedge === 'k' || neighborWedge === 'k') return false;

            if (myWedge === neighborWedge || myWedge === 'w' || neighborWedge === 'w') {
                hasAtLeastOneMatch = true;
            }
        }
    }

    return hasAtLeastOneMatch;
}
window.isValidPlacement = isValidPlacement;

function hasLegalMoves(player) {
    if (!player || !player.hand || player.hand.length === 0) return false;
    let emptySpots = new Set();
    neighbors.forEach(n => grid.forEach((_, k) => {
        let [q, r] = k.split(',').map(Number);
        let nk = `${q + n.dq},${r + n.dr}`;
        if (!grid.has(nk)) emptySpots.add(nk);
    }));

    for (let tile of player.hand) {
        for (let i = 0; i < 6; i++) {
            let rotated = [...tile];
            for (let j = 0; j < i; j++) rotated.unshift(rotated.pop());
            for (let spot of emptySpots) {
                let [q, r] = spot.split(',').map(Number);
                if (isValidPlacement(q, r, rotated)) return true;
            }
        }
    }
    return false;
}

async function executeVoidFlush(colorgonWedges, poisonTileKey) {
    try {
        let poisonTile = grid.get(poisonTileKey);
        if (!poisonTile) return;

        let [pQ, pR] = poisonTileKey.split(',').map(Number);

        colorgonWedges.sort((a, b) => {
            let distA = Math.hypot(a.q - pQ, a.r - pR);
            let distB = Math.hypot(b.q - pQ, b.r - pR);
            return distA - distB;
        });

        if (typeof SFX !== 'undefined' && typeof SFX.powerDown === 'function') SFX.powerDown();

        for (let i = 0; i < colorgonWedges.length; i++) {
            let w = colorgonWedges[i];
            window.activeFlushWedges.add(`${w.q},${w.r},${w.dir}`);
            if (typeof SFX !== 'undefined' && typeof SFX.flushStep === 'function') SFX.flushStep();
            safeRenderBoard();
            await new Promise(res => setTimeout(res, 220));
        }

        window.dissolvingPoisonKey = poisonTileKey;
        safeRenderBoard();

        if (typeof spawnSVGText === 'function') {
            spawnSVGText(pQ, pR, '💀✨', 48, '#55efc4', 1500);
        }

        if (typeof SFX !== 'undefined' && typeof SFX.cleanse === 'function') SFX.cleanse();

        await new Promise(res => setTimeout(res, 1200));

        poisonTile.isPoison = false;
        window.dissolvingPoisonKey = null;
        window.activeFlushWedges.clear();
        safeRenderBoard();
    } catch (err) {
        console.error("Void flush execution error:", err);
        window.dissolvingPoisonKey = null;
        window.activeFlushWedges.clear();
        safeRenderBoard();
    }
}

// ==========================================
// UPDATED SCORING & POISON SCORING ENGINE
// ==========================================

function calculateEdgeMatches(q, r, tile) {
    let totalMatches = 0;
    let poisonMatches = 0;

    if (typeof recentMatchWedges !== 'undefined' && recentMatchWedges) {
        recentMatchWedges.clear();
    }

    let nList = window.neighbors || (typeof neighbors !== 'undefined' ? neighbors : []);

    nList.forEach((n, dirIdx) => {
        let nKey = `${q + n.dq},${r + n.dr}`;
        if (typeof grid !== 'undefined' && grid.has(nKey)) {
            let nTile = grid.get(nKey);
            let edgeIdx = (n.edge !== undefined) ? n.edge : dirIdx;
            let myColor = tile[edgeIdx];
            let nColor = nTile[n.opp];

            let isMatch = (myColor === nColor && myColor !== 'k') || 
                          (myColor === 'w' && ['r','y','b','w'].includes(nColor)) || 
                          (nColor === 'w' && ['r','y','b','w'].includes(myColor));

            if (isMatch) {
                totalMatches += 1;

                // Check if the adjacent tile is a poison tile
                if (nTile.isPoison) {
                    poisonMatches += 1;
                }

                if (typeof recentMatchWedges !== 'undefined' && recentMatchWedges) {
                    recentMatchWedges.add(`${q},${r},${edgeIdx}`);
                    recentMatchWedges.add(`${nKey},${n.opp}`);
                }
            }
        }
    });

    return { totalMatches, poisonMatches };
}

// ==========================================
// COLORGON DETECTION (ALLOWS TILE REUSE)
// ==========================================

function checkForEnclosedColorgons(startQ, startR, startTile) {
    let scoredShapes = [];
    let { highArr, midArr, lowArr } = getDiceStateCategories();

    let colorQueue = [
        ...highArr.map(c => ({ color: c, isHigh: true, isLow: false })),
        ...lowArr.map(c => ({ color: c, isHigh: false, isLow: true })),
        ...midArr.map(c => ({ color: c, isHigh: false, isLow: false }))
    ];

    let seedTiles = [{ q: startQ, r: startR, tile: startTile }];
    let nList = window.neighbors || neighbors;

    nList.forEach(n => {
        let nQ = startQ + n.dq;
        let nR = startR + n.dr;
        let nKey = `${nQ},${nR}`;
        if (grid.has(nKey)) {
            seedTiles.push({ q: nQ, r: nR, tile: grid.get(nKey) });
        }
    });

    for (let item of colorQueue) {
        let color = item.color;
        let isHigh = item.isHigh;
        let isLow = item.isLow;
        let globalVisited = new Set();

        for (let seed of seedTiles) {
            let startWedges = [];
            for (let dir = 0; dir < 6; dir++) {
                if (seed.tile[dir] === color || seed.tile[dir] === 'w') {
                    startWedges.push(dir);
                }
            }

            for (let startDir of startWedges) {
                let startKey = `${seed.q},${seed.r},${startDir}`;
                if (globalVisited.has(startKey)) continue;

                let queue = [{ q: seed.q, r: seed.r, dir: startDir }];
                let visited = new Set([startKey]);
                let component = [];
                let canBeExpanded = false;
                let touchingPoisonKey = null;
                let containsBlackVoid = false;

                while (queue.length > 0) {
                    let curr = queue.shift();
                    component.push(curr);
                    globalVisited.add(`${curr.q},${curr.r},${curr.dir}`);

                    let tile = grid.get(`${curr.q},${curr.r}`);
                    if (tile && tile.isPoison) touchingPoisonKey = `${curr.q},${curr.r}`;

                    let leftDir = (curr.dir + 5) % 6;
                    let rightDir = (curr.dir + 1) % 6;

                    // Strictly check if internal adjacent wedges on the same tile are Black Voids ('k')
                    if (tile[leftDir] === 'k' || tile[rightDir] === 'k') {
                        containsBlackVoid = true;
                    }

                    if (tile[leftDir] === color || tile[leftDir] === 'w') {
                        let k = `${curr.q},${curr.r},${leftDir}`;
                        if (!visited.has(k)) {
                            visited.add(k);
                            queue.push({ q: curr.q, r: curr.r, dir: leftDir });
                        }
                    }

                    if (tile[rightDir] === color || tile[rightDir] === 'w') {
                        let k = `${curr.q},${curr.r},${rightDir}`;
                        if (!visited.has(k)) {
                            visited.add(k);
                            queue.push({ q: curr.q, r: curr.r, dir: rightDir });
                        }
                    }

                    let nInfo = nList[curr.dir];
                    let nQ = curr.q + nInfo.dq;
                    let nR = curr.r + nInfo.dr;
                    let nKey = `${nQ},${nR}`;

                    if (grid.has(nKey)) {
                        let nTile = grid.get(nKey);
                        if (nTile.isPoison) touchingPoisonKey = nKey;

                        // Strictly check if facing edge on adjacent tile is a Black Void ('k')
                        if (nTile[nInfo.opp] === 'k') {
                            containsBlackVoid = true;
                        }

                        if (nTile[nInfo.opp] === color || nTile[nInfo.opp] === 'w') {
                            let k = `${nQ},${nR},${nInfo.opp}`;
                            if (!visited.has(k)) {
                                visited.add(k);
                                queue.push({ q: nQ, r: nR, dir: nInfo.opp });
                            }
                        }
                    } else {
                        if (isSocketVoid(nQ, nR)) {
                            containsBlackVoid = true;
                        } else {
                            canBeExpanded = true;
                        }
                    }
                }

                if (!canBeExpanded && component.length >= 4) {
                    let signature = component.map(w => `${w.q},${w.r},${w.dir}`).sort().join('|');

                    if (window.completedColorgonSignatures && window.completedColorgonSignatures.has(signature)) {
                        continue;
                    }

                    if (!scoredShapes.some(s => s.signature === signature)) {
                        let uniqueTileKeys = [...new Set(component.map(w => `${w.q},${w.r}`))];
                        let poisonTileCount = uniqueTileKeys.filter(k => grid.has(k) && grid.get(k).isPoison).length;

                        scoredShapes.push({
                            signature,
                            color,
                            wedges: component,
                            isHigh,
                            isLow,
                            poisonKey: touchingPoisonKey,
                            containsBlackVoid,
                            poisonTileCount
                        });
                    }
                }
            }
        }
    }

    return scoredShapes;
}

// ==========================================
// PLACEMENT & TURN COMPLETION SEQUENCING
// ==========================================

async function attemptPlacement(q, r) {
    if (selectedHandIndex === -1 || !hasRolledDiceThisTurn || isAnimating || isRolling) return;
    
    isAnimating = true; 
    let curP = playersList[activePlayerIdx];
    let tile = curP.hand[selectedHandIndex];
    if (!tile || !isValidPlacement(q, r, tile)) {
        isAnimating = false;
        return;
    }

    activePreviewSocketKey = null;
    let placedKeyStr = `${q},${r}`;
    window.newlyPlacedKey = placedKeyStr;
    placeTile(q, r, tile);

    if (tile && tile.isPoison) {
        if (typeof spawnPoisonMistFX === 'function') spawnPoisonMistFX(q, r);
        if (typeof SFX !== 'undefined' && typeof SFX.infectWedge === 'function') SFX.infectWedge();
    }

    curP.hand.splice(selectedHandIndex, 1);
    selectedHandIndex = (curP.hand.length > 0) ? 0 : -1;
    totalTilesPlaced++; 
    playsLeft--;

    safeRenderBoard(); 
    safeRenderHand(); 
    safeUpdateUI();

    setTimeout(() => {
        if (window.newlyPlacedKey === placedKeyStr) {
            window.newlyPlacedKey = null;
        }
    }, 350);

    if (typeof centerCameraOn === 'function') centerCameraOn(q, r, 1.25);

    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // ==========================================
    // SIDE MATCH SCORING
    // ==========================================
    let { totalMatches, poisonMatches } = calculateEdgeMatches(q, r, tile);

    if (tile.isPoison) {
        if (totalMatches >= 2) {
            if (curP.hand.length > 0) playsLeft++;
            if (typeof spawnSVGText === 'function') {
                spawnSVGText(q, r - 0.5, "+1 BONUS PLAY!", 22, "#f1c40f", 1500);
                spawnSVGText(q, r, "POISON TILE: 0 PTS", 30, "#55efc4", 1200);
            }
            if (typeof SFX !== 'undefined' && typeof SFX.sideMatch === 'function') SFX.sideMatch(totalMatches);
            await sleep(800);
        } else {
            playsLeft = 0;
            if (typeof spawnSVGText === 'function') {
                spawnSVGText(q, r - 0.5, "POISON TILE: 0 PTS", 26, "#55efc4", 1500);
            }
            if (typeof SFX !== 'undefined' && typeof SFX.tileDrop === 'function') SFX.tileDrop();
            await sleep(600);
        }
    } else {
        if (totalMatches < 2) {
            playsLeft = 0;
            if (typeof spawnSVGText === 'function') {
                spawnSVGText(q, r - 0.5, "0 PTS - TURN OVER", 26, "#e74c3c", 1500);
            }
            if (typeof SFX !== 'undefined' && typeof SFX.tileDrop === 'function') SFX.tileDrop();
            await sleep(600);
        } else {
            let earnedPoints = Math.max(0, totalMatches - poisonMatches);
            if (curP.hand.length > 0) playsLeft++;
            curP.score += earnedPoints;

            let msg = poisonMatches > 0 
                ? `+${earnedPoints} PTS (-${poisonMatches} POISON)`
                : `+${earnedPoints} PTS`;

            if (typeof spawnSVGText === 'function') {
                spawnSVGText(q, r - 0.5, "+1 BONUS PLAY!", 22, "#f1c40f", 1500);
                spawnSVGText(q, r, msg, 32, curP.color || "#2ecc71", 1200);
            }
            if (typeof SFX !== 'undefined' && typeof SFX.sideMatch === 'function') SFX.sideMatch(totalMatches);
            await sleep(800);
        }
    }

    // ==========================================
    // COLORGON RESOLUTION
    // ==========================================
    let enclosedShapes = checkForEnclosedColorgons(q, r, tile);

    enclosedShapes.sort((a, b) => {
        let pA = a.isHigh ? 1 : (a.isLow ? 3 : 2);
        let pB = b.isHigh ? 1 : (b.isLow ? 3 : 2);
        return pA - pB;
    });

for (let shape of enclosedShapes) {
        // Register signature so this Colorgon can never be re-scored on future plays
        if (window.completedColorgonSignatures) {
            window.completedColorgonSignatures.add(shape.signature);
        }

        if (shape.isHigh) {
            if (!shape.containsBlackVoid) {
                if (typeof spawnSVGText === 'function') {
                    spawnSVGText(q, r - 0.4, "VOIDED! NO BLACK VOID ✕", 36, "#ff7675", 2000);
                }
                if (typeof SFX !== 'undefined' && typeof SFX.powerDown === 'function') SFX.powerDown();
                await sleep(1000);
            } else if (shape.poisonKey || shape.poisonTileCount > 0) {
                let [pQ, pR] = (shape.poisonKey || `${q},${r}`).split(',').map(Number);
                let pointsText = `HIGH PURGE! +${shape.wedges.length + 1}`;

                if (typeof triggerPoisonFlushAnim === 'function') {
                    await triggerPoisonFlushAnim(pQ, pR, shape.wedges.map(w => `${w.q},${w.r},${w.dir}`), pointsText);
                } else {
                    await executeVoidFlush(shape.wedges, shape.poisonKey || `${q},${r}`);
                }

                let purgePoints = shape.wedges.length + 1;
                curP.score += purgePoints;

                if (typeof SFX !== 'undefined' && typeof SFX.colorgonChord === 'function') {
                    SFX.colorgonChord(shape.wedges.length);
                }
                await sleep(800);
            } else {
                let scorePoints = shape.wedges.length;
                let colorName = (shape.color || 'red').toUpperCase();
                await animateRegularColorgonCompletion(shape.wedges, scorePoints, colorName, `${q},${r}`);
                await sleep(400);
            }

        } else if (!shape.isLow && !shape.isHigh) {
            if (shape.containsBlackVoid && (shape.poisonKey || shape.poisonTileCount > 0)) {
                let [pQ, pR] = (shape.poisonKey || `${q},${r}`).split(',').map(Number);
                let pointsText = `MID PURGE! +1`;

                if (typeof triggerPoisonFlushAnim === 'function') {
                    await triggerPoisonFlushAnim(pQ, pR, shape.wedges.map(w => `${w.q},${w.r},${w.dir}`), pointsText);
                } else {
                    await executeVoidFlush(shape.wedges, shape.poisonKey || `${q},${r}`);
                }

                curP.score += 1;
                if (typeof SFX !== 'undefined' && typeof SFX.colorgonChord === 'function') {
                    SFX.colorgonChord(shape.wedges.length);
                }
                await sleep(800);
            }

        } else if (shape.isLow) {
            if (shape.poisonTileCount > 0) {
                let poisonPoints = shape.poisonTileCount;
                curP.score += poisonPoints;
                if (typeof spawnSVGText === 'function') {
                    spawnSVGText(q, r - 0.4, `POISON COLORGON! +${poisonPoints} PTS 💀`, 36, "#55efc4", 1800);
                }
            }
            let colorgonKeys = [...new Set(shape.wedges.map(w => `${w.q},${w.r}`))];
            await processLowDieColorgonDistribution(colorgonKeys, `${q},${r}`);
            await sleep(400);
        }    
    }

    // ==========================================
    // VISUAL HOLD BEFORE TURN TRANSITION
    // ==========================================
    if (enclosedShapes.length > 0) {
        // Holds screen state so scoring animations and floating text finish completely
        await sleep(1000);
    }

    safeRenderBoard(); 
    safeRenderHand(); 
    safeUpdateUI();

    await sleep(300);
    window.newlyPlacedKey = null; 
    isAnimating = false;
    safeRenderBoard();

    if (curP.score >= winTargetValue) {
        isGameOver = true;
        if (typeof SFX !== 'undefined' && typeof SFX.victoryStinger === 'function') SFX.victoryStinger();
        alert(`🏆 ${curP.name.toUpperCase()} WINS WITH ${curP.score} POINTS!`);
        return;
    }

    let canPlay = hasLegalMoves(curP);
    if (playsLeft <= 0 || curP.hand.length === 0 || !canPlay) {
        if (!canPlay && curP.hand.length > 0 && playsLeft > 0) {
            if (typeof spawnSVGText === 'function') spawnSVGText(q, r, "NO MORE MOVES", 36, "#e74c3c", 2000);
            await sleep(1500);
        }
        initiateEndTurn();
    }
}

window.calculateEdgeMatches = calculateEdgeMatches;
window.checkForEnclosedColorgons = checkForEnclosedColorgons;
window.attemptPlacement = attemptPlacement;
function getDiceStateCategories() {
    let high = new Set(window.activeDice || (typeof activeDice !== 'undefined' ? activeDice : []));
    let toxic = new Set(window.toxicDice || (typeof toxicDice !== 'undefined' ? toxicDice : []));
    let inactive = new Set(window.inactiveDice || (typeof inactiveDice !== 'undefined' ? inactiveDice : []));

    if (high.size === 0 && toxic.size === 0 && typeof lastDiceValues !== 'undefined' && lastDiceValues) {
        let vals = [
            { c: 'r', v: lastDiceValues.r || 0 },
            { c: 'b', v: lastDiceValues.b || 0 },
            { c: 'y', v: lastDiceValues.y || 0 }
        ].sort((a, b) => b.v - a.v);

        let maxV = vals[0].v;
        let minV = vals[2].v;

        vals.forEach(item => {
            if (item.v === maxV) high.add(item.c);
            else if (item.v === minV) toxic.add(item.c);
            else inactive.add(item.c);
        });
    }

    if (high.size === 0 && toxic.size === 0) {
        high = new Set(['r', 'b', 'y']);
    }

    let highArr = [...high];
    let midArr = [...inactive].filter(c => !high.has(c));
    let lowArr = [...toxic].filter(c => !high.has(c) && !inactive.has(c));

    return { highArr, midArr, lowArr };
}

function isSocketVoid(q, r) {
    let nList = window.neighbors || (typeof neighbors !== 'undefined' ? neighbors : []);
    for (let i = 0; i < 6; i++) {
        let nInfo = nList[i];
        let nKey = `${q + nInfo.dq},${r + nInfo.dr}`;
        if (grid.has(nKey)) {
            let nTile = grid.get(nKey);
            if (nTile[nInfo.opp] === 'k') return true;
        }
    }
    return false;
}

window.isSocketVoid = isSocketVoid;
window.checkForEnclosedColorgons = checkForEnclosedColorgons;

// ==========================================
// END OF TURN REFILL & POISON BANK PENALTY LOGIC
// ==========================================

async function initiateEndTurn() {
    if (isAnimating) return;
    isAnimating = true;

    let curP = playersList[activePlayerIdx];
    let slotsNeeded = targetHandSize - (curP.hand ? curP.hand.length : 0);

    // 1. Hand Refill Phase
    if (curP && slotsNeeded > 0) {
        await promptHandRefillChoice(curP, slotsNeeded);
    }

    // 2. Poison Bank Penalty Phase (-1 pt per tile, -5 pts if full at 3, capped at 0)
    if (curP && curP.poisonBank && curP.poisonBank.length > 0) {
        let count = curP.poisonBank.length;
        let penalty = (count >= 3) ? 5 : count;

        if ((curP.score || 0) > 0) {
            let oldScore = curP.score;
            curP.score = Math.max(0, curP.score - penalty);
            let actualDeduction = oldScore - curP.score;

            if (typeof spawnSVGText === 'function') {
                spawnSVGText(0, 0, `BANK PENALTY: -${actualDeduction} PTS 💀`, 32, '#ff7675', 1800);
            }
            if (typeof SFX !== 'undefined' && typeof SFX.poisonMeltdown === 'function') {
                SFX.poisonMeltdown();
            }

            safeUpdateUI();
            if (typeof renderLeaderboard === 'function') renderLeaderboard();
            const sleep = ms => new Promise(res => setTimeout(res, ms));
            await sleep(1400);
        }
    }

    isAnimating = false;
    activePlayerIdx = (activePlayerIdx + 1) % playersList.length;
    startTurnLogic();
}

function promptHandRefillChoice(player, slotsNeeded) {
    return new Promise((resolve) => {
        let bankTiles = player.poisonBank || [];

        // Bot AI Logic
        if (player.type === 'bot') {
            let botChoice = (typeof getBotRefillSelection === 'function') 
                ? getBotRefillSelection(player, slotsNeeded) 
                : [];
            executeRefill(player, botChoice, slotsNeeded);
            resolve();
            return;
        }

        // Human with empty Poison Bank: Auto-refill from main deck
        if (bankTiles.length === 0) {
            executeRefill(player, [], slotsNeeded);
            resolve();
            return;
        }

        // Human with Poison Bank tiles: Display Granular Selection Modal
        let modal = document.getElementById('refill-modal');
        let container = document.getElementById('refill-bank-tiles-container');
        let confirmBtn = document.getElementById('confirm-refill-btn');
        let subtitle = document.getElementById('refill-subtitle');

        if (!modal || !container || !confirmBtn) {
            executeRefill(player, [], slotsNeeded);
            resolve();
            return;
        }

        subtitle.textContent = `Select up to ${slotsNeeded} Poison Bank tile(s) to add to your hand:`;
        container.innerHTML = '';
        let selectedIndices = new Set();

        bankTiles.forEach((tile, idx) => {
            let wrapper = document.createElement('div');
            wrapper.style.cssText = 'cursor:pointer; padding:6px; border:2px solid transparent; border-radius:8px; transition:all 0.2s ease;';
            
            let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '50');
            svg.setAttribute('height', '50');
            svg.setAttribute('viewBox', '-40 -40 80 80');
            if (typeof createHexGroup === 'function') {
                svg.appendChild(createHexGroup(tile, null, null, false));
            }
            wrapper.appendChild(svg);

            wrapper.onclick = () => {
                if (selectedIndices.has(idx)) {
                    selectedIndices.delete(idx);
                    wrapper.style.borderColor = 'transparent';
                    wrapper.style.boxShadow = 'none';
                } else {
                    if (selectedIndices.size < slotsNeeded) {
                        selectedIndices.add(idx);
                        wrapper.style.borderColor = '#55efc4';
                        wrapper.style.boxShadow = '0 0 12px rgba(85,239,196,0.6)';
                    }
                }
            };
            container.appendChild(wrapper);
        });

        modal.classList.add('visible');

        confirmBtn.onclick = () => {
            modal.classList.remove('visible');
            confirmBtn.onclick = null;
            executeRefill(player, [...selectedIndices], slotsNeeded);
            resolve();
        };
    });
}

function executeRefill(player, selectedPoisonIndices, slotsNeeded) {
    if (!player.hand) player.hand = [];
    if (!player.poisonBank) player.poisonBank = [];

    // Sort indices in descending order so splicing from array doesn't shift remaining targets
    selectedPoisonIndices.sort((a, b) => b - a);

    selectedPoisonIndices.forEach(idx => {
        if (player.poisonBank[idx]) {
            let [extractedTile] = player.poisonBank.splice(idx, 1);
            player.hand.push(extractedTile);
        }
    });

    // Fill remaining open hand slots from the standard draw deck
    while (player.hand.length < targetHandSize) {
        player.hand.push(generateRandomTile());
    }

    safeRenderHand();
    safeUpdateUI();
    if (typeof renderPoisonBankUI === 'function') renderPoisonBankUI();
}

window.initiateEndTurn = initiateEndTurn;
window.promptHandRefillChoice = promptHandRefillChoice;
window.executeRefill = executeRefill;

function safeRenderBoard() { if (window.renderBoard) window.renderBoard(); }
function safeRenderHand() { if (window.renderHand) window.renderHand(); }
function safeUpdateUI() { if (window.updateUI) window.updateUI(); }
function generateRandomTile() {
    let colors = ['r', 'r', 'b', 'b', 'y', 'y', 'w'];
    let pool = [...colors, 'r', 'b', 'y', 'k']; 
    return Array.from({length: 6}, () => pool[Math.floor(Math.random()*pool.length)]);
}
function generateStarterTile() { return ['y', 'r', 'b', 'y', 'r', 'b']; }
function placeTile(q, r, tile) { if (typeof grid !== 'undefined') grid.set(`${q},${r}`, tile); }
function getDieSVG(val, colorHex) { return `<svg width="100%" height="100%" viewBox="0 0 100 100" style="background:${colorHex}; border-radius:6px;">${[[],[{cx:50,cy:50}],[{cx:25,cy:25},{cx:75,cy:75}],[{cx:25,cy:25},{cx:50,cy:50},{cx:75,cy:75}],[{cx:25,cy:25},{cx:75,cy:25},{cx:25,cy:75},{cx:75,cy:75}],[{cx:25,cy:25},{cx:75,cy:25},{cx:50,cy:50},{cx:25,cy:75},{cx:75,cy:75}],[{cx:25,cy:25},{cx:75,cy:25},{cx:25,cy:50},{cx:75,cy:50},{cx:25,cy:75},{cx:75,cy:75}]][val].map(p=>`<circle cx="${p.cx}" cy="${p.cy}" r="12" fill="white" />`).join('')}</svg>`; }

async function processLowDieColorgonDistribution(colorgonKeys, placedKey = null) {
    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    let curIdx = (typeof activePlayerIdx !== 'undefined') ? activePlayerIdx : 0;
    let curP = plist[curIdx];
    let numPlayers = plist.length;

    if (typeof centerCameraOn === 'function') centerCameraOn(0, 0, 1.4);

    if (typeof spawnSVGText === 'function') {
        spawnSVGText(0, 0, "CENTER ANCHOR LOCKED! 🛡️", 28, "#00cec9", 1400);
    }
    await new Promise(r => setTimeout(r, 600));

    let ringKeys = colorgonKeys.filter(k => k !== '0,0');

    let startKey = (placedKey && ringKeys.includes(placedKey)) ? placedKey :
                   (window.newlyPlacedKey && ringKeys.includes(window.newlyPlacedKey)) ? window.newlyPlacedKey :
                   ringKeys[0];

    let waves = [];
    let visited = new Set();
    if (startKey) {
        let currentWave = [startKey];
        visited.add(startKey);
        while (currentWave.length > 0) {
            waves.push(currentWave);
            let nextWave = [];
            for (let k of currentWave) {
                let [q, r] = k.split(',').map(Number);
                neighbors.forEach(n => {
                    let nk = `${q + n.dq},${r + n.dr}`;
                    if (ringKeys.includes(nk) && !visited.has(nk)) {
                        visited.add(nk);
                        nextWave.push(nk);
                    }
                });
            }
            currentWave = nextWave;
        }
    }
    let unvisited = ringKeys.filter(k => !visited.has(k));
    if (unvisited.length > 0) waves.push(unvisited);

    let removedTiles = [];

    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
        let waveKeys = waves[waveIndex];

        // Flash toxic wave and convert tiles to poison
        for (let k of waveKeys) {
            if (grid.has(k)) {
                let tile = grid.get(k);
                let [q, r] = k.split(',').map(Number);
                tile.isPoison = true; 

                if (!removedTiles.some(item => item.key === k)) {
                    removedTiles.push({ key: k, tile: tile });
                }

                if (typeof spawnSVGText === 'function') {
                    spawnSVGText(q, r, "💀", 26, "#55efc4", 800);
                }
            }
        }

        if (typeof SFX !== 'undefined' && SFX.tileInfect) SFX.tileInfect();
        if (typeof renderBoard === 'function') renderBoard();
        await new Promise(r => setTimeout(r, 220));
    }

    // ==========================================
    // POISON CREATION REWARD: +1 PT PER CREATED TILE
    // ==========================================
    let createdCount = removedTiles.length;
    if (createdCount > 0 && curP) {
        curP.score = (curP.score || 0) + createdCount;

        if (typeof spawnSVGText === 'function') {
            spawnSVGText(0, -0.6, `+${createdCount} PTS FOR CREATING POISON! 💀`, 32, "#55efc4", 1600);
        }
        if (typeof SFX !== 'undefined' && typeof SFX.sideMatch === 'function') SFX.sideMatch(createdCount);
        
        safeUpdateUI();
        if (typeof renderLeaderboard === 'function') renderLeaderboard();
        await new Promise(r => setTimeout(r, 600));
    }

    for (let i = 0; i < removedTiles.length; i++) {
        let item = removedTiles[i];
        let [q, r] = item.key.split(',').map(Number);
        
        let assigned = false;
        let targetDOMSlot = null;

        for (let step = 1; step < numPlayers; step++) {
            let targetIdx = (curIdx + step) % numPlayers;
            let targetP = plist[targetIdx];
            if (!targetP.poisonBank) targetP.poisonBank = [];

            if (targetP.poisonBank.length < 3) {
                targetP.poisonBank.push(item.tile);
                assigned = true;
                targetDOMSlot = getDistributionTargetElement(targetIdx, targetP, false);
                break;
            }
        }

        if (!assigned) {
            if (!curP.poisonBank) curP.poisonBank = [];

            if (curP.poisonBank.length < 3) {
                curP.poisonBank.push(item.tile);
                targetDOMSlot = getDistributionTargetElement(curIdx, curP, true);
            } else {
                curP.score = Math.max(0, (curP.score || 0) - 2);
                if (typeof spawnSVGText === 'function') {
                    spawnSVGText(q, r, `BANK OVERFLOW! -2 PTS ⚠️`, 24, "#ff7675", 1400);
                }
                targetDOMSlot = getDistributionTargetElement(curIdx, curP, true);
            }
        }

        grid.delete(item.key);
        if (typeof renderBoard === 'function') renderBoard();

        if (typeof SFX !== 'undefined' && SFX.orbLaunch) SFX.orbLaunch();

        if (typeof animateToxicOrbFlight === 'function') {
            await animateToxicOrbFlight(q, r, targetDOMSlot);
        }

        if (typeof SFX !== 'undefined' && SFX.hudImpact) SFX.hudImpact();

        if (typeof renderPoisonBankUI === 'function') renderPoisonBankUI();
        if (typeof renderLeaderboard === 'function') renderLeaderboard();
        await new Promise(r => setTimeout(r, 120));
    }

    if (typeof renderBoard === 'function') renderBoard();
}

window.processLowDieColorgonDistribution = processLowDieColorgonDistribution;

function getDistributionTargetElement(playerIdx, playerObj, isActivePlayer) {
    if (isActivePlayer) {
        let bankSlots = document.querySelectorAll('#poison-bank-wrapper .pb-slot, .pb-slot, #poison-bank .slot');
        let bankIndex = Math.min((playerObj.poisonBank ? playerObj.poisonBank.length : 1) - 1, 2);
        if (bankSlots && bankSlots[bankIndex]) return bankSlots[bankIndex];

        let bankContainer = document.getElementById('poison-bank-wrapper') || document.querySelector('.poison-bank-container') || document.getElementById('poison-bank');
        if (bankContainer) return bankContainer;
    }

    if (playerObj && playerObj.name) {
        let elems = document.querySelectorAll('#score-tracker div, .lb-card-inner, .player-card, #leaderboard-list div');
        for (let el of elems) {
            if (el.textContent.toLowerCase().includes(playerObj.name.toLowerCase())) {
                let rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) return el;
            }
        }
    }

    let rows = document.querySelectorAll('#score-tracker .player-card, #score-tracker > div, .lb-card-inner');
    if (rows && rows[playerIdx]) return rows[playerIdx];

    return document.getElementById('score-tracker');
}

function getPlayerScoreTrackerElement(playerIdx, playerObj) {
    if (!playerObj || !playerObj.name) return null;

    let candidates = document.querySelectorAll('#score-tracker div, #score-tracker p, .score-tracker div, #leaderboard-list div, .lb-card-inner, .player-card');
    
    for (let el of candidates) {
        if (el.children.length <= 2 && el.textContent.toLowerCase().includes(playerObj.name.toLowerCase())) {
            let rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                return el;
            }
        }
    }

    let rows = document.querySelectorAll('#score-tracker .player-card, #score-tracker > div, .score-row');
    if (rows && rows[playerIdx]) {
        return rows[playerIdx];
    }

    return document.getElementById('score-tracker') || document.querySelector('.score-tracker-container');
}

window.processLowDieColorgonDistribution = processLowDieColorgonDistribution;

async function animateRegularColorgonCompletion(colorgonWedges, scorePoints, colorName = 'RED', placedKey = '0,1') {
    let colorKey = (colorName || 'r').toLowerCase()[0];
    
    let vibrantMap = { 'r': '#ff0033', 'b': '#00e5ff', 'y': '#ffe600' };
    let themeColor = vibrantMap[colorKey] || '#ff0033';

    if (typeof centerCameraOn === 'function') centerCameraOn(0, 0, 1.4);

    let [pq, pr] = (placedKey || '0,1').split(',').map(Number);

    let tileWedgeMap = new Map();
    colorgonWedges.forEach(w => {
        let k = `${w.q},${w.r}`;
        if (!tileWedgeMap.has(k)) tileWedgeMap.set(k, []);
        tileWedgeMap.get(k).push(w.dir);
    });

    let sortedTileKeys = [...tileWedgeMap.keys()].sort((a, b) => {
        let [aq, ar] = a.split(',').map(Number);
        let [bq, br] = b.split(',').map(Number);
        return Math.hypot(aq - pq, ar - pr) - Math.hypot(bq - pq, br - pr);
    });

    window.activeColorgonColor = colorKey;
    window.recentColorgonWedges = window.recentColorgonWedges || new Set();
    window.recentColorgonWedges.clear();

// PHASE 1: Ignite participating wedges with paced sound steps & floating sparkles
    for (let i = 0; i < sortedTileKeys.length; i++) {
        let k = sortedTileKeys[i];
        let [q, r] = k.split(',').map(Number);
        let dirs = tileWedgeMap.get(k);

        dirs.forEach(wDir => {
            window.recentColorgonWedges.add(`${q},${r},${wDir}`);
        });

        if (typeof spawnSVGText === 'function') {
            spawnSVGText(q, r, "✨", 26, themeColor, 800);
        }

        if (typeof SFX !== 'undefined' && SFX.wedgeStep) SFX.wedgeStep(i);
        safeRenderBoard();
        await new Promise(res => setTimeout(res, 180)); // Double wedge ignition step pause
    }

    if (typeof SFX !== 'undefined' && SFX.colorgonSuccess) {
        SFX.colorgonSuccess();
    } else if (typeof SFX !== 'undefined' && SFX.colorgonChord) {
        SFX.colorgonChord(scorePoints);
    }

    await new Promise(res => setTimeout(res, 500));

    // PHASE 2: Floating Banner & Point Payoff
    if (typeof spawnSVGText === 'function') {
        spawnSVGText(pq, pr - 0.5, `${colorName} COLORGON! +${scorePoints} PTS! 🎉`, 34, themeColor, 2200);
    }

    let plist = (typeof playersList !== 'undefined') ? playersList : (window.playersList || []);
    let curIdx = (typeof activePlayerIdx !== 'undefined') ? activePlayerIdx : 0;
    if (plist[curIdx]) {
        plist[curIdx].score = (plist[curIdx].score || 0) + scorePoints;
    }

    await new Promise(res => setTimeout(res, 600));
    if (window.recentColorgonWedges) window.recentColorgonWedges.clear();
    window.activeColorgonColor = null;

    if (typeof renderLeaderboard === 'function') renderLeaderboard();
    safeRenderBoard();
}

async function evaluateColorgonAfterPlacement(placedQ, placedR) {
    let colorgonKeys = ['0,0', '1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
    let isFullyEnclosed = colorgonKeys.every(k => grid.has(k));

    if (isFullyEnclosed) {
        let isLowDie = (window.activeDieType === 'low' || window.currentDieType === 'low');

        if (isLowDie) {
            await processLowDieColorgonDistribution(colorgonKeys, `${placedQ},${placedR}`);
        } else {
            await animateRegularColorgonCompletion(colorgonKeys, 10, 'RED');
        }
    }
}

window.animateRegularColorgonCompletion = animateRegularColorgonCompletion;
window.evaluateColorgonAfterPlacement = evaluateColorgonAfterPlacement;