const CARD_NUM = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

function numVal(card) { return CARD_NUM[card.value]; }

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  if (arr.length === k) return [[...arr]];
  const [first, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map(c => [first, ...c]),
    ...combinations(rest, k),
  ];
}

function evaluate5(cards) {
  const vals = cards.map(numVal).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const counts = {};
  vals.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const groups = Object.entries(counts)
    .sort(([, a], [, b]) => b - a || 0)
    .map(([v, c]) => ({ v: parseInt(v), c }));

  const isFlush = suits.every(s => s === suits[0]);
  let isStraight = false;
  let straightHigh = vals[0];

  if (new Set(vals).size === 5 && vals[0] - vals[4] === 4) {
    isStraight = true;
  }
  // Wheel (A-2-3-4-5)
  if (vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2) {
    isStraight = true;
    straightHigh = 5;
  }

  const g = groups.map(x => x.c);
  const gv = groups.map(x => x.v);

  let rank, kickers;

  if (isStraight && isFlush) {
    rank = straightHigh === 14 ? 9 : 8;
    kickers = [straightHigh];
  } else if (g[0] === 4) {
    rank = 7; kickers = [gv[0], gv[1] ?? 0];
  } else if (g[0] === 3 && g[1] === 2) {
    rank = 6; kickers = [gv[0], gv[1]];
  } else if (isFlush) {
    rank = 5; kickers = vals;
  } else if (isStraight) {
    rank = 4; kickers = [straightHigh];
  } else if (g[0] === 3) {
    rank = 3; kickers = gv;
  } else if (g[0] === 2 && g[1] === 2) {
    rank = 2; kickers = [Math.max(gv[0], gv[1]), Math.min(gv[0], gv[1]), gv[2] ?? 0];
  } else if (g[0] === 2) {
    rank = 1; kickers = gv;
  } else {
    rank = 0; kickers = vals;
  }

  let score = rank * 1e10;
  kickers.forEach((k, i) => { score += k * Math.pow(100, 4 - i); });
  return score;
}

// Evaluate best possible 5-card hand from hole + community cards
function bestHandScore(holeCards, communityCards) {
  const all = [...holeCards, ...communityCards];
  if (all.length < 5) {
    // Preflop or fewer cards: simplified 2-card scoring
    const vals = all.map(numVal).sort((a, b) => b - a);
    const isPair = all.length === 2 && vals[0] === vals[1];
    return isPair ? 1e8 + vals[0] * 1e6 : vals[0] * 1e4 + (vals[1] ?? 0);
  }
  if (all.length === 5) return evaluate5(all);
  return Math.max(...combinations(all, 5).map(evaluate5));
}

// Returns { playerId: rank } — rank 1 = worst hand, N = best hand
// Ties broken by player join order (tiebreaker = playerIndex)
function rankPlayers(playerHands, communityCards, playerIds) {
  const scores = playerIds.map((id, idx) => ({
    id,
    score: bestHandScore(playerHands[id] || [], communityCards),
    idx,
  }));

  scores.sort((a, b) => a.score - b.score || a.idx - b.idx); // ascending

  const ranks = {};
  scores.forEach(({ id }, i) => { ranks[id] = i + 1; }); // 1 = worst
  return ranks;
}

function handName(holeCards, communityCards) {
  const all = [...holeCards, ...communityCards];
  if (all.length < 5) {
    const vals = all.map(numVal).sort((a, b) => b - a);
    return vals[0] === vals[1] ? `Paire de ${all[0].value}` : `${all[0].value} haut`;
  }
  const score = bestHandScore(holeCards, communityCards);
  const rank = Math.floor(score / 1e10);
  const NAMES = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush', 'Quinte flush royale'];
  return NAMES[rank] ?? '?';
}

module.exports = { rankPlayers, handName };
