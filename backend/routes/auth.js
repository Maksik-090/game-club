const router = require("express").Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require('fs');
const path = require('path');
const auth = require("../middleware/auth");
const SECRET = "supersecret";

// регистрация
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, hash],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("User registered");
    }
  );
});


// логин
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0) return res.status(404).json("User not found");

    const user = result[0];

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json("Wrong password");

    const token = jwt.sign(
      { id: user.id, role: user.role },
       SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token });
  });
});


// Получить профиль текущего пользователя
router.get('/profile', auth, (req, res) => {
  db.query('SELECT id, username, email, role, avatar, created_at FROM users WHERE id = ?',
    [req.user.id], (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.length === 0) return res.sendStatus(404);
      res.json(result[0]);
    });
});

// Загрузить/обновить аватар
router.put('/profile/avatar', auth, (req, res, next) => {
  req.app.locals.upload.single('avatar')(req, res, next);
}, (req, res) => {
  if (!req.file) return res.status(400).json('No file uploaded');
  const avatar = req.file.filename;

  db.query('SELECT avatar FROM users WHERE id = ?', [req.user.id], (err, result) => {
    if (err) return res.status(500).json(err);
    const oldAvatar = result[0]?.avatar;
    if (oldAvatar) {
      const oldPath = path.join(__dirname, '..', 'uploads', oldAvatar);
      fs.unlink(oldPath, (err) => { if (err) console.error(err); });
    }
    db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.id], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json({ avatar });
    });
  });
});


// Обновить имя, email
router.put('/profile', auth, (req, res) => {
  const { username, email } = req.body;
  // Простейшая валидация
  if (!username || !email) return res.status(400).json('Username and email required');
  
  db.query('UPDATE users SET username = ?, email = ? WHERE id = ?',
    [username, email, req.user.id], (err) => {
      if (err) return res.status(500).json(err);
      res.json('Profile updated');
    });
});

// Сменить пароль (требуется старый пароль)
router.put('/profile/password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json('Old and new password required');
  
  db.query('SELECT password FROM users WHERE id = ?', [req.user.id], async (err, result) => {
    if (err || result.length === 0) return res.status(500).json('Server error');
    const valid = await bcrypt.compare(oldPassword, result[0].password);
    if (!valid) return res.status(401).json('Wrong old password');
    
    const hash = await bcrypt.hash(newPassword, 10);
    db.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json('Password changed');
    });
  });
});

// Удалить аватар
router.delete('/profile/avatar', auth, (req, res) => {
  db.query('SELECT avatar FROM users WHERE id = ?', [req.user.id], (err, result) => {
    if (err) return res.status(500).json(err);
    const oldAvatar = result[0]?.avatar;
    if (oldAvatar) {
      const oldPath = path.join(__dirname, '..', 'uploads', oldAvatar);
      fs.unlink(oldPath, (err) => { if (err) console.error(err); });
    }
    db.query('UPDATE users SET avatar = NULL WHERE id = ?', [req.user.id], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json('Avatar removed');
    });
  });
});


module.exports = router;