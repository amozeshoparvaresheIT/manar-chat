const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.get('/', (req, res) => res.send('Manar Signaling Server is running.'));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', socket => {
  console.log('signaling: connected', socket.id);

  socket.on('join', (room) => {
    socket.join(room);
    const roomInfo = io.sockets.adapter.rooms.get(room);
    const count = roomInfo ? roomInfo.size : 0;
    console.log('join', room, socket.id, 'count', count);
    io.to(room).emit('room-count', { count });
    const isInitiator = (count === 1);
    socket.emit('initiator', { initiator: isInitiator });
    socket.to(room).emit('peer-joined', { id: socket.id });
  });

  socket.on('signal', ({ room, data }) => {
    socket.to(room).emit('signal', data);
  });

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room === socket.id) continue;
      setTimeout(() => {
        const roomInfo = io.sockets.adapter.rooms.get(room);
        const count = roomInfo ? roomInfo.size : 0;
        io.to(room).emit('room-count', { count });
      }, 50);
    }
  });

  socket.on('disconnect', () => {
    console.log('signaling: disconnected', socket.id);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log('Manar Signaling Server listening on', port));