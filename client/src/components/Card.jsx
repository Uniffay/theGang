import './Card.css';

export default function Card({ value, onClick, topCard }) {
  const playable = value > topCard;

  return (
    <button
      className={`playing-card ${playable ? 'playable' : 'early'}`}
      onClick={onClick}
      title={playable ? `Jouer le ${value}` : `Le ${value} est inférieur à la carte en cours (${topCard})`}
    >
      <span className="card-val">{value}</span>
    </button>
  );
}
