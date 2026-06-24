import { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from './socket';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import GameScreen from './screens/GameScreen';
import ThemeContext from './ThemeContext';
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

// ── Background kawaii ─────────────────────────────────────────────────────────
const KW_ICONS = ['🌸', '💕', '⭐', '✨', '💖', '🌟', '💫', '🎀', '🍭', '🦄'];
const KAWAII_BG = Array.from({ length: 72 }, (_, i) => ({
  icon: KW_ICONS[i % KW_ICONS.length],
  left: ((i * 14.7) + (i % 3) * 7) % 100,
  top:  ((i * 13.1) + (i % 5) * 4) % 100,
  pulse: i % 6 === 0,
  delay: -(i % 50) / 10,
  size:  0.75 + (i % 4) * 0.18,
}));

function BackgroundKawaii() {
  return (
    <div className="bg-kawaii" aria-hidden="true">
      {KAWAII_BG.map((d, i) => (
        <span key={i}
          className={`bg-kawaii-icon${d.pulse ? ' kawaii-pulse' : ''}`}
          style={{ left: `${d.left}%`, top: `${d.top}%`, fontSize: `${d.size}rem`, animationDelay: d.pulse ? `${d.delay}s` : undefined }}>
          {d.icon}
        </span>
      ))}
      <div className="bg-kawaii-vignette" />
    </div>
  );
}

// ── Background galaxy ─────────────────────────────────────────────────────────
const GALAXY_STARS = Array.from({ length: 190 }, (_, i) => ({
  x: +(((i * 37.7 + (i % 7) * 13.3)) % 100).toFixed(1),
  y: +(((i * 29.3 + (i % 5) * 17.7)) % 100).toFixed(1),
  size: +(0.8 + (i % 5) * 0.45).toFixed(1),
  pulse: i % 8 === 0,
  blue: i % 4 === 0,
  delay: -((i * 1.7) % 6),
}));
function BackgroundGalaxy() {
  return (
    <div className="bg-galaxy" aria-hidden="true">
      {GALAXY_STARS.map((s, i) => (
        <span key={i}
          className={`bg-star${s.pulse ? ' star-pulse' : ''}${s.blue ? ' star-blue' : ''}`}
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.size}px`, height: `${s.size}px`, animationDelay: s.pulse ? `${s.delay}s` : undefined }}
        />
      ))}
      <div className="bg-galaxy-nebula1" />
      <div className="bg-galaxy-nebula2" />
      <div className="bg-galaxy-vignette" />
    </div>
  );
}

// ── Background enfer ──────────────────────────────────────────────────────────
const EMBER_ICONS_LIST = ['✦', '◆', '◉', '✦', '◆', '•'];
const EMBER_PARTICLES = Array.from({ length: 70 }, (_, i) => ({
  icon: EMBER_ICONS_LIST[i % EMBER_ICONS_LIST.length],
  left: +(((i * 14.7 + (i % 6) * 8.3)) % 100).toFixed(1),
  delay: -(((i * 2.3) % 12)),
  size: +(0.4 + (i % 5) * 0.22).toFixed(1),
  duration: 3 + (i % 6),
}));
function BackgroundEnfer() {
  return (
    <div className="bg-enfer" aria-hidden="true">
      {EMBER_PARTICLES.map((e, i) => (
        <span key={i} className="bg-ember"
          style={{ left: `${e.left}%`, fontSize: `${e.size}rem`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s` }}
        >{e.icon}</span>
      ))}
      <div className="bg-enfer-glow" />
      <div className="bg-enfer-vignette" />
    </div>
  );
}

// ── Background vegas ──────────────────────────────────────────────────────────
const VEGAS_ICONS_LIST = ['♠', '♥', '♦', '♣', '7', '♠', '♥', '♦', '♣'];
const VEGAS_PARTICLES = Array.from({ length: 90 }, (_, i) => ({
  icon: VEGAS_ICONS_LIST[i % VEGAS_ICONS_LIST.length],
  x: +(((i * 11.3 + (i % 7) * 8.7)) % 100).toFixed(1),
  y: +(((i * 10.7 + (i % 5) * 9.3)) % 100).toFixed(1),
  isRed: i % 5 === 1 || i % 5 === 3,
  size: +(0.9 + (i % 4) * 0.28).toFixed(1),
}));
function BackgroundVegas() {
  return (
    <div className="bg-vegas" aria-hidden="true">
      {VEGAS_PARTICLES.map((v, i) => (
        <span key={i} className={`bg-vegas-icon ${v.isRed ? 'vegas-red' : 'vegas-gold'}`}
          style={{ left: `${v.x}%`, top: `${v.y}%`, fontSize: `${v.size}rem` }}
        >{v.icon}</span>
      ))}
      <div className="bg-vegas-vignette" />
    </div>
  );
}

// ── Background matrix ─────────────────────────────────────────────────────────
const MTX_CHARS = ['0','1','ア','ウ','カ','テ','ン','ス','コ','エ','ラ','リ','0','1','ム','ヤ','ノ','0'];
const MATRIX_STREAMS = Array.from({ length: 44 }, (_, i) => ({
  x: +(((i * 23.7 + (i % 7) * 5.3)) % 100).toFixed(1),
  delay: -(((i * 2.1) % 14)),
  duration: 4 + (i % 9),
  chars: Array.from({ length: 8 + (i % 12) }, (_, j) => MTX_CHARS[(i * 3 + j * 5) % MTX_CHARS.length]),
}));
function BackgroundMatrix() {
  return (
    <div className="bg-matrix" aria-hidden="true">
      {MATRIX_STREAMS.map((s, i) => (
        <div key={i} className="bg-matrix-col"
          style={{ left: `${s.x}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }}
        >
          {s.chars.map((c, j) => (
            <span key={j} className={j === 0 ? 'matrix-bright' : j < 3 ? 'matrix-mid' : ''}>{c}</span>
          ))}
        </div>
      ))}
      <div className="bg-matrix-scanlines" />
      <div className="bg-matrix-vignette" />
    </div>
  );
}

// ── Avatar options ─────────────────────────────────────────────────────────────
const AVATAR_OPTIONS = [
  { v: '🐱' }, { v: '🐶' }, { v: '🐼' },
  { v: '🐙' }, { v: '🦄' }, { v: '🐲' },
  { v: '/avatars/nami.jpg',      label: 'Nami' },
  { v: '/avatars/robin.jpg',     label: 'Robin' },
  { v: '/avatars/hancock.jpg',   label: 'Hancock' },
  { v: '/avatars/luffy.jpg',     label: 'Luffy' },
  { v: '/avatars/zoro.jpg',      label: 'Zoro' },
  { v: '/avatars/astolfo.jpg',   label: 'Astolfo' },
  { v: '/avatars/wollip.jpg',    label: 'Wollip' },
  { v: '/avatars/mia.png',       label: 'Mia' },
  { v: '/avatars/abella.jpg',    label: 'Abella' },
  { v: '/avatars/kirby.png',     label: 'Kirby' },
  { v: '/avatars/hellokitty.png',label: 'Hello Kitty' },
  { v: '/avatars/kuromi.png',    label: 'Kuromi' },
  { v: '/avatars/fatcat.jpg',    label: 'Fat Cat' },
  { v: '/avatars/bowsette.jpg',  label: 'Bowsette' },
  { v: '/avatars/boosette.jpg',  label: 'Boosette' },
  { v: '/avatars/mereclaus.jpg', label: 'Mère Noël' },
  { v: '/avatars/boobs.jpg',     label: 'Boobs' },
  { v: '/avatars/ass.jpg',       label: 'Ass' },
  { v: '/avatars/poppy.png',     label: 'Poppy' },
  { v: '/avatars/lux.png',       label: 'Lux' },
  { v: '/avatars/neeko.png',        label: 'Neeko' },
  { v: '/avatars/miss_fortune.jpg', label: 'Miss Fortune' },
  { v: '/avatars/seraphine.png', label: 'Seraphine' },
  { v: '/avatars/jinx.png',      label: 'Jinx' },
];

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
  const [playerEmoji, setPlayerEmoji] = useState(() => localStorage.getItem('thegang-emoji') ?? '🐱');
  const [drawnMalus, setDrawnMalus] = useState(null);
  const audioRef = useRef(null);

  const updateTheme = useCallback((key, value) => {
    setTheme(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('thegang-theme', JSON.stringify(next));
      return next;
    });
  }, []);

  const updateEmoji = useCallback((emoji) => {
    setPlayerEmoji(emoji);
    localStorage.setItem('thegang-emoji', emoji);
    socket.emit('update-emoji', { emoji });
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
    const savedEmoji = localStorage.getItem('thegang-emoji') ?? '🐱';
    if (savedRoom && savedName) {
      setPlayerName(savedName);
      socket.connect();
      socket.emit('join-room', { roomId: savedRoom, name: savedName, emoji: savedEmoji });
    }
  }, []);

  const join = useCallback((rid, name) => {
    setPlayerName(name);
    sessionStorage.setItem('thegang-room', rid);
    sessionStorage.setItem('thegang-name', name);
    socket.connect();
    socket.emit('join-room', { roomId: rid, name, emoji: playerEmoji });
  }, [playerEmoji]);

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
  const toggleExcludedMalus = useCallback((id) => socket.emit('toggle-excluded-malus', { id }), []);
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
  else if (screen === 'lobby') content = <Lobby roomId={roomId} roomData={roomData} playerName={playerName} onReady={setReady} onQuit={quit} onSetMode={setGameMode} onToggleMalus={toggleDefaultMalus} onToggleExcluded={toggleExcludedMalus} onKick={kickPlayer} error={error} />;
  else content = <GameScreen gameState={gameState} playerName={playerName} roomId={roomId} onPickToken={pickToken} onPlaceToken={placeToken} onReleaseToken={releaseToken} onSendChat={sendChat} onHostAction={hostAction} onKick={kickPlayer} onLeave={leaveGame} drawnMalus={drawnMalus} error={error} />;

  return (
    <ThemeContext.Provider value={theme}>
    <>
      {theme.background === 'kawaii' ? <BackgroundKawaii /> :
       theme.background === 'galaxy' ? <BackgroundGalaxy /> :
       theme.background === 'enfer'  ? <BackgroundEnfer /> :
       theme.background === 'vegas'   ? <BackgroundVegas /> :
       theme.background === 'matrix' ? <BackgroundMatrix /> :
       <BackgroundSuits />}
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
              <p className="settings-cat-label">Ton émoji</p>
              <div className="emoji-picker-grid">
                {AVATAR_OPTIONS.map(a => (
                  <button key={a.v}
                    className={`emoji-picker-btn${playerEmoji === a.v ? ' selected' : ''}`}
                    onClick={() => updateEmoji(a.v)}>
                    {a.v.startsWith('/')
                      ? <img src={a.v} alt={a.label} style={{ width: 72, height: 72, objectFit: 'cover' }} />
                      : a.v}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-category">
              <p className="settings-cat-label">Fond</p>
              <div className="settings-options-grid">
                <button className={`settings-option${theme.background === 'shapes' ? ' selected' : ''}`} onClick={() => updateTheme('background', 'shapes')}>
                  <div className="settings-preview settings-preview-shapes">
                    <span className="sp-suit sp-gold">♠</span><span className="sp-suit sp-red">♥</span>
                    <span className="sp-suit sp-gold">♣</span><span className="sp-suit sp-red">♦</span>
                  </div>
                  <span className="settings-option-name">Classique</span>
                </button>
                <button className={`settings-option${theme.background === 'kawaii' ? ' selected' : ''}`} onClick={() => updateTheme('background', 'kawaii')}>
                  <div className="settings-preview settings-preview-kawaii-bg">
                    <span>🌸</span><span>💕</span><span>🦄</span><span>⭐</span>
                  </div>
                  <span className="settings-option-name">Kawaii</span>
                </button>
                <button className={`settings-option${theme.background === 'galaxy' ? ' selected' : ''}`} onClick={() => updateTheme('background', 'galaxy')}>
                  <div className="settings-preview settings-preview-galaxy-bg" />
                  <span className="settings-option-name">Galaxy</span>
                </button>
                <button className={`settings-option${theme.background === 'enfer' ? ' selected' : ''}`} onClick={() => updateTheme('background', 'enfer')}>
                  <div className="settings-preview settings-preview-enfer-bg">
                    <span>🔥</span><span>✦</span><span>🔥</span>
                  </div>
                  <span className="settings-option-name">Enfer</span>
                </button>
                <button className={`settings-option${theme.background === 'vegas' ? ' selected' : ''}`} onClick={() => updateTheme('background', 'vegas')}>
                  <div className="settings-preview settings-preview-vegas-bg">
                    <span className="sp-suit sp-red">♥</span><span className="sp-suit sp-gold">♠</span>
                    <span className="sp-suit sp-gold">7</span><span className="sp-suit sp-red">♦</span>
                  </div>
                  <span className="settings-option-name">Vegas</span>
                </button>
                <button className={`settings-option${theme.background === 'matrix' ? ' selected' : ''}`} onClick={() => updateTheme('background', 'matrix')}>
                  <div className="settings-preview settings-preview-matrix-bg" />
                  <span className="settings-option-name">Matrix</span>
                </button>
              </div>
            </div>

            <div className="settings-category">
              <p className="settings-cat-label">Cartes</p>
              <div className="settings-options-grid">
                <button className={`settings-option${theme.cards === 'classic' ? ' selected' : ''}`} onClick={() => updateTheme('cards', 'classic')}>
                  <div className="settings-preview settings-preview-cards">
                    <div className="sp-card sp-card-back" />
                    <div className="sp-card sp-card-red"><span>A</span><span>♥</span></div>
                  </div>
                  <span className="settings-option-name">Classique</span>
                </button>
                <button className={`settings-option${theme.cards === 'kawaii' ? ' selected' : ''}`} onClick={() => updateTheme('cards', 'kawaii')}>
                  <div className="settings-preview settings-preview-cards">
                    <div className="sp-card sp-card-kawaii-back">🦄</div>
                    <div className="sp-card sp-card-kawaii-face"><span>A</span><span>♡</span></div>
                  </div>
                  <span className="settings-option-name">Kawaii</span>
                </button>
                <button className={`settings-option${theme.cards === 'dark' ? ' selected' : ''}`} onClick={() => updateTheme('cards', 'dark')}>
                  <div className="settings-preview settings-preview-cards">
                    <div className="sp-card sp-card-dark-back">✦</div>
                    <div className="sp-card sp-card-dark-face sp-card-dark-red"><span>A</span><span>♥</span></div>
                  </div>
                  <span className="settings-option-name">Dark</span>
                </button>
                <button className={`settings-option${theme.cards === 'color' ? ' selected' : ''}`} onClick={() => updateTheme('cards', 'color')}>
                  <div className="settings-preview settings-preview-cards">
                    <div className="sp-card sp-card-color-back" />
                    <div className="sp-card sp-card-color-face sp-card-color-spade"><span>A</span><span>♠</span></div>
                  </div>
                  <span className="settings-option-name">Coloré</span>
                </button>
                <button className={`settings-option${theme.cards === 'pixel' ? ' selected' : ''}`} onClick={() => updateTheme('cards', 'pixel')}>
                  <div className="settings-preview settings-preview-cards">
                    <div className="sp-card sp-card-pixel-back">█</div>
                    <div className="sp-card sp-card-pixel-face"><span>A</span><span>♠</span></div>
                  </div>
                  <span className="settings-option-name">Pixel</span>
                </button>
              </div>
            </div>

            <div className="settings-category">
              <p className="settings-cat-label">Table</p>
              <div className="settings-options-grid">
                <button className={`settings-option${theme.table === 'classic' ? ' selected' : ''}`} onClick={() => updateTheme('table', 'classic')}>
                  <div className="settings-preview settings-preview-table"><div className="sp-table" /></div>
                  <span className="settings-option-name">Classique</span>
                </button>
                <button className={`settings-option${theme.table === 'kawaii' ? ' selected' : ''}`} onClick={() => updateTheme('table', 'kawaii')}>
                  <div className="settings-preview settings-preview-table"><div className="sp-table sp-table-kawaii" /></div>
                  <span className="settings-option-name">Kawaii</span>
                </button>
                <button className={`settings-option${theme.table === 'noir' ? ' selected' : ''}`} onClick={() => updateTheme('table', 'noir')}>
                  <div className="settings-preview settings-preview-table"><div className="sp-table sp-table-noir" /></div>
                  <span className="settings-option-name">Luxe Noir</span>
                </button>
                <button className={`settings-option${theme.table === 'rouge' ? ' selected' : ''}`} onClick={() => updateTheme('table', 'rouge')}>
                  <div className="settings-preview settings-preview-table"><div className="sp-table sp-table-rouge" /></div>
                  <span className="settings-option-name">Vegas Rouge</span>
                </button>
                <button className={`settings-option${theme.table === 'ocean' ? ' selected' : ''}`} onClick={() => updateTheme('table', 'ocean')}>
                  <div className="settings-preview settings-preview-table"><div className="sp-table sp-table-ocean" /></div>
                  <span className="settings-option-name">Océan</span>
                </button>
                <button className={`settings-option${theme.table === 'violet' ? ' selected' : ''}`} onClick={() => updateTheme('table', 'violet')}>
                  <div className="settings-preview settings-preview-table"><div className="sp-table sp-table-violet" /></div>
                  <span className="settings-option-name">Violet</span>
                </button>
                <button className={`settings-option${theme.table === 'matrix' ? ' selected' : ''}`} onClick={() => updateTheme('table', 'matrix')}>
                  <div className="settings-preview settings-preview-table"><div className="sp-table sp-table-matrix" /></div>
                  <span className="settings-option-name">Matrix</span>
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
  </ThemeContext.Provider>
  );
}
