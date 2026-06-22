import './PokerCard.css';

const RED_SUITS = ['♥', '♦'];

export default function PokerCard({ card, hidden, small, large, delay = 0, highlight = false }) {
  const sizeClass = large ? 'large' : small ? 'small' : '';
  const style = delay ? { animationDelay: `${delay}ms` } : undefined;

  if (hidden) {
    return (
      <div className={`poker-card back deal ${sizeClass}`} style={style}>
        <span className="back-icon">♛</span>
      </div>
    );
  }
  if (!card) return null;

  const isRed = RED_SUITS.includes(card.suit);
  return (
    <div className={`poker-card deal ${isRed ? 'red' : 'black'} ${sizeClass}${highlight ? ' card-highlight' : ''}`} style={style}>
      <span className="cv top">{card.value}</span>
      <span className="cs">{card.suit}</span>
      <span className="cv bot">{card.value}</span>
    </div>
  );
}
