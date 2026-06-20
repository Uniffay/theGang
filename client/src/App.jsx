import { useState, useEffect, useCallback } from 'react';
import { socket } from './socket';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import GameScreen from './screens/GameScreen';
import './App.css';

export default function App() {
  const [screen, setScreen] = useState('home'); // home | lobby | game
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    socket.on('joined', ({ roomId }) => {
      setRoomId(roomId);
      setScreen('lobby');
      setError('');
    });

    socket.on('room-update', (data) => {
      setRoomData(data);
      if (data.state === 'playing') setScreen('game');
      if (data.state === 'lobby' && screen === 'game') setScreen('lobby');
    });

    socket.on('game-state', (state) => {
      setGameState(state);
      if (state.state === 'won' || state.state === 'lost') setScreen('game');
    });

    socket.on('error', ({ message }) => setError(message));

    return () => {
      socket.off('joined');
      socket.off('room-update');
      socket.off('game-state');
      socket.off('error');
    };
  }, [screen]);

  const join = useCallback((rid, name) => {
    setPlayerName(name);
    socket.connect();
    socket.emit('join-room', { roomId: rid, name });
  }, []);

  const setReady = useCallback((v) => socket.emit('set-ready', { ready: v }), []);
  const playCard = useCallback((card) => socket.emit('play-card', { card }), []);
  const useToken = useCallback(() => socket.emit('use-token'), []);
  const restart = useCallback(() => socket.emit('restart'), []);

  if (screen === 'home') return <Home onJoin={join} error={error} />;
  if (screen === 'lobby') return <Lobby roomId={roomId} roomData={roomData} playerName={playerName} onReady={setReady} error={error} />;
  return <GameScreen gameState={gameState} roomData={roomData} playerName={playerName} roomId={roomId} onPlayCard={playCard} onUseToken={useToken} onRestart={restart} error={error} />;
}
