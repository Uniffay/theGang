import { useState, useRef, useEffect } from 'react';
import PokerCard from '../components/PokerCard';
import './GameScreen.css';

const PHASE_LABEL = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River' };
const PHASE_ORDER = ['preflop', 'flop', 'turn', 'river'];
const COLOR_CLASS = { white: 'tok-white', yellow: 'tok-yellow', orange: 'tok-orange', red: 'tok-red' };

function Token({ value, color, onClick, dim, highlight, size = 'md' }) {
  const cls = [
    'token',
    COLOR_CLASS[color] ?? 'tok-white',
    dim ? 'dim' : '',
    highlight ? 'highlight' : '',
    `tok-${size}`,
    onClick ? 'clickable' : '',
  ].filter(Boolean).join(' ');
  return <button className={cls} onClick={onClick} disabled={!onClick}>{value}</button>;
}

function CompletedPhase({ cp, players }) {
  function pname(id) { return players?.find(p => p.id === id)?.name ?? '?'; }
  const sorted = Object.entries(cp.zones).sort(([, a], [, b]) => a - b);
  return (
    <div className="cp-row">
      <span className={`cp-label ${COLOR_CLASS[cp.color]}`}>{PHASE_LABEL[cp.phase]}</span>
      {sorted.map(([id, t]) => (
        <span key={id} className="cp-entry">
          <Token value={t} color={cp.color} size="sm" />
          <span className="cp-name">{pname(id)}</span>
        </span>
      ))}
    </div>
  );
}

export default function GameScreen({ gameState, playerName, roomId, onPickToken, onSendChat, onRestart }) {
  const [chatText, setChatText] = useState('');
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [gameState?.chat]);

  if (!gameState) return <div className="screen"><p style={{ color: 'var(--muted)' }}>Connexion…</p></div>;

  const { state, phase, phaseIndex, color, players, myHand, community, tokenPool, playerZones, completedPhases, revealOrder, n, lastEvent, chat } = gameState;
  const isOver = state === 'won' || state === 'lost';
  const me = players?.find(p => p.name === playerName);
  const myId = me?.id;
  const myToken = myId ? playerZones?.[myId] ?? null : null;

  const communitySlots = Array(5).fill(null).map((_, i) => community[i] ?? null);

  function sendChat(e) {
    e.preventDefault();
    if (chatText.trim()) { onSendChat(chatText); setChatText(''); }
  }

  function handleTokenClick(token) {
    onPickToken(token);
  }

  return (
    <div className="game-wrap">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="game-logo-sm">THE GANG</span>
          <span className="room-chip">{roomId}</span>
        </div>

        {/* Phase progress */}
        <div className="phase-track">
          {PHASE_ORDER.map((ph, i) => (
            <div key={ph} className={`ph-pip ${i < phaseIndex ? 'done' : i === phaseIndex ? 'active' : 'future'} ${COLOR_CLASS[{ preflop:'white',flop:'yellow',turn:'orange',river:'red' }[ph]]}`}>
              {PHASE_LABEL[ph]}
            </div>
          ))}
        </div>

        {/* Completed phases history */}
        {completedPhases?.length > 0 && (
          <div className="history">
            {completedPhases.map((cp, i) => <CompletedPhase key={i} cp={cp} players={players} />)}
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
        <form className="chat-form" onSubmit={sendChat}>
          <input value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Parle à ton gang…" maxLength={200} />
          <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px' }}>→</button>
        </form>
      </aside>

      {/* ── Main ── */}
      <main className="game-main">
        {/* Community cards */}
        <section className="community-area">
          <p className="section-label">Cartes communes — {PHASE_LABEL[phase]}</p>
          <div className="community-cards">
            {communitySlots.map((card, i) => (
              <PokerCard key={i} card={card} hidden={!card} />
            ))}
          </div>
        </section>

        {/* Token pool */}
        {!isOver && (
          <section className="pool-area">
            <p className="section-label">Jetons disponibles</p>
            <div className="token-row">
              {tokenPool?.length > 0
                ? tokenPool.map(t => (
                    <Token key={t} value={t} color={color} size="lg" onClick={() => handleTokenClick(t)} />
                  ))
                : <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Tous les jetons sont pris</span>
              }
            </div>
          </section>
        )}

        {/* Player zones */}
        {!isOver && (
          <section className="zones-area">
            <p className="section-label">Zones des joueurs</p>
            <div className="zones-row">
              {players?.map(p => {
                const isMe = p.name === playerName;
                const tok = playerZones?.[p.id] ?? null;
                return (
                  <div key={p.id} className={`player-zone ${isMe ? 'mine' : ''}`}>
                    <span className="zone-name">{p.name}{isMe ? ' (toi)' : ''}</span>
                    <div className="zone-slot">
                      {tok !== null
                        ? <Token
                            value={tok}
                            color={color}
                            size="lg"
                            onClick={isMe ? () => handleTokenClick(tok) : () => handleTokenClick(tok)}
                            highlight={isMe}
                          />
                        : <div className="zone-empty" />
                      }
                    </div>
                  </div>
                );
              })}
            </div>
            {lastEvent?.type === 'phase-complete' && (
              <p className="phase-ok">✓ {PHASE_LABEL[lastEvent.phase]} validé — passage au {PHASE_LABEL[PHASE_ORDER[phaseIndex]] ?? '…'}</p>
            )}
          </section>
        )}

        {/* My hand */}
        <section className="hand-area">
          <p className="section-label">Ta main (privée)</p>
          <div className="hand-cards">
            {(myHand ?? []).map((card, i) => <PokerCard key={i} card={card} />)}
          </div>
        </section>
      </main>

      {/* ── End overlay ── */}
      {isOver && (
        <div className="end-overlay">
          <div className="end-box">
            <h2 className={state === 'won' ? 'won-title' : 'lost-title'}>
              {state === 'won' ? '🏆 LE GANG GAGNE !' : '💀 MAUVAIS RANG !'}
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              {state === 'won' ? 'Les rangs correspondent parfaitement.' : 'Les jetons ne correspondent pas aux vraies mains.'}
            </p>

            {/* Reveal in token order */}
            <div className="reveal-list">
              {(revealOrder ?? []).map((r, i) => (
                <div key={r.id} className={`reveal-row ${r.correct ? 'correct' : 'wrong'}`}>
                  <Token value={r.token} color="red" size="sm" />
                  <span className="rev-name">{r.name}</span>
                  <div className="rev-hand">
                    {r.hand?.map((card, ci) => <PokerCard key={ci} card={card} small />)}
                  </div>
                  <span className="rev-hand-name">{r.handName}</span>
                  <span className="rev-rank">
                    rang réel <strong>{r.actualRank}</strong>
                    {r.correct ? ' ✓' : ` ✗ (jeton ${r.token})`}
                  </span>
                </div>
              ))}
            </div>

            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={onRestart}>Rejouer</button>
          </div>
        </div>
      )}
    </div>
  );
}
