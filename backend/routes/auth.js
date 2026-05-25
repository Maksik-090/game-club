const router = require("express").Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
      "SECRET",
      { expiresIn: "1h" }
    );

    res.json({ token });
  });
});

module.exports = router;