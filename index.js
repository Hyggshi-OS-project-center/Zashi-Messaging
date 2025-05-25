const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let messages = [];

io.on('connection', (socket) => {
  console.log('Một người đã kết nối.');

  socket.emit('loadMessages', messages);

  socket.on('sendMessage', (msgObj) => {
    messages.push(msgObj);
    io.emit('newMessage', msgObj);
  });

  socket.on('disconnect', () => {
    console.log('Một người đã ngắt kết nối.');
  });
});

http.listen(3001, () => {
  console.log('Server chạy ở http://localhost:3001');
});
