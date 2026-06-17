const API_BASE = '';

let currentUser = null;
let authToken = null;

// Восстановление сессии из localStorage
if (localStorage.getItem('authToken')) {
  authToken = localStorage.getItem('authToken');
  try {
    const payload = JSON.parse(atob(authToken.split('.')[1]));
    currentUser = { id: payload.id, role: payload.role, username: 'User' };
  } catch (e) {}
}

function imageUrl(path) {
  if (!path) return 'https://via.placeholder.com/150';
  if (path.startsWith('http')) return path;
  return API_BASE + '/uploads/' + path;
}

// Универсальная функция запросов 
async function api(url, method = 'GET', body = null, isFormData = false) {
  const headers = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (authToken) headers['Authorization'] = authToken;

  const options = { method, headers };
  if (body) options.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(`${API_BASE}${url}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Ошибка ${res.status}`);
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) return await res.json();
  return null;
}

//  Навигация 
function updateNav() {
  document.getElementById('navProfile')?.classList.toggle('hidden', !currentUser);
  const navLogin = document.getElementById('navLogin');
  const navRegister = document.getElementById('navRegister');
  const navAdmin = document.getElementById('navAdmin');
  const btnLogout = document.getElementById('btnLogout');
  if (currentUser) {
    navLogin.classList.add('hidden');
    navRegister.classList.add('hidden');
    btnLogout.classList.remove('hidden');
    navAdmin.classList.toggle('hidden', currentUser.role !== 'admin');
  } else {
    navLogin.classList.remove('hidden');
    navRegister.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    navAdmin.classList.add('hidden');
  }
}

function logout() {
  localStorage.removeItem('authToken');
  authToken = null;
  currentUser = null;
  updateNav();
  window.location.hash = '#home';
}

document.getElementById('btnLogout').addEventListener('click', logout);
updateNav();

//  Роутинг 
window.addEventListener('hashchange', renderPage);
window.addEventListener('load', renderPage);

function renderPage() {
  const hash = window.location.hash.slice(1) || 'home';
  const app = document.getElementById('app');
  app.innerHTML = '';
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  const activeLink = document.querySelector(`nav a[href="#${hash.split('/')[0]}"]`);
  if (activeLink) activeLink.classList.add('active');

  if (hash === 'home') renderHome(app);
  else if (hash.startsWith('post/')) renderPost(app, hash.split('/')[1]);
  else if (hash === 'login') renderLogin(app);
  else if (hash === 'register') renderRegister(app);
  else if (hash === 'profile') renderProfile(app, null);
  else if (hash.startsWith('profile/')) renderProfile(app, hash.split('/')[1]);
  else if (hash === 'admin') renderAdmin(app);
  else if (hash === 'lobby') renderLobby(app);
  else app.innerHTML = '<h2>Страница не найдена</h2>';
}

//  Главная страница (список новостей) 
async function renderHome(container) {
  container.innerHTML = '<h2>Новости клуба</h2><div id="postsList">Загрузка...</div>';
  try {
    const posts = await api('/posts');
    const list = document.getElementById('postsList');
    if (!posts || posts.length === 0) {
      list.innerHTML = '<p>Пока нет новостей.</p>';
      return;
    }
    list.innerHTML = posts.map(p => {
      const imageHtml = p.image
        ? `<img src="${imageUrl(p.image)}" style="max-width:100%; border-radius:8px; margin-bottom:1rem;" alt="Изображение">`
        : '';
      return `
        <div class="card">
          ${imageHtml}
          <a href="#post/${p.id}" class="post-title">${escapeHtml(p.title)}</a>
          <div class="post-meta" style="display:flex; align-items:center; gap:8px;">
          <a href="#profile/${p.author_id}" style="display:flex; align-items:center; gap:8px; text-decoration:none; color:inherit;"> 
          ${p.author_avatar ? `<img src="${imageUrl(p.author_avatar)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : '<div style="width:24px;height:24px;border-radius:50%;background:var(--border);"></div>'}
          <span>${escapeHtml(p.author_name || 'Автор #' + p.author_id)}</span>
          </a>
          <span>• ${new Date(p.created_at).toLocaleString()}</span>
          </div>
          <p>${escapeHtml(p.content.substring(0, 200))}${p.content.length > 200 ? '...' : ''}</p>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML += `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}

//  Страница одной новости + комментарии 
async function renderPost(container, postId) {
  container.innerHTML = '<p>Загрузка...</p>';
  try {
    // Параллельная загрузка поста и тегов
    const [post, tags] = await Promise.all([
      api(`/posts/${postId}`),
      api(`/posts/${postId}/tags`)
    ]);
    
    if (!post) throw new Error("Новость не найдена");

    const imageHtml = post.image
      ? `<img src="${imageUrl(post.image)}" style="max-width:100%; border-radius:12px; margin-bottom:1.5rem;" alt="Изображение">`
      : '';
    const tagsHtml = tags && tags.length
      ? `<div class="tags" style="margin-bottom:1rem;">${tags.map(t => `<span class="tag" style="background:var(--primary); padding:2px 8px; border-radius:4px; margin-right:6px;">${escapeHtml(t.name)}</span>`).join('')}</div>`
      : '';
    container.innerHTML = `
      <div class="card">
        ${imageHtml}
        <h2>${escapeHtml(post.title)}</h2>
        ${tagsHtml}
        <div class="post-meta" style="display:flex; align-items:center; gap:8px;"> 
        <a href="#profile/${post.author_id}" style="display:flex; align-items:center; gap:8px; text-decoration:none; color:inherit;">
          ${post.author_avatar ? `<img src="${imageUrl(post.author_avatar)}" style="width:24px;height:24px;border-radius:50%;">` : ''}
          <span>Автор: ${escapeHtml(post.author_name || 'Автор #' + post.author_id)}</span>
        </a>
        <span>• ${new Date(post.created_at).toLocaleString()}</span>
        </div>
        <p style="white-space: pre-wrap;">${escapeHtml(post.content)}</p>
      </div>
      <div class="comments-section">
        <h3>Комментарии</h3>
        <div id="commentsList">Загрузка...</div>
        ${currentUser ? `
          <form id="commentForm" style="margin-top:1rem;">
            <textarea id="commentContent" placeholder="Ваш комментарий..." required></textarea>
            <button type="submit" class="btn-primary">Отправить</button>
          </form>
        ` : '<p><a href="#login">Войдите</a>, чтобы оставить комментарий.</p>'}
      </div>
    `;
    loadComments(postId);
    document.getElementById('commentForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = document.getElementById('commentContent').value.trim();
      if (!content) return;
      try {
        await api('/comments', 'POST', { content, post_id: postId });
        document.getElementById('commentContent').value = '';
        loadComments(postId);
      } catch (err) { alert('Ошибка: ' + err.message); }
    });
  } catch (err) {
    container.innerHTML = `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}

async function loadComments(postId) {
  const list = document.getElementById('commentsList');
  if (!list) return;
  try {
    const comments = await api(`/comments/${postId}`);
    if (!comments || comments.length === 0) {
      list.innerHTML = '<p>Комментариев пока нет.</p>';
      return;
    }
    list.innerHTML = comments.map(c => `
      <div class="comment" data-id="${c.id}">
        <div class="comment-header">
          <div style="display:flex; align-items:center; gap:8px;">
          <a href="#profile/${c.user_id}" style="display:flex; align-items:center; gap:8px; text-decoration:none; color:inherit;">
          ${c.avatar ? `<img src="${imageUrl(c.avatar)}" style="width:20px;height:20px;border-radius:50%;">` : '<div style="width:20px;height:20px;border-radius:50%;background:var(--border);"></div>'}
          <strong>${escapeHtml(c.username || 'User #' + c.user_id)}</strong>
          </a>
          </div>
          <span>${new Date(c.created_at).toLocaleString()}</span>
        </div>
        <div class="comment-content">${escapeHtml(c.content)}</div>
        ${(currentUser && (currentUser.id === c.user_id || currentUser.role === 'admin')) ? `
          <div class="comment-actions">
            <button class="edit-comment" data-id="${c.id}">✏️</button>
            <button class="delete-comment" data-id="${c.id}">🗑️</button>
          </div>` : ''}
      </div>
    `).join('');

    list.querySelectorAll('.delete-comment').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить комментарий?')) return;
        await api(`/comments/${btn.dataset.id}`, 'DELETE');
        loadComments(postId);
      });
    });
    list.querySelectorAll('.edit-comment').forEach(btn => {
      btn.addEventListener('click', async () => {
        const commentDiv = btn.closest('.comment');
        const contentDiv = commentDiv.querySelector('.comment-content');
        const oldContent = contentDiv.textContent;
        const textarea = document.createElement('textarea');
        textarea.value = oldContent;
        contentDiv.replaceWith(textarea);
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Сохранить';
        saveBtn.className = 'btn-primary';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Отмена';
        cancelBtn.className = 'btn-secondary';
        commentDiv.querySelector('.comment-actions').innerHTML = '';
        commentDiv.querySelector('.comment-actions').append(saveBtn, cancelBtn);
        saveBtn.addEventListener('click', async () => {
          const newContent = textarea.value.trim();
          if (!newContent) return;
          await api(`/comments/${btn.dataset.id}`, 'PUT', { content: newContent });
          loadComments(postId);
        });
        cancelBtn.addEventListener('click', () => loadComments(postId));
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="error-message">Ошибка загрузки комментариев</p>`;
  }
}

//  Авторизация 
function renderLogin(container) {
  container.innerHTML = `
    <div class="card" style="max-width:400px;margin:2rem auto;">
      <h2>Вход</h2>
      <form id="loginForm">
        <input type="email" id="loginEmail" placeholder="Email" required>
        <input type="password" id="loginPassword" placeholder="Пароль" required>
        <button type="submit" class="btn-primary" style="width:100%">Войти</button>
      </form>
      <p style="text-align:center;margin-top:1rem;">Нет аккаунта? <a href="#register">Зарегистрироваться</a></p>
      <div id="loginError" class="error-message"></div>
    </div>
  `;
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
      const data = await api('/auth/login', 'POST', { email, password });
      authToken = data.token;
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      currentUser = { id: payload.id, role: payload.role };
      localStorage.setItem('authToken', authToken);
      updateNav();
      window.location.hash = '#home';
    } catch (err) {
      document.getElementById('loginError').textContent = err.message;
    }
  });
}

async function renderProfile(container, userId) {
  const isOwn = !userId || (currentUser && userId == currentUser.id);

  container.innerHTML = '<p>Загрузка...</p>';
  try {
    let user;
    if (isOwn) {
      user = await api('/auth/profile'); // свой полный профиль
    } else {
      user = await api(`/users/${userId}`); // публичный профиль (теперь с email и role)
    }

    const avatarUrl = imageUrl(user.avatar);

    container.innerHTML = `
      <div class="card" style="max-width:500px;margin:2rem auto;">
        <div style="text-align:center;">
          <img id="profileAvatarImg" src="${avatarUrl}" 
               style="width:150px;height:150px;border-radius:50%;object-fit:cover;margin-bottom:1rem;">
          <h3>${escapeHtml(user.username)}</h3>
          <p style="color:var(--text-muted);">Email: ${escapeHtml(user.email)}</p>
          <p style="color:var(--text-muted);">ID: ${user.id}</p>
          <p style="color:var(--text-muted);">Роль: ${user.role === 'admin' ? 'Администратор' : 'Пользователь'}</p>
          ${user.created_at ? `<p style="color:var(--text-muted);">На сайте с ${new Date(user.created_at).toLocaleDateString()}</p>` : ''}
          ${isOwn ? `
            <div id="profileActions" style="margin-top:1rem;">
              <button id="btnEditProfile" class="btn-primary">Редактировать</button>
            </div>
            <div id="editProfileForm" class="hidden" style="margin-top:1rem;"></div>
          ` : ''}
        </div>
      </div>
    `;

    if (isOwn) {
      document.getElementById('btnEditProfile').addEventListener('click', () => {
        showEditProfileForm(user);
      });
    }
  } catch (err) {
    container.innerHTML = `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}


function showEditProfileForm(user) {
  const formDiv = document.getElementById('editProfileForm');
  formDiv.classList.remove('hidden');
  formDiv.innerHTML = `
    <hr style="margin:1.5rem 0; border-color: var(--border);">
    <form id="profileForm">
      <input type="text" id="profileUsername" value="${escapeHtml(user.username)}" required>
      <input type="email" id="profileEmail" value="${escapeHtml(user.email || '')}" required>
      <button type="submit" class="btn-primary" style="width:100%">Сохранить изменения</button>
    </form>
    <hr style="margin:1.5rem 0; border-color: var(--border);">
    <h4>Сменить пароль</h4>
    <form id="passwordForm">
      <input type="password" id="oldPassword" placeholder="Старый пароль" required>
      <input type="password" id="newPassword" placeholder="Новый пароль" required>
      <button type="submit" class="btn-primary" style="width:100%">Сменить пароль</button>
    </form>
    <div style="margin-top:1rem;">
      <label class="btn-primary" style="cursor:pointer;display:inline-block;margin-right:10px;">
        Загрузить аватар
        <input type="file" id="avatarInput" accept="image/*" hidden>
      </label>
      <button id="btnRemoveAvatar" class="btn-danger" ${!user.avatar ? 'disabled' : ''}>Удалить аватар</button>
    </div>
  `;

// Загрузка аватара
document.getElementById('avatarInput')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await fetch(`${API_BASE}/auth/profile/avatar`, {
    method: 'PUT',
    headers: { 'Authorization': authToken },
    body: formData
  });
  if (res.ok) {
    const data = await res.json();
    const avatarImg = document.getElementById('profileAvatarImg');
    if (avatarImg) avatarImg.src = imageUrl(data.avatar);
    document.getElementById('btnRemoveAvatar').disabled = false;
  } else {
    alert('Ошибка загрузки');
  }
});

// Удаление аватара
document.getElementById('btnRemoveAvatar')?.addEventListener('click', async () => {
  if (!confirm('Удалить аватар?')) return;
  const res = await fetch(`${API_BASE}/auth/profile/avatar`, {
    method: 'DELETE',
    headers: { 'Authorization': authToken }
  });
  if (res.ok) {
    const avatarImg = document.getElementById('profileAvatarImg');
    if (avatarImg) avatarImg.src = 'https://via.placeholder.com/150';
    document.getElementById('btnRemoveAvatar').disabled = true;
  } else {
    alert('Ошибка удаления');
  }
});

  document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('profileUsername').value.trim();
    const email = document.getElementById('profileEmail').value.trim();
    try {
      await api('/auth/profile', 'PUT', { username, email });
      alert('Профиль обновлён');
      // Обновляем отображаемое имя на странице
      document.querySelector('#editProfileForm').previousElementSibling.querySelector('h3').textContent = username;
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  });

  document.getElementById('passwordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    try {
      await api('/auth/profile/password', 'PUT', { oldPassword, newPassword });
      alert('Пароль изменён');
      document.getElementById('passwordForm').reset();
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  });
}

function renderRegister(container) {
  container.innerHTML = `
    <div class="card" style="max-width:400px;margin:2rem auto;">
      <h2>Регистрация</h2>
      <form id="registerForm">
        <input type="text" id="regUsername" placeholder="Логин" required>
        <input type="email" id="regEmail" placeholder="Email" required>
        <input type="password" id="regPassword" placeholder="Пароль" required>
        <button type="submit" class="btn-primary" style="width:100%">Зарегистрироваться</button>
      </form>
      <p style="text-align:center;margin-top:1rem;">Уже есть аккаунт? <a href="#login">Войти</a></p>
      <div id="regError" class="error-message"></div>
    </div>
  `;
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    try {
      await api('/auth/register', 'POST', { username, email, password });
      alert('Регистрация успешна! Теперь войдите.');
      window.location.hash = '#login';
    } catch (err) {
      document.getElementById('regError').textContent = err.message;
    }
  });
}

// Админ-панель 
function renderAdmin(container) {
  if (!currentUser || currentUser.role !== 'admin') {
    container.innerHTML = '<h2>Доступ запрещён</h2>';
    return;
  }
  container.innerHTML = `
    <h2>Панель администратора</h2>
    <div class="admin-tabs">
      <div class="admin-tab active" data-tab="users">Пользователи</div>
      <div class="admin-tab" data-tab="posts">Новости</div>
      <div class="admin-tab" data-tab="tags">Теги</div>
      <div class="admin-tab" data-tab="lobby">Лобби</div>
    </div>
    <div id="adminContent"></div>
  `;
  const tabs = container.querySelectorAll('.admin-tab');
  const contentDiv = document.getElementById('adminContent');
  function switchTab(tab) {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const tabName = tab.dataset.tab;
    if (tabName === 'users') loadAdminUsers(contentDiv);
    else if (tabName === 'posts') loadAdminPosts(contentDiv);
    else if (tabName === 'tags') loadAdminTags(contentDiv);
    else if (tabName === 'lobby') {
      if (typeof loadAdminLobby === 'function') {
        loadAdminLobby(contentDiv);
      } else {
        contentDiv.innerHTML = '<p>Модуль лобби не загружен</p>';
      }
    }
  }
  tabs.forEach(t => t.addEventListener('click', () => switchTab(t)));
  switchTab(tabs[0]);
}

async function loadAdminUsers(container) {
  container.innerHTML = '<p>Загрузка...</p>';
  try {
    const users = await api('/admin/users');
    container.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <tr><th>ID</th><th>Имя</th><th>Email</th><th>Роль</th><th>Действия</th></tr>
        ${users.map(u => `
          <tr>
            <td>${u.id}</td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.email)}</td><td>${u.role}</td>
            <td>
              <select class="roleSelect" data-id="${u.id}">
                <option value="user" ${u.role==='user'?'selected':''}>user</option>
                <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
              </select>
              <button class="btn-danger delete-user" data-id="${u.id}">Удалить</button>
            </td>
          </tr>
        `).join('')}
      </table>
    `;
    container.querySelectorAll('.delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить пользователя?')) return;
        await api(`/admin/users/${btn.dataset.id}`, 'DELETE');
        loadAdminUsers(container);
      });
    });
    container.querySelectorAll('.roleSelect').forEach(sel => {
      sel.addEventListener('change', async () => {
        await api(`/admin/users/${sel.dataset.id}`, 'PATCH', { role: sel.value });
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}

//  Управление постами (с картинками и тегами) 
async function loadAdminPosts(container) {
  container.innerHTML = '<p>Загрузка...</p>';
  try {
    const posts = await api('/posts');
    container.innerHTML = `
      <button id="btnCreatePost" class="btn-primary" style="margin-bottom:1rem;">+ Создать новость</button>
      <div id="postFormContainer" class="hidden"></div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><th>ID</th><th>Заголовок</th><th>Автор</th><th>Действия</th></tr>
        ${posts.map(p => `
          <tr>
            <td>${p.id}</td><td>${escapeHtml(p.title)}</td><td>${escapeHtml(p.author_name || 'Автор #' + p.author_id)}</td>
            <td><button class="btn-danger delete-post" data-id="${p.id}">Удалить</button></td>
          </tr>
        `).join('')}
      </table>
    `;
    container.querySelectorAll('.delete-post').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить новость?')) return;
        await api(`/posts/${btn.dataset.id}`, 'DELETE');
        loadAdminPosts(container);
      });
    });

    // Показать/скрыть форму создания
    document.getElementById('btnCreatePost').addEventListener('click', () => {
      const formDiv = document.getElementById('postFormContainer');
      formDiv.classList.toggle('hidden');
      formDiv.innerHTML = `
        <form id="createPostForm" enctype="multipart/form-data">
          <input type="text" id="postTitle" placeholder="Заголовок" required>
          <textarea id="postContent" placeholder="Текст новости" required></textarea>
          <input type="file" id="postImage" accept="image/*">
          <div id="tagsSelection">
            <p>Теги:</p>
            <div id="tagsCheckboxes">Загрузка тегов...</div>
          </div>
          <button type="submit" class="btn-primary">Опубликовать</button>
          <button type="button" class="btn-secondary cancel-form">Отмена</button>
        </form>
      `;
      formDiv.querySelector('.cancel-form').addEventListener('click', () => formDiv.classList.add('hidden'));

      // Загружаем теги и вставляем чекбоксы
      loadTagsForForm();

      // Единственный обработчик отправки формы
      document.getElementById('createPostForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;
        const imageFile = document.getElementById('postImage').files[0];

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        if (imageFile) formData.append('image', imageFile);

        // Собираем выбранные теги
        const checkedTags = document.querySelectorAll('input[name="tags"]:checked');
        const tagIds = Array.from(checkedTags).map(cb => cb.value);
        if (tagIds.length > 0) {
          formData.append('tags', JSON.stringify(tagIds));
        }

        try {
          const res = await fetch(`${API_BASE}/posts`, {
            method: 'POST',
            headers: {
              'Authorization': authToken
            },
            body: formData
          });
          if (!res.ok) throw new Error(await res.text());
          formDiv.classList.add('hidden');
          loadAdminPosts(container);
        } catch (err) {
          alert('Ошибка: ' + err.message);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}

//  Загрузка тегов в форму создания поста 
async function loadTagsForForm() {
  const container = document.getElementById('tagsCheckboxes');
  if (!container) return;
  try {
    const tags = await api('/admin/tags');
    if (tags.length === 0) {
      container.innerHTML = '<p>Нет доступных тегов</p>';
      return;
    }
    container.innerHTML = tags.map(tag => `
      <label style="display: inline-block; margin-right: 12px;">
        <input type="checkbox" name="tags" value="${tag.id}"> ${escapeHtml(tag.name)}
      </label>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p>Ошибка загрузки тегов</p>';
  }
}

//  Управление тегами 
async function loadAdminTags(container) {
  container.innerHTML = '<p>Загрузка...</p>';
  try {
    const tags = await api('/admin/tags');
    container.innerHTML = `
      <form id="addTagForm" style="display:flex; gap:1rem; margin-bottom:1rem;">
        <input type="text" id="newTagName" placeholder="Название тега" required>
        <button type="submit" class="btn-primary">Добавить</button>
      </form>
      <ul>
        ${tags.map(t => `<li>${escapeHtml(t.name)} <button class="btn-danger delete-tag" data-id="${t.id}">Удалить</button></li>`).join('')}
      </ul>
    `;
    document.getElementById('addTagForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newTagName').value.trim();
      await api('/admin/tags', 'POST', { name });
      loadAdminTags(container);
    });
    container.querySelectorAll('.delete-tag').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(`/admin/tags/${btn.dataset.id}`, 'DELETE');
        loadAdminTags(container);
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="error-message">Ошибка: ${escapeHtml(err.message)}</p>`;
  }
}

// Гамбургер-меню
function initBurgerMenu() {
  const burgerBtn = document.getElementById('burgerBtn');
  const mainNav = document.getElementById('mainNav');
  const overlay = document.getElementById('overlay');

  if (!burgerBtn || !mainNav || !overlay) return;

  function openMenu() {
    mainNav.classList.add('show');
    overlay.classList.add('show');
  }

  function closeMenu() {
    mainNav.classList.remove('show');
    overlay.classList.remove('show');
  }

  burgerBtn.addEventListener('click', () => {
    if (mainNav.classList.contains('show')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay.addEventListener('click', closeMenu);
  mainNav.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('click', closeMenu);
  });
}

// Запускаем при загрузке
document.addEventListener('DOMContentLoaded', initBurgerMenu);

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}