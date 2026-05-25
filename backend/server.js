const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(cors());
app.use(express.json());


// роуты
app.use("/auth", require("./routes/auth"));
app.use("/posts", require("./routes/posts"));
app.use("/comments", require("./routes/comments"));


const SECRET = "supersecret";

const db = mysql.createConnection({
  host: "db",
  user: "root",
  password: "root",
  database: "gameclub"
});

db.connect(err => {
  if (err) throw err;
  console.log("MySQL connected");
});


// =======================
//  MIDDLEWARE

function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.sendStatus(403);
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.sendStatus(403);
  }
  next();
}


// =======================
// AUTH

// Регистрация
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hash],
    (err) => {
      if (err) return res.status(500).send(err);
      res.send("User created");
    }
  );
});

// Логин
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, result) => {
      if (err || result.length === 0) return res.sendStatus(401);

      const user = result[0];

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.sendStatus(401);

      const token = jwt.sign(
        { id: user.id, role: user.role },
        SECRET
      );

      res.json({ token });
    }
  );
});


// =======================
// POSTS
// Получить все
app.get("/posts", (req, res) => {
  db.query("SELECT * FROM posts", (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

// Создать (admin)
app.post("/posts", auth, adminOnly, (req, res) => {
  const { title, content } = req.body;

  db.query(
    "INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)",
    [title, content, req.user.id],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json({ id: result.insertId });
    }
  );
});

// Удалить (admin)
// app.delete("/posts/:id", auth, adminOnly, (req, res) => {
//   db.query("DELETE FROM posts WHERE id = ?", [req.params.id], (err) => {
//     if (err) return res.status(500).send(err);
//     res.send("Deleted");
//   });
// });


// =======================
//  COMMENTS
// Получить комментарии поста
app.get("/posts/:id/comments", (req, res) => {
  db.query(
    "SELECT * FROM comments WHERE post_id = ?",
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json(result);
    }
  );
});

// Добавить комментарий
app.post("/comments", auth, (req, res) => {
  const { content, post_id } = req.body;

  db.query(
    "INSERT INTO comments (content, user_id, post_id) VALUES (?, ?, ?)",
    [content, req.user.id, post_id],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json({ id: result.insertId });
    }
  );
});

// Удалить комментарий (свой или админ)
app.delete("/comments/:id", auth, (req, res) => {
  db.query(
    "SELECT * FROM comments WHERE id = ?",
    [req.params.id],
    (err, result) => {
      if (result.length === 0) return res.sendStatus(404);

      const comment = result[0];

      if (
        comment.user_id !== req.user.id &&
        req.user.role !== "admin"
      ) {
        return res.sendStatus(403);
      }

      db.query("DELETE FROM comments WHERE id = ?", [req.params.id]);
      res.send("Deleted");
    }
  );
});


// =======================
// TAGS

// Создать тег (admin)
app.post("/tags", auth, adminOnly, (req, res) => {
  db.query(
    "INSERT INTO tags (name) VALUES (?)",
    [req.body.name],
    (err) => {
      if (err) return res.status(500).send(err);
      res.send("Tag created");
    }
  );
});


// =======================
// ADMIN USERS

// Получить всех пользователей
app.get("/users", auth, adminOnly, (req, res) => {
  db.query("SELECT id, username, role FROM users", (err, result) => {
    res.json(result);
  });
});

// Удалить пользователя
app.delete("/users/:id", auth, adminOnly, (req, res) => {
  db.query("DELETE FROM users WHERE id = ?", [req.params.id]);
  res.send("User deleted");
});

// Изменить роль
app.patch("/users/:id", auth, adminOnly, (req, res) => {
  db.query(
    "UPDATE users SET role = ? WHERE id = ?",
    [req.body.role, req.params.id]
  );
  res.send("Updated");
});

//проверка API
app.get('/sessions', (req, res) => {
  db.query(`
    SELECT s.*, u.username as user, c.name as computer
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    JOIN computers c ON s.computer_id = c.id
  `, (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

//888888888888959


// ======================
app.listen(3000, () => {
  console.log("Server running on port 3000");
});