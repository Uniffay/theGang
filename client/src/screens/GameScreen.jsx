import { useState, useRef, useEffect } from 'react';
import PokerCard from '../components/PokerCard';
import './GameScreen.css';

const STAGE_LABELS = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River' };
const STAGE_ORDER = ['preflop', 'flop', 'turn', 'river'];

function findDuplicates(choices) {
  const seen = {}, dupes = [];
  for (const t of Object.values(choices)) {
    if (seen[t]) dupes.push(t);
    seen[t] = true;
  }
  return [...new Set(dupes)];
}

function playerName(players, id) {
  return players?.find(p => p.id === id)?.name ?? '?';
}

function EventBanner({ event, players }) {
  if (!event) return null;

  if (event.type === 'conflict') {
    const dupes = findDuplicates(event.choices);
    return (
      <div className="event-banner bad">
        ⚠️ Conflit ! {Object.entries(event.choices).map(([id, t]) => `${playerName(players, id)}: jeton ${t}`).join(' · ')}
        {' '}— {dupes.map(t => `jeton ${t} réclamé plusieurs fois`).join(', ')} — une vie perdue !
      </div>
    );
  }
  if (event.type === 'stage-clear') {
    return (
      <div className="event-banner good">
        ✓ {STAGE_LABELS[event.stage]} validé !{' '}
        {Object.entries(event.choices).map(([id, t]) => `${playerName(players, id)}: jeton ${t}`).join(' · ')}
      </div>
    );
  }
  if (event.type === 'stage-open') {
    return <div className="event-banner neutral">Nouvelle phase : {STAGE_LABELS[event.stage]} — choisissez vos jetons.</div>;
  }
  return null;
}

function FinalSummary({ event, players }) {
  if (!event?.ranks) return null;
  const ids = Object.keys(event.ranks);
  return (
    <div style={{ marginTop: 16, width: '100%' }}>
      {ids.map(id => {
        const correct = event.choices[id] === event.ranks[id];
        return (
          <div key={id} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>{playerName(players, id)}</span>
            <span style={{ color: 'var(--muted)' }}>{event.handNames?.[id]}</span>
            <span>
              Jeton <strong>{event.choices[id]}</strong> / Rang <strong>{event.ranks[id]}</strong>
              {' '}<span style={{ color: correct ? 'var(--green)' : 'var(--red)' }}>{correct ? '✓' : '✗'}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function GameScreen({ gameState, playerName, roomId, onPickToken, onSendChat, onRestart, error }) {
  const [chatText, setChatText] = useState('');
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [gameState?.chat]);

  if (!gameState) return <div className="screen"><p style={{ color: 'var(--muted)' }}>Connexion…</p></div>;

  const { state, stage, stageIndex, myHand, community, lives, n, myToken, otherPlayers, lastEvent, players, chat } = gameState;
  const isOver = state === 'won' || state === 'lost';

  const communitySlots = Array(5).fill(null).map((_, i) => community[i] ?? null);

  function sendChat(e) {
    e.preventDefault();
    if (chatText.trim()) { onSendChat(chatText); setChatText(''); }
  }

  return (
    <div className="game-wrap">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="game-logo-sm">THE GANG</span>
          <span className="room-chip">{roomId}</span>
        </div>

        <div className="lives-row">
          {Array(3).fill(0).map((_, i) => (
            <span key={i} className={`life ${i < lives ? 'alive' : 'dead'}`}>❤️</span>
          ))}
          <span style={{ color: 'var(--muted)', fontSize: '0.8rem', marginLeft: 4 }}>{lives} vie{lives > 1 ? 's' : ''}</span>
        </div>

        <div className="stage-row">
          {STAGE_ORDER.map((s, i) => (
            <div key={s} className={`stage-pip ${i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'future'}`}>
              {STAGE_LABELS[s]}
            </div>
          ))}
        </div>

        <div className="player-list">
          {players?.map(p => {
            const other = otherPlayers?.find(o => o.id === p.id);
            const isMe = p.name === playerName;
            const hasPicked = isMe ? myToken !== null : other?.hasPicked;
            return (
              <div key={p.id} className="player-row">
                <span className="player-dot" style={{ background: isMe ? 'var(--accent)' : 'var(--muted)' }} />
                <span className="player-nm">{p.name}{isMe ? ' (toi)' : ''}</span>
                <span className={`pick-status ${hasPicked ? 'picked' : ''}`}>{hasPicked ? '✓' : '…'}</span>
              </div>
            );
          })}
        </div>

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
          <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>→</button>
        </form>
      </aside>

      {/* Main */}
      <main className="game-main">
        <section className="community-area">
          <p className="section-label">{STAGE_LABELS[stage] ?? ''}</p>
          <div className="community-cards">
            {communitySlots.map((card, i) => (
              <PokerCard key={i} card={card} hidden={!card} />
            ))}
          </div>
        </section>

        <EventBanner event={lastEvent} players={players} />

        <section className="hand-area">
          <p className="section-label">Ta main</p>
          <div className="hand-cards">
            {(myHand ?? []).map((card, i) => <PokerCard key={i} card={card} />)}
          </div>

          {!isOver && (
            <div className="token-area">
              <p className="section-label" style={{ marginBottom: 8 }}>
                {myToken !== null
                  ? `Tu as choisi le jeton ${myToken} — attente des autres…`
                  : `Choisis ton rang (1 = main la plus faible, ${n} = la plus forte)`}
              </p>
              <div className="token-row">
                {Array.from({ length: n }, (_, i) => i + 1).map(t => (
                  <button
                    key={t}
                    className={`token-btn ${myToken === t ? 'selected' : ''}`}
                    onClick={() => onPickToken(t)}
                    disabled={myToken !== null}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isOver && otherPlayers?.length > 0 && (
            <div className="reveal-hands">
              {otherPlayers.filter(op => op.hand).map(op => (
                <div key={op.id} className="other-hand">
                  <p className="section-label">{op.name}</p>
                  <div className="hand-cards">
                    {op.hand.map((card, i) => <PokerCard key={i} card={card} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && <p className="error-msg" style={{ textAlign: 'center', marginTop: 8 }}>{error}</p>}
      </main>

      {isOver && (
        <div className="end-overlay">
          <div className="end-box">
            <h2 className={state === 'won' ? 'won-title' : 'lost-title'}>
              {state === 'won' ? '🏆 LE GANG GAGNE !' : '💀 LE GANG EST PRIS !'}
            </h2>
            {lastEvent?.type === 'final' && <FinalSummary event={lastEvent} players={players} />}
            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={onRestart}>Rejouer</button>
          </div>
        </div>
      )}
    </div>
  );
}
