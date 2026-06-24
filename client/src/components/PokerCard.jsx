import './PokerCard.css';
import { useTheme } from '../ThemeContext';

const RED_SUITS = ['♥', '♦'];
const KAWAII_SUITS = { '♠': '🌸', '♥': '💗', '♦': '⭐', '♣': '🦄' };
const COLOR_SUIT_CLASS = { '♠': 'color-spade', '♥': 'color-heart', '♦': 'color-diamond', '♣': 'color-club' };

export default function PokerCard({ card, hidden, small, large, delay = 0, highlight = false }) {
  const { cards: cardTheme } = useTheme();
  const isKawaii = cardTheme === 'kawaii';
  const isDark   = cardTheme === 'dark';
  const isColor  = cardTheme === 'color';
  const isPixel  = cardTheme === 'pixel';
  const sizeClass = large ? 'large' : small ? 'small' : '';
  const style = delay ? { animationDelay: `${delay}ms` } : undefined;

  if (hidden) {
    const backClass = isKawaii ? 'kawaii-back' : isDark ? 'dark-back' : isColor ? 'color-back' : isPixel ? 'pixel-back' : '';
    const backIcon  = isKawaii ? '🦄' : isDark ? '✦' : isColor ? '★' : isPixel ? '█' : '♛';
    return (
      <div className={`poker-card back deal ${sizeClass}${backClass ? ` ${backClass}` : ''}`} style={style}>
        <span className="back-icon">{backIcon}</span>
      </div>
    );
  }
  if (!card) return null;

  const isRed = RED_SUITS.includes(card.suit);
  let suit = card.suit;
  let colorClass = isRed ? 'red' : 'black';
  let themeClass = '';

  if (isKawaii) {
    suit = KAWAII_SUITS[card.suit] ?? card.suit;
    colorClass = isRed ? 'kawaii-pink' : 'kawaii-purple';
    themeClass = 'kawaii-card';
  } else if (isDark) {
    colorClass = isRed ? 'dark-red' : 'dark-black';
    themeClass = 'dark-card';
  } else if (isColor) {
    colorClass = COLOR_SUIT_CLASS[card.suit] ?? 'color-spade';
    themeClass = 'color-card';
  } else if (isPixel) {
    colorClass = 'pixel-green';
    themeClass = 'pixel-card';
  }

  return (
    <div className={`poker-card deal ${colorClass} ${sizeClass}${themeClass ? ` ${themeClass}` : ''}${highlight ? ' card-highlight' : ''}`} style={style}>
      <span className="cv top">{card.value}</span>
      <span className="cs">{suit}</span>
      <span className="cv bot">{card.value}</span>
    </div>
  );
}
