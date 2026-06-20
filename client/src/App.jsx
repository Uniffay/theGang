import { useState, useEffect, useCallback } from 'react';
import { socket } from './socket';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import GameScreen from './screens/GameScreen';
import './App.css';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');

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
    return () => socket.off('joined').off('room-update').off('game-state').off('error');
  }, []);

  const join = useCallback((rid, name) => {
    setPlayerName(name);
    socket.connect();
    socket.emit('join-room', { roomId: rid, name });
  }, []);

  const setReady = useCallback((v) => socket.emit('set-ready', { ready: v }), []);
  const pickToken = useCallback((token) => socket.emit('pick-token', { token }), []);
  const releaseToken = useCallback((token) => socket.emit('release-token', { token }), []);
  const sendChat = useCallback((text) => socket.emit('chat', { text }), []);
  const restart = useCallback(() => socket.emit('restart'), []);

  if (screen === 'home') return <Home onJoin={join} error={error} />;
  if (screen === 'lobby') return <Lobby roomId={roomId} roomData={roomData} playerName={playerName} onReady={setReady} error={error} />;
  return <GameScreen gameState={gameState} playerName={playerName} roomId={roomId} onPickToken={pickToken} onReleaseToken={releaseToken} onSendChat={sendChat} onRestart={restart} error={error} />;
}
