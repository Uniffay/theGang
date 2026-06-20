const { rankPlayers, handName } = require('./poker');

const PHASES = ['preflop', 'flop', 'turn', 'river'];
const PHASE_COLORS = { preflop: 'white', flop: 'yellow', turn: 'orange', river: 'red' };
const COMMUNITY_COUNT = { preflop: 0, flop: 3, turn: 4, river: 5 };

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
  const d = [];
  for (const suit of SUITS) for (const value of VALUES) d.push({ value, suit });
  return d;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class Game {
  constructor(roomId) {
    this.id = roomId;
    this.players = [];   // [{ id, name, ready }]
    this.state = 'lobby'; // lobby | playing | reveal | won | lost
    this.hands = {};
    this.community = [];  // full 5 community cards (revealed progressively)
    this.phaseIndex = 0;
    this.tokenPool = [];          // tokens not held by anyone
    this.playerZones = {};        // playerId -> token (null = empty)
    this.completedPhases = [];    // [{ phase, color, zones }]
    this.revealOrder = null;      // set after river validation
    this.chat = [];
    this.lastEvent = null;
  }

  get phase() { return PHASES[this.phaseIndex]; }
  get color() { return PHASE_COLORS[this.phase]; }
  get n() { return this.players.length; }

  // ── Lobby ──────────────────────────────────────────────

  addPlayer(id, name) {
    if (this.n >= 8 || this.state !== 'lobby') return false;
    if (this.players.find(p => p.id === id)) return false;
    this.players.push({ id, name, ready: false });
    return true;
  }

  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id);
    delete this.hands[id];
    delete this.playerZones[id];
  }

  setReady(id, value) {
    const p = this.players.find(p => p.id === id);
    if (p) p.ready = value;
  }

  allReady() { return this.n >= 2 && this.players.every(p => p.ready); }

  // ── Start ───────────────────────────────────────────────

  start() {
    if (this.n < 2) return { error: 'Il faut au moins 2 joueurs.' };
    this.state = 'playing';
    this.phaseIndex = 0;
    this.completedPhases = [];
    this.revealOrder = null;
    this.chat = [];
    this.lastEvent = null;

    const deck = shuffle(createDeck());
    this.community = deck.slice(0, 5);
    let offset = 5;
    this.hands = {};
    for (const p of this.players) {
      this.hands[p.id] = [deck[offset++], deck[offset++]];
    }

    this._openPhase();
    return null;
  }

  // ── Phase management ────────────────────────────────────

  _openPhase() {
    this.tokenPool = Array.from({ length: this.n }, (_, i) => i + 1);
    this.playerZones = {};
    this.players.forEach(p => { this.playerZones[p.id] = null; });
    this.lastEvent = { type: 'phase-open', phase: this.phase, color: this.color };
  }

  visibleCommunity() {
    return this.community.slice(0, COMMUNITY_COUNT[this.phase]);
  }

  _validatePhase() {
    this.completedPhases.push({
      phase: this.phase,
      color: this.color,
      zones: { ...this.playerZones },
    });

    this.lastEvent = {
      type: 'phase-complete',
      phase: this.phase,
      color: this.color,
      zones: { ...this.playerZones },
    };

    if (this.phase === 'river') return this._reveal();

    this.phaseIndex++;
    this._openPhase();
    return { phaseComplete: true };
  }

  // ── Token interaction ────────────────────────────────────

  // Take a token (from pool or from another player).
  // Clicking your own token drops it back to pool.
  takeToken(playerId, token) {
    if (this.state !== 'playing') return { error: 'Pas en cours de jeu.' };
    if (token < 1 || token > this.n) return { error: 'Jeton invalide.' };

    const inPool = this.tokenPool.includes(token);
    const fromPlayerId = Object.keys(this.playerZones).find(pid => this.playerZones[pid] === token) ?? null;

    // Clicking own token → drop back to pool
    if (fromPlayerId === playerId) {
      this.playerZones[playerId] = null;
      this.tokenPool.push(token);
      this.tokenPool.sort((a, b) => a - b);
      this.lastEvent = { type: 'token-dropped', playerId };
      return { ok: true };
    }

    if (!inPool && !fromPlayerId) return { error: 'Jeton introuvable.' };

    // Put player's current token back to pool if they have one
    const myToken = this.playerZones[playerId] ?? null;
    if (myToken !== null) {
      this.tokenPool.push(myToken);
      this.tokenPool.sort((a, b) => a - b);
      this.playerZones[playerId] = null;
    }

    // Remove token from origin
    if (inPool) {
      this.tokenPool = this.tokenPool.filter(t => t !== token);
    } else if (fromPlayerId) {
      this.playerZones[fromPlayerId] = null;
    }

    this.playerZones[playerId] = token;
    this.lastEvent = { type: 'token-taken', playerId, fromPlayerId, token };

    // Auto-validate when every zone has exactly one token
    const allFilled = Object.values(this.playerZones).every(t => t !== null);
    if (allFilled) return this._validatePhase();

    return { ok: true };
  }

  // ── Reveal ───────────────────────────────────────────────

  _reveal() {
    const playerIds = this.players.map(p => p.id);
    const riverZones = this.completedPhases.find(cp => cp.phase === 'river')?.zones ?? {};
    const actualRanks = rankPlayers(this.hands, this.community, playerIds);

    // Sort by river token (1 = reveals first = claims to be weakest)
    this.revealOrder = this.players
      .map(p => ({
        id: p.id,
        name: p.name,
        token: riverZones[p.id],
        hand: this.hands[p.id],
        actualRank: actualRanks[p.id],
        handName: handName(this.hands[p.id], this.community),
        correct: riverZones[p.id] === actualRanks[p.id],
      }))
      .sort((a, b) => a.token - b.token);

    const allCorrect = this.revealOrder.every(r => r.correct);
    this.state = allCorrect ? 'won' : 'lost';
    this.lastEvent = { type: 'reveal', correct: allCorrect };
    return { reveal: true, correct: allCorrect };
  }

  // ── Chat ─────────────────────────────────────────────────

  // Remove token from whatever zone it's in, put back to pool
  releaseToken(token) {
    for (const pid of Object.keys(this.playerZones)) {
      if (this.playerZones[pid] === token) {
        this.playerZones[pid] = null;
        if (!this.tokenPool.includes(token)) {
          this.tokenPool.push(token);
          this.tokenPool.sort((a, b) => a - b);
        }
        this.lastEvent = { type: 'token-released', token };
        return { ok: true };
      }
    }
    return { ok: true };
  }

  addChat(playerId, text) {
    const name = this.players.find(p => p.id === playerId)?.name ?? '?';
    const msg = { name, text, ts: Date.now() };
    this.chat.push(msg);
    if (this.chat.length > 60) this.chat.shift();
    return msg;
  }

  reset() {
    this.players.forEach(p => { p.ready = false; });
    this.state = 'lobby';
    this.hands = {};
    this.completedPhases = [];
    this.revealOrder = null;
    this.lastEvent = null;
    this.chat = [];
  }

  // ── Public state (per player) ────────────────────────────

  publicState(forPlayerId) {
    const isOver = this.state === 'won' || this.state === 'lost';
    return {
      state: this.state,
      phase: this.phase,
      phaseIndex: this.phaseIndex,
      color: this.color,
      players: this.players,
      myHand: this.hands[forPlayerId] ?? [],
      community: this.visibleCommunity(),
      tokenPool: [...this.tokenPool],
      playerZones: { ...this.playerZones },
      completedPhases: this.completedPhases,
      revealOrder: isOver ? this.revealOrder : null,
      n: this.n,
      lastEvent: this.lastEvent,
      chat: this.chat,
    };
  }
}

const rooms = new Map();
function getOrCreateRoom(id) {
  if (!rooms.has(id)) rooms.set(id, new Game(id));
  return rooms.get(id);
}
function deleteRoom(id) { rooms.delete(id); }

module.exports = { getOrCreateRoom, deleteRoom };
