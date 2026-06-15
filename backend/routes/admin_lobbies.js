const router = require("express").Router();
const db = require("../db");
const auth = require("../middleware/auth");
const fs = require("fs");
const path = require("path");

// Проверка прав администратора
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.sendStatus(403);
  next();
}

//  ИГРЫ 
// Получить все игры
router.get("/games", (req, res) => {
  db.query("SELECT * FROM games ORDER BY name", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// Создать игру (с обложкой)
router.post("/games", auth, adminOnly, (req, res, next) => {
  req.app.locals.upload.single("cover")(req, res, next);
}, (req, res) => {
  const { name, max_players } = req.body;
  if (!name) return res.status(400).json("Name is required");
  const cover = req.file ? req.file.filename : null;
  db.query(
    "INSERT INTO games (name, cover, max_players) VALUES (?, ?, ?)",
    [name, cover, max_players || 10],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Game created");
    }
  );
});

// Обновить игру
router.put("/games/:id", auth, adminOnly, (req, res, next) => {
  req.app.locals.upload.single("cover")(req, res, next);
}, (req, res) => {
  const gameId = req.params.id;
  const { name, max_players } = req.body;
  const newCover = req.file ? req.file.filename : null;

  // Удаляем старую обложку, если загружена новая
  if (newCover) {
    db.query("SELECT cover FROM games WHERE id = ?", [gameId], (err, result) => {
      if (err) return res.status(500).json(err);
      const oldCover = result[0]?.cover;
      if (oldCover) {
        fs.unlink(path.join(__dirname, "..", "uploads", oldCover), () => {});
      }
      updateGame();
    });
  } else {
    updateGame();
  }

  function updateGame() {
    const fields = {};
    if (name) fields.name = name;
    if (max_players) fields.max_players = max_players;
    if (newCover) fields.cover = newCover;
    db.query("UPDATE games SET ? WHERE id = ?", [fields, gameId], (err) => {
      if (err) return res.status(500).json(err);
      res.json("Game updated");
    });
  }
});

// Удалить игру
router.delete("/games/:id", auth, adminOnly, (req, res) => {
  const gameId = req.params.id;
  db.query("SELECT cover FROM games WHERE id = ?", [gameId], (err, result) => {
    if (err) return res.status(500).json(err);
    const cover = result[0]?.cover;
    if (cover) {
      fs.unlink(path.join(__dirname, "..", "uploads", cover), () => {});
    }
    db.query("DELETE FROM games WHERE id = ?", [gameId], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json("Game deleted");
    });
  });
});

//  ПЛАТФОРМЫ 
router.get("/platforms", (req, res) => {
  db.query("SELECT * FROM platforms ORDER BY name", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

router.post("/platforms", auth, adminOnly, (req, res) => {
  const { name, icon } = req.body;
  if (!name) return res.status(400).json("Name required");
  db.query("INSERT INTO platforms (name, icon) VALUES (?, ?)", [name, icon || null], (err) => {
    if (err) return res.status(500).json(err);
    res.json("Platform added");
  });
});

router.delete("/platforms/:id", auth, adminOnly, (req, res) => {
  db.query("DELETE FROM platforms WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json("Platform deleted");
  });
});

//  СПОСОБЫ КОММУНИКАЦИИ 
router.get("/communications", (req, res) => {
  db.query("SELECT * FROM communication_methods ORDER BY name", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

router.post("/communications", auth, adminOnly, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json("Name required");
  db.query("INSERT INTO communication_methods (name) VALUES (?)", [name], (err) => {
    if (err) return res.status(500).json(err);
    res.json("Communication method added");
  });
});

router.delete("/communications/:id", auth, adminOnly, (req, res) => {
  db.query("DELETE FROM communication_methods WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json("Communication method deleted");
  });
});

module.exports = router;