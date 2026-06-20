import Card from '../components/Card';
import PlayerPile from '../components/PlayerPile';
import './GameScreen.css';

export default function GameScreen({ gameState, roomData, playerName, roomId, onPlayCard, onUseToken, onRestart, error }) {
  if (!gameState) {
    return (
      <div className="screen">
        <p style={{ color: 'var(--muted)' }}>Chargement de la partie…</p>
      </div>
    );
  }

  const { state, hand, otherHands, played, lives, tokens, lastAction, players } = gameState;
  const topCard = played.length > 0 ? played[played.length - 1] : null;
  const isOver = state === 'won' || state === 'lost';

  const lastMistake = lastAction?.type === 'mistake';

  return (
    <div className="game-screen">
      {/* Header */}
      <header className="game-header">
        <span className="game-logo">THE GANG</span>
        <div className="game-stats">
          <span className="stat">
            <span className="stat-icon">❤️</span>
            <span className="stat-val">{lives}</span>
          </span>
          <span className="stat">
            <span className="stat-icon">🎯</span>
            <span className="stat-val">{tokens}</span>
          </span>
          <span className="stat code">{roomId}</span>
        </div>
      </header>

      {/* Other players */}
      <div className="other-players">
        {players?.filter(p => p.name !== playerName).map(p => (
          <PlayerPile key={p.id} name={p.name} count={otherHands[p.id] ?? 0} />
        ))}
      </div>

      {/* Table */}
      <div className="table-area">
        <div className="played-pile">
          {topCard ? (
            <div className={`pile-card ${lastMistake ? 'mistake' : ''}`}>
              <span className="pile-num">{topCard.card}</span>
            </div>
          ) : (
            <div className="pile-empty">
              <span>Aucune carte<br />jouée</span>
            </div>
          )}
          <p className="pile-label">{played.length} carte{played.length > 1 ? 's' : ''} jouée{played.length > 1 ? 's' : ''}</p>
        </div>

        {lastAction && (
          <div className={`last-action ${lastAction.type === 'mistake' ? 'bad' : lastAction.type === 'token' ? 'token' : 'good'}`}>
            {lastAction.type === 'play' && `▶ ${findName(players, lastAction.playerId)} joue le ${lastAction.card}`}
            {lastAction.type === 'mistake' && `⚠️ ${findName(players, lastAction.playerId)} joue le ${lastAction.card} — ERREUR !`}
            {lastAction.type === 'token' && (
              <span>
                🎯 Jeton utilisé — plus faibles cartes:{' '}
                {Object.entries(lastAction.reveals).map(([id, v]) => `${findName(players, id)}: ${v ?? '-'}`).join(', ')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* End overlay */}
      {isOver && (
        <div className="end-overlay">
          <div className="end-box">
            <h2 className={state === 'won' ? 'won-title' : 'lost-title'}>
              {state === 'won' ? '🏆 THE GANG GAGNE !' : '💀 LE GANG EST PRIS !'}
            </h2>
            <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
              {state === 'won'
                ? 'Toutes les cartes jouées en ordre. Le braquage est parfait !'
                : `Le gang a perdu toutes ses vies. Meilleures chances la prochaine fois.`}
            </p>
            <button className="btn btn-primary" onClick={onRestart}>Rejouer</button>
          </div>
        </div>
      )}

      {/* Hand */}
      {!isOver && (
        <div className="hand-area">
          <p className="hand-label">Ta main ({hand.length} cartes)</p>
          <div className="hand-cards">
            {hand.map(card => (
              <Card key={card} value={card} onClick={() => onPlayCard(card)} topCard={topCard?.card ?? 0} />
            ))}
          </div>
          <button
            className="btn btn-token"
            onClick={onUseToken}
            disabled={tokens <= 0}
            style={{ alignSelf: 'center', marginTop: 12 }}
          >
            🎯 Utiliser un jeton de synchronisation ({tokens} restant{tokens > 1 ? 's' : ''})
          </button>
          {error && <p className="error-msg" style={{ textAlign: 'center', marginTop: 8 }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

function findName(players, id) {
  return players?.find(p => p.id === id)?.name ?? 'Inconnu';
}
