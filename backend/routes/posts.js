const router = require("express").Router();
const db = require("../db");
const auth = require("../middleware/auth");

// получить все посты
router.get("/", (req, res) => {
  db.query("SELECT * FROM posts", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// создать пост
router.post("/", auth, (req, res) => {
  const { title, content } = req.body;

  db.query(
    "INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)",
    [title, content, req.user.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Post created");
    }
  );
});

module.exports = router;