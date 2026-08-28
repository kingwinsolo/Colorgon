function updateHostProfile() {
    let nameInput = document.getElementById('host-player-name');
    let colorInput = document.getElementById('host-player-color');
    let hName = nameInput ? nameInput.value.trim() || "Host (P1)" : "Host (P1)";
    let hColor = colorInput ? colorInput.value : "#2ecc71";

    if (playersList.length > 0 && playersList[0]) {
        playersList[0].name = hName; playersList[0].color = hColor;
        renderOnlineParticipants();
        if (isHost) broadcastLobby();
    }
}

function startHostingRoom() {
    isHost = true; myPlayerId = 0;
    roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    let hName = document.getElementById('host-player-name') ? document.getElementById('host-player-name').value.trim() : "Host (P1)";
    let hColor = document.getElementById('host-player-color') ? document.getElementById('host-player-color').value : "#2ecc71";

    try {
        if (peer) peer.destroy();
        peer = new Peer('COLORGON-NUM-' + roomCode);

        peer.on('open', () => {
            document.getElementById('host-room-code').innerText = roomCode;
            document.getElementById('host-code-wrap').style.display = 'flex';
            document.getElementById('create-room-btn').style.display = 'none';
            document.getElementById('start-hosted-game-btn').style.display = 'block';
            document.getElementById('online-participants-list').style.display = 'flex';
            document.getElementById('host-bots-wrapper').style.display = 'flex';
            
            playersList = [{ id: 0, name: hName || "Host (P1)", color: hColor || "#2ecc71", type: "human", isReady: true, score: 0, hand: [], poisonBank: [] }];
            hostBotSlots = [];
            renderHostBotSlots(); renderOnlineParticipants();
        });

        peer.on('error', (err) => { alert("Online hosting requires running on a live web server or local HTTP server."); });

        peer.on('connection', (conn) => {
            connections.push(conn);
            conn.on('data', (data) => handleNetworkData(data, conn));
            conn.on('close', () => { connections = connections.filter(c => c !== conn); renderOnlineParticipants(); broadcastLobby(); });
        });
    } catch (err) { alert("Online hosting is unavailable on raw file:// protocol."); }
}

function joinRoomByCode() {
    isHost = false;
    let code = document.getElementById('join-room-code-input').value.toString().trim();
    let myName = document.getElementById('join-player-name').value || "Player";
    let myColor = document.getElementById('join-player-color').value || "#3498db";

    if (!code || code.length !== 4) { document.getElementById('join-status-msg').innerText = "Enter a valid 4-digit code!"; return; }

    try {
        if (peer) peer.destroy();
        peer = new Peer();
        
        peer.on('open', () => {
            document.getElementById('join-status-msg').innerText = "Connecting to room...";
            hostConn = peer.connect('COLORGON-NUM-' + code);
            
            hostConn.on('open', () => {
                document.getElementById('join-input-section').style.display = 'none';
                document.getElementById('join-lobby-section').style.display = 'flex';
                hostConn.send({ type: 'JOIN', name: myName, color: myColor });
            });

            hostConn.on('data', (data) => handleNetworkData(data, hostConn));
        });

        peer.on('error', () => { document.getElementById('join-status-msg').innerText = "Could not connect to room code."; });
    } catch (err) { document.getElementById('join-status-msg').innerText = "WebRTC unavailable on file:// protocol."; }
}

function toggleReadyStatus() {
    isReady = !isReady;
    let btn = document.getElementById('ready-toggle-btn');
    btn.innerText = isReady ? "Unready ↩" : "Ready Up 👍";
    if (hostConn) hostConn.send({ type: 'READY_CHANGE', isReady });
}

function broadcastAnimationEvent(eventData) {
    if (!isHost) return;
    connections.forEach(c => c.send(eventData));
}

function handleNetworkData(data, conn) {
    if (isHost) {
        if (data.type === 'JOIN') {
            let newId = playersList.length;
            playersList.push({ id: newId, name: data.name, color: data.color, type: 'human', isReady: false, score: 0, hand: [], poisonBank: [] });
            conn.send({ type: 'ASSIGN_ID', myPlayerId: newId });
            renderOnlineParticipants(); broadcastLobby();
        } else if (data.type === 'READY_CHANGE') {
            let p = playersList.find(x => x.id === conn.peerId || playersList.indexOf(x) > 0);
            if (p) p.isReady = data.isReady;
            renderOnlineParticipants(); broadcastLobby();
        } else if (data.type === 'CHAT_MSG') {
            receiveChatMessage(data.sender, data.color, data.text);
            connections.forEach(c => { if (c !== conn) c.send(data); });
        } else if (data.type === 'ACTION_PLACE') { attemptPlacement(data.q, data.r, null, true, data.handIndex, data.tile); }
        else if (data.type === 'ACTION_END_TURN') { initiateEndTurn(true); }
        else if (data.type === 'ACTION_ROLL') { 
            executeDiceRollAnimation(); 
            connections.forEach(c => c.send({ type: 'TRIGGER_ROLL' }));
        } else if (data.type === 'ACTION_DRAW_CHOICE') {
            executeDrawChoice(data.choice, true, data.targetPlayerIdx);
        }
    } else {
        if (data.type === 'ASSIGN_ID') { myPlayerId = Number(data.myPlayerId); }
        else if (data.type === 'LOBBY_UPDATE') { playersList = data.playersList; renderJoinedParticipants(); updateUI(); }
        else if (data.type === 'START_GAME') { applySyncedState(data.state); document.getElementById('tutorial-overlay').classList.remove('visible'); }
        else if (data.type === 'SYNC_STATE') { applySyncedState(data.state); }
        else if (data.type === 'TRIGGER_ROLL') { executeDiceRollAnimation(); }
        else if (data.type === 'CHAT_MSG') { receiveChatMessage(data.sender, data.color, data.text); }
        else if (data.type === 'GAME_OVER') { triggerVictoryScreen(data.winner, data.standings); }
        else if (data.type === 'ANIM_CAMERA_PAN') { animateCamera(data.targetPanX, data.targetPanY, data.targetScale, data.duration); }
        else if (data.type === 'ANIM_PLACEMENT_START') { centerCameraOn(data.q, data.r, 1.3); } 
        else if (data.type === 'ANIM_MATCH_BURST') {
            recentMatchWedges.clear();
            data.matchingEdges.forEach(m => {
                recentMatchWedges.add(`${data.q},${data.r},${m.myDir}`);
                recentMatchWedges.add(`${m.neighborQ},${m.neighborR},${m.neighborDir}`);
            });
            renderBoard(); SFX.sideMatch(data.matches);
            spawnSVGText(data.q, data.r, `+${data.matches}`, 36, data.colorHex, 900);
        } else if (data.type === 'ANIM_SWOOSH') {
            spawnSVGText(data.q, data.r, data.text, 36, data.colorHex, 900);
        } else if (data.type === 'ANIM_COLORGON_STEP') {
            activeColorgonColor = data.targetColor;
            recentColorgonWedges.add(`${data.wq},${data.wr},${data.wdir}`);
            renderBoard(); SFX.wedgeStep(data.stepCount);
            spawnSVGText(data.wq, data.wr, "+1", 22, data.gColorHex, 700);
        } else if (data.type === 'ANIM_COLORGON_COMPLETE') {
            SFX.colorgonChord(data.wedgesCount);
            recentColorgonWedges.clear(); activeColorgonColor = null; renderBoard();
        } else if (data.type === 'PROMPT_DRAW_CHOICE') {
            openDrawChoiceModal(data.queueCount, data.targetPlayerIdx);
        }
    }
}

function broadcastLobby() {
    if (!isHost) return;
    connections.forEach(c => c.send({ type: 'LOBBY_UPDATE', playersList }));
}

function broadcastState() {
    if (!isHost) return;
    let state = { grid: Array.from(grid.entries()), playersList, activePlayerIdx, playsLeft, tilesPlayedThisTurn, hasRolledDiceThisTurn, diceActive, lastDiceValues };
    connections.forEach(conn => conn.send({ type: 'SYNC_STATE', state }));
}

function applySyncedState(state) {
    grid = new Map(state.grid);
    if (state.playersList) {
        state.playersList.forEach((incomingP, idx) => {
            if (playersList[idx]) {
                playersList[idx].score = incomingP.score;
                playersList[idx].name = incomingP.name;
                playersList[idx].color = incomingP.color;
                playersList[idx].hand = incomingP.hand;
                playersList[idx].poisonBank = incomingP.poisonBank;
            } else { playersList[idx] = incomingP; }
        });
    }
    activePlayerIdx = Number(state.activePlayerIdx);
    playsLeft = state.playsLeft; tilesPlayedThisTurn = state.tilesPlayedThisTurn;
    hasRolledDiceThisTurn = state.hasRolledDiceThisTurn; diceActive = state.diceActive;
    if (state.lastDiceValues) lastDiceValues = state.lastDiceValues;

    renderBoard(); renderHand(); updateUI(); checkNoMoreMoves();
    if (hasRolledDiceThisTurn) hideTurnAnnouncement(); else showTurnAnnouncement();
}

function sendChatMessage() {
    let input = document.getElementById('chat-input-text');
    if (!input) return;
    let msg = input.value.trim(); if (!msg) return;
    let myP = playersList[myPlayerId] || { name: "Player", color: "#2ecc71" };
    receiveChatMessage(myP.name, myP.color, msg);

    if (peer) {
        let packet = { type: 'CHAT_MSG', sender: myP.name, color: myP.color, text: msg };
        if (isHost) connections.forEach(c => c.send(packet));
        else if (hostConn) hostConn.send(packet);
    }
    input.value = '';
}

function receiveChatMessage(sender, color, text) {
    chatMessages.push({ sender, color, text });
    let log = document.getElementById('chat-messages-log');
    if (log) {
        let msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg-item';
        msgDiv.innerHTML = `<span class="chat-msg-author" style="color:${color};">${sender}:</span><span class="chat-msg-text">${text}</span>`;
        log.appendChild(msgDiv); log.scrollTop = log.scrollHeight;
    }
    if (!isChatOpen) { unreadChatCount++; updateChatBadge(); SFX.hover(); }
}