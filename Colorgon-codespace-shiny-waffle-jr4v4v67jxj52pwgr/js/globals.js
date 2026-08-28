// CONFIG & CONSTANTS
const colorMap = { 'r': '#e74c3c', 'b': '#3498db', 'y': '#f1c40f', 'w': '#ffffff', 'k': '#2c3e50' };
const vibrantColorMap = { 'r': '#ff0033', 'b': '#00e5ff', 'y': '#ffe600' };

const wedges = ["M0,0 L20,-34.64 L40,0 Z", "M0,0 L40,0 L20,34.64 Z", "M0,0 L20,34.64 L-20,34.64 Z", "M0,0 L-20,34.64 L-40,0 Z", "M0,0 L-40,0 L-20,-34.64 Z", "M0,0 L-20,-34.64 L20,-34.64 Z"];
const wedgeOffsets = [{ dx: 15, dy: -18 }, { dx: 22, dy: 12 }, { dx: 0, dy: 25 }, { dx: -22, dy: 12 }, { dx: -22, dy: -18 }, { dx: 0, dy: -25 }];
const neighbors = [{ dq: 1, dr: -1, edge: 0, opp: 3 }, { dq: 1, dr: 0, edge: 1, opp: 4 }, { dq: 0, dr: 1, edge: 2, opp: 5 }, { dq: -1, dr: 1, edge: 3, opp: 0 }, { dq: -1, dr: 0, edge: 4, opp: 1 }, { dq: 0, dr: -1, edge: 5, opp: 2 }];

// GAME STATE
let grid = new Map();
let playersList = [];
let activePlayerIdx = 0;
let myPlayerId = 0;

let winConditionType = 'score', winTargetValue = 100, targetHandSize = 3;
let voidDensitySetting = 'normal'; 
let turnTimerDuration = 0, turnTimerInterval = null, turnTimeRemaining = 0;
let localSecretHandEnabled = false;

let selectedHandIndex = -1, hasRolledDiceThisTurn = false, isRolling = false, isAnimating = false, playsLeft = 2, tilesPlayedThisTurn = 0, totalTilesPlaced = 0;
let diceActive = [], lastDiceValues = { r: 1, b: 1, y: 1 }, panX = 0, panY = 0, currentBoardScale = 1.0, isGameOver = false;

let particleFXEnabled = true, validGuidesEnabled = true, cinematicCameraEnabled = true;
let sfxVolume = 1.0, masterSoundMuted = false;

let chatMessages = [], unreadChatCount = 0, isChatOpen = false;
let hostBotSlots = [];

// BOARD TRACKERS
let activePreviewSocketKey = null;
let recentMatchWedges = new Set();
let recentColorgonWedges = new Set();
let activeColorgonColor = null; 
let scoredColorgons = new Set();
let newlyPlacedKey = null;

let pendingDrawQueue = 0;
let pendingDrawPlayerIdx = null;

// NETWORKING GLOBALS
let peer = null, connections = [], hostConn = null, isHost = false, roomCode = '', isReady = false;

// CAMERA & TOUCH GLOBALS
let activePointers = new Map();
let isPinching = false, initialPinchDist = 0, initialScale = 1.0;
let isDragging = false, hasDragged = false, dragStartX = 0, dragStartY = 0, panAnimationId = null;

// CANVAS GLOBALS
let ambientStars = [], ambientOrbs = [], shootingStars = [], boardMistParticles = [];

// LOCAL LOBBY DEFAULTS
let localSlotSetup = [
    { name: "Player 1", type: "human", color: "#2ecc71", difficulty: "normal" },
    { name: "Bot 1", type: "bot", color: "#e67e22", difficulty: "normal" }
];

// UTILITIES
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function getPinchDistance() {
    let pts = Array.from(activePointers.values());
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}