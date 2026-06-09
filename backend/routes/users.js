const router = require("express").Router();
const db = require("../db");

// Публичный просмотр профиля пользователя по ID
router.get("/:id", (req, res) => {
  const userId = req.params.id;
  db.query(
    "SELECT id, username, email, role, avatar, created_at FROM users WHERE id = ?",
    [userId],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.length === 0) return res.status(404).json("User not found");
      res.json(result[0]);
    }
  );
});

module.exports = router;