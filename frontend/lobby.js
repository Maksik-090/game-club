let activeLobbyInterval = null;
let timerIntervals = [];
let currentDetailRoomId = null;

function clearAllLobbyTimers() {
  if (activeLobbyInterval) {
    clearInterval(activeLobbyInterval);
    activeLobbyInterval = null;
  }
  timerIntervals.forEach(id => clearInterval(id));
  timerIntervals = [];
}

//  ОТРИСОВКА СТРАНИЦЫ ЛОББИ 
async function renderLobby(container) {
  if (!currentUser) {
    window.location.hash = '#login';
    return;
  }

  clearAllLobbyTimers();
  currentDetailRoomId = null;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h2>Игровое лобби</h2>
      <button id="btnCreateRoom" class="btn-primary">＋ Создать комнату</button>
    </div>
    <div id="roomsList" style="margin-top:1rem;">Загрузка...</div>
    <div id="roomDetail" class="hidden" style="margin-top:2rem;"></div>
  `;

  document.getElementById('btnCreateRoom').addEventListener('click', () => showCreateRoomForm(container));
  loadRooms();

  activeLobbyInterval = setInterval(loadRooms, 30000);
}

//  ЗАГРУЗКА КОМНАТ 
async function loadRooms() {
  const list = document.getElementById('roomsList');
  if (!list) return;

  try {
    const rooms = await api('/lobbies/rooms');
    if (!rooms || rooms.length === 0) {
      list.innerHTML = '<p>Нет активных комнат</p>';
      return;
    }

    // Сортировка: сначала не закрытые, потом закрытые
    const sorted = rooms.sort((a, b) => {
      if (a.status === 'closed' && b.status !== 'closed') return 1;
      if (a.status !== 'closed' && b.status === 'closed') return -1;
      return 0;
    });

    list.innerHTML = sorted.map(room => {
      const statusText = {
        waiting: '⌛ Ожидание',
        full: '🟡 Заполнена',
        playing: '🎮 В игре',
        closed: '🔴 Закрыта'
      }[room.status] || room.status;

      const players = room.players || [];
      let slotsHtml = '';
      // Реальные аватарки всех участников
      players.forEach(p => {
        slotsHtml += `<img src="${p.avatar ? API_BASE + '/uploads/' + p.avatar : 'https://via.placeholder.com/32'}" 
        style="width:32px;height:32px;border-radius:50%;object-fit:cover;" title="${escapeHtml(p.username)}">`;
      });
      // Пустые слоты
      for (let i = players.length; i < room.max_slots; i++) {
        slotsHtml += `<div style="width:32px;height:32px;border-radius:50%;background:var(--border);display:inline-block;" title="Свободно"></div>`;
      }

      return `
        <div class="card" style="margin-bottom:1rem;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${room.game_cover ? `<img src="${API_BASE}/uploads/${room.game_cover}" style="width:64px;height:64px;border-radius:12px;object-fit:cover;">` : ''}
            <div style="flex:1;">
              <strong>${escapeHtml(room.game_name)}</strong>
              <div style="font-size:0.9rem; color:var(--text-muted);">
                Создал: ${escapeHtml(room.creator_name)} ·
                Участников: ${room.players_count}/${room.max_slots} ·
                ${statusText}
              </div>
              <div style="margin-top:4px;display:flex;gap:4px;">${slotsHtml}</div>
            </div>
            <div style="text-align:right;">
              <div id="timer-${room.id}" style="font-weight:bold; margin-bottom:4px;"></div>
              ${room.status === 'waiting' && room.creator_id !== currentUser.id ? 
                `<button class="btn-primary" onclick="joinRoom(${room.id})">Записаться</button>` : ''}
              <button class="btn-secondary" onclick="showRoomDetail(${room.id})">Описание</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    sorted.forEach(room => startRoomTimer(room));

  } catch (err) {
    list.innerHTML = `<p class="error-message">Ошибка загрузки: ${escapeHtml(err.message)}</p>`;
  }
}

//  ТАЙМЕР КОМНАТЫ 
function startRoomTimer(room) {
  const el = document.getElementById(`timer-${room.id}`);
  if (!el) return;

  const endTime = room.closed_at ? new Date(room.closed_at).getTime() : Date.now() + 5*3600*1000;

  function update() {
    const now = Date.now();
    const diff = endTime - now;
    if (diff <= 0) {
      el.textContent = 'Закрыта';
      clearInterval(interval);
      return;
    }
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    el.textContent = `${hours}ч ${mins}м`;
  }

  update();
  const interval = setInterval(update, 30000);
  timerIntervals.push(interval);
}

//  ДЕТАЛИ КОМНАТЫ 
async function showRoomDetail(roomId) {
  const detailDiv = document.getElementById('roomDetail');

  if (currentDetailRoomId === roomId) {
    detailDiv.classList.add('hidden');
    currentDetailRoomId = null;
    return;
  }

  detailDiv.classList.remove('hidden');
  currentDetailRoomId = roomId;
  detailDiv.innerHTML = '<p>Загрузка...</p>';

  try {
    const rooms = await api('/lobbies/rooms');
    const room = rooms.find(r => r.id == roomId);
    if (!room) throw new Error("Комната не найдена");

    const [players, platforms] = await Promise.all([
      api(`/lobbies/rooms/${roomId}/players`),
      api(`/lobbies/rooms/${roomId}/platforms`)
    ]);

    const statusText = {
      waiting: '⌛ Ожидание',
      full: '🟡 Заполнена',
      playing: '🎮 В игре',
      closed: '🔴 Закрыта'
    }[room.status] || room.status;

    const playersHtml = players.map(p => `
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
        <img src="${p.avatar ? API_BASE + '/uploads/' + p.avatar : 'https://via.placeholder.com/24'}" 
             style="width:24px;height:24px;border-radius:50%;">
        <span>${escapeHtml(p.username)}</span>
      </div>
    `).join('');

    const platformsHtml = platforms.map(p => 
      `<span title="${escapeHtml(p.name)}" style="font-size:1.5rem; margin-right:6px;">${p.icon || '🎮'}</span>`
    ).join('') || '—';

    const isCreator = room.creator_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    detailDiv.innerHTML = `
      <div class="card">
        <h3>${escapeHtml(room.game_name)}</h3>
        <p><strong>Создатель:</strong> ${escapeHtml(room.creator_name)}</p>
        <p><strong>Платформы:</strong> ${platformsHtml}</p>
        <p><strong>Участники (${players.length}/${room.max_slots}):</strong></p>
        <div style="margin-bottom:1rem;">${playersHtml}</div>
        <p><strong>Статус:</strong> ${statusText}</p>
        <p><strong>Комментарий:</strong> ${escapeHtml(room.comment || '—')}</p>
        <p><strong>Время до закрытия:</strong> <span id="detailTimer-${room.id}"></span> (закрытие в: ${new Date(room.closed_at).toLocaleString('ru-RU', { hour12: false })})</p>
        <div style="margin-top:1rem;">
          ${room.status === 'waiting' && !isCreator ? `<button class="btn-primary" onclick="joinRoom(${room.id})">Записаться</button>` : ''}
          ${isCreator || isAdmin ? `<button class="btn-secondary" onclick="closeRoom(${room.id})">${room.status === 'closed' ? 'Удалить' : 'Закрыть'}</button>` : ''}
          ${currentUser.id !== room.creator_id && players.some(p => p.id === currentUser.id) ? 
            `<button class="btn-secondary" onclick="leaveRoom(${room.id})">Выйти</button>` : ''}
        </div>
      </div>
    `;

    // Таймер для деталей
    startRoomTimer(room);
    const timerEl = document.getElementById(`detailTimer-${room.id}`);
    if (timerEl) timerEl.id = `timer-${room.id}`;

  } catch (err) {
    detailDiv.innerHTML = `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}

//  СОЗДАНИЕ КОМНАТЫ 
async function showCreateRoomForm(container) {
  const detailDiv = document.getElementById('roomDetail');
  detailDiv.classList.remove('hidden');
  currentDetailRoomId = null;

  try {
    const [games, platforms, communications] = await Promise.all([
      api('/admin/lobbies/games'),
      api('/admin/lobbies/platforms'),
      api('/admin/lobbies/communications')
    ]);

    detailDiv.innerHTML = `
      <div class="card">
        <h3>Создание комнаты</h3>
        <form id="createRoomForm">
          <select id="roomGame" required>
            <option value="">Выберите игру</option>
            ${games.map(g => `<option value="${g.id}" data-max="${g.max_players}">${escapeHtml(g.name)} (макс. ${g.max_players})</option>`).join('')}
          </select>
          <input type="number" id="roomSlots" placeholder="Количество игроков" min="2" required>

          <fieldset>
            <legend>Платформы</legend>
            ${platforms.map(p => `
              <label><input type="checkbox" name="platforms" value="${p.id}"> ${escapeHtml(p.name)}</label><br>
            `).join('')}
          </fieldset>

          <fieldset>
            <legend>Способы коммуникации</legend>
            ${communications.map(c => `
              <label>
                <input type="checkbox" name="comm_${c.id}" value="${c.id}"> ${escapeHtml(c.name)}
              </label>
              <input type="text" name="comm_link_${c.id}" placeholder="Ссылка" style="width:200px; margin-left:10px;"><br>
            `).join('')}
          </fieldset>

          <input type="datetime-local" id="roomStartTime">
          <textarea id="roomComment" placeholder="Дополнительный комментарий"></textarea>

          <button type="submit" class="btn-primary">Создать</button>
          <button type="button" class="btn-secondary" onclick="document.getElementById('roomDetail').classList.add('hidden')">Отмена</button>
        </form>
      </div>
    `;

    const gameSelect = document.getElementById('roomGame');
    const slotsInput = document.getElementById('roomSlots');
    gameSelect.addEventListener('change', () => {
      const max = gameSelect.selectedOptions[0]?.dataset.max;
      if (max) {
        slotsInput.max = max;
        if (parseInt(slotsInput.value) > parseInt(max)) slotsInput.value = max;
      }
    });

    document.getElementById('createRoomForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const gameId = gameSelect.value;
      const slots = parseInt(slotsInput.value);
      const maxSlots = parseInt(gameSelect.selectedOptions[0]?.dataset.max) || 10;
      if (slots > maxSlots) { alert(`Максимум игроков: ${maxSlots}`); return; }
      if (slots < 2) { alert('Минимум 2 игрока'); return; }

      const startTime = document.getElementById('roomStartTime').value || null;
      const comment = document.getElementById('roomComment').value;
      const selectedPlatforms = Array.from(document.querySelectorAll('input[name="platforms"]:checked')).map(cb => cb.value);
      const comms = [];
      communications.forEach(c => {
        const cb = document.querySelector(`input[name="comm_${c.id}"]:checked`);
        if (cb) {
          const link = document.querySelector(`input[name="comm_link_${c.id}"]`).value.trim();
          if (!link) return alert(`Укажите ссылку для ${c.name}`);
          comms.push({ method_id: c.id, link });
        }
      });

      try {
        await api('/lobbies/rooms', 'POST', {
          game_id: gameId, max_slots: slots, start_time: startTime,
          comment, platforms: selectedPlatforms, communications: comms
        });
        detailDiv.classList.add('hidden');
        loadRooms();
      } catch (err) { alert('Ошибка: ' + err.message); }
    });
  } catch (err) {
    detailDiv.innerHTML = `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}

//  ЗАПИСАТЬСЯ / ВЫЙТИ 
async function joinRoom(roomId) {
  try {
    await api(`/lobbies/rooms/${roomId}/join`, 'POST');
    if (currentDetailRoomId === roomId) {
      document.getElementById('roomDetail').classList.add('hidden');
      currentDetailRoomId = null;
    }
    // Обновляем список
    await loadRooms();
  } catch (err) {
    alert(err.message);
  }
}

async function leaveRoom(roomId) {
  try {
    await api(`/lobbies/rooms/${roomId}/leave`, 'DELETE');
    if (currentDetailRoomId === roomId) {
      document.getElementById('roomDetail').classList.add('hidden');
      currentDetailRoomId = null;
    }
    await loadRooms();
  } catch (err) {
    alert(err.message);
  }
}

//  ЗАКРЫТЬ / УДАЛИТЬ КОМНАТУ 
async function closeRoom(roomId) {
  try {
    const rooms = await api('/lobbies/rooms');
    const room = rooms.find(r => r.id == roomId);
    if (!room) return;

    if (room.status === 'closed') {
      if (!confirm('Удалить комнату навсегда?')) return;
      await api(`/lobbies/rooms/${roomId}/force`, 'DELETE');
    } else {
      if (!confirm('Закрыть комнату?')) return;
      await api(`/lobbies/rooms/${roomId}`, 'DELETE'); // обычное закрытие
    }

    if (currentDetailRoomId === roomId) {
      document.getElementById('roomDetail').classList.add('hidden');
      currentDetailRoomId = null;
    }
    await loadRooms();
  } catch (err) {
    alert(err.message);
  }
}