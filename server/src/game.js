const { rankPlayers, handName, bestFiveCards, rankPlayersOmaha, handNameOmaha, bestFiveCardsOmaha, rankPlayersBanana, bestFiveCardsBanana, rankPlayersBananaOmaha, handNameBananaOmaha, bestFiveCardsBananaOmaha, rankPlayersWithCommunities, rankPlayersBananaOmahaWithCommunities, bestHandScore, bestHandScoreOmaha, bestHandScoreBananaOmaha } = require('./poker');

const PHASES = ['preflop', 'flop', 'turn', 'river'];

const MALUS_DECK = [
  {
    id: 'jeton-noir',
    name: 'Jeton 1 Maudit',
    description: 'Phases blanc/jaune/orange : le jeton 1 est maudit. Celui qui le touche le reçoit dans sa zone et ne peut plus être bougé.',
    icon: '🖤',
  },
  {
    id: 'jeton-haut-noir',
    name: 'Jeton Élevé Maudit',
    description: 'Phases blanc/jaune/orange : le jeton le plus élevé est maudit. Celui qui le touche le reçoit dans sa zone et ne peut plus être bougé.',
    icon: '⬛',
  },
  {
    id: 'echange-tete',
    name: 'Échange de Tête',
    description: 'Si une tête (K, D, J) apparaît au flop, le joueur avec le jeton 1 défausse ses cartes et en pioche de nouvelles.',
    icon: '👑',
  },
  {
    id: 'echange-sans-tete',
    name: 'Échange Sans Tête',
    description: 'Si aucune tête (K, D, J) n\'apparaît au flop, le joueur au jeton le plus élevé défausse ses cartes et en pioche de nouvelles.',
    icon: '🔄',
  },
  {
    id: 'camera-surveillance',
    name: 'Caméra de Surveillance',
    description: 'Chaque joueur reçoit une carte supplémentaire en main.',
    icon: '📹',
  },
  {
    id: 'orangophobe',
    name: 'Orangophobe',
    description: 'Le tour orange est supprimé. On passe directement du flop à la river.',
    icon: '🟠',
  },
  {
    id: 'jugement-final',
    name: 'Jugement Final',
    description: 'Avant la révélation, le gang vote une carte. Si le joueur au jeton le plus élevé ne l\'a pas, c\'est perdu.',
    icon: '⚖️',
  },
  {
    id: 'analyse-jeu',
    name: 'Analyse de Jeu',
    description: 'Avant la révélation du dernier joueur, le gang vote sur sa combinaison de main. Si la majorité se trompe, c\'est perdu.',
    icon: '🕵️',
  },
];
const PHASE_COLORS = { preflop: 'white', flop: 'yellow', turn: 'orange', river: 'red' };
const COMMUNITY_COUNT = { preflop: 0, flop: 3, turn: 4, river: 5 };
const BANANA_PHASE_COUNT = { preflop: 0, flop: 1, turn: 2, river: 3 };

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
  const d = [];
  for (const suit of SUITS) for (const value of VALUES) d.push({ value, suit });
  d.push({ value: 'Jo', suit: '★', isJoker: true });
  d.push({ value: 'Jo', suit: '★', isJoker: true });
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

// Draw n non-joker cards from the front of a deck array (mutates deck)
function drawNonJoker(deck, n) {
  const drawn = [];
  while (drawn.length < n && deck.length > 0) {
    const card = deck.shift();
    if (!card.isJoker) drawn.push(card);
  }
  return drawn;
}

// Expand joker slots in a community array into all possible flat card arrays
function expandCommunity(community) {
  const result = [[]];
  for (const c of community) {
    if (c && c.isJokerSlot && c.cards?.length) {
      const next = [];
      for (const partial of result)
        for (const card of c.cards) next.push([...partial, card]);
      result.length = 0;
      result.push(...next);
    } else {
      for (const partial of result) partial.push(c);
    }
  }
  return result;
}

const hasJokerSlots = arr => arr.some(c => c?.isJokerSlot);

// Find the community expansion (flat array) that maximises scoreFn for the given hand
function bestCommExpansion(hand, community, scoreFn) {
  if (!hasJokerSlots(community)) return community;
  let best = null, bestScore = -Infinity;
  for (const c of expandCommunity(community)) {
    const score = scoreFn(hand, c);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// Rank players when community may contain joker slots
function rankWithJokerSlots(playerIds, scoreFn) {
  const scores = playerIds.map(id => ({ id, score: scoreFn(id) }));
  scores.sort((a, b) => a.score - b.score);
  const result = {};
  let i = 0;
  while (i < scores.length) {
    const score = scores[i].score;
    let j = i;
    while (j < scores.length && scores[j].score === score) j++;
    for (let k = i; k < j; k++) result[scores[k].id] = { rank: i + 1, minRank: i + 1, maxRank: j };
    i = j;
  }
  return result;
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
    this.playerZones = {};        // playerId -> token | null
    this.completedPhases = [];    // [{ phase, color, zones }]
    this.revealOrder = null;      // set after river validation
    this.chat = [];
    this.lastEvent = null;
    this.countdownStartedAt = null;
    this.restartVotes = new Set();
    this.mode = 'texas'; // 'texas' | 'omaha'
    this.activeMalus = [];
    this.defaultMalus = []; // malus pre-selected in lobby
    this.excludedMalus = new Set(); // malus banned from the draw pool
    this.lockedZones = {}; // { playerId: token } — token locked in that zone
    this.deck = []; // remaining cards after deal
    this.betweenCards = []; // banana split: card between players[i] and players[(i+1)%N]
    this.voteState = null; // { targetId, votes: { playerId: value } }
    this.jokerChoices = {}; // { playerId: [{ handIdx, cards: [c1,c2] }] } — pending joker choices
  }

  setMode(mode) {
    if (this.state !== 'lobby') return;
    if (['texas','omaha','banana','banana-omaha'].includes(mode)) this.mode = mode;
  }

  toggleDefaultMalus(id) {
    if (this.state !== 'lobby') return;
    const idx = this.defaultMalus.findIndex(m => m.id === id);
    if (idx >= 0) {
      this.defaultMalus.splice(idx, 1);
    } else {
      const malus = MALUS_DECK.find(m => m.id === id);
      if (malus) this.defaultMalus.push(malus);
    }
  }

  toggleExcludedMalus(id) {
    if (this.state !== 'lobby') return;
    if (this.excludedMalus.has(id)) {
      this.excludedMalus.delete(id);
    } else {
      this.excludedMalus.add(id);
      this.defaultMalus = this.defaultMalus.filter(m => m.id !== id);
    }
  }

  hasMalus(id) { return this.activeMalus.some(m => m.id === id); }

  get phase() { return PHASES[this.phaseIndex]; }
  get color() { return PHASE_COLORS[this.phase]; }
  get n() { return this.players.filter(p => !p.left).length; }
  get hostId() { return this.players.find(p => !p.left)?.id ?? this.players[0]?.id; }

  // ── Lobby ──────────────────────────────────────────────

  addPlayer(id, name, emoji = '🐱') {
    // Rejoin: player with same name exists but is inactive (disconnected during game)
    const existing = this.players.find(p => p.name === name);
    if (existing) {
      if (existing.active || existing.left) return false; // name taken or player was kicked
      const oldId = existing.id;
      existing.id = id;
      existing.active = true;
      existing.emoji = emoji;
      this._migrateId(oldId, id);
      return true;
    }
    // New join: only in lobby
    if (this.state !== 'lobby' || this.n >= 8) return false;
    this.players.push({ id, name, emoji, ready: false, active: true, left: false });
    return true;
  }

  _migrateId(oldId, newId) {
    if (Object.prototype.hasOwnProperty.call(this.playerZones, oldId)) {
      this.playerZones[newId] = this.playerZones[oldId];
      delete this.playerZones[oldId];
    }
    if (this.hands[oldId] !== undefined) {
      this.hands[newId] = this.hands[oldId];
      delete this.hands[oldId];
    }
    for (const cp of this.completedPhases) {
      if (cp.zones[oldId] !== undefined) {
        cp.zones[newId] = cp.zones[oldId];
        delete cp.zones[oldId];
      }
    }
    if (this.revealOrder) {
      for (const r of this.revealOrder) {
        if (r.id === oldId) r.id = newId;
      }
    }
  }

  markDisconnected(id) {
    const p = this.players.find(p => p.id === id);
    if (p) p.active = false;
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

  start(fromLobby = false) {
    if (this.n < 2) return { error: 'Il faut au moins 2 joueurs.' };
    this.state = 'playing';
    this.phaseIndex = 0;
    this.completedPhases = [];
    this.revealOrder = null;
    this.chat = [];
    this.lastEvent = null;
    if (fromLobby) this.activeMalus = [...this.defaultMalus];

    const deck = shuffle(createDeck());
    this.hands = {};
    const baseHoleCount = (this.mode === 'omaha' || this.mode === 'banana-omaha') ? 4 : 2;
    const holeCount = baseHoleCount + (this.hasMalus('camera-surveillance') ? 1 : 0);
    let offset = 0;

    if (this.mode === 'banana' || this.mode === 'banana-omaha') {
      this.community = [];
      const activePlayers = this.players.filter(p => !p.left);
      for (const p of activePlayers) {
        this.hands[p.id] = deck.slice(offset, offset + holeCount);
        offset += holeCount;
      }
      // 3 cards per adjacent pair; use this.players.length for circular layout
      this.betweenCards = [];
      for (let i = 0; i < this.players.length; i++) {
        this.betweenCards.push(deck.slice(offset, offset + 3));
        offset += 3;
      }
    } else {
      this.community = deck.slice(0, 5);
      offset = 5;
      for (const p of this.players) {
        this.hands[p.id] = deck.slice(offset, offset + holeCount);
        offset += holeCount;
      }
      this.betweenCards = [];
    }
    this.deck = deck.slice(offset);

    // ── Joker handling ──────────────────────────────────────────────
    // Community jokers → replace with a slot of 2 cards (auto, no player choice)
    this.community = this.community.map(c => {
      if (!c?.isJoker) return c;
      return { isJokerSlot: true, cards: drawNonJoker(this.deck, 2) };
    });
    this.betweenCards = this.betweenCards.map(bCards =>
      bCards.map(c => {
        if (!c?.isJoker) return c;
        return { isJokerSlot: true, cards: drawNonJoker(this.deck, 2) };
      })
    );
    // Hand jokers → pause for player choice
    this.jokerChoices = {};
    for (const p of this.players.filter(pl => !pl.left)) {
      const hand = this.hands[p.id];
      if (!hand) continue;
      for (let i = 0; i < hand.length; i++) {
        if (hand[i]?.isJoker) {
          if (!this.jokerChoices[p.id]) this.jokerChoices[p.id] = [];
          this.jokerChoices[p.id].push({ handIdx: i, cards: drawNonJoker(this.deck, 2) });
          hand[i] = null; // placeholder until chosen
        }
      }
    }
    if (Object.keys(this.jokerChoices).length > 0) {
      this.state = 'joker-choice';
      return null;
    }

    this._openPhase();
    return null;
  }

  resolveJoker(playerId, chosenIdx) {
    if (this.state !== 'joker-choice') return { error: 'Pas en phase de choix joker.' };
    const pending = this.jokerChoices[playerId];
    if (!pending?.length) return { error: 'Pas de joker à résoudre.' };
    const { handIdx, cards } = pending[0];
    if (chosenIdx < 0 || chosenIdx >= cards.length) return { error: 'Choix invalide.' };
    this.hands[playerId][handIdx] = cards[chosenIdx];
    pending.shift();
    if (pending.length === 0) delete this.jokerChoices[playerId];
    if (Object.keys(this.jokerChoices).length === 0) {
      this.state = 'playing';
      this._openPhase();
      return { allResolved: true };
    }
    return { ok: true };
  }

  // ── Phase management ────────────────────────────────────

  _openPhase() {
    const active = this.players.filter(p => !p.left);
    this.tokenPool = Array.from({ length: active.length }, (_, i) => i + 1);
    this.playerZones = {};
    this.lockedZones = {};
    active.forEach(p => { this.playerZones[p.id] = null; });
    this.lastEvent = { type: 'phase-open', phase: this.phase, color: this.color };
    if (this.phase === 'flop') this._applyFlopSwap();
  }

  _applyFlopSwap() {
    if (this.mode === 'banana' || this.mode === 'banana-omaha') return;
    const prevPhase = this.completedPhases.find(cp => cp.phase === 'preflop');
    if (!prevPhase) return;

    const zones = prevPhase.zones;
    const holeCount = (this.mode === 'omaha' ? 4 : 2) + (this.hasMalus('camera-surveillance') ? 1 : 0);
    let targetId = null;
    let reason = null;

    if (this.hasMalus('echange-tete')) {
      for (const [pid, tok] of Object.entries(zones)) {
        if (tok === 1) {
          const hand = this.hands[pid] ?? [];
          if (hand.some(c => ['K', 'Q', 'J'].includes(c.value))) {
            targetId = pid;
            reason = 'tete';
          }
          break;
        }
      }
    }

    if (!targetId && this.hasMalus('echange-sans-tete')) {
      let maxTok = 0, maxId = null;
      for (const [pid, tok] of Object.entries(zones)) {
        if (tok > maxTok) { maxTok = tok; maxId = pid; }
      }
      if (maxId) {
        const hand = this.hands[maxId] ?? [];
        if (!hand.some(c => ['K', 'Q', 'J'].includes(c.value))) {
          targetId = maxId;
          reason = 'sans-tete';
        }
      }
    }

    if (!targetId) return;

    const newHand = drawNonJoker(this.deck, holeCount);
    if (newHand.length < holeCount) return; // deck exhausted, keep old hand
    this.hands[targetId] = newHand;
    this.lastEvent = {
      type: 'cards-redrawn',
      phase: 'flop',
      reason,
      targetId,
      ts: Date.now(),
    };
  }

  visibleCommunity(forPlayerId = null) {
    if (this.mode === 'banana' || this.mode === 'banana-omaha') {
      const idx = this.players.findIndex(p => p.id === forPlayerId);
      if (idx < 0) return [];
      const N = this.players.length;
      const count = BANANA_PHASE_COUNT[this.phase] ?? 0;
      return [
        ...(this.betweenCards[(idx - 1 + N) % N] ?? []).slice(0, count),
        ...(this.betweenCards[idx] ?? []).slice(0, count),
      ];
    }
    return this.community.slice(0, COMMUNITY_COUNT[this.phase]);
  }

  _validatePhase() {
    const zones = { ...this.playerZones };
    this.completedPhases.push({ phase: this.phase, color: this.color, zones });
    this.lastEvent = { type: 'phase-complete', phase: this.phase, color: this.color, zones };

    if (this.phase === 'river') return this._reveal();

    this.phaseIndex++;
    if (this.phase === 'turn' && this.hasMalus('orangophobe')) this.phaseIndex++;
    this._openPhase();
    return { phaseComplete: true };
  }

  // ── Token interaction ────────────────────────────────────

  takeToken(playerId, token) {
    return this.placeToken(playerId, playerId, token);
  }

  // Place a token in a player's zone — replaces their previous claim
  placeToken(requestingPlayerId, targetPlayerId, token) {
    if (this.state !== 'playing') return { error: 'Pas en cours de jeu.' };
    if (token < 1 || token > this.n) return { error: 'Jeton invalide.' };
    if (!Object.prototype.hasOwnProperty.call(this.playerZones, targetPlayerId)) return { error: 'Joueur invalide.' };

    // Reject if this token is locked
    const lockedPid = Object.keys(this.lockedZones).find(pid => this.lockedZones[pid] === token);
    if (lockedPid) return { error: 'Ce jeton est maudit et ne peut pas être bougé.' };

    const notRiver = this.color !== 'red';

    // Jeton Noir: token 1 snaps to requester's zone and locks (not during river)
    if (token === 1 && this.hasMalus('jeton-noir') && notRiver) {
      targetPlayerId = requestingPlayerId;
    }
    // Jeton Haut Noir: highest token snaps to requester's zone and locks (not during river)
    if (token === this.n && this.hasMalus('jeton-haut-noir') && notRiver) {
      targetPlayerId = requestingPlayerId;
    }

    // Remove token from pool or any zone
    this.tokenPool = this.tokenPool.filter(t => t !== token);
    for (const pid of Object.keys(this.playerZones)) {
      if (this.playerZones[pid] === token) this.playerZones[pid] = null;
    }

    // Return target's current token to pool (unless that zone is locked)
    const existing = this.playerZones[targetPlayerId];
    if (existing !== null && this.lockedZones[targetPlayerId] !== existing) {
      this.tokenPool.push(existing);
      this.tokenPool.sort((a, b) => a - b);
    }

    this.playerZones[targetPlayerId] = token;

    // Lock cursed tokens
    if (token === 1 && this.hasMalus('jeton-noir') && notRiver) {
      this.lockedZones[targetPlayerId] = token;
    }
    if (token === this.n && this.hasMalus('jeton-haut-noir') && notRiver) {
      this.lockedZones[targetPlayerId] = token;
    }

    this.lastEvent = { type: 'token-placed', requestingPlayerId, targetPlayerId, token };

    const allFilled = Object.values(this.playerZones).every(t => t !== null);
    return { ok: true, allFilled };
  }

  validateNow() {
    this.countdownStartedAt = null;
    return this._validatePhase();
  }

  // ── Reveal ───────────────────────────────────────────────

  _reveal() {
    const activePlayers = this.players.filter(p => !p.left);
    const activePlayerIds = activePlayers.map(p => p.id);
    const riverZones = this.completedPhases.find(cp => cp.phase === 'river')?.zones ?? {};
    const isOmaha = this.mode === 'omaha';
    const isBanana = this.mode === 'banana';
    const isBananaOmaha = this.mode === 'banana-omaha';
    const hasBetweenCards = isBanana || isBananaOmaha;
    const N = this.players.length; // full layout size for circular between-cards

    // Precompute community for each active player using their original seat index
    const communityMap = {};
    if (hasBetweenCards) {
      activePlayers.forEach(p => {
        const origIdx = this.players.findIndex(pp => pp.id === p.id);
        communityMap[p.id] = [
          ...(this.betweenCards[(origIdx - 1 + N) % N] ?? []),
          ...(this.betweenCards[origIdx] ?? []),
        ];
      });
    }

    const rankInfo = hasBetweenCards
      ? rankWithJokerSlots(activePlayerIds, id => {
          const comm = communityMap[id] || [];
          const sf = isBananaOmaha ? bestHandScoreBananaOmaha : bestHandScore;
          return Math.max(...(hasJokerSlots(comm) ? expandCommunity(comm) : [comm]).map(c => sf(this.hands[id] || [], c)));
        })
      : rankWithJokerSlots(activePlayerIds, id => {
          const sf = isOmaha ? bestHandScoreOmaha : bestHandScore;
          return Math.max(...(hasJokerSlots(this.community) ? expandCommunity(this.community) : [this.community]).map(c => sf(this.hands[id] || [], c)));
        });

    // Sort by river token (1 = reveals first = claims to be weakest)
    this.revealOrder = activePlayers
      .map(p => {
        const info = rankInfo[p.id] ?? { rank: 1, minRank: 1, maxRank: 1 };
        const token = riverZones[p.id];
        let bestFive, hName, community2 = null;
        const hand = this.hands[p.id];
        if (hasBetweenCards) {
          community2 = communityMap[p.id];
          const sf = isBananaOmaha ? bestHandScoreBananaOmaha : bestHandScore;
          const bestComm = bestCommExpansion(hand, community2, sf);
          if (isBananaOmaha) {
            bestFive = bestFiveCardsBananaOmaha(hand, bestComm);
            hName = handNameBananaOmaha(hand, bestComm);
          } else {
            bestFive = bestFiveCardsBanana(hand, bestComm);
            hName = handName(hand, bestComm);
          }
        } else if (isOmaha) {
          const bestComm = bestCommExpansion(hand, this.community, bestHandScoreOmaha);
          bestFive = bestFiveCardsOmaha(hand, bestComm);
          hName = handNameOmaha(hand, bestComm);
        } else {
          const bestComm = bestCommExpansion(hand, this.community, bestHandScore);
          bestFive = bestFiveCards(hand, bestComm);
          hName = handName(hand, bestComm);
        }
        return {
          id: p.id, name: p.name, token,
          hand: this.hands[p.id],
          bestFive,
          community: community2,
          actualRank: info.rank,
          handName: hName,
          correct: token != null && token >= info.minRank && token <= info.maxRank,
        };
      })
      .sort((a, b) => a.token - b.token);

    const voteQueue = [];
    if (this.hasMalus('jugement-final')) voteQueue.push('card');
    if (this.hasMalus('analyse-jeu')) voteQueue.push('hand');

    if (voteQueue.length > 0) {
      const target = this.revealOrder[this.revealOrder.length - 1];
      this.state = 'voting';
      this.voteState = { targetId: target.id, votes: {}, voteType: voteQueue[0], queue: voteQueue.slice(1), passed: [] };
      this.lastEvent = { type: 'vote-started', targetId: target.id, ts: Date.now() };
      return { voting: true };
    }

    const allCorrect = this.revealOrder.every(r => r.correct);
    this.state = allCorrect ? 'won' : 'lost';
    this.lastEvent = { type: 'reveal', correct: allCorrect };
    return { reveal: true, correct: allCorrect };
  }

  // ── Vote (Jugement Final / Analyse de Jeu) ───────────────

  submitVote(playerId, value) {
    if (this.state !== 'voting' || !this.voteState) return { error: 'Pas en phase de vote.' };
    if (playerId === this.voteState.targetId) return { error: 'Tu ne peux pas voter.' };
    const CARD_VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const HAND_NAMES = ['Carte haute','Paire','Double paire','Brelan','Quinte','Couleur','Full','Carré','Quinte flush','Quinte flush royale'];
    const valid = this.voteState.voteType === 'hand' ? HAND_NAMES : CARD_VALUES;
    if (!valid.includes(value)) return { error: 'Valeur invalide.' };

    this.voteState.votes[playerId] = value; // overwrite to allow vote change

    const nonTarget = this.players.filter(p => p.id !== this.voteState.targetId && !p.left);
    if (!nonTarget.every(p => this.voteState.votes[p.id])) return { ok: true, allVoted: false };

    // Tally votes with random tiebreak
    const tally = {};
    for (const v of Object.values(this.voteState.votes)) tally[v] = (tally[v] ?? 0) + 1;
    const max = Math.max(...Object.values(tally));
    const winners = Object.keys(tally).filter(v => tally[v] === max);
    const challengeValue = winners[Math.floor(Math.random() * winners.length)];

    const targetId = this.voteState.targetId;
    const voteType = this.voteState.voteType;
    const nextQueue = this.voteState.queue ?? [];
    const prevPassed = this.voteState.passed ?? [];

    let challengePassed;
    if (voteType === 'hand') {
      let actual;
      const th = this.hands[targetId] || [];
      if (this.mode === 'banana' || this.mode === 'banana-omaha') {
        const idx = this.players.findIndex(p => p.id === targetId);
        const Nv = this.players.length;
        const c6 = [
          ...(this.betweenCards[(idx - 1 + Nv) % Nv] ?? []),
          ...(this.betweenCards[idx] ?? []),
        ];
        const sf = this.mode === 'banana-omaha' ? bestHandScoreBananaOmaha : bestHandScore;
        const bestComm = bestCommExpansion(th, c6, sf);
        actual = this.mode === 'banana-omaha'
          ? handNameBananaOmaha(th, bestComm)
          : handName(th, bestComm);
      } else if (this.mode === 'omaha') {
        const bestComm = bestCommExpansion(th, this.community, bestHandScoreOmaha);
        actual = handNameOmaha(th, bestComm);
      } else {
        const bestComm = bestCommExpansion(th, this.community, bestHandScore);
        actual = handName(th, bestComm);
      }
      challengePassed = challengeValue === actual;
    } else {
      challengePassed = (this.hands[targetId] ?? []).some(c => c.value === challengeValue);
    }

    const thisResult = { voteType, challengeValue, passed: challengePassed };

    // If more votes queued, start the next one
    if (nextQueue.length > 0) {
      this.voteState = { targetId, votes: {}, voteType: nextQueue[0], queue: nextQueue.slice(1), passed: [...prevPassed, thisResult] };
      this.lastEvent = { type: 'vote-started', targetId, ts: Date.now() };
      return { ok: true, allVoted: true };
    }

    this.voteState = null;
    const allResults = [...prevPassed, thisResult];
    const allChallengesPassed = allResults.every(r => r.passed);
    const firstFailed = allResults.find(r => !r.passed);
    const allCorrect = this.revealOrder.every(r => r.correct);
    this.state = (!allChallengesPassed || !allCorrect) ? 'lost' : 'won';
    this.lastEvent = {
      type: allChallengesPassed ? 'vote-passed' : 'vote-failed',
      challengeValue: firstFailed ? firstFailed.challengeValue : challengeValue,
      voteType: firstFailed ? firstFailed.voteType : voteType,
      targetId,
      ts: Date.now(),
    };
    return { ok: true, allVoted: true };
  }

  // ── Leave / Kick ─────────────────────────────────────────

  leaveGame(playerId) {
    const p = this.players.find(pl => pl.id === playerId);
    if (!p || p.left) return false;
    p.left = true;
    p.active = false;

    // Return their current phase token to pool
    if (Object.prototype.hasOwnProperty.call(this.playerZones, playerId)) {
      const token = this.playerZones[playerId];
      if (token !== null) this.tokenPool.push(token);
      delete this.playerZones[playerId];
    }
    delete this.lockedZones[playerId];

    // Trim pool to valid range 1..newN
    const newN = this.players.filter(pl => !pl.left).length;
    this.tokenPool = this.tokenPool.filter(t => t <= newN).sort((a, b) => a - b);

    this.lastEvent = { type: 'player-left', playerId, name: p.name, ts: Date.now() };

    const remaining = this.players.filter(pl => !pl.left);
    const allFilled = remaining.length > 0 && remaining.every(pl =>
      pl.id in this.playerZones && this.playerZones[pl.id] !== null
    );
    return { allFilled };
  }

  // ── Chat ─────────────────────────────────────────────────

  releaseToken(token) {
    // Reject if locked
    const lockedPid = Object.keys(this.lockedZones).find(pid => this.lockedZones[pid] === token);
    if (lockedPid) return { error: 'Ce jeton est maudit et ne peut pas être bougé.' };

    for (const pid of Object.keys(this.playerZones)) {
      if (this.playerZones[pid] === token) this.playerZones[pid] = null;
    }
    if (!this.tokenPool.includes(token)) {
      this.tokenPool.push(token);
      this.tokenPool.sort((a, b) => a - b);
    }
    this.lastEvent = { type: 'token-released', token };
    return { ok: true };
  }

  nextManche() {
    const won = this.state === 'won';
    let newMalus = null;
    if (won) {
      const available = MALUS_DECK.filter(m => !this.activeMalus.some(a => a.id === m.id) && !this.excludedMalus.has(m.id));
      if (available.length > 0) {
        newMalus = available[Math.floor(Math.random() * available.length)];
        this.activeMalus.push(newMalus);
      }
    }
    this.restartVotes = new Set();
    this.lockedZones = {};
    this.voteState = null;
    return { newMalus };
  }

  resetZero() {
    this.activeMalus = [];
    this.defaultMalus = [];
    this.excludedMalus = new Set();
    this.lockedZones = {};
    this.betweenCards = [];
    this.voteState = null;
    this.jokerChoices = {};
    this.players = this.players.filter(p => !p.left);
    this.players.forEach(p => { p.ready = false; p.active = true; p.left = false; });
    this.state = 'lobby';
    this.hands = {};
    this.completedPhases = [];
    this.revealOrder = null;
    this.lastEvent = null;
    this.chat = [];
    this.restartVotes = new Set();
  }

  addChat(playerId, text) {
    const name = this.players.find(p => p.id === playerId)?.name ?? '?';
    const msg = { name, text, ts: Date.now() };
    this.chat.push(msg);
    if (this.chat.length > 60) this.chat.shift();
    return msg;
  }

  voteRestart(playerId) {
    this.restartVotes.add(playerId);
    const active = this.players.filter(p => p.active);
    if (active.length > 0 && active.every(p => this.restartVotes.has(p.id))) {
      this.reset();
      return true;
    }
    return false;
  }

  reset() {
    this.players = this.players.filter(p => !p.left);
    this.players.forEach(p => { p.ready = false; p.active = true; p.left = false; });
    this.state = 'lobby';
    // mode is preserved across restarts
    this.hands = {};
    this.completedPhases = [];
    this.revealOrder = null;
    this.lastEvent = null;
    this.chat = [];
    this.jokerChoices = {};
    this.restartVotes = new Set();
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
      mode: this.mode,
      activeMalus: this.activeMalus,
      defaultMalus: this.defaultMalus,
      excludedMalus: [...this.excludedMalus],
      lockedZones: { ...this.lockedZones },
      creatorId: this.state === 'lobby' ? this.players[0]?.id : this.hostId,
      jokerChoices: (this.jokerChoices[forPlayerId] ?? []).map(({ handIdx, cards }) => ({ handIdx, cards })),
      jokerWaiting: Object.keys(this.jokerChoices).map(id => this.players.find(p => p.id === id)?.name).filter(Boolean),
      myHand: this.hands[forPlayerId] ?? [],
      handSizes: Object.fromEntries(this.players.map(p => [p.id, (this.hands[p.id] ?? []).length])),
      community: this.visibleCommunity(forPlayerId),
      betweenCards: (this.mode === 'banana' || this.mode === 'banana-omaha') ? this.betweenCards.map((cards, i) => ({
        cards: cards.slice(0, BANANA_PHASE_COUNT[this.phase] ?? 0),
        total: 3,
        playerAIdx: i,
        playerBIdx: (i + 1) % this.players.length,
      })) : null,
      tokenPool: [...this.tokenPool],
      playerZones: { ...this.playerZones },
      completedPhases: this.completedPhases,
      revealOrder: (isOver || this.state === 'voting') ? this.revealOrder : null,
      voteState: this.voteState ? {
        targetId: this.voteState.targetId,
        votes: { ...this.voteState.votes },
        myVote: this.voteState.votes[forPlayerId] ?? null,
        voteType: this.voteState.voteType,
      } : null,
      n: this.n,
      lastEvent: this.lastEvent,
      chat: this.chat,
      countdownStartedAt: this.countdownStartedAt,
      restartVotes: [...this.restartVotes],
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
