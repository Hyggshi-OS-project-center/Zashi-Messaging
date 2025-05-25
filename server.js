const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
app.use('/uploads', express.static('uploads'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Simple in-memory chat storage
let groups = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinGroup', (groupName) => {
    socket.join(groupName);
    console.log(`User ${socket.id} joined group: ${groupName}`);

    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    // Gửi lại tin nhắn cũ cho user mới
    socket.emit('loadMessages', groups[groupName]);
  });

  socket.on('sendMessage', ({ user, text, group }) => {
    const msgObj = { user, text };
    if (!groups[group]) groups[group] = [];
    groups[group].push(msgObj);

    // Gửi tin nhắn cho tất cả trong group
    io.to(group).emit('newMessage', msgObj);
  });
});

// File upload endpoint
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  const { user, group } = req.body;
  const fileUrl = `http://localhost:3001/uploads/${req.file.filename}`;
  io.to(group).emit('newFile', { user, filename: req.file.originalname, url: fileUrl });
  res.json({ success: true });
});

server.listen(3001, () => console.log('Server running on port 3001'));
