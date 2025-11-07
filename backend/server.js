const express = require('express');
const http = require('http');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

const clients = {}; // map id -> socket.id

io.on('connection', (socket) => {
  socket.on('join', ({id}) => {
    clients[id] = socket.id;
    socket.data.userId = id;
    console.log('join', id);
  });

  socket.on('private_message', (payload) => {
    const to = payload.to;
    const sid = clients[to];
    if(sid){
      io.to(sid).emit('message', payload);
    } else {
      // user offline; in prod, persist encrypted message temporarily or use push notif
      console.log('user offline, dropping or queueing', to);
    }
  });

  socket.on('disconnect', () => {
    const id = socket.data.userId;
    if(id && clients[id]) delete clients[id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log('Server listening on', PORT));
