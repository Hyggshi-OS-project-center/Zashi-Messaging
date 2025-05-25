const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let messages = [];

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.emit('loadMessages', messages);

  socket.on('sendMessage', (msgObj) => {
    messages.push(msgObj);
    io.emit('newMessage', msgObj);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(3001, () => {
  console.log('Server chạy trên cổng 3001');
});
