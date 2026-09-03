const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

const defaultDatabase = {
  users: [],
  posts: [],
  messages: [],
  rooms: [],
  games: [],
  reports: [],
  sessions: []
};

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(defaultDatabase, null, 2),
      "utf8"
    );
  }
}

function readDatabase() {
  ensureDatabase();

  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const database = JSON.parse(raw);

    return {
      ...defaultDatabase,
      ...database
    };
  } catch (error) {
    console.error("Database read error:", error);
    return { ...defaultDatabase };
  }
}

function writeDatabase(database) {
  ensureDatabase();

  const temporaryFile = `${DB_FILE}.tmp`;

  fs.writeFileSync(
    temporaryFile,
    JSON.stringify(database, null, 2),
    "utf8"
  );

  fs.renameSync(temporaryFile, DB_FILE);
}

function updateDatabase(callback) {
  const database = readDatabase();
  const result = callback(database);

  writeDatabase(database);

  return result;
}

function findUserById(id) {
  const database = readDatabase();

  return database.users.find(
    user => user.id === id
  ) || null;
}

function findUserByUsername(username) {
  const database = readDatabase();
  const normalized = String(username)
    .trim()
    .replace(/^@/, "")
    .toLowerCase();

  return database.users.find(
    user => user.username.toLowerCase() === normalized
  ) || null;
}

function findUserByAnonymousId(anonymousId) {
  const database = readDatabase();

  return database.users.find(
    user => user.anonymousId === anonymousId
  ) || null;
}

function createUser(user) {
  return updateDatabase(database => {
    database.users.push(user);
    return user;
  });
}

function updateUser(id, changes) {
  return updateDatabase(database => {
    const index = database.users.findIndex(
      user => user.id === id
    );

    if (index === -1) {
      return null;
    }

    database.users[index] = {
      ...database.users[index],
      ...changes,
      updatedAt: new Date().toISOString()
    };

    return database.users[index];
  });
}

function createPost(post) {
  return updateDatabase(database => {
    database.posts.unshift(post);
    return post;
  });
}

function getPosts() {
  const database = readDatabase();
  return database.posts;
}

function getPostsByUser(userId) {
  const database = readDatabase();

  return database.posts.filter(
    post => post.authorId === userId
  );
}

function deletePost(postId) {
  return updateDatabase(database => {
    const index = database.posts.findIndex(
      post => post.id === postId
    );

    if (index === -1) {
      return false;
    }

    database.posts.splice(index, 1);
    return true;
  });
}

function createMessage(message) {
  return updateDatabase(database => {
    database.messages.push(message);
    return message;
  });
}

function getConversation(userA, userB) {
  const database = readDatabase();

  return database.messages
    .filter(message => {
      const sameDirection =
        message.senderId === userA &&
        message.receiverId === userB;

      const reverseDirection =
        message.senderId === userB &&
        message.receiverId === userA;

      return sameDirection || reverseDirection;
    })
    .sort(
      (a, b) =>
        new Date(a.createdAt) -
        new Date(b.createdAt)
    );
}

function createRoom(room) {
  return updateDatabase(database => {
    database.rooms.push(room);
    return room;
  });
}

function getRoomByUser(userId) {
  const database = readDatabase();

  return database.rooms.find(
    room => room.userId === userId
  ) || null;
}

function updateRoom(userId, changes) {
  return updateDatabase(database => {
    const index = database.rooms.findIndex(
      room => room.userId === userId
    );

    if (index === -1) {
      return null;
    }

    database.rooms[index] = {
      ...database.rooms[index],
      ...changes,
      updatedAt: new Date().toISOString()
    };

    return database.rooms[index];
  });
}

function createReport(report) {
  return updateDatabase(database => {
    database.reports.push(report);
    return report;
  });
}

function getStats() {
  const database = readDatabase();

  return {
    users: database.users.length,
    posts: database.posts.length,
    messages: database.messages.length,
    rooms: database.rooms.length,
    reports: database.reports.length
  };
}

module.exports = {
  ensureDatabase,
  readDatabase,
  writeDatabase,
  updateDatabase,

  findUserById,
  findUserByUsername,
  findUserByAnonymousId,
  createUser,
  updateUser,

  createPost,
  getPosts,
  getPostsByUser,
  deletePost,

  createMessage,
  getConversation,

  createRoom,
  getRoomByUser,
  updateRoom,

  createReport,
  getStats
};
