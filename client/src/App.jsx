import { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from './socket';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import GameScreen from './screens/GameScreen';
import './App.css';

// ── Background suits ─────────────────────────────────────────────────────────
const SUITS_CYCLE = ['♠', '♥', '♦', '♣'];
const SUIT_BG = [];
for (let r = 0; r < 14; r++) {
  for (let c = 0; c < 11; c++) {
    const suit = SUITS_CYCLE[(c + r) % 4];
    SUIT_BG.push({
      suit,
      isRed: suit === '♥' || suit === '♦',
      left: c * 9.5 + (r % 2 === 0 ? 0 : 4.75),
      top: r * 7.8 - 3,
      pulse: (c * 3 + r * 7) % 11 === 0,
      delay: -(((c * 2 + r * 5) % 60) / 10),
    });
  }
}

function BackgroundSuits() {
  return (
    <div className="bg-suits" aria-hidden="true">
      {SUIT_BG.map((d, i) => (
        <span
          key={i}
          className={`bg-suit ${d.isRed ? 'suit-red' : 'suit-gold'}${d.pulse ? ' suit-pulse' : ''}`}
          style={{ left: `${d.left}%`, top: `${d.top}%`, animationDelay: d.pulse ? `${d.delay}s` : undefined }}
        >{d.suit}</span>
      ))}
      <div className="bg-suits-vignette" />
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('home');
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.45);
  const [showVolume, setShowVolume] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return JSON.parse(localStorage.getItem('thegang-theme')) ?? { background: 'shapes', cards: 'classic', table: 'classic' }; }
    catch { return { background: 'shapes', cards: 'classic', table: 'classic' }; }
  });
  const [drawnMalus, setDrawnMalus] = useState(null);
  const audioRef = useRef(null);

  const updateTheme = useCallback((key, value) => {
    setTheme(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('thegang-theme', JSON.stringify(next));
      return next;
    });
  }, []);

  // Background music — autoplay immediately, fallback to first click if blocked
  useEffect(() => {
    const audio = new Audio('/music/aseleyeah.mp3');
    audio.loop = true;
    audio.volume = 0.45;
    audio.muted = true;
    audio.preload = 'auto';
    audioRef.current = audio;

    audio.play().catch(() => {
      const unlock = () => {
        audio.play().catch(() => {});
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
      };
      document.addEventListener('click', unlock);
      document.addEventListener('keydown', unlock);
    });

    return () => { audio.pause(); audio.src = ''; };
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const newMuted = !muted;
    audioRef.current.muted = newMuted;
    setMuted(newMuted);
  }, [muted]);

  const changeVolume = useCallback((v) => {
    setVolume(v);
    if (!audioRef.current) return;
    audioRef.current.volume = v;
    if (v === 0) { audioRef.current.muted = true; setMuted(true); }
    else if (muted) { audioRef.current.muted = false; setMuted(false); }
  }, [muted]);

  useEffect(() => {
    socket.on('joined', ({ roomId }) => { setRoomId(roomId); setScreen('lobby'); setError(''); });
    socket.on('room-update', (data) => {
      setRoomData(data);
      if (data.state === 'lobby') setScreen('lobby');
    });
    socket.on('game-state', (state) => {
      setGameState(state);
      setScreen('game');
    });
    socket.on('error', ({ message }) => setError(message));
    socket.on('room-terminated', () => quit());
    socket.on('kicked', () => quit());
    socket.on('left-game', () => quit());
    socket.on('malus-drawn', ({ malus }) => {
      setDrawnMalus(malus);
      setTimeout(() => setDrawnMalus(null), 4500);
    });
    return () => socket.off('joined').off('room-update').off('game-state').off('error').off('room-terminated').off('kicked').off('left-game').off('malus-drawn');
  }, []);

  // Auto-rejoin on page refresh
  useEffect(() => {
    const savedRoom = sessionStorage.getItem('thegang-room');
    const savedName = sessionStorage.getItem('thegang-name');
    if (savedRoom && savedName) {
      setPlayerName(savedName);
      socket.connect();
      socket.emit('join-room', { roomId: savedRoom, name: savedName });
    }
  }, []);

  const join = useCallback((rid, name) => {
    setPlayerName(name);
    sessionStorage.setItem('thegang-room', rid);
    sessionStorage.setItem('thegang-name', name);
    socket.connect();
    socket.emit('join-room', { roomId: rid, name });
  }, []);

  const quit = useCallback(() => {
    sessionStorage.removeItem('thegang-room');
    sessionStorage.removeItem('thegang-name');
    socket.disconnect();
    setScreen('home');
    setRoomId('');
    setPlayerName('');
    setRoomData(null);
    setGameState(null);
    setError('');
  }, []);

  const setReady = useCallback((v) => socket.emit('set-ready', { ready: v }), []);
  const setGameMode = useCallback((mode) => socket.emit('set-game-mode', { mode }), []);
  const toggleDefaultMalus = useCallback((id) => socket.emit('toggle-default-malus', { id }), []);
  const hostAction = useCallback((action) => socket.emit('host-action', { action }), []);
  const pickToken = useCallback((token) => socket.emit('take-token', { token }), []);
  const placeToken = useCallback((token, targetPlayerId) => socket.emit('place-token', { token, targetPlayerId }), []);
  const releaseToken = useCallback((token) => socket.emit('release-token', { token }), []);
  const sendChat = useCallback((text) => socket.emit('chat', { text }), []);
  const restart = useCallback(() => socket.emit('vote-restart'), []);
  const kickPlayer = useCallback((targetId) => socket.emit('kick-player', { targetId }), []);
  const leaveGame = useCallback(() => socket.emit('leave-game'), []);

  let content;
  if (screen === 'home')  content = <Home onJoin={join} error={error} />;
  else if (screen === 'lobby') content = <Lobby roomId={roomId} roomData={roomData} playerName={playerName} onReady={setReady} onQuit={quit} onSetMode={setGameMode} onToggleMalus={toggleDefaultMalus} onKick={kickPlayer} error={error} />;
  else content = <GameScreen gameState={gameState} playerName={playerName} roomId={roomId} onPickToken={pickToken} onPlaceToken={placeToken} onReleaseToken={releaseToken} onSendChat={sendChat} onHostAction={hostAction} onKick={kickPlayer} onLeave={leaveGame} drawnMalus={drawnMalus} error={error} />;

  return (
    <>
      <BackgroundSuits />
      {content}

      {/* Settings modal */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <span className="settings-modal-title">⚙️ Paramètres</span>
              <button className="settings-close-btn" onClick={() => setShowSettings(false)}>✕</button>
            </div>

            <div className="settings-category">
              <p className="settings-cat-label">Fond</p>
              <div className="settings-options-grid">
                <button
                  className={`settings-option${theme.background === 'shapes' ? ' selected' : ''}`}
                  onClick={() => updateTheme('background', 'shapes')}>
                  <div className="settings-preview settings-preview-shapes">
                    <span className="sp-suit sp-gold">♠</span>
                    <span className="sp-suit sp-red">♥</span>
                    <span className="sp-suit sp-gold">♣</span>
                    <span className="sp-suit sp-red">♦</span>
                  </div>
                  <span className="settings-option-name">Formes</span>
                </button>
              </div>
            </div>

            <div className="settings-category">
              <p className="settings-cat-label">Cartes</p>
              <div className="settings-options-grid">
                <button
                  className={`settings-option${theme.cards === 'classic' ? ' selected' : ''}`}
                  onClick={() => updateTheme('cards', 'classic')}>
                  <div className="settings-preview settings-preview-cards">
                    <div className="sp-card sp-card-red">
                      <span>A</span><span>♥</span>
                    </div>
                    <div className="sp-card sp-card-black">
                      <span>K</span><span>♠</span>
                    </div>
                  </div>
                  <span className="settings-option-name">Classique</span>
                </button>
              </div>
            </div>

            <div className="settings-category">
              <p className="settings-cat-label">Table</p>
              <div className="settings-options-grid">
                <button
                  className={`settings-option${theme.table === 'classic' ? ' selected' : ''}`}
                  onClick={() => updateTheme('table', 'classic')}>
                  <div className="settings-preview settings-preview-table">
                    <div className="sp-table" />
                  </div>
                  <span className="settings-option-name">Classique</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="volume-ctrl" onMouseEnter={() => setShowVolume(true)} onMouseLeave={() => setShowVolume(false)}>
        {showVolume && (
          <div className="volume-popup">
            <input
              type="range" min="0" max="1" step="0.02"
              value={muted ? 0 : volume}
              onChange={e => changeVolume(parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>
        )}
        <button className="mute-btn" onClick={toggleMute} title={muted ? 'Activer le son' : 'Couper le son'}>
          {muted || volume === 0 ? '🔇' : volume < 0.35 ? '🔈' : volume < 0.7 ? '🔉' : '🔊'}
        </button>
      </div>

      <button
        className="settings-btn"
        onClick={() => setShowSettings(s => !s)}
        title="Paramètres"
      >
        ⚙️
      </button>
    </>
  );
}
