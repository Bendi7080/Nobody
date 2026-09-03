"use strict";

const API = "/api";

const state = {
  token: localStorage.getItem("nobody_token") || "",
  user: null,
  currentPage: "home",
  currentChat: null,
  posts: [],
  conversations: [],
  theme: localStorage.getItem("nobody_theme") || "system",
  authMode: "login"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function setToken(token) {
  state.token = token || "";

  if (token) {
    localStorage.setItem("nobody_token", token);
  } else {
    localStorage.removeItem("nobody_token");
  }
}

async function api(endpoint, options = {}) {
  const config = {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(state.token
        ? { Authorization: `Bearer ${state.token}` }
        : {}),
      ...(options.headers || {})
    }
  };

  const response = await fetch(`${API}${endpoint}`, config);

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    if (response.status === 401) {
      setToken("");
      state.user = null;
    }

    throw new Error(
      data.message || "Произошла ошибка."
    );
  }

  return data;
}

function showToast(message, type = "normal") {
  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function setMessage(element, message, type = "error") {
  if (!element) return;

  element.textContent = message;
  element.dataset.type = type;
}

function formatDate(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const diff = now - date;

  if (diff < 60 * 1000) {
    return "только что";
  }

  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / 60000)} мин`;
  }

  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / 3600000)} ч`;
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short"
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(user) {
  const name =
    user?.displayName ||
    user?.username ||
    "N";

  return escapeHTML(
    name.slice(0, 1).toUpperCase()
  );
}

/* =========================
   THEME
========================= */

function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem("nobody_theme", theme);

  const root = document.documentElement;

  if (theme === "system") {
    root.removeAttribute("data-theme");
    root.classList.remove("dark");
    return;
  }

  root.dataset.theme = theme;

  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  const select = $("#themeSelect");

  if (select) {
    select.value = theme;
  }
}

function toggleTheme() {
  const next =
    state.theme === "light"
      ? "dark"
      : "light";

  applyTheme(next);
}

/* =========================
   SCREENS
========================= */

function hideAllScreens() {
  $$(".screen").forEach(screen => {
    screen.classList.add("hidden");
  });
}

function showScreen(id) {
  hideAllScreens();

  const screen = document.getElementById(id);

  if (screen) {
    screen.classList.remove("hidden");
  }
}

function openAuth() {
  showScreen("authFormScreen");

  const formScreen = $("#authFormScreen");

  if (formScreen) {
    formScreen.classList.remove("hidden");
  }
}

function showLoginForm() {
  state.authMode = "login";

  $("#authEyebrow").textContent = "WELCOME BACK";
  $("#authFormTitle").textContent = "Войти";
  $("#authFormDescription").textContent =
    "Вернись в свой анонимный мир.";

  $("#authSubmit").textContent = "Войти";

  $("#passwordConfirmField")?.classList.add("hidden");
  $("#nicknameOptionalField")?.classList.add("hidden");

  $("#loginTab")?.classList.add("active");
  $("#registerTab")?.classList.remove("active");

  $("#passwordInput")?.setAttribute(
    "autocomplete",
    "current-password"
  );

  setMessage($("#authMessage"), "");
}

function showRegisterForm() {
  state.authMode = "register";

  $("#authEyebrow").textContent = "CREATE ACCOUNT";
  $("#authFormTitle").textContent =
    "Создать аккаунт";

  $("#authFormDescription").textContent =
    "Придумай nobody-личность.";

  $("#authSubmit").textContent =
    "Создать аккаунт";

  $("#passwordConfirmField")?.classList.remove("hidden");
  $("#nicknameOptionalField")?.classList.remove("hidden");

  $("#loginTab")?.classList.remove("active");
  $("#registerTab")?.classList.add("active");

  $("#passwordInput")?.setAttribute(
    "autocomplete",
    "new-password"
  );

  setMessage($("#authMessage"), "");
}

function enterApp() {
  $("#topbar")?.classList.remove("hidden");
  $("#bottomNav")?.classList.remove("hidden");
  $("#headerProfileButton")?.classList.remove("hidden");

  showScreen("homePage");

  state.currentPage = "home";

  updateNavigation();
  updateUserUI();

  loadFeed();
}

function leaveApp() {
  $("#bottomNav")?.classList.add("hidden");
  $("#headerProfileButton")?.classList.add("hidden");

  showScreen("authScreen");
}

/* =========================
   USER UI
========================= */

function updateUserUI() {
  if (!state.user) return;

  const username =
    state.user.username || "nobody";

  const displayName =
    state.user.displayName ||
    username;

  const welcome = $("#welcomeText");
  const description = $("#welcomeDescription");

  if (welcome) {
    welcome.textContent =
      `Привет, ${displayName}.`;
  }

  if (description) {
    description.textContent =
      `Ты вошёл как @${username}.`;
  }

  const headerAvatar =
    $("#headerProfileButton");

  if (headerAvatar) {
    headerAvatar.textContent =
      initials(state.user);
  }

  const composerAvatar =
    $("#composerAvatar");

  if (composerAvatar) {
    composerAvatar.textContent =
      initials(state.user);
  }

  const composerUsername =
    $("#composerUsername");

  if (composerUsername) {
    composerUsername.textContent =
      `@${username}`;
  }

  const roomOwner =
    $("#roomOwnerLabel");

  if (roomOwner) {
    roomOwner.textContent =
      `@${username}`;
  }
}

/* =========================
   AUTH
========================= */

async function submitAuth(event) {
  event.preventDefault();

  const username =
    $("#usernameInput")?.value.trim();

  const password =
    $("#passwordInput")?.value || "";

  const message =
    $("#authMessage");

  if (!username) {
    setMessage(
      message,
      "Введи ник."
    );
    return;
  }

  if (password.length < 6) {
    setMessage(
      message,
      "Пароль должен содержать минимум 6 символов."
    );
    return;
  }

  if (state.authMode === "register") {
    const confirm =
      $("#passwordConfirmInput")?.value || "";

    if (password !== confirm) {
      setMessage(
        message,
        "Пароли не совпадают."
      );
      return;
    }
  }

  const submit =
    $("#authSubmit");

  if (submit) {
    submit.disabled = true;
    submit.dataset.loading = "true";
  }

  try {
    const endpoint =
      state.authMode === "login"
        ? "/auth/login"
        : "/auth/register";

    const result = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    });

    setToken(result.token);
    state.user = result.user;

    setMessage(
      message,
      "Готово!",
      "success"
    );

    $("#authForm")?.reset();

    await loadMe();
    enterApp();

    showToast(
      state.authMode === "login"
        ? "Добро пожаловать обратно 👋"
        : "Аккаунт создан ✦",
      "success"
    );
  } catch (error) {
    setMessage(
      message,
      error.message
    );
  } finally {
    if (submit) {
      submit.disabled = false;
      delete submit.dataset.loading;
    }
  }
}

async function loadMe() {
  if (!state.token) {
    return false;
  }

  try {
    const result =
      await api("/auth/me");

    state.user =
      result.user;

    return true;
  } catch {
    setToken("");
    state.user = null;
    return false;
  }
}

async function logout() {
  try {
    if (state.token) {
      await api("/auth/logout", {
        method: "POST"
      });
    }
  } catch {
    // локальный выход всё равно выполняется
  }

  setToken("");
  state.user = null;
  state.currentChat = null;

  leaveApp();

  showToast(
    "Ты вышел из аккаунта.",
    "success"
  );
}

/* =========================
   NAVIGATION
========================= */

function navigate(page) {
  state.currentPage = page;

  const pages = {
    home: "homePage",
    explore: "explorePage",
    profile: "profilePage",
    messages: "messagesPage",
    games: "gamesPage",
    room: "roomPage",
    settings: "settingsPage",
    owner: "ownerPage"
  };

  const target = pages[page];

  if (!target) {
    return;
  }

  showScreen(target);
  updateNavigation();

  $("#moreMenu")?.classList.add("hidden");

  if (page === "home") {
    loadFeed();
  }

  if (page === "profile") {
    loadOwnProfile();
  }

  if (page === "messages") {
    loadConversations();
  }

  if (page === "room") {
    loadRoom();
  }

  if (page === "owner") {
    loadOwner();
  }
}

function updateNavigation() {
  $$(".nav-button").forEach(button => {
    button.classList.remove("active");

    if (
      button.dataset.page ===
      state.currentPage
    ) {
      button.classList.add("active");
    }
  });
}

/* =========================
   FEED
========================= */

async function loadFeed() {
  const feed = $("#feed");

  if (!feed) return;

  feed.innerHTML = `
    <div class="loading-state">
      Загружаем ленту...
    </div>
  `;

  try {
    const result =
      await api("/posts");

    state.posts =
      result.posts || [];

    renderFeed();
  } catch (error) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <strong>Не удалось загрузить ленту</strong>
        <p>${escapeHTML(error.message)}</p>
      </div>
    `;
  }
}

function renderFeed(posts = state.posts) {
  const feed = $("#feed");

  if (!feed) return;

  if (!posts.length) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✦</div>
        <strong>Здесь пока тихо</strong>
        <p>Создай первый пост в NOBODY.</p>
      </div>
    `;

    return;
  }

  feed.innerHTML =
    posts.map(renderPost).join("");

  bindPostButtons();
}

function renderPost(post) {
  const author =
    post.author || {};

  const username =
    author.username || "anonymous";

  const displayName =
    author.displayName ||
    username;

  const liked =
    post.liked ? "liked" : "";

  return `
    <article
      class="post-card"
      data-post-id="${escapeHTML(post.id)}"
    >
      <div class="post-header">
        <button
          class="post-author"
          data-user-id="${escapeHTML(author.id || "")}"
          type="button"
        >
          <div class="avatar">
            ${initials(author)}
          </div>

          <div class="post-author-info">
            <strong>
              ${escapeHTML(displayName)}
            </strong>

            <span>
              @${escapeHTML(username)}
              ·
              ${escapeHTML(formatDate(post.createdAt))}
            </span>
          </div>
        </button>

        ${
          author.id === state.user?.id
            ? `
              <button
                class="post-more"
                data-delete-post="${escapeHTML(post.id)}"
                type="button"
              >
                •••
              </button>
            `
            : ""
        }
      </div>

      <div class="post-body">
        ${escapeHTML(post.text).replaceAll("\n", "<br>")}
      </div>

      <div class="post-actions">
        <button
          class="post-action like-button ${liked}"
          data-like-post="${escapeHTML(post.id)}"
          type="button"
        >
          ♡
          <span>${post.likes || 0}</span>
        </button>

        <button
          class="post-action"
          type="button"
          data-comment-post="${escapeHTML(post.id)}"
        >
          ◌
          <span>${post.comments || 0}</span>
        </button>

        <button
          class="post-action share-post"
          data-share-post="${escapeHTML(post.id)}"
          type="button"
        >
          ↗
        </button>
      </div>
    </article>
  `;
}

function bindPostButtons() {
  $$("[data-like-post]").forEach(button => {
    button.addEventListener(
      "click",
      () => likePost(
        button.dataset.likePost
      )
    );
  });

  $$("[data-delete-post]").forEach(button => {
    button.addEventListener(
      "click",
      () => deletePost(
        button.dataset.deletePost
      )
    );
  });

  $$("[data-comment-post]").forEach(button => {
    button.addEventListener(
      "click",
      () => {
        showToast(
          "Комментарии будут добавлены следующим модулем."
        );
      }
    );
  });

  $$("[data-share-post]").forEach(button => {
    button.addEventListener(
      "click",
      async () => {
        const postId =
          button.dataset.sharePost;

        const url =
          `${location.origin}${location.pathname}#post=${postId}`;

        try {
          await navigator.clipboard.writeText(url);
          showToast(
            "Ссылка на пост скопирована.",
            "success"
          );
        } catch {
          showToast(
            "Не удалось скопировать ссылку."
          );
        }
      }
    );
  });

  $$("[data-user-id]").forEach(button => {
    button.addEventListener(
      "click",
      () => {
        const userId =
          button.dataset.userId;

        if (userId) {
          openUserProfile(userId);
        }
      }
    );
  });
}

async function likePost(postId) {
  try {
    const result =
      await api(`/posts/${postId}/like`, {
        method: "POST"
      });

    const post =
      state.posts.find(
        item => item.id === postId
      );

    if (post) {
      post.likes = result.likes;
      post.liked = result.liked;
    }

    renderFeed();
  } catch (error) {
    showToast(error.message);
  }
}

async function deletePost(postId) {
  const confirmed =
    confirm("Удалить этот пост?");

  if (!confirmed) {
    return;
  }

  try {
    await api(`/posts/${postId}`, {
      method: "DELETE"
    });

    state.posts =
      state.posts.filter(
        post => post.id !== postId
      );

    renderFeed();

    showToast(
      "Пост удалён.",
      "success"
    );
  } catch (error) {
    showToast(error.message);
  }
}

/* =========================
   CREATE POST
========================= */

function openModal(id) {
  const modal =
    document.getElementById(id);

  if (!modal) return;

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  const modal =
    document.getElementById(id);

  if (!modal) return;

  modal.classList.add("hidden");

  if (
    !document.querySelector(
      ".modal:not(.hidden)"
    )
  ) {
    document.body.classList.remove(
      "modal-open"
    );
  }
}

function closeAllModals() {
  $$(".modal").forEach(modal => {
    modal.classList.add("hidden");
  });

  document.body.classList.remove(
    "modal-open"
  );
}

async function createPost(event) {
  event.preventDefault();

  const textarea =
    $("#postText");

  const message =
    $("#postMessage");

  const text =
    textarea?.value.trim() || "";

  if (!text) {
    setMessage(
      message,
      "Напиши что-нибудь."
    );
    return;
  }

  try {
    const result =
      await api("/posts", {
        method: "POST",
        body: JSON.stringify({ text })
      });

    state.posts.unshift(
      result.post
    );

    $("#postForm")?.reset();

    updatePostCounter();
    closeModal("postModal");
    renderFeed();

    showToast(
      "Пост опубликован ✦",
      "success"
    );
  } catch (error) {
    setMessage(
      message,
      error.message
    );
  }
}

function updatePostCounter() {
  const textarea =
    $("#postText");

  const counter =
    $("#postCounter");

  if (!textarea || !counter) {
    return;
  }

  counter.textContent =
    `${textarea.value.length} / 2000`;
}

/* =========================
   SEARCH
========================= */

let searchTimer = null;

function setupSearch() {
  const input =
    $("#searchInput");

  if (!input) return;

  input.addEventListener(
    "input",
    () => {
      const query =
        input.value.trim();

      $("#searchClearButton")
        ?.classList.toggle(
          "hidden",
          !query
        );

      clearTimeout(searchTimer);

      if (!query) {
        renderEmptySearch();
        return;
      }

      searchTimer = setTimeout(
        () => searchUsers(query),
        300
      );
    }
  );

  $("#searchClearButton")
    ?.addEventListener(
      "click",
      () => {
        input.value = "";
        input.dispatchEvent(
          new Event("input")
        );
      }
    );

  $$(".suggestion-chip").forEach(
    chip => {
      chip.addEventListener(
        "click",
        () => {
          input.value =
            chip.dataset.searchExample || "";

          input.dispatchEvent(
            new Event("input")
          );
        }
      );
    }
  );
}

function renderEmptySearch() {
  const results =
    $("#searchResults");

  if (!results) return;

  results.innerHTML = `
    <div class="empty-state compact">
      <div class="empty-icon">⌕</div>
      <strong>Кого сегодня найдём?</strong>
      <p>Введи хотя бы несколько символов.</p>
    </div>
  `;
}

async function searchUsers(query) {
  const results =
    $("#searchResults");

  if (!results) return;

  results.innerHTML = `
    <div class="loading-state">
      Ищем...
    </div>
  `;

  try {
    const result =
      await api(
        `/users/search?q=${encodeURIComponent(query)}`
      );

    renderSearchResults(
      result.users || []
    );
  } catch (error) {
    results.innerHTML = `
      <div class="empty-state compact">
        <strong>Ошибка поиска</strong>
        <p>${escapeHTML(error.message)}</p>
      </div>
    `;
  }
}

function renderSearchResults(users) {
  const results =
    $("#searchResults");

  if (!results) return;

  if (!users.length) {
    results.innerHTML = `
      <div class="empty-state compact">
        <div class="empty-icon">⌕</div>
        <strong>Никого не нашли</strong>
        <p>Попробуй другой запрос.</p>
      </div>
    `;

    return;
  }

  results.innerHTML =
    users.map(user => `
      <button
        class="user-result"
        data-search-user="${escapeHTML(user.id)}"
        type="button"
      >
        <div class="avatar">
          ${initials(user)}
        </div>

        <div class="user-result-info">
          <strong>
            ${escapeHTML(user.displayName)}
          </strong>

          <span>
            @${escapeHTML(user.username)}
          </span>

          ${
            user.anonymousId
              ? `
                <small>
                  ${escapeHTML(user.anonymousId)}
                </small>
              `
              : ""
          }
        </div>

        <span class="setting-arrow">
          ›
        </span>
      </button>
    `).join("");

  $$("[data-search-user]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => openUserProfile(
          button.dataset.searchUser
        )
      );
    });
}

/* =========================
   PROFILE
========================= */

async function loadOwnProfile() {
  if (!state.user) return;

  try {
    const result =
      await api("/users/me");

    state.user = {
      ...state.user,
      ...result.user
    };

    renderProfile(
      state.user,
      true
    );

    const postsResult =
      await api(
        `/users/${state.user.id}/posts`
      );

    const profileFeed =
      $("#profileFeed");

    if (profileFeed) {
      const posts =
        postsResult.posts || [];

      profileFeed.innerHTML =
        posts.length
          ? posts.map(renderPost).join("")
          : `
            <div class="empty-state">
              <div class="empty-icon">✦</div>
              <strong>Пока нет публикаций</strong>
              <p>Создай свой первый пост.</p>
            </div>
          `;

      bindPostButtons();
    }
  } catch (error) {
    showToast(error.message);
  }
}

function renderProfile(user, own = false) {
  const card =
    $("#profileCard");

  if (!card) return;

  card.innerHTML = `
    <div class="profile-avatar avatar large">
      ${initials(user)}
    </div>

    <div class="profile-main">
      <div class="profile-name-row">
        <div>
          <h1>
            ${escapeHTML(
              user.displayName ||
              user.username
            )}
          </h1>

          <p>
            @${escapeHTML(user.username)}
          </p>
        </div>

        ${
          own
            ? `
              <button
                class="secondary-button"
                id="profileInlineEdit"
                type="button"
              >
                Редактировать
              </button>
            `
            : `
              <button
                class="primary-button"
                id="profileMessageButton"
                type="button"
              >
                Написать
              </button>
            `
        }
      </div>

      <p class="profile-bio">
        ${
          escapeHTML(
            user.bio ||
            "Этот nobody пока ничего о себе не рассказал."
          )
        }
      </p>

      ${
        user.anonymousId
          ? `
            <span class="profile-id">
              ${escapeHTML(user.anonymousId)}
            </span>
          `
          : ""
      }
    </div>
  `;

  if (own) {
    $("#profileInlineEdit")
      ?.addEventListener(
        "click",
        openProfileEditor
      );
  } else {
    $("#profileMessageButton")
      ?.addEventListener(
        "click",
        () => {
          closeModal("userProfileModal");
          navigate("messages");
          openChat(user.id);
        }
      );
  }

  const info =
    $("#profileInfo");

  if (info) {
    info.innerHTML = `
      <div>
        <span>Ник</span>
        <strong>
          @${escapeHTML(user.username)}
        </strong>
      </div>

      <div>
        <span>Anonymous ID</span>
        <strong>
          ${
            user.anonymousId
              ? escapeHTML(user.anonymousId)
              : "скрыт"
          }
        </strong>
      </div>

      <div>
        <span>В NOBODY с</span>
        <strong>
          ${escapeHTML(
            new Date(
              user.createdAt
            ).toLocaleDateString(
              "ru-RU"
            )
          )}
        </strong>
      </div>
    `;
  }
}

async function openUserProfile(userId) {
  try {
    const result =
      await api(`/users/${userId}`);

    const content =
      $("#userProfileModalContent");

    if (!content) return;

    const user =
      result.user;

    content.innerHTML = `
      <div class="public-profile">
        <div class="avatar large">
          ${initials(user)}
        </div>

        <h2>
          ${escapeHTML(
            user.displayName ||
            user.username
          )}
        </h2>

        <p class="public-username">
          @${escapeHTML(user.username)}
        </p>

        <p>
          ${escapeHTML(
            user.bio ||
            "Нет описания."
          )}
        </p>

        ${
          user.anonymousId
            ? `
              <div class="profile-id">
                ${escapeHTML(
                  user.anonymousId
                )}
              </div>
            `
            : ""
        }

        <div class="public-profile-actions">
          ${
            user.id !== state.user?.id
              ? `
                <button
                  class="primary-button full-button"
                  id="modalMessageUser"
                  type="button"
                >
                  Написать сообщение
                </button>
              `
              : ""
          }
        </div>
      </div>
    `;

    $("#modalMessageUser")
      ?.addEventListener(
        "click",
        () => {
          closeModal("userProfileModal");
          navigate("messages");
          openChat(user.id);
        }
      );

    openModal("userProfileModal");
  } catch (error) {
    showToast(error.message);
  }
}

/* =========================
   PROFILE EDIT
========================= */

function openProfileEditor() {
  if (!state.user) return;

  $("#editUsernameInput").value =
    state.user.username || "";

  $("#editBioInput").value =
    state.user.bio || "";

  setMessage(
    $("#profileEditMessage"),
    ""
  );

  openModal("profileEditModal");
}

async function saveProfile(event) {
  event.preventDefault();

  const username =
    $("#editUsernameInput")
      ?.value.trim();

  const bio =
    $("#editBioInput")
      ?.value.trim();

  try {
    const result =
      await api("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          username,
          bio,
          displayName: username
        })
      });

    state.user = {
      ...state.user,
      ...result.user
    };

    closeModal(
      "profileEditModal"
    );

    updateUserUI();
    loadOwnProfile();

    showToast(
      "Профиль сохранён.",
      "success"
    );
  } catch (error) {
    setMessage(
      $("#profileEditMessage"),
      error.message
    );
  }
}

/* =========================
   MESSAGES
========================= */

async function loadConversations() {
  try {
    const result =
      await api("/messages");

    state.conversations =
      result.conversations || [];

    renderConversations();
  } catch (error) {
    showToast(error.message);
  }
}

function renderConversations() {
  const container =
    $("#conversationItems");

  if (!container) return;

  if (!state.conversations.length) {
    container.innerHTML = `
      <div class="empty-state compact">
        <div class="empty-icon">□</div>
        <strong>Чатов пока нет</strong>
        <p>Найди пользователя и начни разговор.</p>
      </div>
    `;

    return;
  }

  container.innerHTML =
    state.conversations.map(
      conversation => {
        const user =
          conversation.user;

        const last =
          conversation.lastMessage;

        return `
          <button
            class="conversation-item ${
              state.currentChat === user.id
                ? "active"
                : ""
            }"
            data-conversation-user="${escapeHTML(user.id)}"
            type="button"
          >
            <div class="avatar">
              ${initials(user)}
            </div>

            <div class="conversation-info">
              <strong>
                ${escapeHTML(
                  user.displayName ||
                  user.username
                )}
              </strong>

              <span>
                ${
                  last
                    ? escapeHTML(
                        last.text
                      )
                    : "Новый разговор"
                }
              </span>
            </div>

            ${
              last
                ? `
                  <time>
                    ${escapeHTML(
                      formatDate(
                        last.createdAt
                      )
                    )}
                  </time>
                `
                : ""
            }
          </button>
        `;
      }
    ).join("");

  $$("[data-conversation-user]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => openChat(
          button.dataset.conversationUser
        )
      );
    });
}

async function openChat(userId) {
  try {
    const result =
      await api(
        `/messages/${userId}`
      );

    state.currentChat =
      userId;

    const placeholder =
      $("#chatPlaceholder");

    const content =
      $("#chatContent");

    placeholder?.classList.add(
      "hidden"
    );

    content?.classList.remove(
      "hidden"
    );

    const user =
      result.user;

    $("#chatUsername").textContent =
      user.displayName ||
      user.username;

    $("#chatUserID").textContent =
      `@${user.username}`;

    $("#chatAvatar").textContent =
      initials(user);

    renderMessages(
      result.messages || []
    );

    renderConversations();
  } catch (error) {
    showToast(error.message);
  }
}

function renderMessages(list) {
  const container =
    $("#chatMessages");

  if (!container) return;

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state compact">
        <div class="empty-icon">✦</div>
        <strong>Начни разговор</strong>
        <p>Здесь пока нет сообщений.</p>
      </div>
    `;

    return;
  }

  container.innerHTML =
    list.map(message => {
      const own =
        message.from === state.user?.id;

      return `
        <div class="message-row ${
          own ? "own" : "other"
        }">
          <div class="message-bubble">
            <div class="message-text">
              ${escapeHTML(
                message.text
              ).replaceAll(
                "\n",
                "<br>"
              )}
            </div>

            <time>
              ${escapeHTML(
                formatDate(
                  message.createdAt
                )
              )}
            </time>
          </div>
        </div>
      `;
    }).join("");

  container.scrollTop =
    container.scrollHeight;
}

async function sendMessage(event) {
  event.preventDefault();

  if (!state.currentChat) {
    showToast(
      "Сначала выбери пользователя."
    );
    return;
  }

  const input =
    $("#chatInput");

  const text =
    input?.value.trim() || "";

  if (!text) return;

  input.value = "";

  try {
    const result =
      await api(
        `/messages/${state.currentChat}`,
        {
          method: "POST",
          body: JSON.stringify({
            text
          })
        }
      );

    const currentMessages =
      $("#chatMessages");

    if (currentMessages) {
      const bubble =
        document.createElement("div");

      bubble.className =
        "message-row own";

      bubble.innerHTML = `
        <div class="message-bubble">
          <div class="message-text">
            ${escapeHTML(text)}
          </div>
          <time>только что</time>
        </div>
      `;

      currentMessages.appendChild(
        bubble
      );

      currentMessages.scrollTop =
        currentMessages.scrollHeight;
    }

    await loadConversations();

    if (result.message) {
      // сервер подтвердил сообщение
    }
  } catch (error) {
    input.value = text;
    showToast(error.message);
  }
}

/* =========================
   ROOM
========================= */

async function loadRoom() {
  try {
    const result =
      await api("/room");

    const room =
      result.room;

    $("#roomStatusTitle").textContent =
      room.visits
        ? "Твоя комната открыта"
        : "Твоя комната закрыта";

    $("#roomStatusText").textContent =
      room.description ||
      "У комнаты пока нет описания.";

    $("#roomVisitsToggle").checked =
      Boolean(room.visits);

    const preview =
      $("#roomPreview");

    if (preview) {
      preview.dataset.style =
        room.style || "mint";
    }
  } catch (error) {
    showToast(error.message);
  }
}

function openRoomEditor() {
  loadRoom();

  api("/room")
    .then(result => {
      const room =
        result.room;

      $("#roomNameInput").value =
        room.name || "";

      $("#roomDescriptionInput").value =
        room.description || "";

      $("#roomStyleSelect").value =
        room.style || "mint";

      openModal("roomEditModal");
    })
    .catch(error => {
      showToast(error.message);
    });
}

async function saveRoom(event) {
  event.preventDefault();

  const name =
    $("#roomNameInput")
      ?.value.trim();

  const description =
    $("#roomDescriptionInput")
      ?.value.trim();

  const style =
    $("#roomStyleSelect")
      ?.value;

  const visits =
    $("#roomVisitsToggle")
      ?.checked ?? true;

  try {
    await api("/room", {
      method: "PATCH",
      body: JSON.stringify({
        name,
        description,
        style,
        visits
      })
    });

    closeModal("roomEditModal");
    loadRoom();

    showToast(
      "Комната сохранена.",
      "success"
    );
  } catch (error) {
    showToast(error.message);
  }
}

async function saveRoomVisits() {
  const visits =
    $("#roomVisitsToggle")
      ?.checked ?? true;

  try {
    await api("/room", {
      method: "PATCH",
      body: JSON.stringify({
        visits
      })
    });

    loadRoom();
  } catch (error) {
    showToast(error.message);
  }
}

/* =========================
   PRIVACY
========================= */

async function loadPrivacy() {
  try {
    const result =
      await api("/users/me");

    const privacy =
      result.user.privacy;

    if (!privacy) return;

    $("#showIDToggle").checked =
      privacy.showID;

    $("#allowMessagesToggle").checked =
      privacy.allowMessages;

    $("#showRoomToggle").checked =
      privacy.showRoom;
  } catch (error) {
    showToast(error.message);
  }
}

async function savePrivacy() {
  try {
    await api(
      "/users/me/privacy",
      {
        method: "PATCH",
        body: JSON.stringify({
          showID:
            $("#showIDToggle").checked,

          allowMessages:
            $("#allowMessagesToggle").checked,

          showRoom:
            $("#showRoomToggle").checked
        })
      }
    );

    closeModal("privacyModal");

    showToast(
      "Настройки приватности сохранены.",
      "success"
    );
  } catch (error) {
    showToast(error.message);
  }
}

/* =========================
   OWNER
========================= */

async function loadOwner() {
  try {
    const result =
      await api("/owner/stats");

    const stats =
      result.stats;

    const container =
      $("#ownerStats");

    if (!container) return;

    container.innerHTML = `
      <div class="owner-stat">
        <span>Users</span>
        <strong>${stats.users}</strong>
      </div>

      <div class="owner-stat">
        <span>Posts</span>
        <strong>${stats.posts}</strong>
      </div>

      <div class="owner-stat">
        <span>Chats</span>
        <strong>${stats.conversations}</strong>
      </div>

      <div class="owner-stat">
        <span>Sessions</span>
        <strong>${stats.sessions}</strong>
      </div>
    `;
  } catch (error) {
    showToast(
      "Owner Panel недоступна."
    );
  }
}

/* =========================
   GAMES
========================= */

function openGame(game) {
  const title =
    $("#gameModalTitle");

  const container =
    $("#gameContainer");

  if (!title || !container) {
    return;
  }

  openModal("gameModal");

  if (game === "tic-tac-toe") {
    title.textContent =
      "Крестики-нолики";

    startTicTacToe(container);
    return;
  }

  if (game === "number") {
    title.textContent =
      "Угадай число";

    startNumberGame(container);
    return;
  }

  if (game === "reaction") {
    title.textContent =
      "Reaction";

    startReactionGame(container);
    return;
  }

  if (game === "battleship") {
    title.textContent =
      "Морской бой";

    startBattleship(container);
  }
}

function startTicTacToe(container) {
  let board = Array(9).fill("");
  let player = "X";
  let gameOver = false;

  function render() {
    container.innerHTML = `
      <div class="mini-game">
        <div class="game-status">
          Ход: ${player}
        </div>

        <div class="ttt-board">
          ${board.map(
            (cell, index) => `
              <button
                class="ttt-cell"
                data-cell="${index}"
                type="button"
              >
                ${cell}
              </button>
            `
          ).join("")}
        </div>

        <button
          class="secondary-button"
          id="resetTTT"
          type="button"
        >
          Новая игра
        </button>
      </div>
    `;

    $$("[data-cell]")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => move(
            Number(button.dataset.cell)
          )
        );
      });

    $("#resetTTT")
      ?.addEventListener(
        "click",
        () => {
          board = Array(9).fill("");
          player = "X";
          gameOver = false;
          render();
        }
      );
  }

  function move(index) {
    if (
      gameOver ||
      board[index]
    ) {
      return;
    }

    board[index] = player;

    const winner =
      getWinner(board);

    if (winner) {
      gameOver = true;
      render();

      setTimeout(
        () => showToast(
          `Победил ${winner}!`,
          "success"
        ),
        50
      );

      return;
    }

    if (
      board.every(Boolean)
    ) {
      gameOver = true;
      render();

      setTimeout(
        () => showToast("Ничья!"),
        50
      );

      return;
    }

    player =
      player === "X"
        ? "O"
        : "X";

    render();
  }

  render();
}

function getWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (const line of lines) {
    const [a, b, c] = line;

    if (
      board[a] &&
      board[a] === board[b] &&
      board[a] === board[c]
    ) {
      return board[a];
    }
  }

  return null;
}

function startNumberGame(container) {
  let target =
    Math.floor(
      Math.random() * 100
    ) + 1;

  let attempts = 0;

  container.innerHTML = `
    <div class="mini-game">
      <p>
        Я загадал число от 1 до 100.
      </p>

      <input
        class="input"
        id="numberGuess"
        type="number"
        min="1"
        max="100"
        placeholder="Твоё число"
      >

      <button
        class="primary-button full-button"
        id="guessButton"
        type="button"
      >
        Проверить
      </button>

      <p
        class="game-feedback"
        id="numberFeedback"
      ></p>
    </div>
  `;

  $("#guessButton")
    ?.addEventListener(
      "click",
      () => {
        const value =
          Number(
            $("#numberGuess").value
          );

        if (
          value < 1 ||
          value > 100
        ) {
          return;
        }

        attempts++;

        const feedback =
          $("#numberFeedback");

        if (value === target) {
          feedback.textContent =
            `Правильно! Попыток: ${attempts}.`;

          return;
        }

        feedback.textContent =
          value < target
            ? "Больше ↑"
            : "Меньше ↓";
      }
    );
}

function startReactionGame(container) {
  let active = false;
  let startTime = 0;
  let timeout = null;

  container.innerHTML = `
    <div class="mini-game reaction-game">
      <button
        class="reaction-button"
        id="reactionButton"
        type="button"
      >
        Жди...
      </button>

      <p id="reactionResult">
        Нажми и жди сигнала.
      </p>
    </div>
  `;

  const button =
    $("#reactionButton");

  function prepare() {
    active = false;
    button.textContent =
      "Жди...";
    button.disabled = false;

    timeout =
      setTimeout(() => {
        active = true;
        startTime =
          performance.now();

        button.textContent =
          "ЖМИ!";
      },
      1200 +
      Math.random() * 2800
      );
  }

  button.addEventListener(
    "click",
    () => {
      if (!active) {
        if (timeout) {
          clearTimeout(timeout);
        }

        $("#reactionResult").textContent =
          "Слишком рано! Попробуй ещё.";

        prepare();
        return;
      }

      const time =
        Math.round(
          performance.now() -
          startTime
        );

      active = false;

      $("#reactionResult").textContent =
        `Твоя реакция: ${time} мс`;

      button.textContent =
        "Ещё раз";

      button.onclick = () => {
        button.onclick = null;
        prepare();
      };
    }
  );

  prepare();
}

function startBattleship(container) {
  container.innerHTML = `
    <div class="mini-game">
      <div class="game-placeholder">
        <div class="empty-icon">▦</div>
        <strong>Морской бой</strong>
        <p>
          Игровое поле будет подключено
          к онлайн-мультиплееру следующим этапом.
        </p>
      </div>
    </div>
  `;
}

/* =========================
   MODALS
========================= */

function bindModalButtons() {
  $$("[data-close-modal]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => closeModal(
          button.dataset.closeModal
        )
      );
    });
}

/* =========================
   SETTINGS
========================= */

function setupSettings() {
  $("#themeSelect")
    ?.addEventListener(
      "change",
      event => {
        applyTheme(
          event.target.value
        );
      }
    );

  $("#themeButton")
    ?.addEventListener(
      "click",
      toggleTheme
    );

  $("#rulesButton")
    ?.addEventListener(
      "click",
      () => openModal(
        "rulesModal"
      )
    );

  $("#openRulesFromAuth")
    ?.addEventListener(
      "click",
      () => openModal(
        "rulesModal"
      )
    );

  $("#safetyButton")
    ?.addEventListener(
      "click",
      () => openModal(
        "safetyModal"
      )
    );

  $("#privacyButton")
    ?.addEventListener(
      "click",
      async () => {
        await loadPrivacy();
        openModal("privacyModal");
      }
    );

  $("#savePrivacyButton")
    ?.addEventListener(
      "click",
      savePrivacy
    );

  $("#editProfileButton")
    ?.addEventListener(
      "click",
      openProfileEditor
    );

  $("#logoutButton")
    ?.addEventListener(
      "click",
      logout
    );
}

/* =========================
   EVENTS
========================= */

function setupNavigation() {
  $$("[data-page]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const page =
            button.dataset.page;

          if (
            page &&
            page !== "owner"
          ) {
            navigate(page);
          }

          if (
            page === "owner"
          ) {
            navigate("owner");
          }
        }
      );
    });

  $$("[data-action='create']")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          openModal("postModal");
        }
      );
    });

  $("#moreNavButton")
    ?.addEventListener(
      "click",
      event => {
        event.stopPropagation();

        $("#moreMenu")
          ?.classList.toggle(
            "hidden"
          );
      }
    );

  document.addEventListener(
    "click",
    event => {
      const menu =
        $("#moreMenu");

      const button =
        $("#moreNavButton");

      if (
        menu &&
        button &&
        !menu.contains(event.target) &&
        !button.contains(event.target)
      ) {
        menu.classList.add(
          "hidden"
        );
      }
    }
  );
}

function setupAuth() {
  $("#openLoginButton")
    ?.addEventListener(
      "click",
      () => {
        openAuth();
        showLoginForm();
      }
    );

  $("#openRegisterButton")
    ?.addEventListener(
      "click",
      () => {
        openAuth();
        showRegisterForm();
      }
    );

  $("#authBackButton")
    ?.addEventListener(
      "click",
      () => {
        showScreen("authScreen");
      }
    );

  $("#loginTab")
    ?.addEventListener(
      "click",
      showLoginForm
    );

  $("#registerTab")
    ?.addEventListener(
      "click",
      showRegisterForm
    );

  $("#authForm")
    ?.addEventListener(
      "submit",
      submitAuth
    );
}

function setupFeed() {
  $("#createPostButton")
    ?.addEventListener(
      "click",
      () => openModal(
        "postModal"
      )
    );

  $("#postForm")
    ?.addEventListener(
      "submit",
      createPost
    );

  $("#postText")
    ?.addEventListener(
      "input",
      updatePostCounter
    );

  $("#addEmojiButton")
    ?.addEventListener(
      "click",
      () => {
        const textarea =
          $("#postText");

        if (!textarea) return;

        const emojis = [
          " ✦",
          " ♡",
          " ◌",
          " ✨",
          " :3"
        ];

        const emoji =
          emojis[
            Math.floor(
              Math.random() *
              emojis.length
            )
          ];

        textarea.value += emoji;
        textarea.focus();

        updatePostCounter();
      }
    );

  $$(".filter-button")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          $$(".filter-button")
            .forEach(
              item =>
                item.classList.remove(
                  "active"
                )
            );

          button.classList.add(
            "active"
          );

          const filter =
            button.dataset.feedFilter;

          if (filter === "popular") {
            renderFeed(
              [...state.posts].sort(
                (a, b) =>
                  (b.likes || 0) -
                  (a.likes || 0)
              )
            );

            return;
          }

          renderFeed();
        }
      );
    });
}

function setupMessages() {
  $("#chatForm")
    ?.addEventListener(
      "submit",
      sendMessage
    );

  $("#chatBackButton")
    ?.addEventListener(
      "click",
      () => {
        $("#chatContent")
          ?.classList.add(
            "hidden"
          );

        $("#chatPlaceholder")
          ?.classList.remove(
            "hidden"
          );

        state.currentChat =
          null;

        renderConversations();
      }
    );

  $("#newMessageButton")
    ?.addEventListener(
      "click",
      () => {
        navigate("explore");

        showToast(
          "Найди пользователя, чтобы начать чат."
        );
      }
    );
}

function setupRoom() {
  $("#editRoomButton")
    ?.addEventListener(
      "click",
      openRoomEditor
    );

  $("#roomEditForm")
    ?.addEventListener(
      "submit",
      saveRoom
    );

  $("#roomVisitsToggle")
    ?.addEventListener(
      "change",
      saveRoomVisits
    );
}

function setupGames() {
  $$(".game-card")
    .forEach(card => {
      card.addEventListener(
        "click",
        () => openGame(
          card.dataset.game
        )
      );
    });
}

/* =========================
   KEYBOARD
========================= */

function setupKeyboard() {
  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape"
      ) {
        closeAllModals();

        $("#moreMenu")
          ?.classList.add(
            "hidden"
          );
      }
    }
  );
}

/* =========================
   LOADING
========================= */

function showLoading() {
  $("#loadingScreen")
    ?.classList.remove(
      "hidden"
    );
}

function hideLoading() {
  $("#loadingScreen")
    ?.classList.add(
      "hidden"
    );
}

/* =========================
   START
========================= */

async function startApp() {
  applyTheme(state.theme);

  setupAuth();
  setupNavigation();
  setupFeed();
  setupMessages();
  setupRoom();
  setupGames();
  setupSearch();
  setupSettings();
  setupKeyboard();
  bindModalButtons();

  $("#profileEditForm")
    ?.addEventListener(
      "submit",
      saveProfile
    );

  $("#headerProfileButton")
    ?.addEventListener(
      "click",
      () => navigate("profile")
    );

  $("#brandButton")
    ?.addEventListener(
      "click",
      () => {
        if (state.user) {
          navigate("home");
        }
      }
    );

  showLoading();

  if (state.token) {
    const authenticated =
      await loadMe();

    if (authenticated) {
      enterApp();
    } else {
      leaveApp();
    }
  } else {
    leaveApp();
  }

  setTimeout(
    hideLoading,
    350
  );
}

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    startApp
  );
} else {
  startApp();
}
