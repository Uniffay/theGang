import { useState, useRef, useEffect, useCallback } from 'react';
import { socket } from '../socket';
import PokerCard from '../components/PokerCard';
import './GameScreen.css';

// ── Constants ──────────────────────────────────────────────────────────────

const PHASE_LABEL  = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River' };
const PHASE_ORDER  = ['preflop', 'flop', 'turn', 'river'];
const COLOR_CLASS  = { white: 'tok-white', yellow: 'tok-yellow', orange: 'tok-orange', red: 'tok-red' };
const PHASE_COLOR  = { preflop: 'white', flop: 'yellow', turn: 'orange', river: 'red' };

// Seat positions [left%, top%] around the table oval.
// Index 0 = current player (always bottom-center).
// Computed on ellipse center(50,46), semi-axes(38,36), clockwise from 270°.
const SEAT_POS = {
  2: [[50,82],[50,10]],
  3: [[50,82],[17,28],[83,28]],
  4: [[50,82],[12,46],[50,10],[88,46]],
  5: [[50,82],[14,57],[28,17],[72,17],[86,57]],
  6: [[50,82],[17,64],[17,28],[50,10],[83,28],[83,64]],
  7: [[50,82],[20,69],[13,38],[34,14],[67,14],[87,38],[80,69]],
  8: [[50,82],[23,72],[12,46],[23,21],[50,10],[77,21],[88,46],[77,72]],
};

// Zone is 30% of the way from seat toward table center (50, 46)
function zonePos([sx, sy]) {
  return [+(sx + 0.30 * (50 - sx)).toFixed(1), +(sy + 0.30 * (46 - sy)).toFixed(1)];
}

// Initial token positions: horizontal row, centered on table
function initialPos(token, total) {
  const spread = Math.min(8, 52 / total);
  return { x: +(50 + (token - 1 - (total - 1) / 2) * spread).toFixed(1), y: 52 };
}

// ── Token chip ─────────────────────────────────────────────────────────────

function Token({ value, color, onMouseDown, faded }) {
  return (
    <div
      className={`token ${COLOR_CLASS[color] ?? 'tok-white'} tok-lg ${faded ? 'tok-faded' : ''}`}
      onMouseDown={onMouseDown}
    >
      {value}
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

function Sidebar({ roomId, phaseIndex, completedPhases, players, chat, onSendChat }) {
  const [chatText, setChatText] = useState('');
  const chatRef = useRef(null);
  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [chat]);

  function pname(id) { return players?.find(p => p.id === id)?.name ?? '?'; }

  function submit(e) {
    e.preventDefault();
    if (chatText.trim()) { onSendChat(chatText); setChatText(''); }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="game-logo-sm">THE GANG</span>
        <span className="room-chip">{roomId}</span>
      </div>

      <div className="phase-track">
        {PHASE_ORDER.map((ph, i) => (
          <div key={ph} className={`ph-pip ${i < phaseIndex ? 'done' : i === phaseIndex ? 'active' : 'future'} ${COLOR_CLASS[PHASE_COLOR[ph]]}`}>
            {PHASE_LABEL[ph]}
          </div>
        ))}
      </div>

      {completedPhases?.length > 0 && (
        <div className="history">
          {completedPhases.map((cp, i) => (
            <div key={i} className="cp-row">
              <span className={`cp-ph ${COLOR_CLASS[cp.color]}`}>{PHASE_LABEL[cp.phase]}</span>
              {Object.entries(cp.zones).sort(([,a],[,b])=>a-b).map(([id, t]) => (
                <span key={id} className="cp-entry">
                  <span className={`token tok-sm ${COLOR_CLASS[cp.color]}`}>{t}</span>
                  <span className="cp-name">{pname(id)}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="chat-box" ref={chatRef}>
        {(chat ?? []).map((m, i) => (
          <div key={i} className="chat-line">
            <span className="chat-name">{m.name}</span>
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Parle à ton gang…" maxLength={200} />
        <button type="submit" className="btn btn-primary" style={{ padding: '7px 12px' }}>→</button>
      </form>
    </aside>
  );
}

// ── End overlay ────────────────────────────────────────────────────────────

function EndOverlay({ state, revealOrder, players, onRestart }) {
  function pname(id) { return players?.find(p => p.id === id)?.name ?? '?'; }
  return (
    <div className="end-overlay">
      <div className="end-box">
        <h2 className={state === 'won' ? 'won-title' : 'lost-title'}>
          {state === 'won' ? '🏆 LE GANG GAGNE !' : '💀 MAUVAIS RANG !'}
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: 20 }}>
          {state === 'won' ? 'Les jetons correspondent aux vraies mains.' : 'Les jetons ne correspondent pas.'}
        </p>
        <div className="reveal-list">
          {(revealOrder ?? []).map(r => (
            <div key={r.id} className={`reveal-row ${r.correct ? 'correct' : 'wrong'}`}>
              <span className={`token tok-sm tok-red`}>{r.token}</span>
              <span className="rev-name">{r.name}</span>
              <div className="rev-hand">{r.hand?.map((card, i) => <PokerCard key={i} card={card} small />)}</div>
              <span className="rev-info">
                <span className="rev-hand-name">{r.handName}</span>
                <span className={r.correct ? 'rev-ok' : 'rev-ko'}>
                  {r.correct ? `✓ rang ${r.actualRank}` : `✗ rang réel ${r.actualRank}`}
                </span>
              </span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginTop: 24, width: '100%' }} onClick={onRestart}>
          Rejouer
        </button>
      </div>
    </div>
  );
}

// ── Main GameScreen ────────────────────────────────────────────────────────

export default function GameScreen({ gameState, playerName, roomId, onPickToken, onPlaceToken, onReleaseToken, onSendChat, onRestart }) {
  const gameAreaRef = useRef(null);
  const [localPos, setLocalPos] = useState({});      // token → {x%, y%} in game-area
  const [dragState, setDragState] = useState(null);  // { token, curX, curY, wasInZoneOf }

  if (!gameState) return <div className="screen"><p style={{ color: 'var(--muted)' }}>Connexion…</p></div>;

  const { state, phase, phaseIndex, color, players, myHand, allHands, community, playerZones, completedPhases, revealOrder, n, chat } = gameState;
  const isOver = state === 'won' || state === 'lost';

  // Ordered players: me first
  const myPlayer = players?.find(p => p.name === playerName);
  const others   = players?.filter(p => p.name !== playerName) ?? [];
  const ordered  = myPlayer ? [myPlayer, ...others] : (players ?? []);
  const positions = SEAT_POS[ordered.length] ?? SEAT_POS[2];
  const myId = myPlayer?.id;

  // Reset local positions on phase change or game start
  useEffect(() => {
    if (!n || isOver) return;
    const pos = {};
    for (let t = 1; t <= n; t++) pos[t] = initialPos(t, n);
    setLocalPos(pos);
  }, [phaseIndex, state, n]);

  // Sync positions from other players
  useEffect(() => {
    function onMoved({ token, x, y }) {
      setLocalPos(prev => ({ ...prev, [token]: { x, y } }));
    }
    socket.on('token-moved', onMoved);
    return () => socket.off('token-moved', onMoved);
  }, []);

  // Drag: attach document-level listeners while dragging
  useEffect(() => {
    if (!dragState) return;

    function onMove(e) {
      setDragState(prev => prev ? { ...prev, curX: e.clientX, curY: e.clientY } : null);
    }

    function onUp(e) {
      const prev = dragState;
      if (!prev) return;

      const rect = gameAreaRef.current?.getBoundingClientRect();
      if (!rect) { setDragState(null); return; }

      const pxX = e.clientX - rect.left;
      const pxY = e.clientY - rect.top;
      const pctX = +(pxX / rect.width  * 100).toFixed(1);
      const pctY = +(pxY / rect.height * 100).toFixed(1);

      // Find hit zone (in px)
      let hitPlayer = null;
      for (let i = 0; i < ordered.length; i++) {
        const [zx, zy] = zonePos(positions[i]);
        const zpxX = zx / 100 * rect.width;
        const zpxY = zy / 100 * rect.height;
        if (Math.abs(pxX - zpxX) < 52 && Math.abs(pxY - zpxY) < 42) {
          hitPlayer = ordered[i];
          break;
        }
      }

      if (hitPlayer) {
        // Drop on any zone → place token there
        onPlaceToken(prev.token, hitPlayer.id);
        const hIdx = ordered.findIndex(p => p.id === hitPlayer.id);
        const [zx, zy] = zonePos(positions[hIdx >= 0 ? hIdx : 0]);
        setLocalPos(p => ({ ...p, [prev.token]: { x: zx, y: zy } }));
      } else {
        // Drop on table → update local pos
        setLocalPos(p => ({ ...p, [prev.token]: { x: pctX, y: pctY } }));
        socket.emit('token-moved', { token: prev.token, x: pctX, y: pctY });
        // Release if token was in ANOTHER player's zone (own zone already released at drag start)
        if (prev.wasInZoneOf && prev.wasInZoneOf !== myId) {
          onReleaseToken(prev.token);
        }
      }

      setDragState(null);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragState, ordered, positions, myId, onPlaceToken, onReleaseToken]);

  function startDrag(e, token) {
    if (isOver) return;
    e.preventDefault();
    let wasInZoneOf = null;
    for (const [pid, t] of Object.entries(playerZones ?? {})) {
      if (t === token) { wasInZoneOf = pid; break; }
    }
    // Release own zone immediately so server doesn't see "toggle" on re-drop
    if (wasInZoneOf === myId) {
      onReleaseToken(token);
    }
    setDragState({ token, curX: e.clientX, curY: e.clientY, wasInZoneOf });
  }

  // Token rendering position: zone if assigned, else free pos
  function getTokenPos(token) {
    for (let i = 0; i < ordered.length; i++) {
      if (playerZones?.[ordered[i].id] === token) {
        return zonePos(positions[i]);
      }
    }
    const lp = localPos[token];
    if (lp) return [lp.x, lp.y];
    const { x, y } = initialPos(token, n);
    return [x, y];
  }

  const allTokens = n ? Array.from({ length: n }, (_, i) => i + 1) : [];
  const communitySlots = Array(5).fill(null).map((_, i) => community?.[i] ?? null);

  return (
    <div className="game-wrap">
      <Sidebar
        roomId={roomId}
        phaseIndex={phaseIndex}
        completedPhases={completedPhases}
        players={players}
        chat={chat}
        onSendChat={onSendChat}
      />

      <div className="game-area" ref={gameAreaRef}>
        {/* ── Felt oval ── */}
        <div className="poker-table">
          <div className="table-community">
            <p className="table-phase-label">{PHASE_LABEL[phase]}</p>
            <div className="community-cards">
              {communitySlots.map((card, i) => <PokerCard key={i} card={card} hidden={!card} />)}
            </div>
          </div>
        </div>

        {/* ── Player name labels (outside oval) ── */}
        {ordered.map((p, i) => (
          <div
            key={p.id}
            className={`player-label ${p.name === playerName ? 'label-me' : ''}`}
            style={{ left: `${positions[i][0]}%`, top: `${positions[i][1]}%` }}
          >
            {p.name}
            {p.name === playerName && <span className="label-you"> (toi)</span>}
          </div>
        ))}

        {/* ── All player hands (always visible) ── */}
        {ordered.map((p, i) => {
          const hand = (allHands ?? {})[p.id] ?? myHand ?? [];
          if (!hand.length) return null;
          const [sx, sy] = positions[i];
          const topPct = sy > 60 ? sy - 15 : sy + 6;
          return (
            <div
              key={`hand-${p.id}`}
              className="hand-float"
              style={{ left: `${sx}%`, top: `${topPct}%` }}
            >
              <div className="hand-name-label">{p.name.slice(0, 6)}</div>
              <div className="hand-float-cards">
                {hand.map((card, ci) => <PokerCard key={ci} card={card} small />)}
              </div>
            </div>
          );
        })}

        {/* ── Validation zones ── */}
        {!isOver && ordered.map((p, i) => {
          const [zx, zy] = zonePos(positions[i]);
          const hasToken = playerZones?.[p.id] != null;
          const isMe = p.id === myId;
          return (
            <div
              key={p.id}
              className={`val-zone ${hasToken ? 'zone-green' : 'zone-red'} ${isMe ? 'zone-mine' : ''}`}
              style={{ left: `${zx}%`, top: `${zy}%` }}
            >
              <span className="zone-owner">{p.name}</span>
            </div>
          );
        })}

        {/* ── Floating tokens ── */}
        {!isOver && allTokens.map(t => {
          const isDragging = dragState?.token === t;
          const [px, py] = getTokenPos(t);
          return (
            <div
              key={t}
              className={`token-float ${isDragging ? 'token-dragging' : ''}`}
              style={{ left: `${px}%`, top: `${py}%` }}
              onMouseDown={e => startDrag(e, t)}
            >
              <Token value={t} color={color} />
            </div>
          );
        })}

      </div>

      {/* ── Drag ghost (fixed, follows cursor) ── */}
      {dragState && (
        <div
          className="drag-ghost"
          style={{ left: dragState.curX, top: dragState.curY }}
        >
          <div className="ghost-badge">✋ {playerName}</div>
          <div className={`token ${COLOR_CLASS[color] ?? 'tok-white'} tok-lg`}>
            {dragState.token}
          </div>
        </div>
      )}

      {isOver && (
        <EndOverlay
          state={state}
          revealOrder={revealOrder}
          players={players}
          onRestart={onRestart}
        />
      )}
    </div>
  );
}
