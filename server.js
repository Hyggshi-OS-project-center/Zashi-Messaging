const express = require('express');
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const groupsPath = path.join(__dirname, 'groups.json');
let groups = {};

// Đọc dữ liệu nhóm/tin nhắn từ file khi khởi động
if (fs.existsSync(groupsPath)) {
  try {
    groups = JSON.parse(fs.readFileSync(groupsPath, 'utf8'));
  } catch (e) {
    groups = {};
  }
}

function saveGroups() {
  fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2));
}

let userAvatars = {};

let users = [];
const usersPath = './users.json';
if (fs.existsSync(usersPath)) {
  users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
}

// Danh sách từ cấm
const bannedWords = ['bậy', 'tục', 'chửi', 'xxx', 'sex', 'địt', 'lồn', 'cặc', 'fuck', 'shit'];
function containsBannedWords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return bannedWords.some(word => lower.includes(word));
}

app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) return res.json({ success: false, message: 'Thiếu username, password hoặc email' });
  if (users.find(u => u.username === username)) return res.json({ success: false, message: 'Username đã tồn tại' });

  const hash = await bcrypt.hash(password, 10);
  users.push({ username, password: hash, email });
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.json({ success: false, message: 'User không tồn tại' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.json({ success: false, message: 'Sai mật khẩu' });

  res.json({ success: true, email: user.email || '' });
});

io.on('connection', (socket) => {
  socket.on('joinGroup', ({ groupName, username }) => {
    socket.join(groupName);
    if (!groups[groupName]) {
      groups[groupName] = [];
      saveGroups();
    }
    socket.emit('loadMessages', groups[groupName]);
    const userAvatar = userAvatars[username] || '';
    socket.emit('avatar', userAvatar);
    socket.data = { username, groupName };
    sendOnlineUsers(groupName);
  });

  socket.on('disconnect', () => {
    const { groupName } = socket.data || {};
    if (groupName) sendOnlineUsers(groupName);
  });

  socket.on('sendMessage', ({ user, text, group, avatar, reply }) => {
    // Kiểm duyệt tin nhắn
    if (containsBannedWords(text)) {
      socket.emit('messageRejected', { reason: 'Tin nhắn chứa nội dung không phù hợp!' });
      return;
    }
    const avatarToSend = avatar || userAvatars[user] || '';
    const msgObj = { user, text, avatar: avatarToSend, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), reply };
    if (!groups[group]) groups[group] = [];
    groups[group].push(msgObj);
    saveGroups();
    io.to(group).emit('newMessage', msgObj);
  });

  socket.on('privateMessage', ({ from, to, text, avatar, reply }) => {
    // Kiểm duyệt tin nhắn riêng
    if (containsBannedWords(text)) {
      socket.emit('messageRejected', { reason: 'Tin nhắn chứa nội dung không phù hợp!' });
      return;
    }
    const msgObj = { user: from, text, avatar: avatar || userAvatars[from] || '', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), reply };
    // Gửi cho người nhận
    for (const [id, s] of io.sockets.sockets) {
      if (s.data?.username === to || s.data?.username === from) {
        s.emit('privateMessage', msgObj);
      }
    }
  });
});

function sendOnlineUsers(groupName) {
  const sockets = Array.from(io.sockets.adapter.rooms.get(groupName) || []);
  const onlineUsers = sockets.map(sid => {
    const s = io.sockets.sockets.get(sid);
    if (!s) return null;
    const username = s.data?.username;
    const user = users.find(u => u.username === username) || {};
    return {
      username,
      avatar: userAvatars[username] || '',
      email: user.email || ''
    };
  }).filter(Boolean);
  io.to(groupName).emit('onlineUsers', onlineUsers);
}

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  const { user, group, avatar, text, to } = req.body;
  const file = req.file;
  let reply = null;
  if (req.body.reply) {
    try { reply = JSON.parse(req.body.reply); } catch {}
  }
  // Kiểm tra định dạng ảnh
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  if (file && !allowedTypes.includes(file.mimetype)) {
    return res.json({ success: false, message: 'Chỉ cho phép upload file ảnh!' });
  }
  // Giới hạn dung lượng 5MB
  if (file && file.size > 5 * 1024 * 1024) {
    return res.json({ success: false, message: 'File quá lớn! (Tối đa 5MB)' });
  }
  // Kiểm duyệt text nếu có
  if (text && containsBannedWords(text)) {
    return res.json({ success: false, message: 'Nội dung tin nhắn không phù hợp!' });
  }
  const fileUrl = file ? `http://localhost:3001/uploads/${file.filename}` : '';
  if (text) {
    const msgObj = { user, text, avatar: avatar || userAvatars[user] || '', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), reply };
    if (!to) {
      if (!groups[group]) groups[group] = [];
      groups[group].push(msgObj);
      io.to(group).emit('newMessage', msgObj);
    } else {
      // Gửi tin nhắn riêng
      for (const [id, s] of io.sockets.sockets) {
        if (s.data?.username === to || s.data?.username === user) {
          s.emit('privateMessage', msgObj);
        }
      }
    }
  }
  if (file) {
    const fileMsg = { user, filename: file.originalname, url: fileUrl, avatar: avatar || userAvatars[user] || '', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    if (!to) {
      io.to(group).emit('newFile', fileMsg);
    } else {
      for (const [id, s] of io.sockets.sockets) {
        if (s.data?.username === to || s.data?.username === user) {
          s.emit('newFile', fileMsg);
        }
      }
    }
  }
  res.json({ success: true });
});


const avatarStorage = multer.diskStorage({
  destination: './uploads/avatars/',
  filename: (req, file, cb) => cb(null, req.body.username + path.extname(file.originalname))
});
const avatarUpload = multer({ storage: avatarStorage });

app.post('/upload-avatar', avatarUpload.single('avatar'), (req, res) => {
  const username = req.body.username;
  const fileUrl = `http://localhost:3001/uploads/avatars/${req.file.filename}`;
  userAvatars[username] = fileUrl;
  res.json({ success: true, url: fileUrl });
});

app.post('/reset-password', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: 'Thiếu username hoặc password' });
  const user = users.find(u => u.username === username);
  if (!user) return res.json({ success: false, message: 'User không tồn tại' });
  user.password = await bcrypt.hash(password, 10);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

app.post('/change-password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  if (!username || !oldPassword || !newPassword) return res.json({ success: false, message: 'Thiếu thông tin' });
  const user = users.find(u => u.username === username);
  if (!user) return res.json({ success: false, message: 'User không tồn tại' });
  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) return res.json({ success: false, message: 'Mật khẩu cũ không đúng' });
  user.password = await bcrypt.hash(newPassword, 10);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

app.post('/link-preview', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.json({ success: false });
  try {
    const response = await fetch(url, { timeout: 5000 });
    const html = await response.text();
    const $ = cheerio.load(html);
    const getMeta = (name) => $(`meta[property='${name}'],meta[name='${name}']`).attr('content') || '';
    const title = $('title').text() || getMeta('og:title') || getMeta('twitter:title');
    const description = getMeta('description') || getMeta('og:description') || getMeta('twitter:description');
    const image = getMeta('og:image') || getMeta('twitter:image');
    res.json({ success: true, title, description, image });
  } catch (e) {
    res.json({ success: false });
  }
});

server.listen(3001, () => console.log('Server running on port 3001'));
