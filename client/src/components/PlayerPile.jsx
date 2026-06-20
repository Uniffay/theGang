import './PlayerPile.css';

export default function PlayerPile({ name, count }) {
  return (
    <div className="player-pile">
      <div className="pile-cards-icon">
        {[...Array(Math.min(count, 5))].map((_, i) => (
          <div key={i} className="mini-card" style={{ right: i * 4, zIndex: i }} />
        ))}
      </div>
      <p className="player-name">{name}</p>
      <p className="player-count">{count} carte{count > 1 ? 's' : ''}</p>
    </div>
  );
}
