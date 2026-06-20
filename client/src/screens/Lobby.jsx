import { useState } from 'react';

export default function Lobby({ roomId, roomData, playerName, onReady, error }) {
  const [ready, setReady] = useState(false);

  function toggle() {
    const next = !ready;
    setReady(next);
    onReady(next);
  }

  const players = roomData?.players ?? [];
  const me = players.find(p => p.name === playerName);

  return (
    <div className="screen">
      <h1 className="logo">THE GANG</h1>

      <div className="card-box" style={{ gap: 20 }}>
        <div>
          <p className="room-code-label">Code de la salle</p>
          <p className="room-code">{roomId}</p>
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
            Partage ce code à tes complices
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Joueurs ({players.length}/5)
          </p>
          {players.map(p => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px',
            }}>
              <span style={{ fontWeight: 600 }}>
                {p.name} {p.name === playerName && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(toi)</span>}
              </span>
              <span style={{ fontSize: '0.8rem', color: p.ready ? 'var(--green)' : 'var(--muted)' }}>
                {p.ready ? '✓ Prêt' : 'En attente'}
              </span>
            </div>
          ))}
        </div>

        {players.length < 2 && (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            En attente d'au moins un autre joueur…
          </p>
        )}

        <button
          className={`btn ${ready ? 'btn-danger' : 'btn-primary'}`}
          onClick={toggle}
          disabled={players.length < 2}
        >
          {ready ? 'Annuler' : 'Je suis prêt !'}
        </button>

        {players.length >= 2 && players.every(p => p.ready) && (
          <p style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>
            Tout le monde est prêt ! La partie démarre…
          </p>
        )}

        {error && <p className="error-msg">{error}</p>}
      </div>
    </div>
  );
}
