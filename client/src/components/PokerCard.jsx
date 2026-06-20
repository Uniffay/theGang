import './PokerCard.css';

const RED_SUITS = ['♥', '♦'];

export default function PokerCard({ card, hidden, small }) {
  if (hidden) return <div className={`poker-card back ${small ? 'small' : ''}`}><span>🂠</span></div>;
  if (!card) return null;
  const isRed = RED_SUITS.includes(card.suit);
  return (
    <div className={`poker-card ${isRed ? 'red' : 'black'} ${small ? 'small' : ''}`}>
      <span className="cv top">{card.value}</span>
      <span className="cs">{card.suit}</span>
      <span className="cv bot">{card.value}</span>
    </div>
  );
}
