const router = require("express").Router();
const db = require("../db");
const auth = require("../middleware/auth");

// Добавить комментарий
router.post("/", auth, (req, res) => {
  const { content, post_id } = req.body;
  db.query(
    "INSERT INTO comments (content, user_id, post_id) VALUES (?, ?, ?)",
    [content, req.user.id, post_id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Comment added");
    }
  );
});

// Получить комментарии поста
router.get("/:postId", (req, res) => {
  db.query(
    `SELECT c.*, u.username, u.avatar
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC`,
    [req.params.postId],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

// Редактировать комментарий
router.put("/:id", auth, (req, res) => {
  const { content } = req.body;
  db.query("SELECT * FROM comments WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0) return res.sendStatus(404);
    const comment = result[0];
    if (comment.user_id !== req.user.id && req.user.role !== "admin") {
      return res.sendStatus(403);
    }
    db.query("UPDATE comments SET content = ? WHERE id = ?", [content, req.params.id], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json("Comment updated");
    });
  });
});

// Удалить комментарий
router.delete("/:id", auth, (req, res) => {
  db.query("SELECT * FROM comments WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0) return res.sendStatus(404);
    const comment = result[0];
    if (comment.user_id !== req.user.id && req.user.role !== "admin") {
      return res.sendStatus(403);
    }
    db.query("DELETE FROM comments WHERE id = ?", [req.params.id], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json("Comment deleted");
    });
  });
});

module.exports = router;