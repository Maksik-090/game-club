const API = "http://localhost:3000";

async function loadPosts() {
  const res = await fetch(API + "/posts");
  const posts = await res.json();

  const container = document.getElementById("posts");
  container.innerHTML = "";

  posts.forEach(p => {
    const div = document.createElement("div");
    div.className = "post";

    div.innerHTML = `
      <h3>${p.title}</h3>
      <p>${p.content}</p>
      <a href="${p.link}" target="_blank" onclick="clickPost(${p.id})">Перейти</a>
    `;

    viewPost(p.id);
    container.appendChild(div);
  });
}

async function addPost() {
  await fetch(API + "/posts", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      title: title.value,
      content: content.value,
      link: link.value
    })
  });

  loadPosts();
}

function viewPost(id) {
  fetch(API + "/view/" + id, { method: "POST" });
}

function clickPost(id) {
  fetch(API + "/click/" + id, { method: "POST" });
}

loadPosts();