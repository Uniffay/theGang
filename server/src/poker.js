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
    .sort(([va, a], [vb, b]) => b - a || parseInt(vb) - parseInt(va))
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

// Returns the 5 cards forming the best hand, sorted ascending by value
function bestFiveCards(holeCards, communityCards) {
  const all = [...holeCards, ...communityCards];
  if (all.length <= 5) {
    return [...all].sort((a, b) => CARD_NUM[a.value] - CARD_NUM[b.value]);
  }
  let best = null, bestScore = -Infinity;
  for (const combo of combinations(all, 5)) {
    const s = evaluate5(combo);
    if (s > bestScore) { bestScore = s; best = combo; }
  }
  return (best ?? all.slice(0, 5)).sort((a, b) => CARD_NUM[a.value] - CARD_NUM[b.value]);
}

// Returns { playerId: { rank, minRank, maxRank } }
// rank 1 = worst hand. Tied players share the same rank range.
function rankPlayers(playerHands, communityCards, playerIds) {
  const scores = playerIds.map(id => ({
    id,
    score: bestHandScore(playerHands[id] || [], communityCards),
  }));

  scores.sort((a, b) => a.score - b.score); // ascending, no tiebreaker

  const result = {};
  let i = 0;
  while (i < scores.length) {
    const score = scores[i].score;
    let j = i;
    while (j < scores.length && scores[j].score === score) j++;
    for (let k = i; k < j; k++) {
      result[scores[k].id] = { rank: i + 1, minRank: i + 1, maxRank: j };
    }
    i = j;
  }
  return result;
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

// ── Omaha: exactly 2 hole + 3 community ─────────────────────────────────────

function bestHandScoreOmaha(holeCards, communityCards) {
  if (holeCards.length < 2 || communityCards.length < 3) {
    return bestHandScore(holeCards.slice(0, 2), communityCards);
  }
  let best = -Infinity;
  for (const hc of combinations(holeCards, 2)) {
    for (const cc of combinations(communityCards, 3)) {
      const s = evaluate5([...hc, ...cc]);
      if (s > best) best = s;
    }
  }
  return best;
}

function bestFiveCardsOmaha(holeCards, communityCards) {
  if (holeCards.length < 2 || communityCards.length < 3) {
    return bestFiveCards(holeCards.slice(0, 2), communityCards);
  }
  let best = null, bestScore = -Infinity;
  for (const hc of combinations(holeCards, 2)) {
    for (const cc of combinations(communityCards, 3)) {
      const combo = [...hc, ...cc];
      const s = evaluate5(combo);
      if (s > bestScore) { bestScore = s; best = combo; }
    }
  }
  return (best ?? [...holeCards.slice(0, 2), ...communityCards.slice(0, 3)])
    .sort((a, b) => CARD_NUM[a.value] - CARD_NUM[b.value]);
}

function rankPlayersOmaha(playerHands, communityCards, playerIds) {
  const scores = playerIds.map(id => ({
    id,
    score: bestHandScoreOmaha(playerHands[id] || [], communityCards),
  }));
  scores.sort((a, b) => a.score - b.score);
  const result = {};
  let i = 0;
  while (i < scores.length) {
    const score = scores[i].score;
    let j = i;
    while (j < scores.length && scores[j].score === score) j++;
    for (let k = i; k < j; k++) {
      result[scores[k].id] = { rank: i + 1, minRank: i + 1, maxRank: j };
    }
    i = j;
  }
  return result;
}

function handNameOmaha(holeCards, communityCards) {
  if (holeCards.length < 2 || communityCards.length < 3) {
    return handName(holeCards.slice(0, 2), communityCards);
  }
  const score = bestHandScoreOmaha(holeCards, communityCards);
  const rank = Math.floor(score / 1e10);
  const NAMES = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush', 'Quinte flush royale'];
  return NAMES[rank] ?? '?';
}

// ── Banana Split: 2 hole + up to 6 community (3 left pair + 3 right pair) ────
// Uses the standard 5-card evaluator — best 5 from up to 8 cards.

function _bananaRank(scores) {
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

function _bananaCommunity(betweenCards, idx, N) {
  return [
    ...(betweenCards[(idx - 1 + N) % N] ?? []),
    ...(betweenCards[idx] ?? []),
  ];
}

function rankPlayersBanana(playerHands, betweenCards, playerIds) {
  const N = playerIds.length;
  return _bananaRank(playerIds.map((id, idx) => ({
    id,
    score: bestHandScore(playerHands[id] || [], _bananaCommunity(betweenCards, idx, N)),
  })));
}

function bestFiveCardsBanana(holeCards, community6) {
  return bestFiveCards(holeCards, community6);
}

// ── Banana Omaha: 4 hole (must use exactly 2) + 6 community (must use exactly 3) ─

function bestHandScoreBananaOmaha(holeCards, community6) {
  if (holeCards.length < 2 || community6.length < 3) {
    return bestHandScoreOmaha(holeCards.slice(0, 4), community6);
  }
  let best = -Infinity;
  for (const hc of combinations(holeCards, 2)) {
    for (const cc of combinations(community6, 3)) {
      const s = evaluate5([...hc, ...cc]);
      if (s > best) best = s;
    }
  }
  return best;
}

function rankPlayersBananaOmaha(playerHands, betweenCards, playerIds) {
  const N = playerIds.length;
  return _bananaRank(playerIds.map((id, idx) => ({
    id,
    score: bestHandScoreBananaOmaha(playerHands[id] || [], _bananaCommunity(betweenCards, idx, N)),
  })));
}

function handNameBananaOmaha(holeCards, community6) {
  if (holeCards.length < 2 || community6.length < 3) return handNameOmaha(holeCards.slice(0, 4), community6);
  const score = bestHandScoreBananaOmaha(holeCards, community6);
  const rank = Math.floor(score / 1e10);
  const NAMES = ['Carte haute','Paire','Double paire','Brelan','Quinte','Couleur','Full','Carré','Quinte flush','Quinte flush royale'];
  return NAMES[rank] ?? '?';
}

function bestFiveCardsBananaOmaha(holeCards, community6) {
  if (holeCards.length < 2 || community6.length < 3) return bestFiveCardsOmaha(holeCards.slice(0, 4), community6);
  let best = null, bestScore = -Infinity;
  for (const hc of combinations(holeCards, 2)) {
    for (const cc of combinations(community6, 3)) {
      const combo = [...hc, ...cc];
      const s = evaluate5(combo);
      if (s > bestScore) { bestScore = s; best = combo; }
    }
  }
  return (best ?? [...holeCards.slice(0, 2), ...community6.slice(0, 3)])
    .sort((a, b) => CARD_NUM[a.value] - CARD_NUM[b.value]);
}

// Rankings with precomputed community per player (banana modes with left players)
function rankPlayersWithCommunities(playerHands, communityMap, playerIds) {
  return _bananaRank(playerIds.map(id => ({
    id, score: bestHandScore(playerHands[id] || [], communityMap[id] || []),
  })));
}

function rankPlayersBananaOmahaWithCommunities(playerHands, communityMap, playerIds) {
  return _bananaRank(playerIds.map(id => ({
    id, score: bestHandScoreBananaOmaha(playerHands[id] || [], communityMap[id] || []),
  })));
}

module.exports = { rankPlayers, handName, bestFiveCards, rankPlayersOmaha, handNameOmaha, bestFiveCardsOmaha, rankPlayersBanana, bestFiveCardsBanana, rankPlayersBananaOmaha, handNameBananaOmaha, bestFiveCardsBananaOmaha, rankPlayersWithCommunities, rankPlayersBananaOmahaWithCommunities, bestHandScore, bestHandScoreOmaha, bestHandScoreBananaOmaha };
