const router = require("express").Router();
const db = require("../db");
const auth = require("../middleware/auth");

// Вспомогательная функция расчёта статуса комнаты
function computeRoomStatus(room, playersCount) {
  const now = new Date();
  if (room.status === 'closed') return 'closed';
  if (room.closed_at && new Date(room.closed_at) <= now) return 'closed';
  if (room.start_time && new Date(room.start_time) <= now) return 'playing';
  if (playersCount >= room.max_slots && !room.start_time) return 'playing';
  if (playersCount >= room.max_slots) return 'full';
  return 'waiting';
}

// Обновление статуса в БД
function updateRoomStatusInDB(roomId, newStatus, callback) {
  db.query("UPDATE rooms SET status = ? WHERE id = ?", [newStatus, roomId], (err) => {
    if (callback) callback(err);
  });
}

//  ПОЛУЧИТЬ КОМНАТЫ 
router.get("/rooms", (req, res) => {
  db.query(
    `SELECT r.*, g.name AS game_name, g.cover AS game_cover, u.username AS creator_name, u.avatar AS creator_avatar,
      (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) AS players_count
    FROM rooms r
    JOIN games g ON r.game_id = g.id
    JOIN users u ON r.creator_id = u.id
    ORDER BY r.created_at DESC`,
    (err, rooms) => {
      if (err) return res.status(500).json(err);

      const roomIds = rooms.map(r => r.id);
      if (roomIds.length === 0) return res.json([]);

      // Получаем игроков для всех комнат
      db.query(
        `SELECT rp.room_id, u.id, u.username, u.avatar
         FROM room_players rp
         JOIN users u ON rp.user_id = u.id
         WHERE rp.room_id IN (?)`,
        [roomIds],
        (err2, players) => {
          if (err2) return res.status(500).json(err2);

          // Группируем игроков по комнате
          const playersByRoom = {};
          players.forEach(p => {
            if (!playersByRoom[p.room_id]) playersByRoom[p.room_id] = [];
            playersByRoom[p.room_id].push({
              id: p.id,
              username: p.username,
              avatar: p.avatar
            });
          });

          // Добавляем players в каждую комнату и вычисляем статус
          const updatedRooms = rooms.map(room => {
            const playersList = playersByRoom[room.id] || [];
            const playersCount = playersList.length;
            const newStatus = computeRoomStatus(room, playersCount);
            if (newStatus !== room.status) {
              updateRoomStatusInDB(room.id, newStatus);
              room.status = newStatus;
            }
            return {
              ...room,
              players: playersList,
              players_count: playersCount
            };
          });

          res.json(updatedRooms);
        }
      );
    }
  );
});

//  СОЗДАТЬ КОМНАТУ 
router.post("/rooms", auth, (req, res) => {
  const { game_id, max_slots, start_time, comment, platforms, communications } = req.body;
  const creator_id = req.user.id;

  // Проверка лимита для не-админов (макс 3 активные комнаты)
  if (req.user.role !== "admin") {
    db.query("SELECT COUNT(*) AS cnt FROM rooms WHERE creator_id = ? AND status != 'closed'",
      [creator_id], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result[0].cnt >= 3) return res.status(400).json("Maximum 3 active rooms allowed");
        createRoom();
      });
  } else {
    createRoom();
  }

  function createRoom() {
    let closedAt;
    if (start_time) {
      closedAt = new Date(new Date(start_time).getTime() + 60 * 60 * 1000); // +1 час после начала
    } else {
      closedAt = new Date(Date.now() + 5 * 60 * 60 * 1000); // +5 часов от создания
    }

    db.query(
      "INSERT INTO rooms (game_id, creator_id, max_slots, start_time, closed_at, comment) VALUES (?, ?, ?, ?, ?, ?)",
      [game_id, creator_id, max_slots, start_time || null, closedAt, comment || null],
      (err, result) => {
        if (err) return res.status(500).json(err);
        const roomId = result.insertId;

        // Создатель автоматически становится участником
        db.query("INSERT INTO room_players (room_id, user_id) VALUES (?, ?)", [roomId, creator_id]);

        // Добавляем платформы
        if (platforms && Array.isArray(platforms)) {
          platforms.forEach(pid => {
            db.query("INSERT INTO room_platforms (room_id, platform_id) VALUES (?, ?)", [roomId, pid]);
          });
        }

        // Добавляем коммуникации
        if (communications && Array.isArray(communications)) {
          communications.forEach(comm => {
            db.query("INSERT INTO room_communications (room_id, method_id, link) VALUES (?, ?, ?)",
              [roomId, comm.method_id, comm.link]);
          });
        }

        res.json({ id: roomId });
      }
    );
  }
});

//  ПРИСОЕДИНИТЬСЯ 
router.post("/rooms/:id/join", auth, (req, res) => {
  const roomId = req.params.id;
  const userId = req.user.id;

  db.query("SELECT * FROM room_players WHERE room_id = ? AND user_id = ?", [roomId, userId], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (rows.length > 0) return res.status(400).json("Already in room");

    db.query(
      `SELECT r.*, (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) AS players_count
       FROM rooms r WHERE r.id = ?`,
      [roomId],
      (err, roomResult) => {
        if (err) return res.status(500).json(err);
        if (roomResult.length === 0) return res.status(404).json("Room not found");
        const room = roomResult[0];
        if (room.status === 'closed' || room.status === 'full' || room.status === 'playing') {
          return res.status(400).json("Room unavailable");
        }
        if (room.players_count >= room.max_slots) return res.status(400).json("Room full");

        // Лимит 3 комнаты для обычного пользователя
        if (req.user.role !== "admin") {
          db.query(
            `SELECT COUNT(*) AS cnt FROM room_players rp JOIN rooms r ON rp.room_id = r.id
             WHERE rp.user_id = ? AND r.status != 'closed'`,
            [userId],
            (err, countRes) => {
              if (err) return res.status(500).json(err);
              if (countRes[0].cnt >= 3) return res.status(400).json("Already in 3 rooms");
              join();
            });
        } else {
          join();
        }

        function join() {
          db.query("INSERT INTO room_players (room_id, user_id) VALUES (?, ?)", [roomId, userId], (err) => {
            if (err) return res.status(500).json(err);
            // Пересчитываем статус после добавления
            db.query("SELECT COUNT(*) AS cnt FROM room_players WHERE room_id = ?", [roomId], (err, countRes) => {
              const newCount = countRes[0].cnt;
              const newStatus = computeRoomStatus(room, newCount);
              if (newStatus !== room.status) {
                updateRoomStatusInDB(roomId, newStatus);
              }
              res.json("Joined");
            });
          });
        }
      }
    );
  });
});

//  ВЫЙТИ ИЗ КОМНАТЫ 
router.delete("/rooms/:id/leave", auth, (req, res) => {
  const roomId = req.params.id;
  const userId = req.user.id;

  db.query("DELETE FROM room_players WHERE room_id = ? AND user_id = ?", [roomId, userId], (err) => {
    if (err) return res.status(500).json(err);
    // Если комната опустела и не закрыта – удаляем совсем
    db.query("SELECT COUNT(*) AS cnt FROM room_players WHERE room_id = ?", [roomId], (err, countRes) => {
      if (countRes[0].cnt === 0) {
        db.query("SELECT status FROM rooms WHERE id = ?", [roomId], (err, roomRes) => {
          if (roomRes.length && roomRes[0].status !== 'closed') {
            db.query("DELETE FROM rooms WHERE id = ?", [roomId]);
          }
        });
      }
      res.json("Left");
    });
  });
});

//  ЗАКРЫТЬ КОМНАТУ (создатель/админ) 
router.delete("/rooms/:id", auth, (req, res) => {
  const roomId = req.params.id;
  db.query("SELECT * FROM rooms WHERE id = ?", [roomId], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (rows.length === 0) return res.status(404).json("Room not found");
    const room = rows[0];
    if (room.creator_id !== req.user.id && req.user.role !== "admin") return res.sendStatus(403);
    // Устанавливаем статус 'closed', но не удаляем
    db.query("UPDATE rooms SET status = 'closed' WHERE id = ?", [roomId], (err) => {
      if (err) return res.status(500).json(err);
      res.json("Room closed");
    });
  });
});

// Полностью удалить комнату (админ всегда, создатель – только после закрытия)
router.delete("/rooms/:id/force", auth, (req, res) => {
  const roomId = req.params.id;
  db.query("SELECT * FROM rooms WHERE id = ?", [roomId], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (rows.length === 0) return res.status(404).json("Room not found");
    const room = rows[0];
    // Права: админ может всегда, создатель – только если комната уже закрыта
    if (req.user.role !== "admin") {
      if (room.creator_id !== req.user.id) return res.sendStatus(403);
      if (room.status !== 'closed') return res.status(400).json("Room must be closed first");
    }
    db.query("DELETE FROM rooms WHERE id = ?", [roomId], (err) => {
      if (err) return res.status(500).json(err);
      res.json("Room deleted permanently");
    });
  });
});


//  РЕДАКТИРОВАТЬ КОМНАТУ (создатель/админ) 
router.put("/rooms/:id", auth, (req, res) => {
  const roomId = req.params.id;
  const { max_slots, start_time, comment, platforms, communications } = req.body;

  db.query("SELECT * FROM rooms WHERE id = ?", [roomId], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (rows.length === 0) return res.status(404).json("Room not found");
    if (rows[0].creator_id !== req.user.id && req.user.role !== "admin") return res.sendStatus(403);

    const room = rows[0];
    const updates = {};
    if (max_slots) updates.max_slots = max_slots;
    if (comment !== undefined) updates.comment = comment;
    if (start_time !== undefined) {
      updates.start_time = start_time || null;
      // пересчёт времени закрытия
      if (start_time) {
        updates.closed_at = new Date(new Date(start_time).getTime() + 60 * 60 * 1000);
      } else {
        updates.closed_at = new Date(Date.now() + 5 * 60 * 60 * 1000);
      }
    }

    db.query("UPDATE rooms SET ? WHERE id = ?", [updates, roomId], (err) => {
      if (err) return res.status(500).json(err);

      // Платформы
      if (platforms) {
        db.query("DELETE FROM room_platforms WHERE room_id = ?", [roomId]);
        platforms.forEach(pid => {
          db.query("INSERT INTO room_platforms (room_id, platform_id) VALUES (?, ?)", [roomId, pid]);
        });
      }

      // Коммуникации
      if (communications) {
        db.query("DELETE FROM room_communications WHERE room_id = ?", [roomId]);
        communications.forEach(comm => {
          db.query("INSERT INTO room_communications (room_id, method_id, link) VALUES (?, ?, ?)",
            [roomId, comm.method_id, comm.link]);
        });
      }

      res.json("Room updated");
    });
  });
});

// Получить участников комнаты
router.get("/rooms/:id/players", (req, res) => {
  db.query(
    `SELECT u.id, u.username, u.avatar 
     FROM room_players rp 
     JOIN users u ON rp.user_id = u.id 
     WHERE rp.room_id = ?`,
    [req.params.id],
    (err, result) => res.json(result)
  );
});

// Получить ВСЕ комнаты (включая закрытые) – для админа
router.get("/admin/rooms", auth, (req, res) => {
  if (req.user.role !== "admin") return res.sendStatus(403);
  db.query(
    `SELECT r.*, g.name AS game_name, u.username AS creator_name,
      (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) AS players_count
     FROM rooms r
     JOIN games g ON r.game_id = g.id
     JOIN users u ON r.creator_id = u.id
     ORDER BY r.created_at DESC`,
    (err, result) => res.json(result)
  );
});

// Полностью удалить комнату (админ)
router.delete("/rooms/:id/force", auth, (req, res) => {
  if (req.user.role !== "admin") return res.sendStatus(403);
  db.query("DELETE FROM rooms WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json("Room permanently deleted");
  });
});

// Получить платформы конкретной комнаты
router.get("/rooms/:id/platforms", (req, res) => {
  db.query(
    `SELECT p.id, p.name, p.icon FROM platforms p
     JOIN room_platforms rp ON p.id = rp.platform_id
     WHERE rp.room_id = ?`,
    [req.params.id],
    (err, result) => res.json(result)
  );
});
module.exports = router;