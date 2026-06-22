import { useState } from 'react';

const MODE_LABELS = {
  texas:         { label: "Texas Hold'em",  desc: '2 cartes en main' },
  omaha:         { label: 'Omaha',          desc: '4 cartes, joue 2 obligatoire' },
  banana:        { label: 'Banana Split',   desc: '2 cartes + 3 entre chaque joueur' },
  'banana-omaha':{ label: 'Banana Omaha',   desc: '4 cartes + 3 entre chaque joueur, joue 2 obligatoire' },
};

const MALUS_LIST = [
  { id: 'jeton-noir',          icon: '🖤', name: 'Jeton 1 Maudit',          description: 'Phases blanc/jaune/orange : le jeton 1 est maudit. Celui qui le touche le reçoit dans sa zone et ne peut plus être bougé.' },
  { id: 'jeton-haut-noir',     icon: '⬛', name: 'Jeton Élevé Maudit',      description: 'Phases blanc/jaune/orange : le jeton le plus élevé est maudit. Celui qui le touche le reçoit dans sa zone et ne peut plus être bougé.' },
  { id: 'echange-tete',        icon: '👑', name: 'Échange de Tête',          description: 'Si une tête (K, D, J) apparaît au flop, le joueur avec le jeton 1 défausse ses cartes et en pioche de nouvelles.' },
  { id: 'echange-sans-tete',   icon: '🔄', name: 'Échange Sans Tête',       description: "Si aucune tête (K, D, J) n'apparaît au flop, le joueur au jeton le plus élevé défausse ses cartes et en pioche de nouvelles." },
  { id: 'camera-surveillance', icon: '📹', name: 'Caméra de Surveillance',  description: 'Chaque joueur reçoit une carte supplémentaire en main.' },
  { id: 'orangophobe',     icon: '🟠', name: 'Orangophobe',     description: 'Le tour orange est supprimé. On passe directement du flop à la river.' },
  { id: 'jugement-final', icon: '⚖️', name: 'Jugement Final', description: "Avant la révélation, le gang vote une carte. Si le joueur au jeton le plus élevé ne l'a pas, c'est perdu." },
  { id: 'analyse-jeu',   icon: '🕵️', name: 'Analyse de Jeu', description: "Avant la révélation du dernier joueur, le gang vote sur sa combinaison de main. Si la majorité se trompe, c'est perdu." },
];

export default function Lobby({ roomId, roomData, playerName, onReady, onQuit, onSetMode, onToggleMalus, onKick, error }) {
  const [ready, setReady] = useState(false);
  const [hoveredMalus, setHoveredMalus] = useState(null);

  function toggle() {
    const next = !ready;
    setReady(next);
    onReady(next);
  }

  const players      = roomData?.players ?? [];
  const mode         = roomData?.mode ?? 'texas';
  const defaultMalus = roomData?.defaultMalus ?? [];
  const isHost       = playerName === roomData?.creatorName;

  return (
    <div className="screen">
      <h1 className="logo">THE GANG</h1>

      <div className="card-box" style={{ gap: 20, maxWidth: 480 }}>
        <div>
          <p className="room-code-label">Code de la salle</p>
          <p className="room-code">{roomId}</p>
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
            Partage ce code à tes complices
          </p>
        </div>

        {/* Mode selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Mode de jeu {!isHost && <span style={{ textTransform: 'none', fontWeight: 400 }}>(chef seulement)</span>}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {Object.entries(MODE_LABELS).map(([key, { label, desc }]) => (
              <button
                key={key}
                className={`btn ${mode === key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 12px', opacity: isHost ? 1 : 0.5, cursor: isHost ? 'pointer' : 'default' }}
                onClick={() => isHost && onSetMode(key)}
              >
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{label}</span>
                <span style={{ fontWeight: 400, fontSize: '0.68rem', opacity: 0.75 }}>{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Malus par défaut */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Malus de départ {!isHost && <span style={{ textTransform: 'none', fontWeight: 400 }}>(chef seulement)</span>}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MALUS_LIST.map(m => {
              const active = defaultMalus.some(dm => dm.id === m.id);
              return (
                <button
                  key={m.id}
                  className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', fontSize: '0.82rem', textAlign: 'left', position: 'relative', opacity: isHost ? 1 : 0.5, cursor: isHost ? 'pointer' : 'default' }}
                  onClick={() => isHost && onToggleMalus(m.id)}
                  onMouseEnter={() => setHoveredMalus(m.id)}
                  onMouseLeave={() => setHoveredMalus(null)}
                >
                  <span style={{ fontSize: '1.15rem', flexShrink: 0 }}>{m.icon}</span>
                  <span style={{ fontWeight: active ? 700 : 400 }}>{m.name}</span>
                  {hoveredMalus === m.id && (
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                      background: '#111', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '10px 12px', width: 220,
                      fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5,
                      zIndex: 100, pointerEvents: 'none', textAlign: 'left',
                    }}>
                      {m.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {defaultMalus.length > 0 && (
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'center' }}>
              {defaultMalus.length} malus actif{defaultMalus.length > 1 ? 's' : ''} dès le départ
            </p>
          )}
        </div>

        {/* Liste joueurs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Joueurs ({players.length}/8)
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', color: p.ready ? 'var(--green)' : 'var(--muted)' }}>
                  {p.ready ? '✓ Prêt' : 'En attente'}
                </span>
                {isHost && p.name !== playerName && (
                  <button
                    onClick={() => onKick(p.id)}
                    style={{
                      background: 'rgba(200,16,46,0.18)', border: '1px solid rgba(200,16,46,0.4)',
                      borderRadius: 6, color: 'var(--red)', cursor: 'pointer',
                      fontSize: '0.75rem', padding: '2px 8px', fontWeight: 700,
                    }}
                    title={`Expulser ${p.name}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {players.length < 2 && (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            En attente d'au moins un autre joueur…
          </p>
        )}

        <button className="btn btn-primary" onClick={toggle} disabled={players.length < 2}>
          {ready ? 'Annuler' : 'Je suis prêt !'}
        </button>

        {players.length >= 2 && players.every(p => p.ready) && (
          <p style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>
            Tout le monde est prêt ! La partie démarre…
          </p>
        )}

        <button className="btn btn-danger" onClick={onQuit} style={{ width: '100%' }}>
          Quitter
        </button>

        {error && <p className="error-msg">{error}</p>}
      </div>
    </div>
  );
}
