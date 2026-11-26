// ======================================
// NEXCHAT - OFFLINE SMARTBOT
// HTML + CSS + JAVASCRIPT
// ======================================

const $ = (id) => document.getElementById(id);

const DB = {
  users: "nexchat_users",
  currentUser: "nexchat_current_user",
  chats: "nexchat_chats",
  theme: "nexchat_theme"
};

let currentUser = null;
let chats = [];
let activeChatId = null;
let botTimer = null;


// ======================================
// STORAGE HELPERS
// ======================================

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast("Could not save data in this browser.");
  }
}

function getUsers() {
  return readStorage(DB.users, []);
}

function getChatKey() {
  return DB.chats + "_" + currentUser.email;
}

function saveChats() {
  saveStorage(getChatKey(), chats);
}

function makeId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}


// ======================================
// AUTHENTICATION
// ======================================

function showAuthMessage(message, success = false) {
  $("authMessage").textContent = message;
  $("authMessage").style.color = success ? "#35d69a" : "#ff667d";
}

function switchAuthTab(tab) {
  const login = tab === "login";

  $("loginForm").classList.toggle("hidden", !login);
  $("signupForm").classList.toggle("hidden", login);

  $("loginTab").classList.toggle("active", login);
  $("signupTab").classList.toggle("active", !login);

  showAuthMessage("");
}

$("loginTab").addEventListener("click", () => switchAuthTab("login"));
$("signupTab").addEventListener("click", () => switchAuthTab("signup"));


$("signupForm").addEventListener("submit", function(event) {
  event.preventDefault();

  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim().toLowerCase();
  const password = $("signupPassword").value;

  if (!name || !email || password.length < 4) {
    showAuthMessage("Please enter valid details.");
    return;
  }

  const users = getUsers();

  if (users.some(user => user.email === email)) {
    showAuthMessage("This email is already registered.");
    return;
  }

  users.push({ name, email, password });
  saveStorage(DB.users, users);

  $("signupForm").reset();
  $("loginEmail").value = email;

  switchAuthTab("login");
  showAuthMessage("Account created! Please login.", true);
});


$("loginForm").addEventListener("submit", function(event) {
  event.preventDefault();

  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;

  const user = getUsers().find(item =>
    item.email === email && item.password === password
  );

  if (!user) {
    showAuthMessage("Incorrect email or password.");
    return;
  }

  loginUser(user);
});


function loginUser(user) {
  currentUser = user;
  saveStorage(DB.currentUser, user.email);

  chats = readStorage(getChatKey(), []);
  activeChatId = null;

  $("authPage").classList.add("hidden");
  $("app").classList.remove("hidden");

  $("welcomeName").textContent = user.name.split(" ")[0];

  renderChatList();

  if (chats.length > 0) {
    openChat(chats[0].id);
  } else {
    createNewChat();
  }

  applyTheme();
}


function logout() {
  if (botTimer) clearTimeout(botTimer);

  localStorage.removeItem(DB.currentUser);

  currentUser = null;
  chats = [];
  activeChatId = null;

  $("app").classList.add("hidden");
  $("authPage").classList.remove("hidden");

  $("loginForm").reset();
  $("signupForm").reset();

  switchAuthTab("login");
  showToast("Logged out successfully.");
}


$("logoutBtn").addEventListener("click", logout);


// ======================================
// CHAT MANAGEMENT
// ======================================

function createNewChat() {
  const chat = {
    id: makeId(),
    title: "New conversation",
    messages: [],
    createdAt: Date.now()
  };

  chats.unshift(chat);
  activeChatId = chat.id;

  saveChats();
  renderChatList();
  renderMessages();

  $("messageInput").focus();
  $("sidebar").classList.remove("open");
}

function getActiveChat() {
  return chats.find(chat => chat.id === activeChatId);
}


function openChat(id) {
  if (botTimer) clearTimeout(botTimer);

  activeChatId = id;

  renderChatList();
  renderMessages();

  $("sidebar").classList.remove("open");
}


function deleteChat(id) {
  const chat = chats.find(item => item.id === id);
  if (!chat) return;

  if (!confirm("Delete this conversation?")) return;

  chats = chats.filter(item => item.id !== id);

  if (activeChatId === id) {
    activeChatId = null;
  }

  saveChats();
  renderChatList();

  if (activeChatId === null) {
    if (chats.length > 0) {
      openChat(chats[0].id);
    } else {
      createNewChat();
    }
  }

  showToast("Conversation deleted.");
}


function renderChatList() {
  const container = $("chatList");
  const search = $("searchChats").value.toLowerCase();

  container.innerHTML = "";

  const filtered = chats.filter(chat => {
    const messageText = chat.messages
      .map(message => message.text)
      .join(" ");

    return (chat.title + " " + messageText)
      .toLowerCase()
      .includes(search);
  });

  if (filtered.length === 0) {
    container.innerHTML =
      '<p style="padding:12px;color:var(--muted);font-size:12px;">No conversations found.</p>';
    return;
  }

  filtered.forEach(chat => {
    const item = document.createElement("div");
    item.className =
      "chat-item" + (chat.id === activeChatId ? " active" : "");

    const title = document.createElement("span");
    title.className = "chat-item-title";
    title.textContent = "▤ " + chat.title;

    const remove = document.createElement("button");
    remove.className = "delete-chat";
    remove.textContent = "×";
    remove.title = "Delete conversation";

    item.appendChild(title);
    item.appendChild(remove);

    title.addEventListener("click", () => openChat(chat.id));
    remove.addEventListener("click", event => {
      event.stopPropagation();
      deleteChat(chat.id);
    });

    container.appendChild(item);
  });
}


$("newChatBtn").addEventListener("click", createNewChat);
$("searchChats").addEventListener("input", renderChatList);


// ======================================
// MESSAGE DISPLAY
// ======================================

function getTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}


function renderMessages() {
  const container = $("messages");
  const chat = getActiveChat();

  if (!chat || chat.messages.length === 0) {
    container.innerHTML = `
      <div class="welcome-screen" id="welcomeScreen">
        <div class="welcome-icon">✦</div>
        <h2>Hello, <span>${escapeHTML(currentUser.name.split(" ")[0])}</span>!</h2>
        <p>I'm NEXCHAT, your offline smart assistant.</p>
        <div class="suggestions">
          <button class="suggestion">👋 Say hello</button>
          <button class="suggestion">🧠 What can you do?</button>
          <button class="suggestion">💻 Tell me about JavaScript</button>
          <button class="suggestion">😂 Tell me a joke</button>
        </div>
      </div>
    `;

    addSuggestionEvents();
    return;
  }

  container.innerHTML = "";

  chat.messages.forEach((message, index) => {
    const row = document.createElement("div");
    row.className = "message-row " + message.sender;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = message.sender === "user"
      ? currentUser.name.charAt(0).toUpperCase()
      : "✦";

    const content = document.createElement("div");
    content.className = "message-content";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = message.text;

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const time = document.createElement("span");
    time.textContent = getTime(message.time);

    meta.appendChild(time);

    if (message.sender === "bot") {
      const copy = document.createElement("button");
      copy.className = "copy-btn";
      copy.textContent = "Copy";

      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(message.text);
          showToast("Message copied!");
        } catch {
          showToast("Copy is not supported here.");
        }
      });

      meta.appendChild(copy);
    }

    content.appendChild(bubble);
    content.appendChild(meta);

    row.appendChild(avatar);
    row.appendChild(content);

    container.appendChild(row);
  });

  container.scrollTop = container.scrollHeight;
}


function addSuggestionEvents() {
  document.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
      sendMessage(button.textContent.replace(/^[^\w]+/, "").trim());
    });
  });
}


// ======================================
// SEND MESSAGE
// ======================================

function sendMessage(text) {
  text = String(text || "").trim();

  if (!text) return;

  let chat = getActiveChat();

  if (!chat) {
    createNewChat();
    chat = getActiveChat();
  }

  chat.messages.push({
    sender: "user",
    text,
    time: Date.now()
  });

  if (chat.messages.filter(m => m.sender === "user").length === 1) {
    chat.title = text.length > 28
      ? text.slice(0, 28) + "..."
      : text;
  }

  saveChats();
  renderMessages();
  renderChatList();

  $("messageInput").value = "";
  $("messageInput").style.height = "40px";

  showTyping();

  if (botTimer) clearTimeout(botTimer);

  botTimer = setTimeout(() => {
    const reply = getBotReply(text);

    const active = getActiveChat();

    if (!active) return;

    active.messages.push({
      sender: "bot",
      text: reply,
      time: Date.now()
    });

    saveChats();
    renderMessages();
    renderChatList();
  }, 700 + Math.random() * 800);
}


function showTyping() {
  const container = $("messages");

  const old = document.getElementById("typingIndicator");
  if (old) old.remove();

  const typing = document.createElement("div");
  typing.id = "typingIndicator";
  typing.className = "typing";
  typing.textContent = "NEXCHAT is thinking...";

  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;
}


$("sendBtn").addEventListener("click", () => {
  sendMessage($("messageInput").value);
});


$("messageInput").addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage($("messageInput").value);
  }
});


$("messageInput").addEventListener("input", function() {
  this.style.height = "40px";
  this.style.height = Math.min(this.scrollHeight, 130) + "px";
});


// ======================================
// OFFLINE SMARTBOT REPLY ENGINE
// ======================================

function getBotReply(originalMessage) {
  const message = originalMessage.toLowerCase().trim();

  // Greetings
  if (/\b(hi|hello|hey|hai|hola)\b/.test(message)) {
    return "Hello! 👋 Welcome to NEXCHAT. How can I help you today?";
  }

  if (message.includes("good morning")) {
    return "Good morning! ☀️ Hope you have a wonderful day!";
  }

  if (message.includes("good night")) {
    return "Good night! 🌙 Have a peaceful sleep.";
  }

  if (message.includes("good evening")) {
    return "Good evening! 😊 What would you like to talk about?";
  }

  // Identity
  if (message.includes("your name") || message.includes("who are you")) {
    return "I'm NEXCHAT, your offline smart assistant! ✨";
  }

  if (message.includes("how are you")) {
    return "I'm doing great! Thanks for asking. 😊 How are you?";
  }

  if (message.includes("your age")) {
    return "I'm a digital bot, so I don't have a human age!";
  }

  if (message.includes("who made you") || message.includes("creator")) {
    return "I was created as an offline chatbot project using HTML, CSS and JavaScript. 🚀";
  }

  // Capabilities
  if (
    message.includes("what can you do") ||
    message.includes("help me") ||
    message === "help"
  ) {
    return `Here are some things I can chat about:

👋 Greetings
💻 HTML, CSS and JavaScript
🧮 Basic maths
😂 Jokes
🌍 General knowledge
📱 Technology
📚 Study tips
⏰ Time and date

I'm an offline bot, so my knowledge is limited to my built-in responses.`;
  }

  // Thanks
  if (
    message.includes("thank you") ||
    message.includes("thanks")
  ) {
    return "You're very welcome! 😊 Happy to help.";
  }

  if (
    message.includes("bye") ||
    message.includes("goodbye")
  ) {
    return "Goodbye! 👋 It was nice chatting with you. Come back anytime!";
  }

  // Jokes
  if (message.includes("joke") || message.includes("funny")) {
    const jokes = [
      "Why did the computer go to the doctor? Because it had a virus! 😂",
      "Why was the math book sad? Because it had too many problems! 😄",
      "What do computers like to eat? Microchips! 🤣",
      "Why did the developer go broke? Because he used up all his cache! 😆"
    ];

    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  // Programming
  if (message.includes("javascript")) {
    return `JavaScript is a programming language used to make websites interactive.

Some things JavaScript can do:
• Handle button clicks
• Create chat applications
• Store data in a browser
• Build games
• Update web pages dynamically

It works together with HTML and CSS. 💻`;
  }

  if (message.includes("html")) {
    return "HTML stands for HyperText Markup Language. It creates the structure of a webpage, such as headings, paragraphs, images and buttons.";
  }

  if (message.includes("css")) {
    return "CSS stands for Cascading Style Sheets. It controls the appearance of websites, including colours, layouts, fonts, spacing and animations.";
  }

  if (message.includes("python")) {
    return "Python is a popular programming language. It is used for automation, data analysis, AI, web development and many other tasks.";
  }

  if (message.includes("coding") || message.includes("programming")) {
    return "Coding means writing instructions for a computer. You can start with HTML, CSS and JavaScript to build websites and simple applications. 🚀";
  }

  // Technology
  if (message.includes("computer")) {
    return "A computer is an electronic device that processes information. It can run applications, browse websites, store files and perform calculations.";
  }

  if (message.includes("internet")) {
    return "The Internet is a global network connecting computers and devices. Remember, I'm designed to work offline and cannot browse the Internet.";
  }

  if (message.includes("mobile") || message.includes("smartphone")) {
    return "A smartphone is a mobile device that combines calling, messaging, apps, camera, Internet access and many other features. 📱";
  }

  // General knowledge
  if (message.includes("capital of india")) {
    return "The capital of India is New Delhi. 🇮🇳";
  }

  if (message.includes("capital of kerala")) {
    return "The capital of Kerala is Thiruvananthapuram.";
  }

  if (message.includes("largest planet")) {
    return "Jupiter is the largest planet in our Solar System. 🪐";
  }

  if (message.includes("how many planets")) {
    return "There are 8 recognised planets in our Solar System.";
  }

  if (message.includes("sun")) {
    return "The Sun is the star at the centre of our Solar System. Earth and the other planets orbit around it. ☀️";
  }

  if (message.includes("water")) {
    return "Water is essential for life. Its chemical formula is H₂O.";
  }

  // Maths
  if (/^\d+\s*[\+\-*/]\s*\d+$/.test(message)) {
    try {
      const match = message.match(/^(\d+)\s*([\+\-*/])\s*(\d+)$/);
      const a = Number(match[1]);
      const operator = match[2];
      const b = Number(match[3]);

      if (operator === "+") return "The answer is " + (a + b);
      if (operator === "-") return "The answer is " + (a - b);
      if (operator === "*") return "The answer is " + (a * b);
      if (operator === "/") {
        return b === 0
          ? "Division by zero is not possible."
          : "The answer is " + (a / b);
      }
    } catch {
      return "I couldn't calculate that. Try something like 25 + 10.";
    }
  }

  // Date and time
  if (message.includes("time")) {
    return "The current time is " +
      new Date().toLocaleTimeString() + " ⏰";
  }

  if (message.includes("date") || message.includes("today")) {
    return "Today's date is " +
      new Date().toLocaleDateString() + " 📅";
  }

  // Malayalam basic replies
  if (
    message.includes("sukhamano") ||
    message.includes("sugamano") ||
    message.includes("sukham aano")
  ) {
    return "Enikku super sukham aanu! 😊 Ninakku engane undu?";
  }

  if (
    message.includes("nanni") ||
    message.includes("thanks bro")
  ) {
    return "Santhosham! 😊 Njan help cheyyan ivide undu.";
  }

  if (message.includes("entha vishesham")) {
    return "Ivde ellam super! 😄 Ninakku entha vishesham?";
  }

  if (message.includes("malayalam")) {
    return "Enikku kurachu basic Malayalam messages manassilakkanum reply cheyyanum pattum! 😊";
  }

  // Default response
  const defaults = [
    "That's interesting! 😊 Can you tell me a little more?",
    "I'm still learning! Try asking me about technology, programming or general knowledge.",
    "I don't have a built-in answer for that yet. You can add more replies to my JavaScript code!",
    "Hmm, I don't know that answer right now. Could you ask in another way?",
    "I'm an offline SmartBot, so my knowledge is limited. Try asking me something else! ✨"
  ];

  return defaults[Math.floor(Math.random() * defaults.length)];
}


// ======================================
// CLEAR CHAT
// ======================================

$("clearChatBtn").addEventListener("click", () => {
  const chat = getActiveChat();

  if (!chat || chat.messages.length === 0) {
    showToast("This chat is already empty.");
    return;
  }

  if (!confirm("Clear all messages in this conversation?")) return;

  if (botTimer) clearTimeout(botTimer);

  chat.messages = [];
  chat.title = "New conversation";

  saveChats();
  renderMessages();
  renderChatList();

  showToast("Messages cleared.");
});


// ======================================
// EMOJI BUTTON
// ======================================

$("emojiBtn").addEventListener("click", () => {
  const input = $("messageInput");
  const emojis = ["😀", "😂", "❤️", "👍", "🔥", "😊", "🎉", "🤔", "🙏", "✨"];

  const emoji = emojis[Math.floor(Math.random() * emojis.length)];

  const start = input.selectionStart;
  const end = input.selectionEnd;

  input.value =
    input.value.slice(0, start) +
    emoji +
    input.value.slice(end);

  input.focus();
  input.selectionStart = input.selectionEnd = start + emoji.length;
});


// ======================================
// DARK / LIGHT MODE
// ======================================

function applyTheme() {
  const theme = readStorage(DB.theme, "dark");
  document.body.classList.toggle("light", theme === "light");
}

$("themeBtn").addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light");

  saveStorage(DB.theme, isLight ? "light" : "dark");

  showToast(isLight ? "Light mode enabled." : "Dark mode enabled.");
});


// ======================================
// PROFILE
// ======================================

$("profileBtn").addEventListener("click", () => {
  $("profileName").value = currentUser.name;
  $("profileMessage").textContent = "";
  $("profileModal").classList.remove("hidden");
});

$("closeProfile").addEventListener("click", () => {
  $("profileModal").classList.add("hidden");
});

$("saveProfile").addEventListener("click", () => {
  const newName = $("profileName").value.trim();

  if (!newName) {
    $("profileMessage").textContent = "Please enter your name.";
    return;
  }

  const users = getUsers();
  const index = users.findIndex(user =>
    user.email === currentUser.email
  );

  if (index === -1) return;

  users[index].name = newName;
  currentUser.name = newName;

  saveStorage(DB.users, users);
  saveStorage(DB.currentUser, currentUser.email);

  $("welcomeName").textContent = newName.split(" ")[0];
  $("profileModal").classList.add("hidden");

  showToast("Profile updated!");
  renderMessages();
});


// ======================================
// MOBILE SIDEBAR
// ======================================

$("openSidebar").addEventListener("click", () => {
  $("sidebar").classList.add("open");
});

$("closeSidebar").addEventListener("click", () => {
  $("sidebar").classList.remove("open");
});


// ======================================
// TOAST MESSAGE
// ======================================

let toastTimer;

function showToast(message) {
  const toast = $("toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}


// ======================================
// APP STARTUP
// ======================================

function startApp() {
  applyTheme();

  const savedEmail = readStorage(DB.currentUser, null);

  if (!savedEmail) return;

  const user = getUsers().find(item =>
    item.email === savedEmail
  );

  if (user) {
    loginUser(user);
  }
}

startApp();