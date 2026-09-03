/* =========================================================
   NOBODY v0.1
   APPLICATION CORE
   JavaScript
========================================================= */

/* =========================================================
   CONFIG
========================================================= */

const NOBODY = {
    version: "0.1",
    name: "NOBODY",
    maxUsernameLength: 24,
    maxPostLength: 1000,
    maxCommentLength: 300,
    maxMessageLength: 2000,
    maxRoomItems: 100,
    defaultTheme: "system",
    ownerRole: "OWNER"
};

/* =========================================================
   STORAGE
========================================================= */

const STORAGE = {
    USERS: "nobody_v01_users",
    POSTS: "nobody_v01_posts",
    SESSION: "nobody_v01_session",
    THEME: "nobody_v01_theme",
    MESSAGES: "nobody_v01_messages",
    ROOMS: "nobody_v01_rooms",
    GAMES: "nobody_v01_games",
    NOTIFICATIONS: "nobody_v01_notifications",
    REPORTS: "nobody_v01_reports",
    BLOCKS: "nobody_v01_blocks",
    SETTINGS: "nobody_v01_settings",
    MEDIA: "nobody_v01_media",
    ACTIVITY: "nobody_v01_activity"
};

/* =========================================================
   GENERIC STORAGE
========================================================= */

function readStorage(key, fallback = []) {
    try {
        const value = localStorage.getItem(key);
        if (!value) return fallback;
        return JSON.parse(value);
    } catch (error) {
        console.error("NOBODY storage error:", error);
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error("NOBODY storage write error:", error);
        showToast("Не удалось сохранить данные");
        return false;
    }
}

function removeStorage(key) {
    localStorage.removeItem(key);
}

function storageExists(key) {
    return localStorage.getItem(key) !== null;
}

/* =========================================================
   IDs
========================================================= */

function uuid() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2)
    );
}

function generateAnonymousID() {
    return (
        "user_" +
        uuid()
            .replaceAll("-", "")
            .slice(0, 12)
            .toUpperCase()
    );
}

function generatePostID() {
    return "post_" + uuid();
}

function generateCommentID() {
    return "comment_" + uuid();
}

function generateMessageID() {
    return "message_" + uuid();
}

function generateRoomID() {
    return "room_" + uuid();
}

function generateNotificationID() {
    return "notification_" + uuid();
}

function generateReportID() {
    return "report_" + uuid();
}

/* =========================================================
   SECURITY HELPERS
========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalizeUsername(username) {
    return String(username || "")
        .trim()
        .replace(/^@+/, "")
        .toLowerCase();
}

function displayUsername(username) {
    if (!username) return "Nobody";
    return username.startsWith("@")
        ? username
        : `@${username}`;
}

function getInitial(value) {
    const username = String(value || "")
        .replace(/^@/, "")
        .trim();

    return username
        ? username.charAt(0).toUpperCase()
        : "?";
}

function sanitizeText(text, maxLength) {
    return String(text || "")
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, maxLength);
}

function formatDate(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "неизвестно";
    }

    return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatFullDate(timestamp) {
    const date = new Date(timestamp);

    return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function randomNumber(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}

/* =========================================================
   USERS
========================================================= */

function getUsers() {
    return readStorage(STORAGE.USERS, []);
}

function saveUsers(users) {
    return writeStorage(STORAGE.USERS, users);
}

function getUserByID(userID) {
    return getUsers().find(
        user => user.id === userID
    ) || null;
}

function getUserByUsername(username) {
    const normalized = normalizeUsername(username);

    return getUsers().find(
        user =>
            normalizeUsername(user.username) === normalized
    ) || null;
}

function getCurrentSessionID() {
    return localStorage.getItem(
        STORAGE.SESSION
    );
}

function getCurrentUser() {
    const sessionID = getCurrentSessionID();

    if (!sessionID) {
        return null;
    }

    return getUserByID(sessionID);
}

function saveCurrentSession(user) {
    if (!user) return;

    localStorage.setItem(
        STORAGE.SESSION,
        user.id
    );
}

function clearCurrentSession() {
    removeStorage(STORAGE.SESSION);
}

function usernameTaken(username) {
    const normalized = normalizeUsername(username);

    return getUsers().some(
        user =>
            normalizeUsername(user.username) === normalized
    );
}

/* =========================================================
   USERNAME VALIDATION
========================================================= */

function validateUsername(username) {
    const clean = normalizeUsername(username);

    if (!clean) {
        return {
            valid: false,
            message: "Введите ник."
        };
    }

    if (
        clean.length < 2 ||
        clean.length > NOBODY.maxUsernameLength
    ) {
        return {
            valid: false,
            message:
                `Ник должен содержать от 2 до ${NOBODY.maxUsernameLength} символов.`
        };
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
        return {
            valid: false,
            message:
                "Разрешены латинские буквы, цифры, _, . и -."
        };
    }

    const reserved = [
        "admin",
        "administrator",
        "owner",
        "nobody",
        "support",
        "moderator",
        "moderation",
        "system",
        "official"
    ];

    if (reserved.includes(clean)) {
        return {
            valid: false,
            message: "Этот ник зарезервирован."
        };
    }

    return {
        valid: true,
        username: clean
    };
}

/* =========================================================
   USER FACTORY
========================================================= */

function createUserObject(username, password) {
    const now = Date.now();

    return {
        id: generateAnonymousID(),
        username: displayUsername(username),
        password: password,
        bio: "",
        avatar: null,
        followers: [],
        following: [],
        blocked: [],
        postsCount: 0,
        likesReceived: 0,
        dislikesReceived: 0,
        createdAt: now,
        lastSeen: now,
        role: "USER",
        verified: false,
        online: true,
        room: {
            name: "Моя комната",
            description: "Добро пожаловать.",
            wallpaper: "default",
            items: [],
            visitors: []
        },
        settings: {
            profileVisible: true,
            allowMessages: true,
            allowComments: true,
            notifications: true
        }
    };
}

/* =========================================================
   REGISTER
========================================================= */

function registerUser(username, password) {
    const users = getUsers();

    const validation =
        validateUsername(username);

    if (!validation.valid) {
        return {
            success: false,
            message: validation.message
        };
    }

    if (usernameTaken(validation.username)) {
        return {
            success: false,
            message: "Этот ник уже занят."
        };
    }

    if (
        typeof password !== "string" ||
        password.length < 6
    ) {
        return {
            success: false,
            message:
                "Пароль должен содержать минимум 6 символов."
        };
    }

    const user =
        createUserObject(
            validation.username,
            password
        );

    users.push(user);

    saveUsers(users);
    saveCurrentSession(user);

    addActivity(
        user.id,
        "ACCOUNT_CREATED"
    );

    return {
        success: true,
        user
    };
}

/* =========================================================
   LOGIN
========================================================= */

function loginUser(username, password) {
    const users = getUsers();

    const normalized =
        normalizeUsername(username);

    const user =
        users.find(
            item =>
                normalizeUsername(item.username) ===
                    normalized &&
                item.password === password
        );

    if (!user) {
        return {
            success: false,
            message:
                "Неверный ник или пароль."
        };
    }

    user.online = true;
    user.lastSeen = Date.now();

    saveUsers(users);
    saveCurrentSession(user);

    addActivity(
        user.id,
        "LOGIN"
    );

    return {
        success: true,
        user
    };
}

/* =========================================================
   LOGOUT
========================================================= */

function logoutUser() {
    const user = getCurrentUser();

    if (user) {
        const users = getUsers();

        const storedUser =
            users.find(
                item => item.id === user.id
            );

        if (storedUser) {
            storedUser.online = false;
            storedUser.lastSeen = Date.now();
            saveUsers(users);
        }

        addActivity(
            user.id,
            "LOGOUT"
        );
    }

    clearCurrentSession();
    renderApplication();
}

/* =========================================================
   AUTH UI
========================================================= */

let authMode = "login";

const authTabs =
    document.querySelectorAll(
        "[data-auth-mode]"
    );

authTabs.forEach(tab => {
    tab.addEventListener(
        "click",
        () => {
            authTabs.forEach(item =>
                item.classList.remove("active")
            );

            tab.classList.add("active");

            authMode =
                tab.dataset.authMode;

            const submit =
                document.getElementById(
                    "authSubmit"
                );

            if (submit) {
                submit.textContent =
                    authMode === "login"
                        ? "Войти"
                        : "Создать аккаунт";
            }

            const message =
                document.getElementById(
                    "authMessage"
                );

            if (message) {
                message.textContent = "";
            }
        }
    );
});

/* =========================================================
   AUTH FORM
========================================================= */

const authForm =
    document.getElementById("authForm");

if (authForm) {
    authForm.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            const usernameInput =
                document.getElementById(
                    "usernameInput"
                );

            const passwordInput =
                document.getElementById(
                    "passwordInput"
                );

            const message =
                document.getElementById(
                    "authMessage"
                );

            const username =
                usernameInput.value
                    .trim()
                    .replace(/^@/, "");

            const password =
                passwordInput.value;

            const result =
                authMode === "register"
                    ? registerUser(
                        username,
                        password
                    )
                    : loginUser(
                        username,
                        password
                    );

            if (!result.success) {
                message.textContent =
                    result.message;
                return;
            }

            message.textContent = "";

            authForm.reset();

            renderApplication();

            showToast(
                authMode === "register"
                    ? "Аккаунт создан ✨"
                    : "С возвращением 👋"
            );
        }
    );
}

/* =========================================================
   POSTS
========================================================= */

function getPosts() {
    return readStorage(
        STORAGE.POSTS,
        []
    );
}

function savePosts(posts) {
    return writeStorage(
        STORAGE.POSTS,
        posts
    );
}

function getPostByID(postID) {
    return getPosts().find(
        post => post.id === postID
    ) || null;
}

function createPost(text) {
    const user = getCurrentUser();

    if (!user) {
        return {
            success: false,
            message: "Нужно войти."
        };
    }

    const cleanText =
        sanitizeText(
            text,
            NOBODY.maxPostLength
        );

    if (!cleanText) {
        return {
            success: false,
            message: "Пост пустой."
        };
    }

    const posts = getPosts();

    const post = {
        id: generatePostID(),
        userId: user.id,
        username: user.username,
        text: cleanText,
        likes: [],
        dislikes: [],
        comments: [],
        media: [],
        repostOf: null,
        createdAt: Date.now(),
        editedAt: null,
        pinned: false
    };

    posts.unshift(post);

    savePosts(posts);

    updateUserPostCount(
        user.id,
        1
    );

    addActivity(
        user.id,
        "POST_CREATED",
        {
            postID: post.id
        }
    );

    return {
        success: true,
        post
    };
}

/* =========================================================
   UPDATE USER POST COUNT
========================================================= */

function updateUserPostCount(
    userID,
    amount
) {
    const users = getUsers();

    const user =
        users.find(
            item => item.id === userID
        );

    if (!user) return;

    user.postsCount =
        Math.max(
            0,
            Number(user.postsCount || 0) +
                amount
        );

    saveUsers(users);
}

/* =========================================================
   DELETE POST
========================================================= */

function deletePost(postID) {
    const user = getCurrentUser();

    if (!user) return false;

    const posts = getPosts();

    const index =
        posts.findIndex(
            post => post.id === postID
        );

    if (index === -1) {
        return false;
    }

    const post = posts[index];

    if (
        post.userId !== user.id &&
        user.role !== NOBODY.ownerRole
    ) {
        return false;
    }

    posts.splice(index, 1);

    savePosts(posts);

    updateUserPostCount(
        post.userId,
        -1
    );

    addActivity(
        user.id,
        "POST_DELETED",
        {
            postID
        }
    );

    renderFeed();

    showToast(
        "Пост удалён"
    );

    return true;
}

/* =========================================================
   EDIT POST
========================================================= */

function editPost(
    postID,
    text
) {
    const user = getCurrentUser();

    if (!user) return false;

    const posts = getPosts();

    const post =
        posts.find(
            item => item.id === postID
        );

    if (!post) return false;

    if (
        post.userId !== user.id &&
        user.role !== NOBODY.ownerRole
    ) {
        return false;
    }

    const cleanText =
        sanitizeText(
            text,
            NOBODY.maxPostLength
        );

    if (!cleanText) {
        return false;
    }

    post.text = cleanText;
    post.editedAt = Date.now();

    savePosts(posts);

    renderFeed();

    showToast(
        "Пост изменён"
    );

    return true;
}

/* =========================================================
   REACTIONS
========================================================= */

function toggleReaction(
    postID,
    type
) {
    const user = getCurrentUser();

    if (!user) return;

    if (
        type !== "like" &&
        type !== "dislike"
    ) {
        return;
    }

    const posts = getPosts();

    const post =
        posts.find(
            item => item.id === postID
        );

    if (!post) return;

    if (!Array.isArray(post.likes)) {
        post.likes = [];
    }

    if (!Array.isArray(post.dislikes)) {
        post.dislikes = [];
    }

    const target =
        type === "like"
            ? post.likes
            : post.dislikes;

    const opposite =
        type === "like"
            ? post.dislikes
            : post.likes;

    const targetIndex =
        target.indexOf(user.id);

    const oppositeIndex =
        opposite.indexOf(user.id);

    if (oppositeIndex !== -1) {
        opposite.splice(
            oppositeIndex,
            1
        );
    }

    if (targetIndex === -1) {
        target.push(user.id);
    } else {
        target.splice(
            targetIndex,
            1
        );
    }

    savePosts(posts);

    updateReceivedReactions(
        post.userId
    );

    renderFeed();
}

/* =========================================================
   REACTION STATISTICS
========================================================= */

function updateReceivedReactions(userID) {
    const users = getUsers();

    const user =
        users.find(
            item => item.id === userID
        );

    if (!user) return;

    const posts =
        getPosts().filter(
            post => post.userId === userID
        );

    user.likesReceived =
        posts.reduce(
            (total, post) =>
                total +
                (
                    Array.isArray(post.likes)
                        ? post.likes.length
                        : 0
                ),
            0
        );

    user.dislikesReceived =
        posts.reduce(
            (total, post) =>
                total +
                (
                    Array.isArray(post.dislikes)
                        ? post.dislikes.length
                        : 0
                ),
            0
        );

    saveUsers(users);
}

/* =========================================================
   COMMENTS
========================================================= */

function addComment(
    postID,
    text
) {
    const user = getCurrentUser();

    if (!user) return false;

    const cleanText =
        sanitizeText(
            text,
            NOBODY.maxCommentLength
        );

    if (!cleanText) return false;

    const posts = getPosts();

    const post =
        posts.find(
            item => item.id === postID
        );

    if (!post) return false;

    if (!Array.isArray(post.comments)) {
        post.comments = [];
    }

    const comment = {
        id: generateCommentID(),
        userId: user.id,
        username: user.username,
        text: cleanText,
        createdAt: Date.now(),
        likes: []
    };

    post.comments.push(comment);

    savePosts(posts);

    if (post.userId !== user.id) {
        createNotification(
            post.userId,
            "COMMENT",
            {
                postID,
                commentID: comment.id,
                username: user.username
            }
        );
    }

    renderFeed();

    return true;
}

/* =========================================================
   DELETE COMMENT
========================================================= */

function deleteComment(
    postID,
    commentID
) {
    const user = getCurrentUser();

    if (!user) return false;

    const posts = getPosts();

    const post =
        posts.find(
            item => item.id === postID
        );

    if (!post) return false;

    const comments =
        Array.isArray(post.comments)
            ? post.comments
            : [];

    const index =
        comments.findIndex(
            comment =>
                comment.id === commentID
        );

    if (index === -1) {
        return false;
    }

    const comment =
        comments[index];

    if (
        comment.userId !== user.id &&
        post.userId !== user.id &&
        user.role !== NOBODY.ownerRole
    ) {
        return false;
    }

    comments.splice(index, 1);

    post.comments = comments;

    savePosts(posts);

    renderFeed();

    return true;
}

/* =========================================================
   COMMENT UI
========================================================= */

function toggleComments(postID) {
    const element =
        document.getElementById(
            `comments-${postID}`
        );

    if (!element) return;

    element.classList.toggle(
        "hidden"
    );
}

function submitComment(
    event,
    postID
) {
    event.preventDefault();

    const form =
        event.currentTarget;

    const input =
        form.querySelector("input");

    if (!input) return;

    addComment(
        postID,
        input.value
    );

    input.value = "";
}

/* =========================================================
   FEED RENDER
========================================================= */

function renderFeed() {
    const feed =
        document.getElementById("feed");

    if (!feed) return;

    const posts = getPosts();

    const currentUser =
        getCurrentUser();

    if (!currentUser) {
        feed.innerHTML = "";
        return;
    }

    if (!posts.length) {
        feed.innerHTML = `
            <article class="post">
                <div class="center">
                    <div style="font-size:35px;margin-bottom:10px">
                        🌙
                    </div>
                    <strong>
                        Здесь пока тихо.
                    </strong>
                    <p class="muted" style="margin-top:6px">
                        Создай первый пост NOBODY.
                    </p>
                </div>
            </article>
        `;

        return;
    }

    feed.innerHTML =
        posts
            .map(post => {
                const likes =
                    Array.isArray(post.likes)
                        ? post.likes
                        : [];

                const dislikes =
                    Array.isArray(post.dislikes)
                        ? post.dislikes
                        : [];

                const comments =
                    Array.isArray(post.comments)
                        ? post.comments
                        : [];

                const liked =
                    likes.includes(
                        currentUser.id
                    );

                const disliked =
                    dislikes.includes(
                        currentUser.id
                    );

                const own =
                    post.userId ===
                    currentUser.id;

                return `
                    <article
                        class="post"
                        data-post-id="${escapeHTML(post.id)}"
                    >
                        <div class="post-header">
                            <button
                                class="avatar"
                                onclick="openUserProfile('${escapeHTML(post.userId)}')"
                            >
                                ${escapeHTML(
                                    getInitial(post.username)
                                )}
                            </button>

                            <div>
                                <button
                                    class="post-author"
                                    style="border:0;background:none;color:inherit"
                                    onclick="openUserProfile('${escapeHTML(post.userId)}')"
                                >
                                    ${escapeHTML(
                                        post.username || "Nobody"
                                    )}
                                </button>

                                <div class="post-id">
                                    ${escapeHTML(post.userId)}
                                </div>
                            </div>

                            <div class="post-time">
                                ${escapeHTML(
                                    formatDate(post.createdAt)
                                )}
                            </div>
                        </div>

                        <div class="post-content">
                            ${escapeHTML(post.text)
                                .replaceAll("\n", "<br>")}
                        </div>

                        <div class="post-actions">
                            <button
                                class="reaction"
                                onclick="toggleReaction('${escapeHTML(post.id)}','like')"
                                style="${liked ? "outline:2px solid var(--accent)" : ""}"
                            >
                                ❤️ ${likes.length}
                            </button>

                            <button
                                class="reaction"
                                onclick="toggleReaction('${escapeHTML(post.id)}','dislike')"
                                style="${disliked ? "outline:2px solid var(--danger)" : ""}"
                            >
                                👎 ${dislikes.length}
                            </button>

                            <button
                                class="reaction"
                                onclick="toggleComments('${escapeHTML(post.id)}')"
                            >
                                💬 ${comments.length}
                            </button>

                            ${
                                own ||
                                currentUser.role ===
                                    NOBODY.ownerRole
                                    ? `
                                        <button
                                            class="reaction"
                                            onclick="deletePost('${escapeHTML(post.id)}')"
                                        >
                                            🗑️
                                        </button>
                                    `
                                    : `
                                        <button
                                            class="reaction"
                                            onclick="reportPost('${escapeHTML(post.id)}')"
                                        >
                                            ⚑
                                        </button>
                                    `
                            }
                        </div>

                        <div
                            class="comments hidden"
                            id="comments-${escapeHTML(post.id)}"
                        >
                            ${
                                comments.length
                                    ? comments
                                        .map(
                                            comment => `
                                                <div class="comment">
                                                    <div class="comment-avatar">
                                                        ${escapeHTML(
                                                            getInitial(
                                                                comment.username
                                                            )
                                                        )}
                                                    </div>

                                                    <div class="comment-box">
                                                        <div class="comment-name">
                                                            ${escapeHTML(
                                                                comment.username
                                                            )}
                                                        </div>

                                                        <div class="comment-text">
                                                            ${escapeHTML(
                                                                comment.text
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            `
                                        )
                                        .join("")
                                    : `
                                        <p class="muted">
                                            Пока нет комментариев.
                                        </p>
                                    `
                            }

                            <form
                                class="comment-form"
                                onsubmit="submitComment(event,'${escapeHTML(post.id)}')"
                            >
                                <input
                                    class="input"
                                    maxlength="${NOBODY.maxCommentLength}"
                                    placeholder="Написать комментарий..."
                                    required
                                >

                                <button
                                    class="button button-primary"
                                    type="submit"
                                >
                                    →
                                </button>
                            </form>
                        </div>
                    </article>
                `;
            })
            .join("");
}

/* =========================================================
   SEARCH
========================================================= */

const searchInput =
    document.getElementById(
        "searchInput"
    );

if (searchInput) {
    searchInput.addEventListener(
        "input",
        event => {
            searchUsers(
                event.target.value
            );
        }
    );
}

function searchUsers(query) {
    const results =
        document.getElementById(
            "searchResults"
        );

    if (!results) return;

    const clean =
        normalizeUsername(query);

    if (!clean) {
        results.innerHTML = `
            <div class="post center muted">
                Начни вводить ник или Anonymous ID.
            </div>
        `;
        return;
    }

    const currentUser =
        getCurrentUser();

    const users =
        getUsers()
            .filter(user => {
                if (
                    currentUser &&
                    isBlockedBetween(
                        currentUser.id,
                        user.id
                    )
                ) {
                    return false;
                }

                return (
                    normalizeUsername(
                        user.username
                    ).includes(clean) ||
                    user.id
                        .toLowerCase()
                        .includes(
                            clean.toLowerCase()
                        )
                );
            })
            .slice(0, 30);

    if (!users.length) {
        results.innerHTML = `
            <div class="post center muted">
                Никого не найдено.
            </div>
        `;
        return;
    }

    results.innerHTML =
        users
            .map(
                user => `
                    <button
                        class="search-user"
                        onclick="openUserProfile('${escapeHTML(user.id)}')"
                    >
                        <div class="avatar">
                            ${escapeHTML(
                                getInitial(
                                    user.username
                                )
                            )}
                        </div>

                        <div class="search-user-info">
                            <div class="search-user-name">
                                ${escapeHTML(
                                    user.username ||
                                    "Nobody"
                                )}
                            </div>

                            <div class="search-user-id">
                                ${escapeHTML(user.id)}
                            </div>
                        </div>
                    </button>
                `
            )
            .join("");
}

/* =========================================================
   PROFILE
========================================================= */

function renderProfile(userID) {
    const profileCard =
        document.getElementById(
            "profileCard"
        );

    if (!profileCard) return;

    const user =
        getUserByID(userID);

    const currentUser =
        getCurrentUser();

    if (!user || !currentUser) {
        return;
    }

    if (
        isBlockedBetween(
            currentUser.id,
            user.id
        )
    ) {
        profileCard.innerHTML = `
            <div class="center muted">
                Этот профиль недоступен.
            </div>
        `;
        return;
    }

    const posts =
        getPosts().filter(
            post =>
                post.userId === user.id
        );

    const isSelf =
        currentUser.id === user.id;

    const following =
        Array.isArray(
            currentUser.following
        ) &&
        currentUser.following.includes(
            user.id
        );

    profileCard.innerHTML = `
        <div class="avatar large">
            ${escapeHTML(
                getInitial(user.username)
            )}
        </div>

        <h2 class="profile-name">
            ${escapeHTML(
                user.username ||
                "Nobody"
            )}
        </h2>

        <div class="profile-id">
            ${escapeHTML(user.id)}
        </div>

        ${
            user.verified
                ? `
                    <div
                        style="
                            margin-top:8px;
                            color:var(--accent);
                            font-size:12px;
                        "
                    >
                        ✓ verified
                    </div>
                `
                : ""
        }

        ${
            user.bio
                ? `
                    <p class="profile-bio">
                        ${escapeHTML(user.bio)}
                    </p>
                `
                : `
                    <p class="profile-bio">
                        Этот пользователь ничего о себе не написал.
                    </p>
                `
        }

        <div class="profile-stats">
            <div class="stat">
                <strong>${posts.length}</strong>
                постов
            </div>

            <div class="stat">
                <strong>
                    ${user.followers?.length || 0}
                </strong>
                подписчиков
            </div>

            <div class="stat">
                <strong>
                    ${user.following?.length || 0}
                </strong>
                подписок
            </div>

            <div class="stat">
                <strong>
                    ${user.likesReceived || 0}
                </strong>
                лайков
            </div>
        </div>

        ${
            !isSelf
                ? `
                    <div
                        style="
                            margin-top:22px;
                            display:flex;
                            justify-content:center;
                            gap:8px;
                            flex-wrap:wrap;
                        "
                    >
                        <button
                            class="button ${
                                following
                                    ? "button-secondary"
                                    : "button-primary"
                            }"
                            onclick="
                                toggleFollow(
                                    '${escapeHTML(user.id)}'
                                )
                            "
                        >
                            ${
                                following
                                    ? "Вы подписаны"
                                    : "Подписаться"
                            }
                        </button>

                        ${
                            user.settings?.allowMessages !== false
                                ? `
                                    <button
                                        class="button button-secondary"
                                        onclick="
                                            openChat(
                                                '${escapeHTML(user.id)}'
                                            )
                                        "
                                    >
                                        💬 Написать
                                    </button>
                                `
                                : ""
                        }

                        <button
                            class="button button-secondary"
                            onclick="
                                visitRoom(
                                    '${escapeHTML(user.id)}'
                                )
                            "
                        >
                            🏠 Комната
                        </button>

                        <button
                            class="button button-danger"
                            onclick="
                                toggleBlock(
                                    '${escapeHTML(user.id)}'
                                )
                            "
                        >
                            🚫 Заблокировать
                        </button>
                    </div>
                `
                : `
                    <div
                        style="margin-top:22px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"
                    >
                        <button
                            class="button button-secondary"
                            onclick="editMyProfile()"
                        >
                            ✏️ Изменить профиль
                        </button>

                        <button
                            class="button button-secondary"
                            onclick="visitRoom('${escapeHTML(user.id)}')"
                        >
                            🏠 Моя комната
                        </button>
                    </div>
                `
        }
    `;
}

/* =========================================================
   FOLLOW
========================================================= */

function toggleFollow(targetID) {
    const current =
        getCurrentUser();

    if (!current) return;

    const users =
        getUsers();

    const me =
        users.find(
            user => user.id === current.id
        );

    const target =
        users.find(
            user => user.id === targetID
        );

    if (!me || !target) return;

    if (
        me.id === target.id
    ) {
        return;
    }

    if (!Array.isArray(me.following)) {
        me.following = [];
    }

    if (!Array.isArray(target.followers)) {
        target.followers = [];
    }

    const index =
        me.following.indexOf(
            target.id
        );

    if (index === -1) {
        me.following.push(
            target.id
        );

        if (
            !target.followers.includes(
                me.id
            )
        ) {
            target.followers.push(
                me.id
            );
        }

        createNotification(
            target.id,
            "FOLLOW",
            {
                username: me.username
            }
        );

        showToast(
            "Подписка оформлена"
        );
    } else {
        me.following.splice(
            index,
            1
        );

        const followerIndex =
            target.followers.indexOf(
                me.id
            );

        if (followerIndex !== -1) {
            target.followers.splice(
                followerIndex,
                1
            );
        }

        showToast(
            "Подписка отменена"
        );
    }

    saveUsers(users);

    renderProfile(
        targetID
    );
}

/* =========================================================
   BLOCK SYSTEM
========================================================= */

function getBlocks() {
    return readStorage(
        STORAGE.BLOCKS,
        {}
    );
}

function saveBlocks(blocks) {
    return writeStorage(
        STORAGE.BLOCKS,
        blocks
    );
}

function isBlockedBetween(
    firstID,
    secondID
) {
    const blocks = getBlocks();

    return (
        Array.isArray(
            blocks[firstID]
        ) &&
        blocks[firstID].includes(
            secondID
        )
    ) || (
        Array.isArray(
            blocks[secondID]
        ) &&
        blocks[secondID].includes(
            firstID
        )
    );
}

function toggleBlock(targetID) {
    const user =
        getCurrentUser();

    if (!user) return;

    if (user.id === targetID) {
        return;
    }

    const blocks =
        getBlocks();

    if (!Array.isArray(blocks[user.id])) {
        blocks[user.id] = [];
    }

    const index =
        blocks[user.id].indexOf(
            targetID
        );

    if (index === -1) {
        blocks[user.id].push(
            targetID
        );

        showToast(
            "Пользователь заблокирован"
        );
    } else {
        blocks[user.id].splice(
            index,
            1
        );

        showToast(
            "Блокировка снята"
        );
    }

    saveBlocks(blocks);

    showPage("home");
}

/* =========================================================
   NAVIGATION
========================================================= */

const pages = [
    "home",
    "explore",
    "profile",
    "settings",
    "owner"
];

function showPage(page) {
    const user =
        getCurrentUser();

    if (!user) return;

    pages.forEach(
        pageName => {
            const element =
                document.getElementById(
                    `${pageName}Page`
                );

            if (!element) return;

            element.classList.toggle(
                "hidden",
                pageName !== page
            );
        }
    );

    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === page
            );
        });

    if (page === "home") {
        renderFeed();
    }

    if (page === "profile") {
        renderProfile(user.id);
    }

    if (page === "settings") {
        renderSettings();
    }

    if (page === "owner") {
        if (
            user.role !==
            NOBODY.ownerRole
        ) {
            showPage("home");
            return;
        }

        renderOwnerPanel();
    }
}

/* =========================================================
   NAV EVENTS
========================================================= */

const bottomNav =
    document.getElementById(
        "bottomNav"
    );

if (bottomNav) {
    bottomNav.addEventListener(
        "click",
        event => {
            const button =
                event.target.closest(
                    "button"
                );

            if (!button) return;

            if (
                button.dataset.action ===
                "create"
            ) {
                openPostModal();
                return;
            }

            if (
                button.dataset.page
            ) {
                showPage(
                    button.dataset.page
                );
            }
        }
    );
}

/* =========================================================
   OPEN PROFILE
========================================================= */

function openUserProfile(userID) {
    const user =
        getUserByID(userID);

    if (!user) {
        showToast(
            "Пользователь не найден"
        );
        return;
    }

    showPage("profile");

    renderProfile(
        userID
    );
}

/* =========================================================
   PROFILE EDIT
========================================================= */

function editMyProfile() {
    const user =
        getCurrentUser();

    if (!user) return;

    const bio =
        prompt(
            "Введите новое описание профиля:",
            user.bio || ""
        );

    if (bio === null) {
        return;
    }

    const users =
        getUsers();

    const storedUser =
        users.find(
            item => item.id === user.id
        );

    if (!storedUser) return;

    storedUser.bio =
        sanitizeText(
            bio,
            500
        );

    saveUsers(users);

    renderProfile(
        user.id
    );

    showToast(
        "Профиль обновлён"
    );
}

/* =========================================================
   POST MODAL
========================================================= */

const postModal =
    document.getElementById(
        "postModal"
    );

function openPostModal() {
    if (!postModal) return;

    postModal.classList.remove(
        "hidden"
    );

    const textarea =
        document.getElementById(
            "postText"
        );

    if (textarea) {
        textarea.focus();
    }
}

function closePostModal() {
    if (!postModal) return;

    postModal.classList.add(
        "hidden"
    );
}

const createPostButton =
    document.getElementById(
        "createPostButton"
    );

if (createPostButton) {
    createPostButton.addEventListener(
        "click",
        openPostModal
    );
}

const closePostModalButton =
    document.getElementById(
        "closePostModal"
    );

if (closePostModalButton) {
    closePostModalButton.addEventListener(
        "click",
        closePostModal
    );
}

const postForm =
    document.getElementById(
        "postForm"
    );

if (postForm) {
    postForm.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            const textarea =
                document.getElementById(
                    "postText"
                );

            const result =
                createPost(
                    textarea.value
                );

            if (!result.success) {
                showToast(
                    result.message
                );
                return;
            }

            textarea.value = "";

            closePostModal();

            renderFeed();

            showToast(
                "Пост опубликован ✨"
            );
        }
    );
}

/* =========================================================
   RULES
========================================================= */

const rulesModal =
    document.getElementById(
        "rulesModal"
    );

const rulesButton =
    document.getElementById(
        "rulesButton"
    );

const closeRulesModal =
    document.getElementById(
        "closeRulesModal"
    );

if (rulesButton) {
    rulesButton.addEventListener(
        "click",
        () => {
            rulesModal?.classList.remove(
                "hidden"
            );
        }
    );
}

if (closeRulesModal) {
    closeRulesModal.addEventListener(
        "click",
        () => {
            rulesModal?.classList.add(
                "hidden"
            );
        }
    );
}

/* =========================================================
   THEME
========================================================= */

function applyTheme(theme) {
    if (
        theme !== "dark" &&
        theme !== "light" &&
        theme !== "system"
    ) {
        theme = NOBODY.defaultTheme;
    }

    let actualTheme = theme;

    if (theme === "system") {
        actualTheme =
            window.matchMedia(
                "(prefers-color-scheme: dark)"
            ).matches
                ? "dark"
                : "light";
    }

    document.documentElement.dataset.theme =
        actualTheme;
}

function loadTheme() {
    const saved =
        localStorage.getItem(
            STORAGE.THEME
        ) ||
        NOBODY.defaultTheme;

    applyTheme(saved);

    const select =
        document.getElementById(
            "themeSelect"
        );

    if (select) {
        select.value = saved;
    }
}

const themeSelect =
    document.getElementById(
        "themeSelect"
    );

if (themeSelect) {
    themeSelect.addEventListener(
        "change",
        event => {
            const theme =
                event.target.value;

            localStorage.setItem(
                STORAGE.THEME,
                theme
            );

            applyTheme(
                theme
            );
        }
    );
}

const themeButton =
    document.getElementById(
        "themeButton"
    );

if (themeButton) {
    themeButton.addEventListener(
        "click",
        () => {
            const current =
                document.documentElement
                    .dataset.theme;

            const next =
                current === "dark"
                    ? "light"
                    : "dark";

            localStorage.setItem(
                STORAGE.THEME,
                next
            );

            applyTheme(next);

            if (themeSelect) {
                themeSelect.value =
                    next;
            }
        }
    );
}

window
    .matchMedia(
        "(prefers-color-scheme: dark)"
    )
    .addEventListener(
        "change",
        () => {
            const saved =
                localStorage.getItem(
                    STORAGE.THEME
                );

            if (saved === "system") {
                applyTheme(
                    "system"
                );
            }
        }
    );

/* =========================================================
   HEADER PROFILE
========================================================= */

const headerProfileButton =
    document.getElementById(
        "headerProfileButton"
    );

if (headerProfileButton) {
    headerProfileButton.addEventListener(
        "click",
        () => {
            const user =
                getCurrentUser();

            if (!user) return;

            showPage("profile");

            renderProfile(
                user.id
            );
        }
    );
}

/* =========================================================
   SETTINGS
========================================================= */

function renderSettings() {
    const user =
        getCurrentUser();

    if (!user) return;

    const select =
        document.getElementById(
            "themeSelect"
        );

    if (select) {
        select.value =
            localStorage.getItem(
                STORAGE.THEME
            ) || "system";
    }
}

/* =========================================================
   MESSAGES
========================================================= */

function getMessages() {
    return readStorage(
        STORAGE.MESSAGES,
        []
    );
}

function saveMessages(messages) {
    return writeStorage(
        STORAGE.MESSAGES,
        messages
    );
}

function getConversation(
    firstUserID,
    secondUserID
) {
    return getMessages()
        .filter(message =>
            (
                message.senderID ===
                    firstUserID &&
                message.receiverID ===
                    secondUserID
            ) ||
            (
                message.senderID ===
                    secondUserID &&
                message.receiverID ===
                    firstUserID
            )
        )
        .sort(
            (a, b) =>
                a.createdAt -
                b.createdAt
        );
}

function sendMessage(
    receiverID,
    text
) {
    const sender =
        getCurrentUser();

    if (!sender) {
        return {
            success: false,
            message: "Нужно войти."
        };
    }

    if (
        sender.id === receiverID
    ) {
        return {
            success: false,
            message:
                "Нельзя отправить сообщение самому себе."
        };
    }

    const receiver =
        getUserByID(
            receiverID
        );

    if (!receiver) {
        return {
            success: false,
            message:
                "Пользователь не найден."
        };
    }

    if (
        isBlockedBetween(
            sender.id,
            receiver.id
        )
    ) {
        return {
            success: false,
            message:
                "Нельзя отправить сообщение этому пользователю."
        };
    }

    if (
        receiver.settings &&
        receiver.settings.allowMessages === false
    ) {
        return {
            success: false,
            message:
                "Пользователь отключил личные сообщения."
        };
    }

    const cleanText =
        sanitizeText(
            text,
            NOBODY.maxMessageLength
        );

    if (!cleanText) {
        return {
            success: false,
            message:
                "Сообщение пустое."
        };
    }

    const messages =
        getMessages();

    const message = {
        id: generateMessageID(),
        senderID: sender.id,
        receiverID: receiver.id,
        text: cleanText,
        createdAt: Date.now(),
        deletedFor: [],
        read: false
    };

    messages.push(message);

    saveMessages(messages);

    createNotification(
        receiver.id,
        "MESSAGE",
        {
            username:
                sender.username
        }
    );

    return {
        success: true,
        message
    };
}

/* =========================================================
   DELETE MESSAGE
========================================================= */

function deleteMessage(
    messageID
) {
    const user =
        getCurrentUser();

    if (!user) return false;

    const messages =
        getMessages();

    const message =
        messages.find(
            item =>
                item.id === messageID
        );

    if (!message) return false;

    if (
        message.senderID !== user.id &&
        message.receiverID !== user.id &&
        user.role !== NOBODY.ownerRole
    ) {
        return false;
    }

    message.deletedFor =
        Array.isArray(
            message.deletedFor
        )
            ? message.deletedFor
            : [];

    if (
        !message.deletedFor.includes(
            user.id
        )
    ) {
        message.deletedFor.push(
            user.id
        );
    }

    saveMessages(messages);

    return true;
}

/* =========================================================
   CHAT UI FOUNDATION
========================================================= */

let activeChatUserID = null;

function openChat(userID) {
    const target =
        getUserByID(userID);

    if (!target) return;

    activeChatUserID =
        target.id;

    showToast(
        `Чат с ${target.username}`
    );

    /*
        Полноценное окно ЛС будет
        подключено к отдельной странице
        в следующем UI-модуле.
    */

    showPage("profile");

    renderProfile(
        target.id
    );
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

function getNotifications() {
    return readStorage(
        STORAGE.NOTIFICATIONS,
        []
    );
}

function saveNotifications(
    notifications
) {
    return writeStorage(
        STORAGE.NOTIFICATIONS,
        notifications
    );
}

function createNotification(
    userID,
    type,
    data = {}
) {
    const notifications =
        getNotifications();

    notifications.unshift({
        id: generateNotificationID(),
        userID,
        type,
        data,
        read: false,
        createdAt: Date.now()
    });

    saveNotifications(
        notifications
    );
}

function getUserNotifications(
    userID
) {
    return getNotifications()
        .filter(
            notification =>
                notification.userID ===
                userID
        );
}

function getUnreadNotificationCount(
    userID
) {
    return getUserNotifications(
        userID
    ).filter(
        notification =>
            !notification.read
    ).length;
}

function markAllNotificationsRead(
    userID
) {
    const notifications =
        getNotifications();

    notifications.forEach(
        notification => {
            if (
                notification.userID ===
                    userID
            ) {
                notification.read = true;
            }
        }
    );

    saveNotifications(
        notifications
    );
}

/* =========================================================
   REPORT SYSTEM
========================================================= */

function getReports() {
    return readStorage(
        STORAGE.REPORTS,
        []
    );
}

function saveReports(reports) {
    return writeStorage(
        STORAGE.REPORTS,
        reports
    );
}

function createReport(
    targetType,
    targetID,
    reason
) {
    const user =
        getCurrentUser();

    if (!user) return false;

    const allowedReasons = [
        "spam",
        "harassment",
        "personal_data",
        "impersonation",
        "other"
    ];

    if (
        !allowedReasons.includes(
            reason
        )
    ) {
        return false;
    }

    const reports =
        getReports();

    const duplicate =
        reports.some(
            report =>
                report.reporterID ===
                    user.id &&
                report.targetType ===
                    targetType &&
                report.targetID ===
                    targetID &&
                report.status ===
                    "OPEN"
        );

    if (duplicate) {
        showToast(
            "Ты уже отправлял жалобу."
        );
        return false;
    }

    reports.push({
        id: generateReportID(),
        reporterID: user.id,
        targetType,
        targetID,
        reason,
        status: "OPEN",
        createdAt: Date.now()
    });

    saveReports(reports);

    showToast(
        "Жалоба отправлена"
    );

    return true;
}

function reportPost(postID) {
    const reason =
        prompt(
            "Причина жалобы:\nspam / harassment / personal_data / impersonation / other"
        );

    if (!reason) return;

    createReport(
        "POST",
        postID,
        reason.trim()
    );
}

/* =========================================================
   ACTIVITY LOG
========================================================= */

function getActivity() {
    return readStorage(
        STORAGE.ACTIVITY,
        []
    );
}

function saveActivity(activity) {
    return writeStorage(
        STORAGE.ACTIVITY,
        activity
    );
}

function addActivity(
    userID,
    type,
    data = {}
) {
    const activity =
        getActivity();

    activity.unshift({
        id: uuid(),
        userID,
        type,
        data,
        createdAt: Date.now()
    });

    /*
        Ограничиваем локальный журнал,
        чтобы прототип не разрастался
        бесконечно.
    */

    if (activity.length > 5000) {
        activity.length = 5000;
    }

    saveActivity(activity);
}

/* =========================================================
   ROOMS
========================================================= */

function getRooms() {
    return readStorage(
        STORAGE.ROOMS,
        []
    );
}

function saveRooms(rooms) {
    return writeStorage(
        STORAGE.ROOMS,
        rooms
    );
}

function getUserRoom(userID) {
    const user =
        getUserByID(userID);

    if (!user) return null;

    if (!user.room) {
        user.room = {
            name: "Моя комната",
            description: "",
            wallpaper: "default",
            items: [],
            visitors: []
        };

        const users =
            getUsers();

        const stored =
            users.find(
                item => item.id === userID
            );

        if (stored) {
            stored.room =
                user.room;

            saveUsers(users);
        }
    }

    return user.room;
}

function visitRoom(userID) {
    const current =
        getCurrentUser();

    const target =
        getUserByID(userID);

    if (!current || !target) {
        return;
    }

    const room =
        getUserRoom(
            target.id
        );

    if (!room) return;

    if (!Array.isArray(room.visitors)) {
        room.visitors = [];
    }

    if (
        !room.visitors.includes(
            current.id
        )
    ) {
        room.visitors.push(
            current.id
        );
    }

    const users =
        getUsers();

    const stored =
        users.find(
            user =>
                user.id === target.id
        );

    if (stored) {
        stored.room =
            room;

        saveUsers(users);
    }

    showToast(
        `🏠 Ты зашёл в комнату ${target.username}`
    );
}

/* =========================================================
   ROOM ITEMS
========================================================= */

function addRoomItem(
    userID,
    item
) {
    const user =
        getCurrentUser();

    if (!user) return false;

    if (
        user.id !== userID &&
        user.role !== NOBODY.ownerRole
    ) {
        return false;
    }

    const users =
        getUsers();

    const target =
        users.find(
            itemUser =>
                itemUser.id === userID
        );

    if (!target) return false;

    if (!target.room) {
        target.room = {
            name: "Моя комната",
            description: "",
            wallpaper: "default",
            items: [],
            visitors: []
        };
    }

    if (
        !Array.isArray(
            target.room.items
        )
    ) {
        target.room.items = [];
    }

    if (
        target.room.items.length >=
        NOBODY.maxRoomItems
    ) {
        return false;
    }

    target.room.items.push({
        id: uuid(),
        type: item.type || "decoration",
        x: Number(item.x || 0),
        y: Number(item.y || 0),
        rotation:
            Number(item.rotation || 0),
        data:
            item.data || {}
    });

    saveUsers(users);

    return true;
}

/* =========================================================
   MINI GAMES
========================================================= */

function getGames() {
    return readStorage(
        STORAGE.GAMES,
        []
    );
}

function saveGames(games) {
    return writeStorage(
        STORAGE.GAMES,
        games
    );
}

/* =========================================================
   TIC TAC TOE
========================================================= */

function createTicTacToe(
    playerOne,
    playerTwo
) {
    const games =
        getGames();

    const game = {
        id: uuid(),
        type: "TICTACTOE",
        players: [
            playerOne,
            playerTwo
        ],
        board: [
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ],
        turn: playerOne,
        winner: null,
        status: "ACTIVE",
        createdAt: Date.now()
    };

    games.push(game);

    saveGames(games);

    return game;
}

function ticTacToeWinner(
    board
) {
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

    for (
        const [
            a,
            b,
            c
        ] of lines
    ) {
        if (
            board[a] &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return board[a];
        }
    }

    if (
        board.every(
            cell => cell !== ""
        )
    ) {
        return "DRAW";
    }

    return null;
}

function ticTacToeMove(
    gameID,
    index,
    playerID
) {
    const games =
        getGames();

    const game =
        games.find(
            item =>
                item.id === gameID
        );

    if (!game) return false;

    if (
        game.status !== "ACTIVE"
    ) {
        return false;
    }

    if (
        game.turn !== playerID
    ) {
        return false;
    }

    if (
        index < 0 ||
        index > 8 ||
        game.board[index]
    ) {
        return false;
    }

    const symbol =
        game.players[0] === playerID
            ? "X"
            : "O";

    game.board[index] =
        symbol;

    const result =
        ticTacToeWinner(
            game.board
        );

    if (result) {
        game.winner =
            result === "DRAW"
                ? "DRAW"
                : (
                    result === "X"
                        ? game.players[0]
                        : game.players[1]
                );

        game.status = "FINISHED";
    } else {
        game.turn =
            game.players.find(
                id => id !== playerID
            );
    }

    saveGames(games);

    return true;
}

/* =========================================================
   BATTLESHIP FOUNDATION
========================================================= */

function createBattleshipGame(
    playerOne,
    playerTwo
) {
    const games =
        getGames();

    const game = {
        id: uuid(),
        type: "BATTLESHIP",
        players: [
            playerOne,
            playerTwo
        ],
        boards: {
            [playerOne]: [],
            [playerTwo]: []
        },
        shots: {
            [playerOne]: [],
            [playerTwo]: []
        },
        turn: playerOne,
        status: "SETUP",
        winner: null,
        createdAt: Date.now()
    };

    games.push(game);

    saveGames(games);

    return game;
}

/* =========================================================
   OWNER
========================================================= */

function isOwner(user) {
    return Boolean(
        user &&
        user.role ===
            NOBODY.ownerRole
    );
}

function renderOwnerPanel() {
    const current =
        getCurrentUser();

    if (!isOwner(current)) {
        showPage("home");
        return;
    }

    const users =
        getUsers();

    const posts =
        getPosts();

    const reports =
        getReports();

    const messages =
        getMessages();

    const comments =
        posts.reduce(
            (
                total,
                post
            ) =>
                total +
                (
                    Array.isArray(
                        post.comments
                    )
                        ? post.comments.length
                        : 0
                ),
            0
        );

    const ownerStats =
        document.getElementById(
            "ownerStats"
        );

    if (!ownerStats) return;

    ownerStats.innerHTML = `
        <div class="owner-stat">
            <div class="owner-stat-number">
                ${users.length}
            </div>
            <div class="owner-stat-label">
                Пользователей
            </div>
        </div>

        <div class="owner-stat">
            <div class="owner-stat-number">
                ${posts.length}
            </div>
            <div class="owner-stat-label">
                Постов
            </div>
        </div>

        <div class="owner-stat">
            <div class="owner-stat-number">
                ${comments}
            </div>
            <div class="owner-stat-label">
                Комментариев
            </div>
        </div>

        <div class="owner-stat">
            <div class="owner-stat-number">
                ${messages.length}
            </div>
            <div class="owner-stat-label">
                Сообщений
            </div>
        </div>

        <div class="owner-stat">
            <div class="owner-stat-number">
                ${
                    reports.filter(
                        report =>
                            report.status ===
                            "OPEN"
                    ).length
                }
            </div>
            <div class="owner-stat-label">
                Открытых жалоб
            </div>
        </div>

        <div class="owner-stat">
            <div class="owner-stat-number">
                ${
                    users.filter(
                        user =>
                            user.online
                    ).length
                }
            </div>
            <div class="owner-stat-label">
                Сейчас онлайн
            </div>
        </div>
    `;
}

/* =========================================================
   OWNER USER ACTIONS
========================================================= */

function ownerDeleteUser(
    userID
) {
    const owner =
        getCurrentUser();

    if (!isOwner(owner)) {
        return false;
    }

    if (
        owner.id === userID
    ) {
        return false;
    }

    const users =
        getUsers();

    const index =
        users.findIndex(
            user =>
                user.id === userID
        );

    if (index === -1) {
        return false;
    }

    users.splice(
        index,
        1
    );

    saveUsers(users);

    const posts =
        getPosts()
            .filter(
                post =>
                    post.userId !==
                    userID
            );

    savePosts(posts);

    const blocks =
        getBlocks();

    delete blocks[userID];

    Object.keys(blocks)
        .forEach(
            key => {
                blocks[key] =
                    blocks[key].filter(
                        id =>
                            id !== userID
                    );
            }
        );

    saveBlocks(blocks);

    renderOwnerPanel();

    showToast(
        "Аккаунт удалён"
    );

    return true;
}

function ownerDeletePost(
    postID
) {
    const owner =
        getCurrentUser();

    if (!isOwner(owner)) {
        return false;
    }

    return deletePost(
        postID
    );
}

function ownerResolveReport(
    reportID,
    status = "RESOLVED"
) {
    const owner =
        getCurrentUser();

    if (!isOwner(owner)) {
        return false;
    }

    const reports =
        getReports();

    const report =
        reports.find(
            item =>
                item.id === reportID
        );

    if (!report) {
        return false;
    }

    report.status =
        status;

    report.resolvedAt =
        Date.now();

    report.resolvedBy =
        owner.id;

    saveReports(reports);

    renderOwnerPanel();

    return true;
}

/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(text) {
    const toast =
        document.getElementById(
            "toast"
        );

    if (!toast) return;

    toast.textContent =
        text;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        toastTimer
    );

    toastTimer =
        setTimeout(
            () => {
                toast.classList.remove(
                    "show"
                );
            },
            2200
        );
}

/* =========================================================
   APPLICATION RENDER
========================================================= */

function renderApplication() {
    const user =
        getCurrentUser();

    const authScreen =
        document.getElementById(
            "authScreen"
        );

    const bottomNavigation =
        document.getElementById(
            "bottomNav"
        );

    if (!user) {
        authScreen?.classList.remove(
            "hidden"
        );

        bottomNavigation?.classList.add(
            "hidden"
        );

        pages.forEach(
            page => {
                const element =
                    document.getElementById(
                        `${page}Page`
                    );

                if (element) {
                    element.classList.add(
                        "hidden"
                    );
                }
            }
        );

        return;
    }

    authScreen?.classList.add(
        "hidden"
    );

    bottomNavigation?.classList.remove(
        "hidden"
    );

    const welcomeText =
        document.getElementById(
            "welcomeText"
        );

    if (welcomeText) {
        welcomeText.textContent =
            `Привет, ${
                user.username ||
                "Nobody"
            }.`;
    }

    const profileButton =
        document.getElementById(
            "headerProfileButton"
        );

    if (profileButton) {
        profileButton.textContent =
            getInitial(
                user.username
            );
    }

    showPage("home");
}

/* =========================================================
   ONLINE STATUS
========================================================= */

function updateOnlineStatus() {
    const user =
        getCurrentUser();

    if (!user) return;

    const users =
        getUsers();

    const stored =
        users.find(
            item =>
                item.id === user.id
        );

    if (!stored) return;

    stored.online =
        document.visibilityState ===
        "visible";

    stored.lastSeen =
        Date.now();

    saveUsers(users);
}

document.addEventListener(
    "visibilitychange",
    updateOnlineStatus
);

window.addEventListener(
    "beforeunload",
    () => {
        const user =
            getCurrentUser();

        if (!user) return;

        const users =
            getUsers();

        const stored =
            users.find(
                item =>
                    item.id === user.id
            );

        if (stored) {
            stored.online = false;
            stored.lastSeen =
                Date.now();

            saveUsers(users);
        }
    }
);

/* =========================================================
   ESC KEY
========================================================= */

document.addEventListener(
    "keydown",
    event => {
        if (
            event.key !== "Escape"
        ) {
            return;
        }

        document
            .querySelectorAll(
                ".modal"
            )
            .forEach(
                modal => {
                    modal.classList.add(
                        "hidden"
                    );
                }
            );
    }
);

/* =========================================================
   CLICK OUTSIDE MODALS
========================================================= */

document.addEventListener(
    "click",
    event => {
        if (
            !event.target.classList.contains(
                "modal"
            )
        ) {
            return;
        }

        event.target.classList.add(
            "hidden"
        );
    }
);

/* =========================================================
   DEFAULT DATA
========================================================= */

function initializeDatabase() {
    if (
        !storageExists(
            STORAGE.USERS
        )
    ) {
        saveUsers([]);
    }

    if (
        !storageExists(
            STORAGE.POSTS
        )
    ) {
        savePosts([]);
    }

    if (
        !storageExists(
            STORAGE.MESSAGES
        )
    ) {
        saveMessages([]);
    }

    if (
        !storageExists(
            STORAGE.ROOMS
        )
    ) {
        saveRooms([]);
    }

    if (
        !storageExists(
            STORAGE.GAMES
        )
    ) {
        saveGames([]);
    }

    if (
        !storageExists(
            STORAGE.NOTIFICATIONS
        )
    ) {
        saveNotifications([]);
    }

    if (
        !storageExists(
            STORAGE.REPORTS
        )
    ) {
        saveReports([]);
    }

    if (
        !storageExists(
            STORAGE.BLOCKS
        )
    ) {
        saveBlocks({});
    }

    if (
        !storageExists(
            STORAGE.ACTIVITY
        )
    ) {
        saveActivity([]);
    }
}

/* =========================================================
   DATA MIGRATION
========================================================= */

function migrateUsers() {
    const users =
        getUsers();

    let changed = false;

    users.forEach(
        user => {
            if (
                !Array.isArray(
                    user.followers
                )
            ) {
                user.followers = [];
                changed = true;
            }

            if (
                !Array.isArray(
                    user.following
                )
            ) {
                user.following = [];
                changed = true;
            }

            if (
                !Array.isArray(
                    user.blocked
                )
            ) {
                user.blocked = [];
                changed = true;
            }

            if (
                !user.settings
            ) {
                user.settings = {
                    profileVisible: true,
                    allowMessages: true,
                    allowComments: true,
                    notifications: true
                };

                changed = true;
            }

            if (
                !user.room
            ) {
                user.room = {
                    name: "Моя комната",
                    description: "",
                    wallpaper: "default",
                    items: [],
                    visitors: []
                };

                changed = true;
            }

            if (
                !user.role
            ) {
                user.role = "USER";
                changed = true;
            }

            if (
                typeof user.postsCount !==
                "number"
            ) {
                user.postsCount = 0;
                changed = true;
            }
        }
    );

    if (changed) {
        saveUsers(users);
    }
}

function migratePosts() {
    const posts =
        getPosts();

    let changed = false;

    posts.forEach(
        post => {
            if (
                !Array.isArray(
                    post.likes
                )
            ) {
                post.likes = [];
                changed = true;
            }

            if (
                !Array.isArray(
                    post.dislikes
                )
            ) {
                post.dislikes = [];
                changed = true;
            }

            if (
                !Array.isArray(
                    post.comments
                )
            ) {
                post.comments = [];
                changed = true;
            }

            if (
                !Array.isArray(
                    post.media
                )
            ) {
                post.media = [];
                changed = true;
            }
        }
    );

    if (changed) {
        savePosts(posts);
    }
}

/* =========================================================
   DEBUG API
========================================================= */

window.NOBODY = {
    version: NOBODY.version,

    getCurrentUser,
    getUsers,
    getPosts,
    getMessages,
    getNotifications,
    getReports,

    createPost,
    deletePost,
    editPost,

    sendMessage,
    deleteMessage,

    toggleFollow,
    toggleBlock,

    createTicTacToe,
    ticTacToeMove,

    createBattleshipGame,

    addRoomItem,
    visitRoom,

    createReport,

    ownerDeleteUser,
    ownerDeletePost,
    ownerResolveReport
};

/* =========================================================
   INITIALIZATION
========================================================= */

initializeDatabase();
migrateUsers();
migratePosts();
loadTheme();
renderApplication();

/* =========================================================
   END OF NOBODY v0.1 CORE
========================================================= */
