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
    console.log('join', room, socket.id);
    socket.to(room).emit('peer-joined', { id: socket.id });
  });

  socket.on('signal', ({ room, data }) => {
    socket.to(room).emit('signal', data);
  });

  socket.on('disconnect', () => {
    console.log('signaling: disconnected', socket.id);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log('Manar Signaling Server listening on', port));
