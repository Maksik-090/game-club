const router = require("express").Router();
const db = require("../db");
const auth = require("../middleware/auth");

// Middleware для проверки админа
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.sendStatus(403);
  next();
}

// Пользователи
router.get("/users", auth, adminOnly, (req, res) => {
  db.query("SELECT id, username, email, role FROM users", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

router.delete("/users/:id", auth, adminOnly, (req, res) => {
  db.query("DELETE FROM users WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json("User deleted");
  });
});

router.patch("/users/:id", auth, adminOnly, (req, res) => {
  const { role } = req.body;
  db.query("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json("Role updated");
  });
});

// Теги
router.get("/tags", (req, res) => {
  db.query("SELECT * FROM tags", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

router.post("/tags", auth, adminOnly, (req, res) => {
  const { name } = req.body;
  db.query("INSERT INTO tags (name) VALUES (?)", [name], (err) => {
    if (err) return res.status(500).json(err);
    res.json("Tag created");
  });
});

router.delete("/tags/:id", auth, adminOnly, (req, res) => {
  db.query("DELETE FROM tags WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json("Tag deleted");
  });
});

module.exports = router;