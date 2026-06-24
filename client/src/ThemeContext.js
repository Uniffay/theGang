import { createContext, useContext } from 'react';
const ThemeContext = createContext({ background: 'shapes', cards: 'classic', table: 'classic' });
export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
