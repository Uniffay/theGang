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

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', ({ roomId, name }) => {
    const room = getOrCreateRoom(roomId);
    if (!room.addPlayer(socket.id, name)) {
      socket.emit('error', { message: 'Impossible de rejoindre cette salle.' });
      return;
    }
    currentRoom = roomId;
    socket.join(roomId);
    broadcastRoom(roomId);
    socket.emit('joined', { roomId });
  });

  socket.on('set-ready', ({ ready }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    room.setReady(socket.id, ready);
    broadcastRoom(currentRoom);
    if (room.allReady()) {
      const err = room.start();
      if (err) { socket.emit('error', err); return; }
      broadcastAll(currentRoom);
    }
  });

  socket.on('take-token', ({ token }) => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    const result = room.takeToken(socket.id, token);
    if (result.error) { socket.emit('error', result); return; }
    broadcastAll(currentRoom);
  });

  socket.on('chat', ({ text }) => {
    if (!currentRoom || !text?.trim()) return;
    const room = getOrCreateRoom(currentRoom);
    const msg = room.addChat(socket.id, text.trim().slice(0, 200));
    io.to(currentRoom).emit('chat-msg', msg);
  });

  socket.on('restart', () => {
    if (!currentRoom) return;
    getOrCreateRoom(currentRoom).reset();
    broadcastRoom(currentRoom);
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = getOrCreateRoom(currentRoom);
    room.removePlayer(socket.id);
    if (room.players.length === 0) deleteRoom(currentRoom);
    else broadcastAll(currentRoom);
  });

  function broadcastRoom(roomId) {
    const room = getOrCreateRoom(roomId);
    io.to(roomId).emit('room-update', { players: room.players, state: room.state });
  }

  function broadcastAll(roomId) {
    const room = getOrCreateRoom(roomId);
    for (const p of room.players) {
      const s = io.sockets.sockets.get(p.id);
      if (s) s.emit('game-state', room.publicState(p.id));
    }
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`TheGang server :${PORT}`));
