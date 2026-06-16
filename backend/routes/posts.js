const router = require("express").Router();
const db = require("../db");
const auth = require("../middleware/auth");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

//  Создать пост (с картинкой и тегами) 
const uploadImage = require('../utils/uploadImage');
const uploadPostImage = multer({ storage: multer.memoryStorage() });

router.post("/", auth, uploadPostImage.single('image'), async (req, res) => {
  const { title, content, tags } = req.body;
  let imageValue = null;

  try {
    if (req.file) {
      imageValue = await uploadImage(req.file, 'posts');
    }

    db.query(
      "INSERT INTO posts (title, content, image, author_id) VALUES (?, ?, ?, ?)",
      [title, content, imageValue, req.user.id],
      (err, result) => {
        if (err) return res.status(500).json(err);
        const postId = result.insertId;

        // Обработка тегов (без изменений)
        if (tags) {
          let tagIds;
          try {
            tagIds = typeof tags === 'string' ? JSON.parse(tags) : tags;
          } catch (e) {
            return res.status(400).json("Invalid tags format");
          }
          if (Array.isArray(tagIds) && tagIds.length > 0) {
            const values = tagIds.map(tagId => [postId, tagId]);
            db.query("INSERT INTO post_tags (post_id, tag_id) VALUES ?", [values], (err2) => {
              if (err2) return res.status(500).json(err2);
              res.json({ id: postId, message: "Post created with tags" });
            });
          } else {
            res.json({ id: postId, message: "Post created" });
          }
        } else {
          res.json({ id: postId, message: "Post created" });
        }
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json(err.message);
  }
});

//  Удалить пост (только админ) – с удалением файла изображения 
router.delete("/:id", auth, (req, res) => {
  if (req.user.role !== "admin") return res.sendStatus(403);

  db.query("SELECT image FROM posts WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0) return res.sendStatus(404);

    const image = result[0].image;

    db.query("DELETE FROM posts WHERE id = ?", [req.params.id], (err2) => {
      if (err2) return res.status(500).json(err2);

      // Если было изображение и оно не URL из облака – удаляем локальный файл
      if (image && !image.startsWith('http')) {
        const filePath = path.join(__dirname, "..", "uploads", image);
        fs.unlink(filePath, (err3) => {
          if (err3) console.error("Ошибка удаления файла:", err3.message);
        });
      }

      res.json("Post deleted");
    });
  });
});

module.exports = router;