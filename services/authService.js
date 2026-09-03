const bcrypt = require("bcrypt");
const crypto = require("crypto");

const {
  findUserByUsername,
  findUserById,
  findUserByAnonymousId,
  createUser,
  updateUser
} = require("../database/database");

function cleanUsername(username) {
  return String(username || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function generateAnonymousId() {
  return `user_${crypto.randomBytes(10).toString("hex")}`;
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    anonymousId: user.anonymousId,
    bio: user.bio,
    avatar: user.avatar,
    createdAt: user.createdAt
  };
}

async function register({ username, password, bio = "" }) {
  const normalizedUsername = cleanUsername(username);

  if (!normalizedUsername) {
    throw new Error("Введите ник");
  }

  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(normalizedUsername)) {
    throw new Error(
      "Ник должен содержать от 3 до 24 символов: буквы, цифры, _, ., -"
    );
  }

  if (!password || password.length < 6) {
    throw new Error("Пароль должен содержать минимум 6 символов");
  }

  const existingUser = findUserByUsername(normalizedUsername);

  if (existingUser) {
    throw new Error("Этот ник уже занят");
  }

  let anonymousId = generateAnonymousId();

  while (findUserByAnonymousId(anonymousId)) {
    anonymousId = generateAnonymousId();
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const now = new Date().toISOString();

  const user = {
    id: generateId("usr"),
    username: normalizedUsername,
    passwordHash,
    anonymousId,
    bio: String(bio).trim().slice(0, 240),
    avatar: "?",
    createdAt: now,
    updatedAt: now,
    settings: {
      showAnonymousId: true,
      allowMessages: true,
      showRoom: true
    },
    room: {
      name: "Моя комната",
      description: "Добро пожаловать...",
      style: "mint",
      visitsAllowed: true
    }
  };

  createUser(user);

  return publicUser(user);
}

async function login({ username, password }) {
  const normalizedUsername = cleanUsername(username);

  if (!normalizedUsername || !password) {
    throw new Error("Введите ник и пароль");
  }

  const user = findUserByUsername(normalizedUsername);

  if (!user) {
    throw new Error("Неверный ник или пароль");
  }

  const passwordCorrect = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordCorrect) {
    throw new Error("Неверный ник или пароль");
  }

  updateUser(user.id, {
    lastLoginAt: new Date().toISOString()
  });

  return publicUser({
    ...user,
    lastLoginAt: new Date().toISOString()
  });
}

function getUser(id) {
  const user = findUserById(id);

  if (!user) {
    throw new Error("Пользователь не найден");
  }

  return publicUser(user);
}

function updateProfile(userId, { username, bio }) {
  const user = findUserById(userId);

  if (!user) {
    throw new Error("Пользователь не найден");
  }

  const changes = {};

  if (username !== undefined) {
    const normalizedUsername = cleanUsername(username);

    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(normalizedUsername)) {
      throw new Error("Некорректный ник");
    }

    const existing = findUserByUsername(normalizedUsername);

    if (existing && existing.id !== userId) {
      throw new Error("Этот ник уже занят");
    }

    changes.username = normalizedUsername;
  }

  if (bio !== undefined) {
    changes.bio = String(bio).trim().slice(0, 240);
  }

  return publicUser(
    updateUser(userId, changes)
  );
}

module.exports = {
  register,
  login,
  getUser,
  updateProfile
};
