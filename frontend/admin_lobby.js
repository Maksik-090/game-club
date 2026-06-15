//Лобби
async function loadAdminLobby(container) {
  container.innerHTML = `
    <h3>Управление лобби</h3>
    <div class="admin-tabs" style="margin-bottom:1rem;">
    <button class="admin-tab active" data-subtab="games">Игры</button>
    <button class="admin-tab" data-subtab="platforms">Платформы</button>
    <button class="admin-tab" data-subtab="communications">Связь</button>
    <button class="admin-tab" data-subtab="rooms">Комнаты</button>
    </div>
    <div id="lobbySubContent"></div>
  `;

  const tabs = container.querySelectorAll('.admin-tab');
  const subContent = document.getElementById('lobbySubContent');

  function switchSubTab(tab) {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const subtab = tab.dataset.subtab;
    if (subtab === 'games') loadAdminGames(subContent);
    else if (subtab === 'platforms') loadAdminPlatforms(subContent);
    else if (subtab === 'communications') loadAdminCommunications(subContent);
    else if (subtab === 'rooms') loadAdminRooms(subContent);
  }

  tabs.forEach(tab => tab.addEventListener('click', () => switchSubTab(tab)));
  switchSubTab(tabs[0]);
}

//  ИГРЫ 
async function loadAdminGames(container) {
  container.innerHTML = '<p>Загрузка игр...</p>';
  try {
    const games = await api('/admin/lobbies/games');
    container.innerHTML = `
      <button id="btnAddGame" class="btn-primary" style="margin-bottom:1rem;">+ Добавить игру</button>
      <div id="gameFormContainer" class="hidden"></div>
      <table style="width:100%; border-collapse:collapse;">
        <tr><th>ID</th><th>Название</th><th>Обложка</th><th>Макс. игроков</th><th>Действия</th></tr>
        ${games.map(g => `
          <tr>
            <td>${g.id}</td>
            <td>${escapeHtml(g.name)}</td>
            <td>${g.cover ? `<img src="${API_BASE}/uploads/${g.cover}" style="width:40px;height:40px;object-fit:cover;">` : '—'}</td>
            <td>${g.max_players}</td>
            <td>
              <button class="btn-secondary edit-game" data-id="${g.id}">✏️</button>
              <button class="btn-danger delete-game" data-id="${g.id}">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </table>
    `;

    // Добавление
    document.getElementById('btnAddGame').addEventListener('click', () => showGameForm(container, null));
    // Редактирование
    container.querySelectorAll('.edit-game').forEach(btn => {
      btn.addEventListener('click', () => showGameForm(container, btn.dataset.id));
    });
    // Удаление
    container.querySelectorAll('.delete-game').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить игру?')) return;
        await api(`/admin/lobbies/games/${btn.dataset.id}`, 'DELETE');
        loadAdminGames(container);
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}

function showGameForm(container, gameId) {
  const formDiv = document.getElementById('gameFormContainer');
  formDiv.classList.remove('hidden');
  const isEdit = gameId !== null;

  // Если редактирование – загрузить данные игры
  if (isEdit) {
    api(`/admin/lobbies/games`).then(games => {
      const game = games.find(g => g.id == gameId);
      if (game) renderForm(game);
    });
  } else {
    renderForm(null);
  }

  function renderForm(game) {
    formDiv.innerHTML = `
      <form id="gameForm" enctype="multipart/form-data" style="max-width:500px;">
        <input type="text" id="gameName" placeholder="Название игры" value="${game ? escapeHtml(game.name) : ''}" required>
        <input type="number" id="gameMaxPlayers" placeholder="Максимум игроков" value="${game ? game.max_players : '10'}" min="2">
        <input type="file" id="gameCover" accept="image/*">
        ${game && game.cover ? `<p>Текущая обложка: ${game.cover}</p>` : ''}
        <button type="submit" class="btn-primary">${isEdit ? 'Сохранить' : 'Добавить'}</button>
        <button type="button" class="btn-secondary cancel-form">Отмена</button>
      </form>
    `;
    formDiv.querySelector('.cancel-form').addEventListener('click', () => formDiv.classList.add('hidden'));

    document.getElementById('gameForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('gameName').value.trim();
      const max_players = document.getElementById('gameMaxPlayers').value;
      const coverFile = document.getElementById('gameCover').files[0];

      const formData = new FormData();
      formData.append('name', name);
      formData.append('max_players', max_players);
      if (coverFile) formData.append('cover', coverFile);

      try {
        const url = isEdit ? `/admin/lobbies/games/${gameId}` : '/admin/lobbies/games';
        const method = isEdit ? 'PUT' : 'POST';
        const res = await fetch(`${API_BASE}${url}`, {
          method,
          headers: { 'Authorization': authToken },
          body: formData
        });
        if (!res.ok) throw new Error(await res.text());
        formDiv.classList.add('hidden');
        loadAdminGames(container);
      } catch (err) {
        alert('Ошибка: ' + err.message);
      }
    });
  }
}

//  ПЛАТФОРМЫ 
async function loadAdminPlatforms(container) {
  container.innerHTML = '<p>Загрузка платформ...</p>';
  try {
    const platforms = await api('/admin/lobbies/platforms');
    container.innerHTML = `
      <form id="platformForm" style="display:flex; gap:1rem; margin-bottom:1rem;">
        <input type="text" id="platformName" placeholder="Название платформы" required>
        <input type="text" id="platformIcon" placeholder="Иконка (текст или emoji)">
        <button type="submit" class="btn-primary">Добавить</button>
      </form>
      <ul>
        ${platforms.map(p => `
          <li>${escapeHtml(p.name)} ${p.icon ? `(${p.icon})` : ''} 
            <button class="btn-danger delete-platform" data-id="${p.id}">Удалить</button>
          </li>
        `).join('')}
      </ul>
    `;
    document.getElementById('platformForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('platformName').value.trim();
      const icon = document.getElementById('platformIcon').value.trim();
      await api('/admin/lobbies/platforms', 'POST', { name, icon: icon || null });
      loadAdminPlatforms(container);
    });
    container.querySelectorAll('.delete-platform').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(`/admin/lobbies/platforms/${btn.dataset.id}`, 'DELETE');
        loadAdminPlatforms(container);
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}

//  СПОСОБЫ СВЯЗИ 
async function loadAdminCommunications(container) {
  container.innerHTML = '<p>Загрузка способов связи...</p>';
  try {
    const comms = await api('/admin/lobbies/communications');
    container.innerHTML = `
      <form id="commForm" style="display:flex; gap:1rem; margin-bottom:1rem;">
        <input type="text" id="commName" placeholder="Название (Discord, Telegram...)" required>
        <button type="submit" class="btn-primary">Добавить</button>
      </form>
      <ul>
        ${comms.map(c => `
          <li>${escapeHtml(c.name)} 
            <button class="btn-danger delete-comm" data-id="${c.id}">Удалить</button>
          </li>
        `).join('')}
      </ul>
    `;
    document.getElementById('commForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('commName').value.trim();
      await api('/admin/lobbies/communications', 'POST', { name });
      loadAdminCommunications(container);
    });
    container.querySelectorAll('.delete-comm').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(`/admin/lobbies/communications/${btn.dataset.id}`, 'DELETE');
        loadAdminCommunications(container);
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}


async function loadAdminRooms(container) {
  container.innerHTML = '<p>Загрузка комнат...</p>';
  try {
    const rooms = await api('/lobbies/admin/rooms');
    if (!rooms.length) {
      container.innerHTML = '<p>Нет комнат</p>';
      return;
    }
    container.innerHTML = `
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <th>ID</th><th>Игра</th><th>Создатель</th>
          <th>Участники</th><th>Статус</th><th>Действия</th>
        </tr>
        ${rooms.map(r => `
          <tr>
            <td>${r.id}</td>
            <td>${escapeHtml(r.game_name)}</td>
            <td>${escapeHtml(r.creator_name)}</td>
            <td>${r.players_count}/${r.max_slots}</td>
            <td>${escapeHtml(r.status)}</td>
            <td>
              ${r.status !== 'closed' ? 
                `<button class="btn-secondary close-room" data-id="${r.id}">Закрыть</button>` : ''}
              <button class="btn-danger force-delete-room" data-id="${r.id}">Удалить</button>
            </td>
          </tr>
        `).join('')}
      </table>
    `;

    // Закрыть (перевести в closed)
    container.querySelectorAll('.close-room').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Закрыть комнату?')) return;
        try {
          await api(`/lobbies/rooms/${btn.dataset.id}`, 'DELETE'); // обычное закрытие
          loadAdminRooms(container);
        } catch (err) {
          alert('Ошибка: ' + err.message);
        }
      });
    });

    // Полностью удалить
    container.querySelectorAll('.force-delete-room').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить комнату безвозвратно?')) return;
        try {
          await api(`/lobbies/rooms/${btn.dataset.id}/force`, 'DELETE');
          loadAdminRooms(container);
        } catch (err) {
          alert('Ошибка: ' + err.message);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}