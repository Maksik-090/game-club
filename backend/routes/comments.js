const router = require("express").Router();
const db = require("../db");
const auth = require("../middleware/auth");

// добавить комментарий
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

// получить комментарии по посту
router.get("/:postId", (req, res) => {
  db.query(
    "SELECT * FROM comments WHERE post_id = ?",
    [req.params.postId],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

module.exports = router;