const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

//  НАСТРОЙКА ЗАГРУЗОК (MULTER) 
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Раздача загруженных файлов
app.use("/uploads", express.static(uploadDir));
app.locals.upload = upload;

app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "frontend")));

// ПОДКЛЮЧЕНИЕ К БД
const db = mysql.createConnection({
  host: process.env.DB_HOST || "db",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "gameclub"
});

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL connected");
});

//  РОУТЫ
app.use("/auth", require("./routes/auth"));
app.use("/posts", require("./routes/posts"));
app.use("/comments", require("./routes/comments"));
app.use("/admin", require("./routes/admin"));
app.use("/users", require("./routes/users"));
app.use("/admin/lobbies", require("./routes/admin_lobbies"));
app.use("/lobbies", require("./routes/lobbies"));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ++++++++++++++++++++++++++++
app.get("/db-test", (req, res) => {
  db.query("SELECT 1", (err, result) => {
    if (err) return res.json({ status: "error", error: err.message });
    res.json({ status: "ok" });
  });
});

// ЗАПУСК
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});