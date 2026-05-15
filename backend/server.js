const express = require("express");
const db = require("./db");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Получить посты
app.get("/posts", (req, res) => {
  db.query("SELECT * FROM posts", (err, result) => {
    res.json(result);
  });
});

// Добавить пост
app.post("/posts", (req, res) => {
  const { title, content, link } = req.body;

  db.query(
    "INSERT INTO posts (title, content, link) VALUES (?, ?, ?)",
    [title, content, link],
    (err, result) => {
      const postId = result.insertId;

      db.query(
        "INSERT INTO stats (post_id) VALUES (?)",
        [postId]
      );

      res.json({ message: "Post added" });
    }
  );
});

// Просмотр поста
app.post("/view/:id", (req, res) => {
  db.query(
    "UPDATE stats SET views = views + 1 WHERE post_id=?",
    [req.params.id]
  );
  res.send("view added");
});

// Клик по ссылке
app.post("/click/:id", (req, res) => {
  db.query(
    "UPDATE stats SET clicks = clicks + 1 WHERE post_id=?",
    [req.params.id]
  );
  res.send("click added");
});

app.listen(3000, () => console.log("Server started"));