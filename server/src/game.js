const { v4: uuidv4 } = require('uuid');

const CARDS_PER_PLAYER = { 2: 10, 3: 9, 4: 8, 5: 8 };
const LIVES_PER_GAME = 3;
const TOTAL_CARDS = 40;

function createDeck() {
  return Array.from({ length: TOTAL_CARDS }, (_, i) => i + 1);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dealCards(playerIds) {
  const n = playerIds.length;
  const perPlayer = CARDS_PER_PLAYER[n] ?? 8;
  const deck = shuffle(createDeck());
  const hands = {};
  playerIds.forEach((id, i) => {
    hands[id] = deck.slice(i * perPlayer, (i + 1) * perPlayer).sort((a, b) => a - b);
  });
  return hands;
}

class Game {
  constructor(roomId) {
    this.id = roomId;
    this.players = [];
    this.state = 'lobby'; // lobby | playing | won | lost
    this.hands = {};
    this.played = [];
    this.lives = LIVES_PER_GAME;
    this.tokens = 0;
    this.lastAction = null;
  }

  addPlayer(id, name) {
    if (this.players.length >= 5 || this.state !== 'lobby') return false;
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
    return this.players.length >= 2 && this.players.every(p => p.ready);
  }

  start() {
    if (this.players.length < 2) return { error: 'Il faut au moins 2 joueurs.' };
    this.state = 'playing';
    this.hands = dealCards(this.players.map(p => p.id));
    this.played = [];
    this.lives = LIVES_PER_GAME;
    this.tokens = Math.floor(this.players.length / 2);
    this.lastAction = null;
    return null;
  }

  playCard(playerId, card) {
    const hand = this.hands[playerId];
    if (!hand) return { error: 'Joueur introuvable.' };
    const idx = hand.indexOf(card);
    if (idx === -1) return { error: 'Tu ne possèdes pas cette carte.' };

    const topCard = this.played.length > 0 ? this.played[this.played.length - 1].card : 0;

    if (card < topCard) {
      // card played too early — lose a life
      this.lives--;
      hand.splice(idx, 1);
      this.played.push({ playerId, card, mistake: true });
      this.lastAction = { type: 'mistake', playerId, card };

      if (this.lives <= 0) {
        this.state = 'lost';
        return { mistake: true, lost: true };
      }
      return { mistake: true };
    }

    hand.splice(idx, 1);
    this.played.push({ playerId, card });
    this.lastAction = { type: 'play', playerId, card };

    const allEmpty = this.players.every(p => this.hands[p.id].length === 0);
    if (allEmpty) {
      this.state = 'won';
      return { won: true };
    }
    return {};
  }

  useToken(playerId) {
    if (this.tokens <= 0) return { error: 'Plus de jetons.' };
    this.tokens--;
    // everyone reveals their lowest card
    const reveals = {};
    this.players.forEach(p => {
      const h = this.hands[p.id];
      reveals[p.id] = h.length > 0 ? Math.min(...h) : null;
    });
    this.lastAction = { type: 'token', playerId, reveals };
    return { reveals };
  }

  publicState(forPlayerId) {
    const otherHands = {};
    this.players.forEach(p => {
      if (p.id !== forPlayerId) {
        otherHands[p.id] = this.hands[p.id]?.length ?? 0;
      }
    });
    return {
      state: this.state,
      players: this.players,
      hand: this.hands[forPlayerId] ?? [],
      otherHands,
      played: this.played,
      lives: this.lives,
      tokens: this.tokens,
      lastAction: this.lastAction,
    };
  }
}

const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Game(roomId));
  return rooms.get(roomId);
}

function deleteRoom(roomId) {
  rooms.delete(roomId);
}

module.exports = { getOrCreateRoom, deleteRoom };
