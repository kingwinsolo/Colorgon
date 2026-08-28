// ==========================================
// COLORGON AI BOT HEURISTIC ENGINE
// ==========================================

async function executeBotTurnSequence() {
    let curP = playersList[activePlayerIdx];
    if (!curP || curP.type !== 'bot' || isGameOver) return;

    const sleep = ms => new Promise(res => setTimeout(res, ms));

    while (isAnimating || isRolling) {
        await sleep(150);
    }

    if (!hasRolledDiceThisTurn) {
        await sleep(900); // Extended pause before AI rolls
        await executeDiceRollAnimation();
    }

    if (isGameOver || activePlayerIdx !== curP.id) return;

    while (playsLeft > 0 && curP.hand.length > 0 && !isGameOver && activePlayerIdx === curP.id) {
        while (isAnimating) {
            await sleep(150);
        }

        await sleep(1100); // Pause before evaluating move

        let move = null;
        if (curP.difficulty === 'hard') {
            move = calculateHardBotMove(curP);
        } else if (curP.difficulty === 'normal') {
            move = calculateNormalBotMove(curP);
        } else {
            move = calculateEasyBotMove(curP);
        }

        if (!move) {
            if (typeof spawnSVGText === 'function') {
                spawnSVGText(0, 0, `${curP.name.toUpperCase()} HAS NO MOVES`, 26, '#e74c3c', 1800);
            }
            await sleep(1500);
            break;
        }

        selectedHandIndex = move.tileIdx;
        safeRenderHand();
        await sleep(600); // Hold selected hand tile

        let tile = curP.hand[selectedHandIndex];
        for (let r = 0; r < move.rotations; r++) {
            tile.unshift(tile.pop());
            if (typeof SFX !== 'undefined' && SFX.rotate) SFX.rotate(true);
            if (typeof trigger3DRotationAnim === 'function') trigger3DRotationAnim(true);
            safeRenderHand();
            safeRenderBoard();
            await sleep(480); // Paced rotation clicks
        }

        activePreviewSocketKey = `${move.q},${move.r}`;
        safeRenderBoard();
        await sleep(900); // Suspends tile preview over target socket before drop

        await attemptPlacement(move.q, move.r);

        if (activePlayerIdx !== curP.id) return;
    }

    if (!isGameOver && activePlayerIdx === curP.id) {
        await sleep(600);
        initiateEndTurn();
    }
}

function calculateHardBotMove(botPlayer) {
    if (!botPlayer || !botPlayer.hand || botPlayer.hand.length === 0) return null;

    let bestMove = null;
    let highestScore = -Infinity;

    let openSockets = new Set();
    neighbors.forEach(n => grid.forEach((_, k) => {
        let [q, r] = k.split(',').map(Number);
        let nk = `${q + n.dq},${r + n.dr}`;
        if (!grid.has(nk)) openSockets.add(nk);
    }));

    for (let tIdx = 0; tIdx < botPlayer.hand.length; tIdx++) {
        let originalTile = [...botPlayer.hand[tIdx]];

        for (let rot = 0; rot < 6; rot++) {
            let testTile = [...originalTile];
            for (let rCount = 0; rCount < rot; rCount++) {
                testTile.unshift(testTile.pop());
            }

            for (let socketKey of openSockets) {
                let [sq, sr] = socketKey.split(',').map(Number);

                if (isValidPlacement(sq, sr, testTile)) {
                    let score = evaluatePlacementScore(sq, sr, testTile, botPlayer);

                    if (score > highestScore) {
                        highestScore = score;
                        bestMove = { tileIdx: tIdx, rotations: rot, q: sq, r: sr, score: score };
                    }
                }
            }
        }
    }

    return bestMove;
}

function evaluatePlacementScore(q, r, tile, botPlayer) {
    let totalValue = 0;

    let sidesMatched = calculateEdgeMatches(q, r, tile);
    if (sidesMatched === 1) {
        totalValue += 0;
    } else if (sidesMatched >= 2) {
        totalValue += sidesMatched * 2.5;
    }

    grid.set(`${q},${r}`, tile);
    let shapes = checkForEnclosedColorgons(q, r, tile);
    grid.delete(`${q},${r}`);

    for (let shape of shapes) {
        let isLowDie = (typeof toxicDice !== 'undefined' && toxicDice.includes(shape.color)) ||
                       (typeof activeDieType !== 'undefined' && activeDieType === 'low');

        if (isLowDie) {
            let colorgonKeys = [...new Set(shape.wedges.map(w => `${w.q},${w.r}`))];
            let ringTilesCount = colorgonKeys.filter(k => k !== '0,0').length;

            let currentBankSize = (botPlayer.poisonBank || []).length;
            let overflowCount = Math.max(0, (currentBankSize + ringTilesCount) - 3);

            totalValue += (ringTilesCount * 3) - (overflowCount * 4);
        } else if (shape.poisonKey) {
            totalValue += (shape.wedges.length + 2) * 2;
        } else if (shape.isHigh) {
            totalValue += shape.wedges.length * 3;
        }
    }

    for (let i = 0; i < 6; i++) {
        let nInfo = neighbors[i];
        let nKey = `${q + nInfo.dq},${r + nInfo.dr}`;
        if (grid.has(nKey) && grid.get(nKey)[nInfo.opp] === 'k') {
            totalValue -= 1.5;
        }
    }

    return totalValue;
}

function calculateEasyBotMove(botPlayer) {
    let moves = getAllLegalMoves(botPlayer);
    return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
}

function calculateNormalBotMove(botPlayer) {
    let moves = getAllLegalMoves(botPlayer);
    if (moves.length === 0) return null;
    moves.sort((a, b) => evaluatePlacementScore(b.q, b.r, botPlayer.hand[b.tileIdx], botPlayer) - 
                        evaluatePlacementScore(a.q, a.r, botPlayer.hand[a.tileIdx], botPlayer));
    return moves[0];
}

function getAllLegalMoves(botPlayer) {
    let legal = [];
    let openSockets = new Set();
    neighbors.forEach(n => grid.forEach((_, k) => {
        let [q, r] = k.split(',').map(Number);
        let nk = `${q + n.dq},${r + n.dr}`;
        if (!grid.has(nk)) openSockets.add(nk);
    }));

    botPlayer.hand.forEach((tile, tIdx) => {
        for (let rot = 0; rot < 6; rot++) {
            let testTile = [...tile];
            for (let r = 0; r < rot; r++) testTile.unshift(testTile.pop());

            openSockets.forEach(sKey => {
                let [sq, sr] = sKey.split(',').map(Number);
                if (isValidPlacement(sq, sr, testTile)) {
                    legal.push({ tileIdx: tIdx, rotations: rot, q: sq, r: sr });
                }
            });
        }
    });

    return legal;
}

window.executeBotTurnSequence = executeBotTurnSequence;
window.calculateHardBotMove = calculateHardBotMove;

// ==========================================
// BOT REFILL HEURISTIC EVALUATOR
// ==========================================

function getBotRefillSelection(botPlayer, slotsNeeded) {
    if (!botPlayer || !botPlayer.poisonBank || botPlayer.poisonBank.length === 0 || slotsNeeded <= 0) {
        return [];
    }

    let bankCount = botPlayer.poisonBank.length;
    let selectedIndices = [];

    // Easy Bot: Oblivious to penalties — never pulls from Poison Bank
    if (botPlayer.difficulty === 'easy') {
        return [];
    }

    // Normal Bot: Avoids heavy -5 penalty if Bank has 2 or 3 tiles
    if (botPlayer.difficulty === 'normal') {
        if (bankCount >= 2) {
            let countToTake = Math.min(bankCount === 3 ? 2 : 1, slotsNeeded);
            for (let i = 0; i < countToTake; i++) selectedIndices.push(i);
        }
        return selectedIndices;
    }

    // Hard Bot: Tactical Evaluator
    if (botPlayer.difficulty === 'hard') {
        // If score is already 0, penalty cannot reduce score further — hold poison in bank
        if ((botPlayer.score || 0) <= 0) {
            return [];
        }

        // Full Bank (3 Tiles): Always pull 1-2 tiles to avoid -5 point hit
        if (bankCount === 3) {
            let countToTake = Math.min(2, slotsNeeded);
            for (let i = 0; i < countToTake; i++) selectedIndices.push(i);
            return selectedIndices;
        }

        // Bank has 1-2 tiles: Clear if current score is high enough to care about 1-2 pt hits
        if (botPlayer.score > 5) {
            let countToTake = Math.min(bankCount, slotsNeeded);
            for (let i = 0; i < countToTake; i++) selectedIndices.push(i);
            return selectedIndices;
        }
    }

    return selectedIndices;
}

window.getBotRefillSelection = getBotRefillSelection;