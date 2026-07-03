import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { socket } from '../socket';
import PokerCard from '../components/PokerCard';
import { useTheme } from '../ThemeContext';
import './GameScreen.css';

const PHASE_LABEL = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River' };
const VALUE_ORDER = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
function sortHand(hand) {
  return [...(hand ?? [])].sort((a, b) => VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value));
}
function handDescription(handName, bestFive) {
  if (!bestFive || !handName) return handName ?? '';
  const counts = {};
  for (const c of bestFive) counts[c.value] = (counts[c.value] || 0) + 1;
  const byRank = Object.entries(counts).sort(([a], [b]) => VALUE_ORDER.indexOf(b) - VALUE_ORDER.indexOf(a));
  const highVal = VALUE_ORDER[bestFive.map(c => VALUE_ORDER.indexOf(c.value)).reduce((a, b) => Math.max(a, b))];
  switch (handName) {
    case 'Quinte flush royale': return 'Quinte flush royale';
    case 'Quinte flush': return `Quinte flush hauteur ${highVal}`;
    case 'Carré': return `Carré de ${byRank.find(([, n]) => n === 4)?.[0]}`;
    case 'Full': return `Full ${byRank.find(([, n]) => n === 3)?.[0]} par ${byRank.find(([, n]) => n === 2)?.[0]}`;
    case 'Couleur': return `Couleur hauteur ${highVal}`;
    case 'Quinte': return `Quinte hauteur ${highVal}`;
    case 'Brelan': return `Brelan de ${byRank.find(([, n]) => n === 3)?.[0]}`;
    case 'Double paire': { const p = byRank.filter(([, n]) => n === 2).map(([v]) => v); return `Double paire ${p[0]}-${p[1]}`; }
    case 'Paire': return `Paire de ${byRank.find(([, n]) => n === 2)?.[0]}`;
    default: return `Hauteur ${highVal}`;
  }
}
const COLOR_CLASS = { white: 'tok-white', yellow: 'tok-yellow', orange: 'tok-orange', red: 'tok-red' };
const COLOR_PHASE = { white: 'Préflop', yellow: 'Flop', orange: 'Turn', red: 'River' };
const PHASE_ORDER = ['white', 'yellow', 'orange', 'red'];

// ── Avatar assignment ────────────────────────────────────────────────────────
const AHEGAO_POOL = ['🥴', '🤤', '😵', '😜', '🥵', '🫠', '😝', '🤪', '😮', '😛', '😵‍💫', '🫦'];

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getAvatarEmojis(players) {
  const seed = players.reduce((h, p) => {
    for (const c of p.name) h = ((Math.imul(h, 31) + c.charCodeAt(0)) >>> 0);
    return h;
  }, 0x9e3779b9);
  const shuffled = seededShuffle(AHEGAO_POOL, seed);
  return players.map((_, i) => shuffled[i % shuffled.length]);
}

// Seat positions [left%, top%] — fixed for all clients (index = join order)
const SEAT_POS = {
  2: [[50,82],[50,17]],
  3: [[50,82],[17,35],[83,35]],
  4: [[50,82],[12,53],[50,17],[88,53]],
  5: [[50,82],[14,64],[28,24],[72,24],[86,64]],
  6: [[50,82],[17,71],[17,35],[50,17],[83,35],[83,71]],
  7: [[50,82],[20,76],[13,45],[34,21],[67,21],[87,45],[80,76]],
  8: [[50,82],[23,79],[12,53],[23,28],[50,17],[77,28],[88,53],[77,79]],
};

// Table center
const CX = 50, CY = 50;

// Zone position: 25% from seat toward table center
function zonePos([sx, sy]) {
  return [+(sx + 0.25 * (CX - sx)).toFixed(1), +(sy + 0.25 * (CY - sy)).toFixed(1)];
}

// Hand position: push outward from table center, but closer than before
function handPos([sx, sy], isBottomSeat) {
  const dx = sx - CX, dy = sy - CY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / len, ny = dy / len;
  const push = isBottomSeat ? 5 : 2;
  return [
    Math.max(2, Math.min(96, +(sx + nx * push).toFixed(1))),
    Math.max(2, Math.min(96, +(sy + ny * push).toFixed(1))),
  ];
}

function initialPos(token, total, isBanana = false) {
  const spread = Math.min(5, 52 / total);
  return { x: +(50 + (token - 1 - (total - 1) / 2) * spread).toFixed(1), y: isBanana ? 50 : 63 };
}

// ── Malus chip with portal tooltip ───────────────────────────────────────────
function MalusChip({ malus }) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  return (
    <>
      <div
        ref={ref}
        className="malus-chip"
        onMouseEnter={() => {
          const rect = ref.current?.getBoundingClientRect();
          if (rect) setPos({ x: rect.left + rect.width / 2, y: rect.top });
          setShow(true);
        }}
        onMouseLeave={() => setShow(false)}
      >
        <span className="malus-chip-icon">{malus.icon}</span>
      </div>
      {show && createPortal(
        <div className="malus-tooltip-fixed" style={{ left: pos.x, top: pos.y }}>
          <strong>{malus.name}</strong>
          <span>{malus.description}</span>
        </div>,
        document.body
      )}
    </>
  );
}

// ── Chip ────────────────────────────────────────────────────────────────────
function Chip({ value, color, size = 'lg', cursed = false }) {
  const cls = cursed ? 'tok-cursed' : (COLOR_CLASS[color] ?? 'tok-white');
  return (
    <div className={`token ${cls} tok-${size}`}>
      {value}
    </div>
  );
}

const VOTE_VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const HAND_VOTE_VALUES = [
  { value: 'Carte haute',         label: 'Carte haute' },
  { value: 'Paire',               label: 'Paire' },
  { value: 'Double paire',        label: 'Double paire' },
  { value: 'Brelan',              label: 'Brelan' },
  { value: 'Quinte',              label: 'Quinte' },
  { value: 'Couleur',             label: 'Couleur' },
  { value: 'Full',                label: 'Full' },
  { value: 'Carré',               label: 'Carré' },
  { value: 'Quinte flush',        label: 'Q. flush' },
  { value: 'Quinte flush royale', label: 'Q.F. royale' },
];

// ── Vote result popup ─────────────────────────────────────────────────────────
function VoteResultPopup({ ev }) {
  if (!ev) return null;
  const failed = ev.type === 'vote-failed';
  return (
    <div className="malus-popup-overlay">
      <div className="malus-popup">
        <p className="malus-popup-label">{failed ? '💀 JUGEMENT RENDU' : '✅ JUGEMENT PASSÉ'}</p>
        <div className="malus-popup-icon">{failed ? '😱' : '😤'}</div>
        <h2 className="malus-popup-name">
          {failed
            ? ev.voteType === 'hand'
              ? `Ce n'était pas une ${ev.challengeValue} !`
              : `Pas de ${ev.challengeValue} dans la main !`
            : ev.voteType === 'hand'
              ? `C'était bien une ${ev.challengeValue} !`
              : `Le ${ev.challengeValue} était là !`}
        </h2>
        <p className="malus-popup-desc">
          {failed ? '💀 Le gang perd à cause du jugement !' : '🏆 Le gang survit au jugement !'}
        </p>
      </div>
    </div>
  );
}

// ── Card swap popup ───────────────────────────────────────────────────────────
function SwapPopup({ data }) {
  if (!data) return null;
  const reasonText = data.reason === 'tete'
    ? 'Une tête est apparue au flop'
    : 'Aucune tête au flop';
  return (
    <div className="malus-popup-overlay">
      <div className="malus-popup">
        <p className="malus-popup-label">🃏 CHANGEMENT DE CARTES !</p>
        <div className="malus-popup-icon">🃏</div>
        <h2 className="malus-popup-name">{data.name} a changé de cartes</h2>
        <p className="malus-popup-desc">{reasonText}</p>
      </div>
    </div>
  );
}

// ── Malus popup ───────────────────────────────────────────────────────────────
function MalusPopup({ malus }) {
  if (!malus) return null;
  return (
    <div className="malus-popup-overlay">
      <div className="malus-popup">
        <p className="malus-popup-label">⚠ MALUS TIRÉ !</p>
        <div className="malus-popup-icon">{malus.icon}</div>
        <h2 className="malus-popup-name">{malus.name}</h2>
        <p className="malus-popup-desc">{malus.description}</p>
      </div>
    </div>
  );
}

// ── End overlay ──────────────────────────────────────────────────────────────
function EndOverlay({ state, revealOrder, community, completedPhases, isHost, creatorName, onHostAction, voteState, players, myId, mode }) {
  const total = revealOrder?.length ?? 0;
  const [step, setStep] = useState(0);
  const wasVotingRef = useRef(false);
  const isVoting = !!voteState;

  // Auto-step; pause at the last player's slot while voting
  useEffect(() => {
    if (step > total) return;
    if (isVoting && step === total) return;
    const delay = step === 0 ? 500 : 1500;
    const t = setTimeout(() => setStep(s => s + 1), delay);
    return () => clearTimeout(t);
  }, [step, total, isVoting]);

  // When vote resolves, resume stepping
  useEffect(() => {
    if (wasVotingRef.current && !isVoting) {
      const t = setTimeout(() => setStep(s => s + 1), 700);
      return () => clearTimeout(t);
    }
    wasVotingRef.current = isVoting;
  }, [isVoting]);

  const isBanana = mode === 'banana' || mode === 'banana-omaha';
  const communitySlots = Array(5).fill(null).map((_, i) => community?.[i] ?? null);
  const shownPlayers = (revealOrder ?? []).slice(0, Math.max(0, step - 1));
  const allRevealed = step > total && !isVoting;

  const isOver = state === 'won' || state === 'lost';
  const hasWrong = shownPlayers.some(r => !r.correct);
  const showResult = isOver && (hasWrong || allRevealed);

  const targetId = voteState?.targetId;
  const targetPlayer = players?.find(p => p.id === targetId);
  const isVoteTarget = myId === targetId;
  const nonTargetPlayers = (players ?? []).filter(p => p.id !== targetId);
  const voteCount = Object.keys(voteState?.votes ?? {}).length;
  const showVotePanel = isVoting && step >= total;

  return (
    <div className="end-overlay">
      <div className={`end-box${showVotePanel ? ' end-box-split' : ''}`}>

        {/* ── Main reveal column ── */}
        <div className="end-main-col">
          {showResult ? (
            <h2 className={`${state === 'won' ? 'won-title' : 'lost-title'} end-appear`}>
              {state === 'won' ? '🏆 LE GANG GAGNE !' : '💀 MAUVAIS RANG !'}
            </h2>
          ) : (
            <h2 className="reveal-title">Révélation…</h2>
          )}

          {!isBanana && (
            <div className={`end-community ${step >= 1 ? 'end-appear' : 'end-hidden'}`}>
              {communitySlots.map((card, i) => <PokerCard key={i} card={card} hidden={!card} />)}
            </div>
          )}

          <div className="reveal-list" style={{ marginTop: 16 }}>
            {shownPlayers.map(r => (
              <div key={r.id} className={`reveal-row ${r.correct ? 'correct' : 'wrong'} end-appear`}>
                <div className="rev-content">
                  <div className="rev-top">
                    <span className="token tok-sm tok-red">{r.token}</span>
                    <span className="rev-name">{r.name}</span>
                    <span className="rev-info">
                      <span className="rev-hand-name">{handDescription(r.handName, r.bestFive)}</span>
                      <span className={r.correct ? 'rev-ok' : 'rev-ko'}>
                        {r.correct ? `✓ rang ${r.actualRank}` : `✗ rang réel ${r.actualRank}`}
                      </span>
                    </span>
                  </div>
                  <div className="rev-cards">
                    <div className="rev-hole">
                      {r.hand?.map((card, i) => {
                        const used = r.bestFive?.some(c => c.value === card.value && c.suit === card.suit);
                        return <PokerCard key={i} card={card} small highlight={used} />;
                      })}
                    </div>
                    {isBanana && r.community && (
                      <>
                        <span className="rev-arrow" style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>+</span>
                        <div className="rev-best" style={{ border: '1px dashed rgba(200,180,100,0.4)', borderRadius: 6, padding: '2px 4px' }}>
                          {r.community.map((card, i) => <PokerCard key={i} card={card} small />)}
                        </div>
                      </>
                    )}
                    {r.bestFive && (
                      <>
                        <span className="rev-arrow">→</span>
                        <div className="rev-best">
                          {r.bestFive.map((card, i) => <PokerCard key={i} card={card} small />)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="rev-phase-history">
                  {PHASE_ORDER.map(c => {
                    const cp = (completedPhases ?? []).find(ph => ph.color === c);
                    if (!cp) return null;
                    return <div key={c} className={`token tok-sm ${COLOR_CLASS[c]}`}>{cp.zones[r.id] ?? '?'}</div>;
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Placeholder for vote target while voting */}
          {showVotePanel && (
            <div className="vote-pending-row end-appear">
              ⚖️ <strong>{targetPlayer?.name}</strong> — en jugement…
            </div>
          )}

          {allRevealed && (
            <div className="restart-vote end-appear">
              {isHost ? (
                <div className="host-actions">
                  <button className="btn btn-danger" onClick={() => onHostAction('terminate')}>Terminer</button>
                  <button className="btn btn-secondary" onClick={() => onHostAction('reset-zero')}>Recommencer de Zéro</button>
                  <button className="btn btn-primary" onClick={() => onHostAction('next-manche')}>Prochaine Manche</button>
                </div>
              ) : (
                <p className="restart-waiting">En attente de {creatorName}…</p>
              )}
            </div>
          )}
        </div>

        {/* ── Vote side panel ── */}
        {showVotePanel && (
          <div className="vote-side-panel">
            <p className="vote-side-label">⚖️ JUGEMENT FINAL</p>
            <p className="vote-side-subtitle">
              {isVoteTarget
                ? 'Tu es en jugement !'
                : voteState?.voteType === 'hand'
                  ? `Quelle est la main de ${targetPlayer?.name} ?`
                  : `Défie ${targetPlayer?.name} !`}
            </p>

            {/* Real-time votes — visible to all */}
            <div className="vote-live-list">
              {nonTargetPlayers.map(p => {
                const v = voteState?.votes?.[p.id];
                return (
                  <div key={p.id} className="vote-live-row">
                    <span className="vote-live-name">
                      {p.emoji && p.emoji.startsWith('/')
                        ? <img src={p.emoji} alt="" style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 3, verticalAlign: 'middle', marginRight: 3 }} />
                        : p.emoji ? `${p.emoji} ` : ''}
                      {p.name}
                    </span>
                    <span className={`vote-live-val${v ? ' voted' : ''}`}>{v ?? '…'}</span>
                  </div>
                );
              })}
            </div>

            {/* Vote buttons — anyone except the target, can change vote */}
            {!isVoteTarget && voteState?.voteType === 'hand' && (
              <div className="vote-btns-grid vote-btns-grid-hands">
                {HAND_VOTE_VALUES.map(({ value, label }) => (
                  <button key={value}
                    className={`btn ${voteState?.myVote === value ? 'btn-primary' : 'btn-secondary'} vote-val-btn`}
                    onClick={() => socket.emit('submit-vote', { value })}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {!isVoteTarget && voteState?.voteType === 'card' && (
              <div className="vote-btns-grid">
                {VOTE_VALUES.map(v => (
                  <button key={v}
                    className={`btn ${voteState?.myVote === v ? 'btn-primary' : 'btn-secondary'} vote-val-btn`}
                    onClick={() => socket.emit('submit-vote', { value: v })}>
                    {v}
                  </button>
                ))}
              </div>
            )}

            <p className="vote-progress">{voteCount} / {nonTargetPlayers.length} votes</p>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function GameScreen({ gameState, playerName, onPlaceToken, onReleaseToken, onHostAction, onKick, onLeave, onResolveJoker, drawnMalus }) {
  const gameAreaRef = useRef(null);
  const [localPos, setLocalPos] = useState({});
  const [dragState, setDragState] = useState(null);
  const [draggers, setDraggers] = useState({});
  const [countdownLeft, setCountdownLeft] = useState(null);
  const [communityDelays, setCommunityDelays] = useState({});
  const [swapPopup, setSwapPopup] = useState(null);
  const [voteResultEv, setVoteResultEv] = useState(null);
  const prevCommunityLenRef = useRef(0);

  const { table: tableTheme } = useTheme();
  if (!gameState) return <div className="screen"><p style={{ color: 'var(--muted)' }}>Connexion…</p></div>;

  const { state, phase, phaseIndex, color, players, myHand, handSizes, community, betweenCards, playerZones, completedPhases, revealOrder, voteState, n, countdownStartedAt, mode, activeMalus, lockedZones, creatorId, jokerChoices: myJokerChoices, jokerWaiting } = gameState;
  const holeCount = ((mode === 'omaha' || mode === 'banana-omaha') ? 4 : 2) + ((activeMalus ?? []).some(m => m.id === 'camera-surveillance') ? 1 : 0);
  const notRiver = color !== 'red';
  const hasJetonNoir     = notRiver && (activeMalus ?? []).some(m => m.id === 'jeton-noir');
  const hasJetonHautNoir = notRiver && (activeMalus ?? []).some(m => m.id === 'jeton-haut-noir');
  const isOver = state === 'won' || state === 'lost';

  // Fixed seat order — same for all clients
  const ordered   = players ?? [];
  const positions = SEAT_POS[ordered.length] ?? SEAT_POS[2];
  const myIdx      = ordered.findIndex(p => p.name === playerName);
  const myId       = ordered[myIdx]?.id;
  const isHost     = creatorId != null && creatorId === myId;
  const creatorName = ordered[0]?.name;
  const avatarEmojis = getAvatarEmojis(ordered);

  // Countdown display
  useEffect(() => {
    if (!countdownStartedAt) { setCountdownLeft(null); return; }
    const tick = () => setCountdownLeft(Math.max(0, 3 - (Date.now() - countdownStartedAt) / 1000));
    tick();
    const id = setInterval(tick, 80);
    return () => clearInterval(id);
  }, [countdownStartedAt]);

  // Track which community cards are newly revealed for stagger animation
  useEffect(() => {
    const len = community?.length ?? 0;
    const prev = prevCommunityLenRef.current;
    if (len === 0) {
      prevCommunityLenRef.current = 0;
      setCommunityDelays({});
      return;
    }
    if (len > prev) {
      const delays = {};
      for (let i = prev; i < len; i++) delays[i] = (i - prev) * 220;
      setCommunityDelays(delays);
      prevCommunityLenRef.current = len;
    } else if (len < prev) {
      prevCommunityLenRef.current = len;
      setCommunityDelays({});
    }
  }, [community?.length]);

  // Reset token positions each phase
  useEffect(() => {
    if (!n || isOver) return;
    const banana = gameState?.mode === 'banana' || gameState?.mode === 'banana-omaha';
    const pos = {};
    for (let t = 1; t <= n; t++) pos[t] = initialPos(t, n, banana);
    setLocalPos(pos);
  }, [phaseIndex, state, n]);

  // Show popup when cards are redrawn due to malus
  useEffect(() => {
    const ev = gameState?.lastEvent;
    if (ev?.type === 'cards-redrawn') {
      const target = (gameState?.players ?? []).find(p => p.id === ev.targetId);
      if (target) {
        setSwapPopup({ name: target.name, reason: ev.reason });
        const t = setTimeout(() => setSwapPopup(null), 4500);
        return () => clearTimeout(t);
      }
    }
  }, [gameState?.lastEvent?.ts]);

  // Show popup after vote resolution
  useEffect(() => {
    const ev = gameState?.lastEvent;
    if (ev?.type === 'vote-failed' || ev?.type === 'vote-passed') {
      setVoteResultEv(ev);
      const t = setTimeout(() => setVoteResultEv(null), 4500);
      return () => clearTimeout(t);
    }
  }, [gameState?.lastEvent?.ts]);

  // Receive position updates from other players
  useEffect(() => {
    function onMoved({ token, x, y, dragger }) {
      if (x != null) setLocalPos(prev => ({ ...prev, [token]: { x, y } }));
      setDraggers(prev => {
        if (dragger) return { ...prev, [token]: dragger };
        const next = { ...prev };
        delete next[token];
        return next;
      });
    }
    socket.on('token-moved', onMoved);
    return () => socket.off('token-moved', onMoved);
  }, []);

  // Drag handlers
  useEffect(() => {
    if (!dragState) return;

    function onMove(e) {
      setDragState(prev => prev ? { ...prev, curX: e.clientX, curY: e.clientY } : null);
      const rect = gameAreaRef.current?.getBoundingClientRect();
      if (rect && dragState?.token != null) {
        const pctX = +((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
        const pctY = +((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
        socket.emit('token-moved', { token: dragState.token, x: pctX, y: pctY, dragger: playerName });
      }
    }

    function onUp(e) {
      const drag = dragState;
      setDragState(null);
      if (!drag) return;

      // Ignore accidental clicks (< 20px travel)
      if (Math.abs(e.clientX - drag.startX) < 20 && Math.abs(e.clientY - drag.startY) < 20) {
        socket.emit('token-moved', { token: drag.token, x: null, y: null, dragger: null });
        return;
      }

      const rect = gameAreaRef.current?.getBoundingClientRect();
      if (!rect) return;

      const pxX = e.clientX - rect.left;
      const pxY = e.clientY - rect.top;
      const pctX = +(pxX / rect.width  * 100).toFixed(1);
      const pctY = +(pxY / rect.height * 100).toFixed(1);

      // Check only own zone for placement
      let inOwnZone = false;
      if (myIdx >= 0) {
        const [zx, zy] = zonePos(positions[myIdx]);
        inOwnZone = Math.abs(pxX - zx / 100 * rect.width) < 65 && Math.abs(pxY - zy / 100 * rect.height) < 52;
      }

      if (inOwnZone) {
        onPlaceToken(drag.token, myId);
      } else if (drag.wasInZoneOf) {
        onReleaseToken(drag.token);
      }

      setLocalPos(p => ({ ...p, [drag.token]: { x: pctX, y: pctY } }));
      socket.emit('token-moved', { token: drag.token, x: pctX, y: pctY, dragger: null });
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragState, positions, myIdx, myId, onPlaceToken, onReleaseToken]);

  function startDrag(e, token) {
    if (isOver) return;
    // Block dragging locked tokens
    const isLocked = lockedZones && Object.values(lockedZones).includes(token);
    if (isLocked) return;
    // Cursed tokens: snap immediately to own zone on touch
    if (token === 1 && hasJetonNoir) { onPlaceToken(1, myId); return; }
    if (token === n && hasJetonHautNoir) { onPlaceToken(n, myId); return; }
    e.preventDefault();
    let wasInZoneOf = null;
    for (const [pid, t] of Object.entries(playerZones ?? {})) {
      if (t === token) { wasInZoneOf = pid; break; }
    }
    setDragState({ token, startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY, wasInZoneOf });
  }

  function getTokenPos(token) {
    // Locked token snaps to its zone
    if (lockedZones) {
      for (const [pid, lt] of Object.entries(lockedZones)) {
        if (lt === token) {
          const pIdx = ordered.findIndex(p => p.id === pid);
          if (pIdx >= 0) return zonePos(positions[pIdx]);
        }
      }
    }
    const lp = localPos[token];
    if (lp) return [lp.x, lp.y];
    const p = initialPos(token, n, gameState?.mode === 'banana' || gameState?.mode === 'banana-omaha');
    return [p.x, p.y];
  }

  const allTokens = n ? Array.from({ length: n }, (_, i) => i + 1) : [];
  return (
    <div className="game-wrap">
      <div className="game-area" ref={gameAreaRef}>

        {/* Countdown bar */}
        {countdownLeft != null && countdownLeft > 0 && (
          <div className="countdown-wrap">
            <div className="countdown-bar" style={{ width: `${(countdownLeft / 3) * 100}%` }} />
            <div className="countdown-text">Validation dans {Math.ceil(countdownLeft)}s…</div>
          </div>
        )}

        {/* Felt oval */}
        <div className={`poker-table${tableTheme !== 'classic' ? ` poker-table-${tableTheme}` : ''}`}>
          <div className="table-community">
            {/* Active malus cards above community */}
            {(activeMalus ?? []).length > 0 && (
              <div className="malus-row">
                {(activeMalus ?? []).map(m => <MalusChip key={m.id} malus={m} />)}
              </div>
            )}
            <p className="table-phase-label">{PHASE_LABEL[phase]}</p>
            {(mode === 'banana' || mode === 'banana-omaha') ? (
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '2px 0 0' }}>
                {mode === 'banana-omaha' ? '🍌 Banana Omaha' : '🍌 Banana Split'}
              </p>
            ) : (
              <div className="community-cards">
                {(community ?? []).map((card, i) =>
                  card?.isJokerSlot ? (
                    <div key={`joker-comm-${i}`} className="joker-comm-slot">
                      {(card.cards ?? []).map((c, j) => (
                        <PokerCard key={j} card={c} large delay={communityDelays[i] ?? 0} />
                      ))}
                      <span className="joker-comm-badge">1/2</span>
                    </div>
                  ) : (
                    <PokerCard
                      key={`${card.value}${card.suit}`}
                      card={card}
                      large
                      delay={communityDelays[i] ?? 0}
                    />
                  )
                )}
              </div>
            )}
          </div>

          {/* Banana Split: 3 between cards per adjacent pair, revealed 1 per phase */}
          {(mode === 'banana' || mode === 'banana-omaha') && (betweenCards ?? []).map((bc, i) => {
            const posA = positions[bc.playerAIdx];
            const posB = positions[bc.playerBIdx];
            if (!posA || !posB) return null;
            const midX = (posA[0] + posB[0]) / 2;
            const midY = (posA[1] + posB[1]) / 2;
            const left = midX + (midX - 50) * 0.38;
            const top  = midY + (midY - 50) * 0.38;
            return (
              <div key={i} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, transform: 'translate(-50%,-50%)', zIndex: 5, display: 'flex', gap: 2 }}>
                {Array.from({ length: bc.total ?? 3 }, (_, j) => {
                  const c = bc.cards?.[j] ?? null;
                  return c?.isJokerSlot ? (
                    <div key={j} className="joker-comm-slot joker-comm-slot-small">
                      {(c.cards ?? []).map((cc, ci) => <PokerCard key={ci} card={cc} small />)}
                      <span className="joker-comm-badge">1/2</span>
                    </div>
                  ) : (
                    <PokerCard key={j} card={c} hidden={!c} small />
                  );
                })}
              </div>
            );
          })}
        </div>


        {/* Hands — mine face-up, others face-down. Label above for north players, below for south. */}
        {ordered.map((p, i) => {
          if (!n && !p.left) return null;
          const isMe = p.id === myId;
          const [hx, hy] = handPos(positions[i], i === 0);
          const isNorth = hy < 50;
          const history = (completedPhases ?? [])
            .map(cp => ({ color: cp.color, token: cp.zones[p.id] }))
            .filter(h => h.token != null);

          if (isOver) return null;

          const labelEl = (
            <div className={`hand-label ${isMe ? 'hand-label-me' : ''}`}>
              {(p.emoji || avatarEmojis[i]).startsWith('/')
                ? <img src={p.emoji} alt="" className="label-avatar-img" />
                : <span className="label-avatar">{p.emoji || avatarEmojis[i]}</span>}
              {p.name}{isMe && <span className="label-you"> (toi)</span>}
              {p.left && <span style={{ color: 'var(--red)', fontSize: '0.7rem', marginLeft: 4 }}>(parti)</span>}
              {isHost && !isMe && !p.left && (
                <button
                  onClick={() => onKick(p.id)}
                  style={{
                    marginLeft: 6, background: 'rgba(200,16,46,0.25)',
                    border: '1px solid rgba(200,16,46,0.5)', borderRadius: 4,
                    color: 'var(--red)', cursor: 'pointer', fontSize: '0.65rem',
                    padding: '1px 5px', fontWeight: 700, lineHeight: 1.4,
                  }}
                  title={`Expulser ${p.name}`}
                >✕</button>
              )}
            </div>
          );

          return (
            <div key={`hand-${p.id}`} className="player-hand" style={{ left: `${hx}%`, top: `${hy}%`, opacity: p.left ? 0.4 : 1 }}>
              {isNorth && labelEl}
              {!p.left && (
                <div className="hand-cards">
                  {isMe
                    ? (myHand ?? []).map((card, ci) =>
                        card
                          ? <PokerCard key={`${card.value}${card.suit}`} card={card} large delay={ci * 220} />
                          : <PokerCard key={`joker-slot-${ci}`} hidden large delay={ci * 220} />
                      )
                    : Array.from({ length: handSizes?.[p.id] ?? holeCount }, (_, ci) => {
                        const epoch = myHand?.[0] ? `${myHand[0].value}${myHand[0].suit}` : 'none';
                        return <PokerCard key={`back-${p.id}-${ci}-${epoch}`} hidden large delay={ci * 180} />;
                      })
                  }
                </div>
              )}
              {history.length > 0 && (
                <div className="hand-history">
                  {history.map((h, hi) => (
                    <div key={hi} className={`token tok-md ${COLOR_CLASS[h.color]}`}>{h.token}</div>
                  ))}
                </div>
              )}
              {!isNorth && labelEl}
            </div>
          );
        })}

        {/* Validation zones — only for active (non-left) players */}
        {!isOver && ordered.map((p, i) => {
          if (p.left) return null;
          const [zx, zy] = zonePos(positions[i]);
          const claimed = playerZones?.[p.id];
          const isMe = p.id === myId;
          return (
            <div
              key={p.id}
              className={`val-zone ${claimed != null ? 'zone-green' : 'zone-red'} ${isMe ? 'zone-mine' : ''}`}
              style={{ left: `${zx}%`, top: `${zy}%` }}
            >
              {claimed != null && <Chip value={claimed} color={color} size="sm" />}
            </div>
          );
        })}

        {/* Floating tokens — all draggable */}
        {!isOver && allTokens.map(t => {
          const isDragging = dragState?.token === t;
          const dragger = !isDragging ? draggers[t] : null;
          const [px, py] = getTokenPos(t);
          const isCursed = (t === 1 && hasJetonNoir) || (t === n && hasJetonHautNoir);
          const isLocked = lockedZones && Object.values(lockedZones).includes(t);
          return (
            <div
              key={t}
              className={`token-float ${isDragging ? 'token-dragging' : ''} ${isLocked ? 'token-locked' : ''}`}
              style={{ left: `${px}%`, top: `${py}%`, cursor: isLocked ? 'not-allowed' : undefined }}
              onMouseDown={e => startDrag(e, t)}
            >
              {dragger && <div className="token-dragger">{dragger}</div>}
              <Chip value={t} color={color} cursed={isCursed} />
            </div>
          );
        })}

      </div>

      {/* Drag ghost */}
      {dragState && (
        <div className="drag-ghost" style={{ left: dragState.curX, top: dragState.curY }}>
          <div className="ghost-badge">✋ {playerName}</div>
          <Chip value={dragState.token} color={color} />
        </div>
      )}

      {/* Quit button — all players, not when game is over */}
      {!isOver && state !== 'voting' && (
        <button
          className="game-quit-btn"
          onClick={() => { if (window.confirm('Quitter la partie ?')) onLeave(); }}
        >
          ⬅ Quitter
        </button>
      )}

      {(isOver || state === 'voting') && (
        <EndOverlay
          state={state}
          revealOrder={revealOrder}
          community={community}
          completedPhases={completedPhases}
          isHost={isHost}
          creatorName={creatorName}
          onHostAction={onHostAction}
          voteState={voteState}
          players={ordered}
          myId={myId}
          mode={mode}
        />
      )}

      <VoteResultPopup ev={voteResultEv} />
      <SwapPopup data={swapPopup} />
      <MalusPopup malus={drawnMalus} />

      {state === 'joker-choice' && (
        <div className="joker-overlay">
          <div className="joker-modal">
            {(myJokerChoices ?? []).length > 0 ? (
              <>
                <h3 className="joker-title">🃏 Joker pioché !</h3>
                <p className="joker-sub">Choisis la carte qui remplace ton Joker :</p>
                <div className="joker-choices">
                  {myJokerChoices[0].cards.map((card, idx) => (
                    <button key={idx} className="joker-choice-btn" onClick={() => onResolveJoker(idx)}>
                      <PokerCard card={card} large />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="joker-title">🃏 Joker en cours…</h3>
                <p className="joker-sub">{(jokerWaiting ?? []).join(', ')} choisit sa carte</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
