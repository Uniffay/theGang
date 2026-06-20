const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getOrCreateRoom, deleteRoom } = require('./game');

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// Serve React build in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

app.get('/api/room/new', (req, res) => {
  const roomId = uuidv4().slice(0, 6).toUpperCase();
  res.json({ roomId });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentName = null;

  socket.on('join-room', ({ roomId, name }) => {
    const room = getOrCreateRoom(roomId);
    const ok = room.addPlayer(socket.id, name);
    if (!ok) {
      socket.emit('error', { message: 'Impossible de rejoindre cette salle.' });
      return;
    }
    currentRoom = roomId;
    currentName = name;
    socket.join(roomId);
    broadcastRoom(roomId, socket.id);
    socket.emit('joined', { roomId });
  });

  socket.on('set-ready', ({ ready }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    room.setReady(socket.id, ready);
    broadcastRoom(currentRoom, socket.id);

    if (room.allReady()) {
      const err = room.start();
      if (err) {
        socket.emit('error', err);
        return;
      }
      broadcastAllStates(currentRoom);
    }
  });

  socket.on('play-card', ({ card }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    if (room.state !== 'playing') return;
    const result = room.playCard(socket.id, card);
    if (result.error) { socket.emit('error', result); return; }
    broadcastAllStates(currentRoom);
  });

  socket.on('use-token', () => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    if (room.state !== 'playing') return;
    const result = room.useToken(socket.id);
    if (result.error) { socket.emit('error', result); return; }
    broadcastAllStates(currentRoom);
  });

  socket.on('restart', () => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    room.players.forEach(p => { p.ready = false; });
    room.state = 'lobby';
    broadcastRoom(currentRoom, socket.id);
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    room.removePlayer(socket.id);
    if (room.players.length === 0) {
      deleteRoom(currentRoom);
    } else {
      broadcastRoom(currentRoom, null);
    }
  });

  function broadcastRoom(roomId, fromSocketId) {
    const room = getOrCreateRoom(roomId);
    io.to(roomId).emit('room-update', {
      players: room.players,
      state: room.state,
    });
  }

  function broadcastAllStates(roomId) {
    const room = getOrCreateRoom(roomId);
    room.players.forEach(p => {
      const s = io.sockets.sockets.get(p.id);
      if (s) s.emit('game-state', room.publicState(p.id));
    });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`TheGang server running on :${PORT}`));
