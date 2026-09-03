const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const users = new Map();
const sessions = new Map();
const posts = new Map();
const messages = new Map();

const now = () => new Date().toISOString();

const id = (prefix) =>
  `${prefix}_${crypto.randomBytes(8).toString("hex")}`;

const hashPassword = (password) =>
  crypto.createHash("sha256").update(password).digest("hex");

const cleanUsername = (username) =>
  String(username || "")
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, 24);

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  bio: user.bio,
  anonymousId: user.anonymousId,
  avatar: user.avatar,
  createdAt: user.createdAt
});

function getToken(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7);
}

function getCurrentUser(req) {
  const token = getToken(req);

  if (!token) {
    return null;
  }

  const userId = sessions.get(token);

  if (!userId) {
    return null;
  }

  return users.get(userId) || null;
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Требуется авторизация."
    });
  }

  req.user = user;
  next();
}

function createUser(username, password) {
  const user = {
    id: id("user"),
    username,
    displayName: username,
    bio: "",
    passwordHash: hashPassword(password),
    anonymousId: `user_${crypto.randomBytes(6).toString("hex")}`,
    avatar: "?",
    role: ["nobody", "bendi"].includes(String(username).toLowerCase()) ? "owner" : "user",
    createdAt: now(),
    privacy: {
      showID: true,
      allowMessages: true,
      showRoom: true
    },
    room: {
      name: "Моя комната",
      description: "Добро пожаловать в мою комнату.",
      style: "mint",
      visits: true
    }
  };

  users.set(user.id, user);
  return user;
}

function createToken(user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, user.id);
  return token;
}

function serializePost(post) {
  const author = users.get(post.authorId);

  return {
    id: post.id,
    text: post.text,
    createdAt: post.createdAt,
    likes: post.likes,
    comments: post.comments,
    liked: false,
    author: author ? publicUser(author) : null
  };
}

function serializeMessage(message) {
  return {
    id: message.id,
    from: message.from,
    to: message.to,
    text: message.text,
    createdAt: message.createdAt
  };
}

/* =========================
   BASIC
========================= */

app.get("/api", (req, res) => {
  res.json({
    ok: true,
    name: "NOBODY API",
    version: "0.1.0",
    status: "online",
    time: now()
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    status: "online",
    users: users.size,
    posts: posts.size
  });
});

/* =========================
   AUTH
========================= */

app.post("/api/auth/register", (req, res) => {
  try {
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || "");

    if (username.length < 3) {
      return res.status(400).json({
        ok: false,
        message: "Ник должен содержать минимум 3 символа."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        message: "Пароль должен содержать минимум 6 символов."
      });
    }

    const exists = [...users.values()].some(
      user => user.username.toLowerCase() === username.toLowerCase()
    );

    if (exists) {
      return res.status(409).json({
        ok: false,
        message: "Этот ник уже занят."
      });
    }

    const user = createUser(username, password);
    const token = createToken(user);

    res.status(201).json({
      ok: true,
      token,
      user: publicUser(user)
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Ошибка регистрации."
    });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || "");

    const user = [...users.values()].find(
      item => item.username.toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Неверный ник или пароль."
      });
    }

    if (user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({
        ok: false,
        message: "Неверный ник или пароль."
      });
    }

    const token = createToken(user);

    res.json({
      ok: true,
      token,
      user: publicUser(user)
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Ошибка входа."
    });
  }
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = getToken(req);

  if (token) {
    sessions.delete(token);
  }

  res.json({
    ok: true
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: publicUser(req.user)
  });
});

/* =========================
   USERS
========================= */

app.get("/api/users/me", requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: {
      ...publicUser(req.user),
      privacy: req.user.privacy,
      room: req.user.room
    }
  });
});

app.patch("/api/users/me", requireAuth, (req, res) => {
  const { username, displayName, bio } = req.body;

  if (username !== undefined) {
    const newUsername = cleanUsername(username);

    if (req.user.role === "owner" && newUsername !== req.user.username) {
      return res.status(403).json({
        ok: false,
        message: "Имя Owner-аккаунта нельзя изменить."
      });
    }

    if (newUsername.length < 3) {
      return res.status(400).json({
        ok: false,
        message: "Ник слишком короткий."
      });
    }

    const exists = [...users.values()].some(
      user =>
        user.id !== req.user.id &&
        user.username.toLowerCase() === newUsername.toLowerCase()
    );

    if (exists) {
      return res.status(409).json({
        ok: false,
        message: "Этот ник уже занят."
      });
    }

    req.user.username = newUsername;
  }

  if (displayName !== undefined) {
    req.user.displayName =
      String(displayName).trim().slice(0, 40);
  }

  if (bio !== undefined) {
    req.user.bio =
      String(bio).trim().slice(0, 240);
  }

  res.json({
    ok: true,
    user: publicUser(req.user)
  });
});

app.get("/api/users/search", requireAuth, (req, res) => {
  const query = String(req.query.q || "")
    .trim()
    .toLowerCase();

  if (!query) {
    return res.json({
      ok: true,
      users: []
    });
  }

  const result = [...users.values()]
    .filter(user => {
      const username = user.username.toLowerCase();
      const anonymousId = user.anonymousId.toLowerCase();

      return (
        username.includes(query.replace(/^@/, "")) ||
        anonymousId.includes(query)
      );
    })
    .slice(0, 30)
    .map(publicUser);

  res.json({
    ok: true,
    users: result
  });
});

app.get("/api/users/:id", requireAuth, (req, res) => {
  const user = users.get(req.params.id);

  if (!user) {
    return res.status(404).json({
      ok: false,
      message: "Пользователь не найден."
    });
  }

  const result = publicUser(user);

  if (!user.privacy.showID && user.id !== req.user.id) {
    delete result.anonymousId;
  }

  res.json({
    ok: true,
    user: result
  });
});

/* =========================
   PRIVACY
========================= */

app.patch("/api/users/me/privacy", requireAuth, (req, res) => {
  const { showID, allowMessages, showRoom } = req.body;

  if (typeof showID === "boolean") {
    req.user.privacy.showID = showID;
  }

  if (typeof allowMessages === "boolean") {
    req.user.privacy.allowMessages = allowMessages;
  }

  if (typeof showRoom === "boolean") {
    req.user.privacy.showRoom = showRoom;
  }

  res.json({
    ok: true,
    privacy: req.user.privacy
  });
});

/* =========================
   POSTS
========================= */

app.get("/api/posts", requireAuth, (req, res) => {
  const feed = [...posts.values()]
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )
    .map(post => ({
      ...serializePost(post),
      liked: post.likedBy?.has(req.user.id) || false
    }));

  res.json({
    ok: true,
    posts: feed
  });
});

app.post("/api/posts", requireAuth, (req, res) => {
  const text = String(req.body.text || "").trim();

  if (!text) {
    return res.status(400).json({
      ok: false,
      message: "Пост не может быть пустым."
    });
  }

  if (text.length > 2000) {
    return res.status(400).json({
      ok: false,
      message: "Пост слишком длинный."
    });
  }

  const post = {
    id: id("post"),
    authorId: req.user.id,
    text,
    createdAt: now(),
    likes: 0,
    comments: 0,
    likedBy: new Set()
  };

  posts.set(post.id, post);

  res.status(201).json({
    ok: true,
    post: serializePost(post)
  });
});

app.delete("/api/posts/:id", requireAuth, (req, res) => {
  const post = posts.get(req.params.id);

  if (!post) {
    return res.status(404).json({
      ok: false,
      message: "Пост не найден."
    });
  }

  if (post.authorId !== req.user.id) {
    return res.status(403).json({
      ok: false,
      message: "Можно удалить только свой пост."
    });
  }

  posts.delete(post.id);

  res.json({
    ok: true
  });
});

app.post("/api/posts/:id/like", requireAuth, (req, res) => {
  const post = posts.get(req.params.id);

  if (!post) {
    return res.status(404).json({
      ok: false,
      message: "Пост не найден."
    });
  }

  if (!post.likedBy) {
    post.likedBy = new Set();
  }

  const liked = post.likedBy.has(req.user.id);

  if (liked) {
    post.likedBy.delete(req.user.id);
    post.likes = Math.max(0, post.likes - 1);
  } else {
    post.likedBy.add(req.user.id);
    post.likes += 1;
  }

  res.json({
    ok: true,
    liked: !liked,
    likes: post.likes
  });
});

app.get("/api/users/:id/posts", requireAuth, (req, res) => {
  const user = users.get(req.params.id);

  if (!user) {
    return res.status(404).json({
      ok: false,
      message: "Пользователь не найден."
    });
  }

  const result = [...posts.values()]
    .filter(post => post.authorId === user.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )
    .map(post => ({
      ...serializePost(post),
      liked: post.likedBy?.has(req.user.id) || false
    }));

  res.json({
    ok: true,
    posts: result
  });
});

/* =========================
   MESSAGES
========================= */

function conversationKey(a, b) {
  return [a, b].sort().join(":");
}

app.get("/api/messages", requireAuth, (req, res) => {
  const conversations = [];

  for (const [key, list] of messages.entries()) {
    if (!key.startsWith(req.user.id + ":") &&
        !key.endsWith(":" + req.user.id)) {
      continue;
    }

    const otherId = key
      .split(":")
      .find(value => value !== req.user.id);

    const otherUser = users.get(otherId);

    if (!otherUser) {
      continue;
    }

    const last = list[list.length - 1];

    conversations.push({
      user: publicUser(otherUser),
      lastMessage: last
        ? serializeMessage(last)
        : null
    });
  }

  conversations.sort((a, b) => {
    const dateA = a.lastMessage
      ? new Date(a.lastMessage.createdAt)
      : 0;

    const dateB = b.lastMessage
      ? new Date(b.lastMessage.createdAt)
      : 0;

    return dateB - dateA;
  });

  res.json({
    ok: true,
    conversations
  });
});

app.get(
  "/api/messages/:userId",
  requireAuth,
  (req, res) => {
    const otherUser = users.get(req.params.userId);

    if (!otherUser) {
      return res.status(404).json({
        ok: false,
        message: "Пользователь не найден."
      });
    }

    const key = conversationKey(
      req.user.id,
      otherUser.id
    );

    res.json({
      ok: true,
      user: publicUser(otherUser),
      messages: (messages.get(key) || [])
        .map(serializeMessage)
    });
  }
);

app.post(
  "/api/messages/:userId",
  requireAuth,
  (req, res) => {
    const otherUser = users.get(req.params.userId);

    if (!otherUser) {
      return res.status(404).json({
        ok: false,
        message: "Пользователь не найден."
      });
    }

    if (!otherUser.privacy.allowMessages) {
      return res.status(403).json({
        ok: false,
        message: "Этот пользователь запретил сообщения."
      });
    }

    const text = String(req.body.text || "").trim();

    if (!text) {
      return res.status(400).json({
        ok: false,
        message: "Сообщение пустое."
      });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        ok: false,
        message: "Сообщение слишком длинное."
      });
    }

    const key = conversationKey(
      req.user.id,
      otherUser.id
    );

    if (!messages.has(key)) {
      messages.set(key, []);
    }

    const message = {
      id: id("msg"),
      from: req.user.id,
      to: otherUser.id,
      text,
      createdAt: now()
    };

    messages.get(key).push(message);

    res.status(201).json({
      ok: true,
      message: serializeMessage(message)
    });
  }
);

/* =========================
   ROOM
========================= */

app.get("/api/room", requireAuth, (req, res) => {
  res.json({
    ok: true,
    room: req.user.room
  });
});

app.patch("/api/room", requireAuth, (req, res) => {
  const {
    name,
    description,
    style,
    visits
  } = req.body;

  if (name !== undefined) {
    req.user.room.name =
      String(name).trim().slice(0, 40);
  }

  if (description !== undefined) {
    req.user.room.description =
      String(description).trim().slice(0, 180);
  }

  if (
    style === "mint" ||
    style === "slate" ||
    style === "lavender" ||
    style === "cloud"
  ) {
    req.user.room.style = style;
  }

  if (typeof visits === "boolean") {
    req.user.room.visits = visits;
  }

  res.json({
    ok: true,
    room: req.user.room
  });
});

app.get("/api/users/:id/room", requireAuth, (req, res) => {
  const user = users.get(req.params.id);

  if (!user) {
    return res.status(404).json({
      ok: false,
      message: "Пользователь не найден."
    });
  }

  if (!user.privacy.showRoom || !user.room.visits) {
    return res.status(403).json({
      ok: false,
      message: "Комната закрыта."
    });
  }

  res.json({
    ok: true,
    room: user.room,
    owner: publicUser(user)
  });
});

/* =========================
   OWNER
========================= */

function isOwner(user) {
  return Boolean(user && user.role === "owner");
}

function requireOwner(req, res, next) {
  if (!isOwner(req.user)) {
    return res.status(403).json({
      ok: false,
      message: "Доступ запрещён."
    });
  }

  next();
}

app.get(
  "/api/owner/stats",
  requireAuth,
  requireOwner,
  (req, res) => {
    res.json({
      ok: true,
      stats: {
        users: users.size,
        posts: posts.size,
        conversations: messages.size,
        sessions: sessions.size
      }
    });
  }
);

app.get(
  "/api/owner/users",
  requireAuth,
  requireOwner,
  (req, res) => {
    res.json({
      ok: true,
      users: [...users.values()].map(publicUser)
    });
  }
);

app.get(
  "/api/owner/posts",
  requireAuth,
  requireOwner,
  (req, res) => {
    res.json({
      ok: true,
      posts: [...posts.values()].map(serializePost)
    });
  }
);

app.delete(
  "/api/owner/posts/:id",
  requireAuth,
  requireOwner,
  (req, res) => {
    if (!posts.has(req.params.id)) {
      return res.status(404).json({
        ok: false,
        message: "Пост не найден."
      });
    }

    posts.delete(req.params.id);

    res.json({
      ok: true
    });
  }
);

/* =========================
   FRONTEND FALLBACK
========================= */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================
   ERRORS
========================= */

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    ok: false,
    message: "Внутренняя ошибка сервера."
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("        NOBODY SERVER");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`API: http://localhost:${PORT}/api`);
  console.log(`WEB: http://localhost:${PORT}`);
  console.log("STATUS: ONLINE");
  console.log("VERSION: 0.1.0");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
});
