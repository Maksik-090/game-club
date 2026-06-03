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

// Статика (фронтенд)
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "frontend")));

// ПОДКЛЮЧЕНИЕ К БД
const db = mysql.createConnection({
  host: "db",
  user: "root",
  password: "root",
  database: "gameclub",
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

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ЗАПУСК
app.listen(3000, () => {
  console.log("Server running on port 3000");
});