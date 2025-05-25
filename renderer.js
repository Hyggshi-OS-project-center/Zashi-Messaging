const socket = io('http://localhost:3000');
const chat = document.getElementById('chat');

socket.on('loadMessages', (msgs) => {
  msgs.forEach(addMessage);
});

socket.on('newMessage', (msg) => {
  addMessage(msg);
});

function addMessage(msg) {
  const div = document.createElement('div');
  div.className = 'message received';
  div.textContent = msg;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

document.getElementById('msg').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') send();
});

function send() {
  const input = document.getElementById('msg');
  const msg = input.value.trim();
  if (msg) {
    socket.emit('sendMessage', msg);
    const div = document.createElement('div');
    div.className = 'message sent';
    div.textContent = msg;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    input.value = '';
  }
}
