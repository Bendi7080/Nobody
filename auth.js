const express = require("express");
const jwt = require("jsonwebtoken");

const {
  register,
  login,
  getUser
} = require("../services/authService");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn("⚠ JWT_SECRET не задан в .env");
}

function createToken(user) {
  return jwt.sign(
    {
      userId: user.id
    },
    JWT_SECRET,
    {
      expiresIn: "30d"
    }
  );
}

router.post("/register", async (req, res) => {
  try {
    const { username, password, bio } = req.body;

    const user = await register({
      username,
      password,
      bio
    });

    const token = createToken(user);

    res.status(201).json({
      success: true,
      message: "Аккаунт создан",
      token,
      user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await login({
      username,
      password
    });

    const token = createToken(user);

    res.json({
      success: true,
      message: "Вход выполнен",
      token,
      user
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message
    });
  }
});

router.get("/me", (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Требуется авторизация"
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    const user = getUser(decoded.userId);

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Недействительная сессия"
    });
  }
});

module.exports = router;
