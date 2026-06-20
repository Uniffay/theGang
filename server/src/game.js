const { rankPlayers, handName } = require('./poker');

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const STAGES = ['preflop', 'flop', 'turn', 'river'];
const COMMUNITY_COUNT = { preflop: 0, flop: 3, turn: 4, river: 5 };
const LIVES = 3;

function createDeck() {
  const deck = [];
  for (const suit of SUITS) for (const value of VALUES) deck.push({ value, suit });
  return deck;
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
    this.players = [];
    this.state = 'lobby';
    this.hands = {};
    this.deck = [];
    this.community = [];
    this.stageIndex = 0;
    this.pendingTokens = {};   // playerId -> token chosen (null = not chosen)
    this.lives = LIVES;
    this.lastEvent = null;
    this.finalRanks = null;
    this.chat = [];
  }

  get stage() { return STAGES[this.stageIndex]; }
  get n() { return this.players.length; }

  addPlayer(id, name) {
    if (this.n >= 5 || this.state !== 'lobby') return false;
    if (this.players.find(p => p.id === id)) return false;
    this.players.push({ id, name, ready: false });
    return true;
  }

  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id);
    delete this.hands[id];
  }

  setReady(id, value) {
    const p = this.players.find(p => p.id === id);
    if (p) p.ready = value;
  }

  allReady() {
    return this.n >= 2 && this.players.every(p => p.ready);
  }

  start() {
    if (this.n < 2) return { error: 'Il faut au moins 2 joueurs.' };
    this.state = 'playing';
    this.stageIndex = 0;
    this.lives = LIVES;
    this.finalRanks = null;
    this.lastEvent = null;
    this.chat = [];

    const deck = shuffle(createDeck());
    this.community = deck.slice(0, 5); // 5 community cards (revealed progressively)
    let offset = 5;
    this.hands = {};
    for (const p of this.players) {
      this.hands[p.id] = [deck[offset++], deck[offset++]];
    }
    this.deck = deck;
    this._openStage();
    return null;
  }

  _openStage() {
    this.pendingTokens = {};
    this.players.forEach(p => { this.pendingTokens[p.id] = null; });
    this.lastEvent = { type: 'stage-open', stage: this.stage };
  }

  visibleCommunity() {
    return this.community.slice(0, COMMUNITY_COUNT[this.stage]);
  }

  pickToken(playerId, token) {
    if (this.state !== 'playing') return { error: 'Partie non active.' };
    if (!this.pendingTokens.hasOwnProperty(playerId)) return { error: 'Joueur introuvable.' };
    if (this.pendingTokens[playerId] !== null) return { error: 'Tu as déjà choisi.' };
    if (token < 1 || token > this.n) return { error: `Jeton invalide (1–${this.n}).` };

    this.pendingTokens[playerId] = token;

    // Check if everyone has picked
    const allPicked = Object.values(this.pendingTokens).every(t => t !== null);
    if (!allPicked) return { waiting: true };

    return this._resolveStage();
  }

  _resolveStage() {
    const choices = this.pendingTokens;
    const tokens = Object.values(choices);
    const unique = new Set(tokens);
    const hasConflict = unique.size < tokens.length;

    if (hasConflict) {
      this.lives--;
      this.lastEvent = {
        type: 'conflict',
        choices: { ...choices },
        stage: this.stage,
      };

      if (this.lives <= 0) {
        this.state = 'lost';
        this.lastEvent.lost = true;
        return { conflict: true, lost: true };
      }

      // Redo this stage
      this._openStage();
      return { conflict: true };
    }

    // No conflict — check if it's the river
    if (this.stage === 'river') {
      return this._finalCheck(choices);
    }

    // Advance to next stage
    this.lastEvent = {
      type: 'stage-clear',
      stage: this.stage,
      choices: { ...choices },
    };
    this.stageIndex++;
    this._openStage();
    return { ok: true };
  }

  _finalCheck(choices) {
    const playerIds = this.players.map(p => p.id);
    const ranks = rankPlayers(this.hands, this.community, playerIds);
    this.finalRanks = ranks;

    // Check if every player's token matches their actual rank
    const correct = playerIds.every(id => choices[id] === ranks[id]);

    this.lastEvent = {
      type: 'final',
      choices: { ...choices },
      ranks,
      handNames: Object.fromEntries(playerIds.map(id => [id, handName(this.hands[id], this.community)])),
      correct,
    };

    this.state = correct ? 'won' : 'lost';
    return { final: true, correct };
  }

  addChat(playerId, text) {
    const name = this.players.find(p => p.id === playerId)?.name ?? '?';
    const msg = { name, text, ts: Date.now() };
    this.chat.push(msg);
    if (this.chat.length > 50) this.chat.shift();
    return msg;
  }

  reset() {
    this.players.forEach(p => { p.ready = false; });
    this.state = 'lobby';
    this.hands = {};
    this.finalRanks = null;
    this.lastEvent = null;
    this.chat = [];
  }

  publicState(forPlayerId) {
    const comm = this.visibleCommunity();
    const myHand = this.hands[forPlayerId] ?? [];
    const revealHands = this.state === 'won' || this.state === 'lost';

    const otherPlayers = this.players
      .filter(p => p.id !== forPlayerId)
      .map(p => ({
        id: p.id,
        name: p.name,
        hasPicked: this.pendingTokens[p.id] !== null,
        hand: revealHands ? this.hands[p.id] : null,
      }));

    return {
      state: this.state,
      stage: this.stage,
      stageIndex: this.stageIndex,
      players: this.players,
      myHand,
      community: comm,
      lives: this.lives,
      n: this.n,
      myToken: this.pendingTokens[forPlayerId] ?? null,
      otherPlayers,
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
