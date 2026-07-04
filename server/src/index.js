const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getOrCreateRoom, deleteRoom } = require('./game');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

app.get('/api/room/new', (_, res) => {
  res.json({ roomId: uuidv4().slice(0, 6).toUpperCase() });
});

app.get('*', (_, res) => res.sendFile(path.join(clientDist, 'index.html')));

// ── Broadcast helpers ────────────────────────────────────────────────────────
function broadcastRoom(roomId) {
  const room = getOrCreateRoom(roomId);
  io.to(roomId).emit('room-update', {
    players: room.players,
    state: room.state,
    mode: room.mode,
    creatorName: room.players[0]?.name,
    defaultMalus: room.defaultMalus,
    excludedMalus: [...room.excludedMalus],
    jokersEnabled: room.jokersEnabled,
    jokersInHands: room.jokersInHands,
    trollVoteEnabled: room.trollVoteEnabled,
    trollId: room.trollId,
  });
}

function broadcastAll(roomId) {
  const room = getOrCreateRoom(roomId);
  for (const p of room.players) {
    const s = io.sockets.sockets.get(p.id);
    if (s) s.emit('game-state', room.publicState(p.id));
  }
}

// ── Validation countdown (server-side 3s timer) ───────────────────────────────
const validationTimers = new Map(); // roomId -> timerId

function startCountdown(roomId) {
  cancelCountdown(roomId);
  const room = getOrCreateRoom(roomId);
  room.countdownStartedAt = Date.now();
  broadcastAll(roomId);

  const timer = setTimeout(() => {
    validationTimers.delete(roomId);
    const r = getOrCreateRoom(roomId);
    r.validateNow();
    broadcastAll(roomId);
  }, 3000);

  validationTimers.set(roomId, timer);
}

function cancelCountdown(roomId) {
  if (validationTimers.has(roomId)) {
    clearTimeout(validationTimers.get(roomId));
    validationTimers.delete(roomId);
  }
  const room = getOrCreateRoom(roomId);
  if (room.countdownStartedAt) {
    room.countdownStartedAt = null;
    broadcastAll(roomId);
  }
}

// ── Socket handlers ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', ({ roomId, name, emoji }) => {
    const room = getOrCreateRoom(roomId);
    if (!room.addPlayer(socket.id, name, emoji ?? '🐱')) {
      socket.emit('error', { message: 'Impossible de rejoindre cette salle.' });
      return;
    }
    currentRoom = roomId;
    socket.join(roomId);
    socket.emit('joined', { roomId });
    if (room.state !== 'lobby') {
      socket.emit('game-state', room.publicState(socket.id));
      broadcastAll(currentRoom);
    } else {
      broadcastRoom(roomId);
    }
  });

  socket.on('toggle-default-malus', ({ id }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    if (room.players[0]?.id !== socket.id) return; // host only
    room.toggleDefaultMalus(id);
    broadcastRoom(currentRoom);
  });

  socket.on('toggle-excluded-malus', ({ id }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    if (room.players[0]?.id !== socket.id) return; // host only
    room.toggleExcludedMalus(id);
    broadcastRoom(currentRoom);
  });

  socket.on('set-game-mode', ({ mode }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    if (room.players[0]?.id !== socket.id) return; // host only
    room.setMode(mode);
    broadcastRoom(currentRoom);
  });

  socket.on('set-joker-config', ({ enabled, inHands }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    if (room.players[0]?.id !== socket.id) return; // host only
    room.setJokerConfig({ enabled, inHands });
    broadcastRoom(currentRoom);
  });

  socket.on('set-troll-vote', ({ enabled }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    if (room.players[0]?.id !== socket.id) return; // host only
    room.setTrollVote(enabled);
    broadcastRoom(currentRoom);
  });

  socket.on('troll-vote', ({ targetId }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    const result = room.submitTrollVote(socket.id, targetId);
    if (result?.error) { socket.emit('error', result); return; }
    broadcastAll(currentRoom);
  });

  socket.on('set-ready', ({ ready }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    room.setReady(socket.id, ready);
    broadcastRoom(currentRoom);
    if (room.allReady()) {
      const err = room.start(true); // fromLobby → load defaultMalus
      if (err) { socket.emit('error', err); return; }
      broadcastAll(currentRoom);
    }
  });

  socket.on('submit-vote', ({ value }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    const result = room.submitVote(socket.id, value);
    if (result?.error) { socket.emit('error', result); return; }
    broadcastAll(currentRoom);
  });

  socket.on('resolve-joker', ({ chosenIdx }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    const result = room.resolveJoker(socket.id, chosenIdx);
    if (result?.error) { socket.emit('error', result); return; }
    broadcastAll(currentRoom);
  });

  socket.on('token-moved', ({ token, x, y, dragger }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('token-moved', { token, x, y, dragger });
  });

  socket.on('release-token', ({ token }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    room.releaseToken(token);
    cancelCountdown(currentRoom);
    broadcastAll(currentRoom);
  });

  socket.on('place-token', ({ token, targetPlayerId }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    const result = room.placeToken(socket.id, targetPlayerId, token);
    if (result?.error) { socket.emit('error', result); return; }
    if (result?.allFilled) {
      startCountdown(currentRoom);
    } else {
      broadcastAll(currentRoom);
    }
  });

  socket.on('take-token', ({ token }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    const result = room.takeToken(socket.id, token);
    if (result?.error) { socket.emit('error', result); return; }
    if (result?.allFilled) {
      startCountdown(currentRoom);
    } else {
      broadcastAll(currentRoom);
    }
  });

  socket.on('chat', ({ text }) => {
    if (!currentRoom || !text?.trim()) return;
    const room = getOrCreateRoom(currentRoom);
    const msg = room.addChat(socket.id, text.trim().slice(0, 200));
    io.to(currentRoom).emit('chat-msg', msg);
  });

  socket.on('kick-player', ({ targetId }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    if (room.state === 'lobby') {
      if (room.players[0]?.id !== socket.id) return;
      const target = room.players.find(p => p.id === targetId);
      if (!target) return;
      room.removePlayer(targetId);
      io.to(targetId).emit('kicked');
      broadcastRoom(currentRoom);
    } else {
      if (room.hostId !== socket.id) return;
      const result = room.leaveGame(targetId);
      if (!result) return;
      io.to(targetId).emit('kicked');
      if (result.allFilled && room.state === 'playing') {
        startCountdown(currentRoom);
      } else {
        broadcastAll(currentRoom);
      }
    }
  });

  socket.on('leave-game', () => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    if (room.state === 'lobby') return;
    const result = room.leaveGame(socket.id);
    if (!result) return;
    socket.emit('left-game');
    if (result.allFilled && room.state === 'playing') {
      startCountdown(currentRoom);
    } else {
      broadcastAll(currentRoom);
    }
  });

  socket.on('update-emoji', ({ emoji }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    const p = room.players.find(pl => pl.id === socket.id);
    if (!p) return;
    p.emoji = emoji;
    if (room.state === 'lobby') broadcastRoom(currentRoom);
    else broadcastAll(currentRoom);
  });

  socket.on('host-action', ({ action }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    if (room.hostId !== socket.id) return; // host only

    cancelCountdown(currentRoom);

    if (action === 'terminate') {
      io.to(currentRoom).emit('room-terminated');
      deleteRoom(currentRoom);
    } else if (action === 'reset-zero') {
      room.resetZero();
      broadcastRoom(currentRoom);
    } else if (action === 'next-manche') {
      const { newMalus } = room.nextManche();
      if (newMalus) {
        io.to(currentRoom).emit('malus-drawn', { malus: newMalus });
        const rid = currentRoom;
        setTimeout(() => {
          const r = getOrCreateRoom(rid);
          if (r) { r.start(false); broadcastAll(rid); }
        }, 4500);
      } else {
        room.start(false);
        broadcastAll(currentRoom);
      }
    }
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    if (room.state === 'lobby') {
      room.removePlayer(socket.id);
      if (room.players.length === 0) deleteRoom(currentRoom);
      else broadcastRoom(currentRoom);
    } else {
      room.markDisconnected(socket.id);
      broadcastAll(currentRoom);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`TheGang server :${PORT}`));
