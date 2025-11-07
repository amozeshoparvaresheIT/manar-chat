// backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.get('/', (req, res) => res.send('Manar v3 signaling/relay'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

io.on('connection', socket => {
  console.log('connect', socket.id);

  socket.on('join', ({ room, name }) => {
    socket.join(room);
    socket.data.name = name || socket.id;
    const roomInfo = io.sockets.adapter.rooms.get(room);
    const count = roomInfo ? roomInfo.size : 0;
    socket.to(room).emit('peer-joined', { id: socket.id, name: socket.data.name });
    socket.emit('room-count', { count });
    console.log('join', room, socket.id, 'count', count);
  });

  // relay encrypted payloads (text or JSON)
  socket.on('msg', ({ room, payload }) => {
    socket.to(room).emit('msg', { from: socket.id, payload });
  });

  // relay public key for ECDH
  socket.on('pubkey', ({ room, raw }) => {
    socket.to(room).emit('pubkey', { from: socket.id, raw });
  });

  // receive encrypted file (base64 ciphertext), save encrypted blob, emit url
  socket.on('file', ({ room, filename, dataBase64, metadata }) => {
    // dataBase64 here should be already ciphertext (base64)
    const safe = Date.now() + '-' + filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const dest = path.join(UPLOAD_DIR, safe);
    // write raw base64 as binary
    const buf = Buffer.from(dataBase64, 'base64');
    fs.writeFileSync(dest, buf);
    const url = `/uploads/${safe}`;
    socket.to(room).emit('file', { from: socket.id, filename, url, metadata });
    socket.emit('file-saved', { url, filename });
  });

  app.get('/uploads/:name', (req, res) => {
    const p = path.join(UPLOAD_DIR, req.params.name);
    if (fs.existsSync(p)) return res.sendFile(p);
    return res.status(404).send('not found');
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log('Manar v3 server listening on', port));
