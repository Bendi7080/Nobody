const jwt = require("jsonwebtoken");
const { findUserById } = require("../database/database");

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Требуется авторизация"
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Неверный формат токена"
      });
    }

    const token = authHeader.slice(7);

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    const user = findUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Пользователь не найден"
      });
    }

    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Сессия недействительна или истекла"
    });
  }
}

module.exports = authMiddleware;
