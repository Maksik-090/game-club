CREATE DATABASE gameclub;
USE gameclub;

-- 1. Пользователи
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50),
    password VARCHAR(255)
);

-- 2. Посты
CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255),
    content TEXT,
    link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Статистика
CREATE TABLE stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT,
    views INT DEFAULT 0,
    clicks INT DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);