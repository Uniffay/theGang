import { useState, useRef, useEffect } from 'react';
import PokerCard from '../components/PokerCard';
import './GameScreen.css';

const PHASE_LABEL = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River' };
const PHASE_ORDER = ['preflop', 'flop', 'turn', 'river'];
const COLOR_CLASS = { white: 'tok-white', yellow: 'tok-yellow', orange: 'tok-orange', red: 'tok-red' };

// [left%, top%] – index 0 = me (always bottom-center).
// Computed on ellipse: center (50,46), semi-axes (38,36), clockwise from bottom.
const SEAT_POS = {
  2: [[50, 82], [50, 10]],
  3: [[50, 82], [17, 28], [83, 28]],
  4: [[50, 82], [12, 46], [50, 10], [88, 46]],
  5: [[50, 82], [14, 57], [28, 17], [72, 17], [86, 57]],
  6: [[50, 82], [17, 64], [17, 28], [50, 10], [83, 28], [83, 64]],
  7: [[50, 82], [20, 69], [13, 38], [34, 14], [67, 14], [87, 38], [80, 69]],
  8: [[50, 82], [23, 72], [12, 46], [23, 21], [50, 10], [77, 21], [88, 46], [77, 72]],
};

// ── Token (draggable) ──────────────────────────────────────────────────────

function Token({ value, color, size = 'lg', onClick }) {
  return (
    <div
      className={`token ${COLOR_CLASS[color] ?? 'tok-white'} tok-${size}`}
      draggable
      onClick={onClick}
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', String(value));
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('dragging');
      }}
      onDragEnd={e => e.currentTarget.classList.remove('dragging')}
    >
      {value}
    </div>
  );
}

// ── Player zone (drop target) ──────────────────────────────────────────────

function PlayerZone({ token, color, onDrop, isMe }) {
  const [over, setOver] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setOver(false);
    const tok = parseInt(e.dataTransfer.getData('text/plain'));
    if (tok) onDrop(tok);
  }

  return (
    <div
      className={`player-zone ${over ? 'dz-over' : ''} ${isMe ? 'dz-mine' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragEnter={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      {token !== null
        ? <Token value={token} color={color} onClick={() => onDrop(token)} />
        : <div className="zone-empty" />
      }
    </div>
  );
}

// ── Player seat ────────────────────────────────────────────────────────────

function Seat({ player, token, color, isMe, hand, onDrop, pos, isOver: gameOver }) {
  return (
    <div
      className={`seat ${isMe ? 'seat-me' : 'seat-other'}`}
      style={{ left: `${pos[0]}%`, top: `${pos[1]}%` }}
    >
      {!isMe && <div className="seat-label">{player.name}</div>}

      <PlayerZone token={token} color={color} onDrop={onDrop} isMe={isMe} />

      {isMe && (
        <>
          <div className="seat-label seat-label-me">{player.name} <span>(toi)</span></div>
          {hand && (
            <div className="seat-hand">
              {hand.map((card, i) => <PokerCard key={i} card={card} />)}
            </div>
          )}
        </>
      )}

      {!isMe && gameOver && hand && (
        <div className="seat-hand-other">
          {hand.map((card, i) => <PokerCard key={i} card={card} small />)}
        </div>
      )}
    </div>
  );
}

// ── Poker table (felt + pool) ──────────────────────────────────────────────

function PokerTable({ community, tokenPool, color, onPickToken, phase }) {
  const [over, setOver] = useState(false);
  const slots = Array(5).fill(null).map((_, i) => community[i] ?? null);

  return (
    <div className="poker-table">
      <div className="table-felt">
        {/* Community cards */}
        <div className="table-community">
          <p className="table-label">{PHASE_LABEL[phase]}</p>
          <div className="community-cards">
            {slots.map((card, i) => <PokerCard key={i} card={card} hidden={!card} />)}
          </div>
        </div>

        {/* Token pool – also a drop target (dropping your token here returns it to pool) */}
        <div
          className={`table-pool ${over ? 'dz-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragEnter={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={e => {
            e.preventDefault();
            setOver(false);
            const tok = parseInt(e.dataTransfer.getData('text/plain'));
            if (tok) onPickToken(tok);
          }}
        >
          <p className="table-label">Jetons</p>
          <div className="pool-tokens">
            {tokenPool?.map(t => (
              <Token key={t} value={t} color={color} onClick={() => onPickToken(t)} />
            ))}
            {tokenPool?.length === 0 && <span className="pool-empty">Tous pris</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

function Sidebar({ roomId, phase, phaseIndex, completedPhases, players, chat, onSendChat }) {
  const [chatText, setChatText] = useState('');
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat]);

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

      {/* Phase track */}
      <div className="phase-track">
        {PHASE_ORDER.map((ph, i) => (
          <div key={ph} className={`ph-pip ${i < phaseIndex ? 'done' : i === phaseIndex ? 'active' : 'future'} ${COLOR_CLASS[{ preflop:'white',flop:'yellow',turn:'orange',river:'red'}[ph]]}`}>
            {PHASE_LABEL[ph]}
          </div>
        ))}
      </div>

      {/* History */}
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

      {/* Chat */}
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

function EndOverlay({ state, revealOrder, onRestart }) {
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
          {(revealOrder ?? []).map((r, i) => (
            <div key={r.id} className={`reveal-row ${r.correct ? 'correct' : 'wrong'}`}>
              <span className={`token tok-sm tok-red`}>{r.token}</span>
              <span className="rev-name">{r.name}</span>
              <div className="rev-hand">
                {r.hand?.map((card, ci) => <PokerCard key={ci} card={card} small />)}
              </div>
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

// ── Main component ─────────────────────────────────────────────────────────

export default function GameScreen({ gameState, playerName, roomId, onPickToken, onSendChat, onRestart }) {
  if (!gameState) return <div className="screen"><p style={{ color: 'var(--muted)' }}>Connexion…</p></div>;

  const { state, phase, phaseIndex, color, players, myHand, community, tokenPool, playerZones, completedPhases, revealOrder, n, chat } = gameState;
  const isOver = state === 'won' || state === 'lost';

  // Reorder: me first, others in join order
  const myPlayer = players?.find(p => p.name === playerName);
  const others = players?.filter(p => p.name !== playerName) ?? [];
  const ordered = myPlayer ? [myPlayer, ...others] : (players ?? []);
  const positions = SEAT_POS[ordered.length] ?? SEAT_POS[2];

  // For reveal: get other players' hands
  const revealHandMap = {};
  revealOrder?.forEach(r => { revealHandMap[r.id] = r.hand; });

  return (
    <div className="game-wrap">
      <Sidebar
        roomId={roomId}
        phase={phase}
        phaseIndex={phaseIndex}
        completedPhases={completedPhases}
        players={players}
        chat={chat}
        onSendChat={onSendChat}
      />

      <div className="game-area">
        {/* Poker table */}
        {!isOver && (
          <PokerTable
            community={community}
            tokenPool={tokenPool}
            color={color}
            onPickToken={onPickToken}
            phase={phase}
          />
        )}

        {/* Seats */}
        {ordered.map((p, i) => {
          const isMe = p.name === playerName;
          return (
            <Seat
              key={p.id}
              player={p}
              token={playerZones?.[p.id] ?? null}
              color={color}
              isMe={isMe}
              hand={isMe ? myHand : (isOver ? revealHandMap[p.id] : null)}
              onDrop={onPickToken}
              pos={positions[i] ?? positions[0]}
              isOver={isOver}
            />
          );
        })}
      </div>

      {isOver && (
        <EndOverlay state={state} revealOrder={revealOrder} onRestart={onRestart} />
      )}
    </div>
  );
}
