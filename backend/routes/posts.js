const router = require("express").Router();
const db = require("../db");
const auth = require("../middleware/auth");

// Получить все посты (с именем автора)
router.get("/", (req, res) => {
  db.query(
    `SELECT p.*, u.username AS author_name, u.avatar AS author_avatar
     FROM posts p
     LEFT JOIN users u ON p.author_id = u.id
     ORDER BY p.created_at DESC`,
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

// Получить один пост (с автором)
router.get("/:id", (req, res) => {
  db.query(
    `SELECT p.*, u.username AS author_name, u.avatar AS author_avatar
     FROM posts p
     LEFT JOIN users u ON p.author_id = u.id
     WHERE p.id = ?`,
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.length === 0) return res.sendStatus(404);
      res.json(result[0]);
    }
  );
});

// Получить теги поста
router.get("/:id/tags", (req, res) => {
  db.query(
    `SELECT t.id, t.name FROM tags t
     JOIN post_tags pt ON t.id = pt.tag_id
     WHERE pt.post_id = ?`,
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

// Создать пост (с картинкой и тегами)
router.post("/", auth, (req, res, next) => {
  req.app.locals.upload.single('image')(req, res, next);
}, (req, res) => {
  const { title, content, tags } = req.body;
  const image = req.file ? req.file.filename : null;

  db.query(
    "INSERT INTO posts (title, content, image, author_id) VALUES (?, ?, ?, ?)",
    [title, content, image, req.user.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      const postId = result.insertId;

      // Если переданы теги, добавляем связи
      if (tags) {
        let tagIds;
        try {
          tagIds = typeof tags === 'string' ? JSON.parse(tags) : tags;
        } catch (e) {
          return res.status(400).json("Invalid tags format");
        }
        if (Array.isArray(tagIds) && tagIds.length > 0) {
          const values = tagIds.map(tagId => [postId, tagId]);
          db.query(
            "INSERT INTO post_tags (post_id, tag_id) VALUES ?",
            [values],
            (err2) => {
              if (err2) return res.status(500).json(err2);
              res.json({ id: postId, message: "Post created with tags" });
            }
          );
        } else {
          res.json({ id: postId, message: "Post created" });
        }
      } else {
        res.json({ id: postId, message: "Post created" });
      }
    }
  );
});

// Удалить пост (только админ)
router.delete("/:id", auth, (req, res) => {
  if (req.user.role !== "admin") return res.sendStatus(403);
  db.query("DELETE FROM posts WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json("Post deleted");
  });
});

module.exports = router;