"use strict";

const DB_KEY = "nobody_local_v3";
const SESSION_KEY = "nobody_session_v3";
const THEME_KEY = "nobody_theme_v3";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = {
  db: loadDB(),
  userId: localStorage.getItem(SESSION_KEY) || "",
  user: null,
  currentPage: "home",
  currentChat: null,
  posts: [],
  filter: "latest",
  authMode: "login",
  theme: localStorage.getItem(THEME_KEY) || "system"
};

function uid(prefix="id"){
  return prefix + "_" + cryptoRandom() + "_" + Date.now().toString(36);
}
function cryptoRandom(){
  try { return crypto.getRandomValues(new Uint32Array(2)).join("").slice(0,12); }
  catch { return Math.random().toString(36).slice(2,14); }
}
function now(){ return new Date().toISOString(); }
function loadDB(){
  try {
    const raw = localStorage.getItem(DB_KEY);
    if(raw) return JSON.parse(raw);
  } catch {}
  return {users:[],posts:[],likes:[],messages:[],rooms:[],privacy:{},sessions:[]};
}
function saveDB(){ localStorage.setItem(DB_KEY, JSON.stringify(state.db)); }
function escapeHTML(v){
  return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function initials(user){
  const n = user?.displayName || user?.username || "N";
  return escapeHTML(n.slice(0,1).toUpperCase());
}
function formatDate(s){
  const d = new Date(s); if(Number.isNaN(d.getTime())) return "";
  const diff = Date.now()-d.getTime();
  if(diff<60000) return "только что";
  if(diff<3600000) return Math.floor(diff/60000)+" мин";
  if(diff<86400000) return Math.floor(diff/3600000)+" ч";
  return d.toLocaleDateString("ru-RU",{day:"numeric",month:"short"});
}
function toast(message,type="normal"){
  const t=$("#toast"); if(!t)return;
  t.textContent=message;t.dataset.type=type;t.classList.add("show");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2600);
}
function message(el,text,type="error"){if(!el)return;el.textContent=text;el.dataset.type=type}
function getUser(id){return state.db.users.find(u=>u.id===id)||null}
function currentUser(){return normalizeOwnerRole(getUser(state.userId))}
function sanitizeUsername(v){return v.toLowerCase().trim().replace(/\s+/g,"_").replace(/[^a-z0-9а-яё_.-]/gi,"").slice(0,24)}
function anonymousId(user){return "N-" + user.id.replace(/\W/g,"").slice(-8).toUpperCase()}

/* Theme */
function applyTheme(theme){
  state.theme=theme;localStorage.setItem(THEME_KEY,theme);
  const dark=theme==="dark"||(theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark",dark);
  const select=$("#themeSelect");if(select)select.value=theme;
}
function toggleTheme(){applyTheme(state.theme==="dark"?"light":state.theme==="light"?"system":"dark")}

/* Screens */
function hideScreens(){$$(".screen").forEach(x=>x.classList.add("hidden"))}
function showScreen(id){hideScreens();$("#"+id)?.classList.remove("hidden")}
function updateOwnerUI(){
  const ownerButtons=$$('[data-page="owner"]');
  ownerButtons.forEach(button=>button.classList.toggle("hidden",!isOwner()));
  const ownerPage=$("#ownerPage");
  if(ownerPage && !isOwner() && state.currentPage==="owner") navigate("home");
}

function enterApp(){
  state.user=currentUser();
  if(!state.user){logout(false);return}
  $("#topbar")?.classList.remove("hidden");$("#bottomNav")?.classList.remove("hidden");$("#headerProfileButton")?.classList.remove("hidden");
  updateUserUI();updateOwnerUI();navigate("home");renderOwner();
}
function leaveApp(){
  $("#topbar")?.classList.add("hidden");$("#bottomNav")?.classList.add("hidden");$("#headerProfileButton")?.classList.add("hidden");
  showScreen("authScreen");
}
function updateUserUI(){
  const u=state.user;if(!u)return;
  $("#welcomeText").textContent=`Привет, ${u.displayName||u.username}.`;
  $("#welcomeDescription").textContent=`Ты вошёл как @${u.username}.`;
  $("#headerProfileButton").textContent=initials(u);
  $("#composerAvatar").textContent=initials(u);
  $("#composerUsername").textContent="@"+u.username;
  $("#roomOwnerLabel").textContent="@"+u.username;
}
function updateNav(){
  $$(".nav-button[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===state.currentPage));
}

/* Auth */
function showLoginForm(){
  state.authMode="login";$("#authEyebrow").textContent="WELCOME BACK";$("#authFormTitle").textContent="Войти";$("#authFormDescription").textContent="Вернись в свой анонимный мир.";$("#authSubmit").textContent="Войти";
  $("#passwordConfirmField")?.classList.add("hidden");$("#nicknameOptionalField")?.classList.add("hidden");$("#loginTab")?.classList.add("active");$("#registerTab")?.classList.remove("active");$("#passwordInput")?.setAttribute("autocomplete","current-password");message($("#authMessage"),"");
}
function showRegisterForm(){
  state.authMode="register";$("#authEyebrow").textContent="CREATE ACCOUNT";$("#authFormTitle").textContent="Создать аккаунт";$("#authFormDescription").textContent="Придумай nobody-личность.";$("#authSubmit").textContent="Создать аккаунт";
  $("#passwordConfirmField")?.classList.remove("hidden");$("#nicknameOptionalField")?.classList.remove("hidden");$("#loginTab")?.classList.remove("active");$("#registerTab")?.classList.add("active");$("#passwordInput")?.setAttribute("autocomplete","new-password");message($("#authMessage"),"");
}
function submitAuth(e){
  e.preventDefault();
  let username=sanitizeUsername($("#usernameInput")?.value||"");
  const password=$("#passwordInput")?.value||"";
  const display=$("#displayNameInput")?.value.trim()||username;
  if(username.length<3)return message($("#authMessage"),"Ник должен содержать минимум 3 символа.");
  if(password.length<6)return message($("#authMessage"),"Пароль должен содержать минимум 6 символов.");
  if(state.authMode==="register"){
    if(password!==($("#passwordConfirmInput")?.value||""))return message($("#authMessage"),"Пароли не совпадают.");
    if(state.db.users.some(u=>u.username===username))return message($("#authMessage"),"Такой ник уже занят.");
    const u={id:uid("usr"),username,displayName:display.slice(0,40),bio:"",passwordHash:btoa(unescape(encodeURIComponent(password))),createdAt:now(),anonymousId:"",role:OWNER_USERNAMES.has(username)?"owner":"user"};
    u.anonymousId=anonymousId(u);state.db.users.push(u);state.userId=u.id;saveDB();localStorage.setItem(SESSION_KEY,u.id);$("#authForm").reset();toast("Аккаунт создан ✦","success");enterApp();
  } else {
    const u=state.db.users.find(x=>x.username===username);
    if(!u||u.passwordHash!==btoa(unescape(encodeURIComponent(password))))return message($("#authMessage"),"Неверный ник или пароль.");
    state.userId=u.id;state.user=u;localStorage.setItem(SESSION_KEY,u.id);$("#authForm").reset();toast("Добро пожаловать обратно 👋","success");enterApp();
  }
}
function logout(show=true){
  state.userId="";state.user=null;state.currentChat=null;localStorage.removeItem(SESSION_KEY);leaveApp();if(show)toast("Ты вышел из аккаунта.","success");
}

/* Owner / admin access */
const OWNER_USERNAMES = new Set(["nobody", "bendi"]);

function isOwner(user = state.user) {
  return Boolean(user && user.role === "owner");
}

function normalizeOwnerRole(user) {
  if (!user) return user;
  // Migrate the two reserved owner accounts from older NOBODY versions.
  if (OWNER_USERNAMES.has(String(user.username || "").toLowerCase())) {
    if (user.role !== "owner") {
      user.role = "owner";
      saveDB();
    }
  }
  return user;
}

function canOpenOwnerPanel() {
  if (!isOwner()) {
    toast("Owner Panel доступна только аккаунтам nobody и bendi.");
    return false;
  }
  return true;
}

/* Navigation */
function navigate(page){
  const map={home:"homePage",explore:"explorePage",profile:"profilePage",messages:"messagesPage",games:"gamesPage",room:"roomPage",settings:"settingsPage",owner:"ownerPage"};
  if(!map[page])return;
  if(page==="owner" && !canOpenOwnerPanel()) { updateNav(); return; }
  state.currentPage=page;showScreen(map[page]);updateNav();$("#moreMenu")?.classList.add("hidden");
  if(page==="home")loadFeed();if(page==="profile")loadProfile();if(page==="explore")renderEmptySearch();if(page==="messages")loadConversations();if(page==="room")loadRoom();if(page==="owner")renderOwner();
}

/* Posts */
function getPosts(){
  const posts=state.db.posts.map(p=>({...p,author:getUser(p.authorId),liked:state.db.likes.some(l=>l.postId===p.id&&l.userId===state.userId),likes:state.db.likes.filter(l=>l.postId===p.id).length,comments:p.comments||0}));
  return posts.filter(p=>p.author);
}
function loadFeed(){state.posts=getPosts();renderFeed()}
function renderFeed(){
  const feed=$("#feed");if(!feed)return;
  let posts=[...state.posts];
  if(state.filter==="popular")posts.sort((a,b)=>b.likes-a.likes);else posts.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if(!posts.length){feed.innerHTML=`<div class="empty-state"><div class="empty-icon">✦</div><strong>Здесь пока тихо</strong><p>Создай первый пост в NOBODY.</p></div>`;return}
  feed.innerHTML=posts.map(renderPost).join("");bindPostButtons();
}
function renderPost(p){
  const a=p.author;
  return `<article class="post-card" data-post-id="${escapeHTML(p.id)}"><div class="post-header"><button class="post-author" data-user-id="${escapeHTML(a.id)}" type="button"><div class="avatar">${initials(a)}</div><div class="post-author-info"><strong>${escapeHTML(a.displayName||a.username)}</strong><span>@${escapeHTML(a.username)} · ${escapeHTML(formatDate(p.createdAt))}</span></div></button>${a.id===state.userId?`<button class="post-more" data-delete-post="${escapeHTML(p.id)}" type="button">•••</button>`:""}</div><div class="post-body">${escapeHTML(p.text).replaceAll("\n","<br>")}</div><div class="post-actions"><button class="post-action like-button ${p.liked?"liked":""}" data-like-post="${escapeHTML(p.id)}" type="button">♡ <span>${p.likes}</span></button><button class="post-action" data-comment-post="${escapeHTML(p.id)}" type="button">◌ <span>${p.comments}</span></button><button class="post-action" data-share-post="${escapeHTML(p.id)}" type="button">↗</button></div></article>`;
}
function bindPostButtons(){
  $$("[data-like-post]").forEach(b=>b.onclick=()=>likePost(b.dataset.likePost));
  $$("[data-delete-post]").forEach(b=>b.onclick=()=>deletePost(b.dataset.deletePost));
  $$("[data-comment-post]").forEach(b=>b.onclick=()=>toast("Комментарии появятся в следующем обновлении."));
  $$("[data-share-post]").forEach(b=>b.onclick=async()=>{const url=location.href.split("#")[0]+"#post="+b.dataset.sharePost;try{await navigator.clipboard.writeText(url);toast("Ссылка скопирована.","success")}catch{toast("Не удалось скопировать ссылку.")}});
  $$("[data-user-id]").forEach(b=>b.onclick=()=>openUserProfile(b.dataset.userId));
}
function likePost(id){
  const i=state.db.likes.findIndex(l=>l.postId===id&&l.userId===state.userId);
  if(i>=0)state.db.likes.splice(i,1);else state.db.likes.push({postId:id,userId:state.userId});
  saveDB();loadFeed();
}
function deletePost(id){
  if(!confirm("Удалить этот пост?"))return;
  state.db.posts=state.db.posts.filter(p=>p.id!==id);state.db.likes=state.db.likes.filter(l=>l.postId!==id);saveDB();loadFeed();toast("Пост удалён.","success");
}
function createPost(e){
  e.preventDefault();const text=$("#postText")?.value.trim()||"";
  if(!text)return message($("#postMessage"),"Напиши что-нибудь.");
  state.db.posts.unshift({id:uid("post"),authorId:state.userId,text,createdAt:now(),comments:0});saveDB();$("#postForm").reset();updatePostCounter();closeModal("postModal");loadFeed();toast("Пост опубликован ✦","success");
}
function updatePostCounter(){const n=$("#postText")?.value.length||0;$("#postCounter").textContent=`${n} / 2000`}

/* Search/Profile */
let searchTimer;
function searchUsers(q){
  const r=$("#searchResults");if(!r)return;
  clearTimeout(searchTimer);
  if(!q.trim())return renderEmptySearch();
  r.innerHTML=`<div class="loading-state">Ищем...</div>`;
  searchTimer=setTimeout(()=>{
    const query=q.toLowerCase();const users=state.db.users.filter(u=>u.id!==state.userId&&(u.username.includes(query)||(u.displayName||"").toLowerCase().includes(query)));
    if(!users.length){r.innerHTML=`<div class="empty-state"><div class="empty-icon">⌕</div><strong>Никого не нашли</strong><p>Попробуй другой запрос.</p></div>`;return}
    r.innerHTML=users.map(u=>`<button class="user-result" data-search-user="${u.id}" type="button"><div class="avatar">${initials(u)}</div><div class="user-result-info"><strong>${escapeHTML(u.displayName||u.username)}</strong><span>@${escapeHTML(u.username)}</span><small>${escapeHTML(u.anonymousId)}</small></div><span class="setting-arrow">›</span></button>`).join("");
    $$("[data-search-user]").forEach(b=>b.onclick=()=>openUserProfile(b.dataset.searchUser));
  },180);
}
function renderEmptySearch(){$("#searchResults").innerHTML=`<div class="empty-state"><div class="empty-icon">⌕</div><strong>Кого сегодня найдём?</strong><p>Введи хотя бы несколько символов.</p></div>`}
function loadProfile(){
  state.user=currentUser();updateUserUI();renderProfile(state.user,true);
  const posts=getPosts().filter(p=>p.author.id===state.userId);$("#profileFeed").innerHTML=posts.length?posts.map(renderPost).join(""):`<div class="empty-state"><div class="empty-icon">✦</div><strong>Пока нет публикаций</strong><p>Создай свой первый пост.</p></div>`;bindPostButtons();
}
function renderProfile(u,own=false){
  $("#profileCard").innerHTML=`<div class="profile-avatar avatar large">${initials(u)}</div><div class="profile-main"><div class="profile-name-row"><div><h1>${escapeHTML(u.displayName||u.username)}</h1><p>@${escapeHTML(u.username)}</p></div>${own?`<button class="secondary-button" id="profileInlineEdit" type="button">Редактировать</button>`:`<button class="primary-button" id="profileMessageButton" type="button">Написать</button>`}</div><p class="profile-bio">${escapeHTML(u.bio||"Этот nobody пока ничего о себе не рассказал.")}</p><span class="profile-id">${escapeHTML(u.anonymousId)}</span></div>`;
  if(own)$("#profileInlineEdit").onclick=openProfileEditor;else $("#profileMessageButton").onclick=()=>{closeModal("userProfileModal");navigate("messages");openChat(u.id)};
  $("#profileInfo").innerHTML=`<div><span>Ник</span><strong>@${escapeHTML(u.username)}</strong></div><div><span>Anonymous ID</span><strong>${escapeHTML(u.anonymousId)}</strong></div><div><span>В NOBODY с</span><strong>${new Date(u.createdAt).toLocaleDateString("ru-RU")}</strong></div>`;
}
function openUserProfile(id){
  const u=getUser(id);if(!u)return;
  const privacy=state.db.privacy[id]||{showID:true,allowMessages:true,showRoom:true};
  $("#userProfileModalContent").innerHTML=`<div class="public-profile"><div class="avatar large">${initials(u)}</div><h2>${escapeHTML(u.displayName||u.username)}</h2><p class="public-username">@${escapeHTML(u.username)}</p><p>${escapeHTML(u.bio||"Нет описания.")}</p>${privacy.showID?`<div class="profile-id">${escapeHTML(u.anonymousId)}</div>`:""}<div class="public-profile-actions">${u.id!==state.userId&&privacy.allowMessages?`<button class="primary-button full-button" id="modalMessageUser" type="button">Написать сообщение</button>`:""}</div></div>`;
  $("#modalMessageUser")?.addEventListener("click",()=>{closeModal("userProfileModal");navigate("messages");openChat(u.id)});openModal("userProfileModal");
}
function openProfileEditor(){$("#editUsernameInput").value=state.user.username;$("#editBioInput").value=state.user.bio||"";message($("#profileEditMessage"),"");openModal("profileEditModal")}
function saveProfile(e){
  e.preventDefault();const username=sanitizeUsername($("#editUsernameInput").value);const bio=$("#editBioInput").value.trim();if(username.length<3)return message($("#profileEditMessage"),"Ник слишком короткий.");if(state.user?.role==="owner"&&username!==state.user.username)return message($("#profileEditMessage"),"Имя Owner-аккаунта нельзя изменить.");if(state.db.users.some(u=>u.username===username&&u.id!==state.userId))return message($("#profileEditMessage"),"Такой ник уже занят.");
  state.user.username=username;state.user.displayName=username;state.user.bio=bio;saveDB();closeModal("profileEditModal");updateUserUI();loadProfile();toast("Профиль сохранён.","success");
}

/* Messages */
function conversationUsers(){
  const ids=new Set(state.db.messages.filter(m=>m.from===state.userId||m.to===state.userId).map(m=>m.from===state.userId?m.to:m.from));
  return [...ids].map(getUser).filter(Boolean);
}
function loadConversations(){renderConversations()}
function renderConversations(){
  const c=$("#conversationItems"),users=conversationUsers();if(!users.length){c.innerHTML=`<div class="empty-state"><div class="empty-icon">□</div><strong>Чатов пока нет</strong><p>Найди пользователя и начни разговор.</p></div>`;return}
  c.innerHTML=users.map(u=>{const msgs=state.db.messages.filter(m=>(m.from===state.userId&&m.to===u.id)||(m.to===state.userId&&m.from===u.id)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));const last=msgs[0];return `<button class="conversation-item ${state.currentChat===u.id?"active":""}" data-conversation-user="${u.id}" type="button"><div class="avatar">${initials(u)}</div><div class="conversation-info"><strong>${escapeHTML(u.displayName||u.username)}</strong><span>${last?escapeHTML(last.text):"Новый разговор"}</span></div>${last?`<time>${formatDate(last.createdAt)}</time>`:""}</button>`}).join("");
  $$("[data-conversation-user]").forEach(b=>b.onclick=()=>openChat(b.dataset.conversationUser));
}
function openChat(id){
  const u=getUser(id);if(!u)return;
  const privacy=state.db.privacy[id]||{allowMessages:true};if(privacy.allowMessages===false)return toast("Этот пользователь не принимает сообщения.");
  state.currentChat=id;$("#chatPlaceholder").classList.add("hidden");$("#chatContent").classList.remove("hidden");$("#chatUsername").textContent=u.displayName||u.username;$("#chatUserID").textContent="@"+u.username;$("#chatAvatar").textContent=initials(u);renderMessages();renderConversations();
}
function renderMessages(){
  const c=$("#chatMessages"),u=state.currentChat;
  const list=state.db.messages.filter(m=>(m.from===state.userId&&m.to===u)||(m.to===state.userId&&m.from===u)).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  c.innerHTML=list.length?list.map(m=>`<div class="message-row ${m.from===state.userId?"own":"other"}"><div class="message-bubble"><div class="message-text">${escapeHTML(m.text).replaceAll("\n","<br>")}</div><time>${formatDate(m.createdAt)}</time></div></div>`).join(""):`<div class="empty-state"><div class="empty-icon">✦</div><strong>Начни разговор</strong><p>Здесь пока нет сообщений.</p></div>`;c.scrollTop=c.scrollHeight;
}
function sendMessage(e){
  e.preventDefault();const input=$("#chatInput"),text=input.value.trim();if(!state.currentChat||!text)return;
  state.db.messages.push({id:uid("msg"),from:state.userId,to:state.currentChat,text,createdAt:now()});saveDB();input.value="";renderMessages();renderConversations();
}

/* Room / privacy */
function defaultRoom(){return{name:"Моя комната",description:"У комнаты пока нет описания.",style:"mint",visits:true}}
function getRoom(){return state.db.rooms.find(r=>r.userId===state.userId)||null}
function loadRoom(){
  const r=getRoom()||defaultRoom();$("#roomStatusTitle").textContent=r.visits?"Твоя комната открыта":"Твоя комната закрыта";$("#roomStatusText").textContent=r.description;$("#roomVisitsToggle").checked=!!r.visits;$("#roomPreview").dataset.style=r.style||"mint";
}
function saveRoom(e){
  e.preventDefault();let r=getRoom();if(!r){r={userId:state.userId,...defaultRoom()};state.db.rooms.push(r)}
  r.name=$("#roomNameInput").value.trim()||"Моя комната";r.description=$("#roomDescriptionInput").value.trim()||"У комнаты пока нет описания.";r.style=$("#roomStyleSelect").value;r.visits=$("#roomVisitsToggle").checked;saveDB();closeModal("roomEditModal");loadRoom();toast("Комната сохранена.","success");
}
function openRoomEditor(){const r=getRoom()||defaultRoom();$("#roomNameInput").value=r.name;$("#roomDescriptionInput").value=r.description;$("#roomStyleSelect").value=r.style;$("#roomVisitsToggle").checked=r.visits;openModal("roomEditModal")}
function saveRoomVisits(){let r=getRoom();if(!r){r={userId:state.userId,...defaultRoom()};state.db.rooms.push(r)}r.visits=$("#roomVisitsToggle").checked;saveDB();loadRoom()}
function loadPrivacy(){const p=state.db.privacy[state.userId]||{showID:true,allowMessages:true,showRoom:true};$("#showIDToggle").checked=p.showID;$("#allowMessagesToggle").checked=p.allowMessages;$("#showRoomToggle").checked=p.showRoom}
function savePrivacy(){state.db.privacy[state.userId]={showID:$("#showIDToggle").checked,allowMessages:$("#allowMessagesToggle").checked,showRoom:$("#showRoomToggle").checked};saveDB();closeModal("privacyModal");toast("Настройки приватности сохранены.","success")}

/* Games */
function openGame(game){openModal("gameModal");const c=$("#gameContainer");if(game==="tic-tac-toe"){$("#gameModalTitle").textContent="Крестики-нолики";ticTacToe(c)}else if(game==="number"){$("#gameModalTitle").textContent="Угадай число";numberGame(c)}else if(game==="reaction"){$("#gameModalTitle").textContent="Reaction";reactionGame(c)}else{$("#gameModalTitle").textContent="Морской бой";battleship(c)}}
function ticTacToe(c){
  let board=Array(9).fill(""),turn="X",over=false;
  const win=b=>[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(([a,d,f])=>b[a]&&b[a]===b[d]&&b[a]===b[f]);
  function render(){c.innerHTML=`<div class="mini-game"><div class="game-status">${over?"Игра окончена":`Ход: ${turn}`}</div><div class="ttt-board">${board.map((x,i)=>`<button class="ttt-cell" data-i="${i}" type="button">${x}</button>`).join("")}</div><button class="secondary-button" id="resetTTT" type="button">Новая игра</button></div>`;$$("[data-i]").forEach(b=>b.onclick=()=>move(+b.dataset.i));$("#resetTTT").onclick=()=>{board=Array(9).fill("");turn="X";over=false;render()}}
  function move(i){if(over||board[i])return;board[i]=turn;const w=win(board);if(w){over=true;render();toast(`Победил ${turn}!`,"success");return}if(board.every(Boolean)){over=true;render();toast("Ничья!");return}turn=turn==="X"?"O":"X";render()}render();
}
function numberGame(c){let target=Math.floor(Math.random()*100)+1,attempts=0;c.innerHTML=`<div class="mini-game"><p>Я загадал число от 1 до 100.</p><input id="numberGuess" class="input" type="number" min="1" max="100" placeholder="Твоё число"><button id="guessButton" class="primary-button full-button" type="button">Проверить</button><p id="numberFeedback" class="game-feedback"></p></div>`;$("#guessButton").onclick=()=>{const v=Number($("#numberGuess").value);if(v<1||v>100)return;attempts++;if(v===target){$("#numberFeedback").textContent=`Правильно! Попыток: ${attempts}.`;$("#guessButton").textContent="Сыграть снова";$("#guessButton").onclick=()=>numberGame(c)}else $("#numberFeedback").textContent=v<target?"Больше ↑":"Меньше ↓"}}
function reactionGame(c){
  c.innerHTML=`<div class="mini-game"><button id="reactionButton" class="reaction-button" type="button">Жди...</button><p id="reactionResult">Нажми и жди сигнала.</p></div>`;const b=$("#reactionButton"),r=$("#reactionResult");let active=false,start=0,timer;
  function prepare(){active=false;b.textContent="Жди...";b.classList.remove("ready");clearTimeout(timer);timer=setTimeout(()=>{active=true;start=performance.now();b.textContent="ЖМИ!";b.classList.add("ready")},1000+Math.random()*2500)}
  b.onclick=()=>{if(!active){clearTimeout(timer);r.textContent="Слишком рано!";prepare();return}const t=Math.round(performance.now()-start);r.textContent=`Твоя реакция: ${t} мс`;b.textContent="Ещё раз";b.classList.remove("ready");active=false;b.onclick=prepare};prepare();
}
function battleship(c){
  const size=6,total=36,shipCount=5;let ships=[],shots=new Set(),hits=0;
  while(ships.length<shipCount){const x=Math.floor(Math.random()*total);if(!ships.includes(x))ships.push(x)}
  function render(){c.innerHTML=`<div class="mini-game"><p>Найди ${shipCount} кораблей на поле 6×6.</p><div class="battleship-grid">${Array.from({length:total},(_,i)=>{let shot=shots.has(i),hit=shot&&ships.includes(i);return `<button class="ship-cell ${hit?"hit":shot?"miss":""}" data-shot="${i}" type="button">${hit?"✦":shot?"•":""}</button>`}).join("")}</div><p id="battleStatus">Найдено: ${hits}/${shipCount}</p><button id="battleReset" class="secondary-button" type="button">Новое поле</button></div>`;$$("[data-shot]").forEach(b=>b.onclick=()=>shot(+b.dataset.shot));$("#battleReset").onclick=()=>battleship(c)}
  function shot(i){if(shots.has(i))return;shots.add(i);if(ships.includes(i)){hits++;toast("Попадание!","success")}else toast("Мимо.");render();if(hits===shipCount)toast("Все корабли найдены! 🎉","success")}render();
}

/* Owner */
function renderOwner(){
  const c=$("#ownerStats");
  if(!c) return;
  if(!isOwner()){
    c.innerHTML=`<div class="owner-denied"><strong>Доступ закрыт</strong><p>Owner Panel доступна только аккаунтам <b>nobody</b> и <b>bendi</b>.</p></div>`;
    $("#ownerUserList")?.replaceChildren();
    $("#ownerPostList")?.replaceChildren();
    return;
  }

  const conversations=new Set(state.db.messages.map(m=>[m.from,m.to].sort().join("_")).filter(Boolean)).size;
  const owners=state.db.users.filter(u=>u.role==="owner").length;
  const recentUsers=[...state.db.users].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,12);
  const recentPosts=[...state.db.posts].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,12);

  c.innerHTML=[
    ["Пользователи",state.db.users.length],
    ["Посты",state.db.posts.length],
    ["Чаты",conversations],
    ["Сообщения",state.db.messages.length],
    ["Owner-аккаунты",owners],
    ["Лайки",state.db.likes.length]
  ].map(([a,b])=>`<div class="owner-stat"><span>${a}</span><strong>${b}</strong></div>`).join("");

  const ul=$("#ownerUserList");
  if(ul){
    ul.innerHTML=recentUsers.length?recentUsers.map(u=>`
      <div class="owner-row">
        <div class="avatar">${initials(u)}</div>
        <div class="owner-row-main"><strong>${escapeHTML(u.displayName||u.username)}</strong><span>@${escapeHTML(u.username)} · ${u.role==="owner"?"OWNER":"USER"}</span></div>
        ${u.role==="owner"?'<span class="owner-badge">OWNER</span>':`<button class="secondary-button owner-delete-user" data-owner-user="${escapeHTML(u.id)}" type="button">Удалить</button>`}
      </div>`).join(""):`<div class="empty-state compact">Пользователей пока нет.</div>`;
    $$(".owner-delete-user").forEach(b=>b.onclick=()=>ownerDeleteUser(b.dataset.ownerUser));
  }

  const pl=$("#ownerPostList");
  if(pl){
    pl.innerHTML=recentPosts.length?recentPosts.map(post=>{const u=getUser(post.authorId);return `
      <div class="owner-row owner-post-row">
        <div class="owner-row-main"><strong>@${escapeHTML(u?.username||"unknown")}</strong><span>${escapeHTML(post.text).slice(0,160)} · ${escapeHTML(formatDate(post.createdAt))}</span></div>
        <button class="secondary-button owner-delete-post" data-owner-post="${escapeHTML(post.id)}" type="button">Удалить</button>
      </div>`}).join(""):`<div class="empty-state compact">Постов пока нет.</div>`;
    $$(".owner-delete-post").forEach(b=>b.onclick=()=>ownerDeletePost(b.dataset.ownerPost));
  }
}

function ownerDeleteUser(userId){
  if(!isOwner()) return toast("Доступ запрещён.");
  const u=getUser(userId);
  if(!u) return;
  if(u.role==="owner" || OWNER_USERNAMES.has(String(u.username).toLowerCase())) return toast("Owner-аккаунт нельзя удалить.");
  if(!confirm(`Удалить аккаунт @${u.username}? Это удалит его посты, лайки, сообщения и комнату.`)) return;
  state.db.users=state.db.users.filter(x=>x.id!==userId);
  state.db.posts=state.db.posts.filter(x=>x.authorId!==userId);
  state.db.likes=state.db.likes.filter(x=>x.userId!==userId && !state.db.posts.some(p=>p.id===x.postId));
  state.db.messages=state.db.messages.filter(x=>x.from!==userId && x.to!==userId);
  state.db.rooms=state.db.rooms.filter(x=>x.userId!==userId);
  delete state.db.privacy[userId];
  saveDB();
  renderOwner();loadFeed();
  toast("Пользователь удалён.","success");
}

function ownerDeletePost(postId){
  if(!isOwner()) return toast("Доступ запрещён.");
  if(!state.db.posts.some(p=>p.id===postId)) return;
  if(!confirm("Удалить этот пост из NOBODY?")) return;
  state.db.posts=state.db.posts.filter(p=>p.id!==postId);
  state.db.likes=state.db.likes.filter(l=>l.postId!==postId);
  saveDB();renderOwner();loadFeed();
  toast("Пост удалён владельцем.","success");
}

function ownerExport(){
  if(!isOwner()) return toast("Доступ запрещён.");
  const payload={exportedAt:now(),version:"nobody_local_v4",data:state.db};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=`nobody-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast("Резервная копия выгружена.","success");
}

function ownerRefresh(){
  state.db=loadDB();state.user=currentUser();renderOwner();
  if(state.currentPage==="home")loadFeed();
  toast("Данные обновлены.","success");
}

/* Modals */
function openModal(id){$("#"+id)?.classList.remove("hidden");document.body.classList.add("modal-open")}
function closeModal(id){$("#"+id)?.classList.add("hidden");if(!document.querySelector(".modal:not(.hidden)"))document.body.classList.remove("modal-open")}
function closeAllModals(){$$(".modal").forEach(m=>m.classList.add("hidden"));document.body.classList.remove("modal-open")}

/* Seed demo data only once, so search/messages aren't empty after first registration. */
function seed(){
  if(localStorage.getItem("nobody_seed_v3"))return;
  const demo=[["moonlit","Moonlit"],["pixel","Pixel"],["moss","Moss"]];
  demo.forEach(([username,displayName])=>{const u={id:uid("usr"),username,displayName,bio:"nobody user",passwordHash:"",createdAt:now(),anonymousId:""};u.anonymousId=anonymousId(u);state.db.users.push(u)});
  saveDB();localStorage.setItem("nobody_seed_v3","1");
}

/* Events */
function setup(){
  applyTheme(state.theme);
  $("#openLoginButton").onclick=()=>{showScreen("authFormScreen");showLoginForm()};
  $("#openRegisterButton").onclick=()=>{showScreen("authFormScreen");showRegisterForm()};
  $("#authBackButton").onclick=()=>showScreen("authScreen");
  $("#loginTab").onclick=showLoginForm;$("#registerTab").onclick=showRegisterForm;$("#authForm").onsubmit=submitAuth;
  $$("[data-page]").forEach(b=>b.onclick=()=>navigate(b.dataset.page));
  $("#ownerRefreshButton")?.addEventListener("click",ownerRefresh);
  $("#ownerExportButton")?.addEventListener("click",ownerExport);
  $$("[data-action=create]").forEach(b=>b.onclick=()=>openModal("postModal"));
  $("#brandButton").onclick=()=>state.user&&navigate("home");$("#headerProfileButton").onclick=()=>navigate("profile");
  $("#moreNavButton").onclick=e=>{e.stopPropagation();$("#moreMenu").classList.toggle("hidden")};
  document.addEventListener("click",e=>{const m=$("#moreMenu");if(m&&!m.contains(e.target)&&e.target!==$("#moreNavButton"))m.classList.add("hidden")});
  $("#createPostButton").onclick=()=>openModal("postModal");$("#postForm").onsubmit=createPost;$("#postText").oninput=updatePostCounter;
  $("#addEmojiButton").onclick=()=>{const t=$("#postText");const a=[" ✦"," ♡"," ✨"," :3"," ◌"];t.value+=a[Math.floor(Math.random()*a.length)];t.focus();updatePostCounter()};
  $$(".filter-button").forEach(b=>b.onclick=()=>{$$(".filter-button").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.filter=b.dataset.feedFilter==="popular"?"popular":"latest";renderFeed()});
  $("#searchInput").oninput=e=>{const q=e.target.value;$("#searchClearButton").classList.toggle("hidden",!q);searchUsers(q)};
  $("#searchClearButton").onclick=()=>{$("#searchInput").value="";$("#searchInput").dispatchEvent(new Event("input"))};
  $$(".suggestion-chip").forEach(b=>b.onclick=()=>{$("#searchInput").value=b.dataset.searchExample;$("#searchInput").dispatchEvent(new Event("input"))});
  $("#chatForm").onsubmit=sendMessage;$("#chatBackButton").onclick=()=>{$("#chatContent").classList.add("hidden");$("#chatPlaceholder").classList.remove("hidden");state.currentChat=null;renderConversations()};
  $("#newMessageButton").onclick=()=>{navigate("explore");toast("Найди пользователя, чтобы начать чат.")};
  $("#editRoomButton").onclick=openRoomEditor;$("#roomEditForm").onsubmit=saveRoom;$("#roomVisitsToggle").onchange=saveRoomVisits;
  $("#themeSelect").onchange=e=>applyTheme(e.target.value);$("#themeButton").onclick=toggleTheme;
  $("#editProfileButton").onclick=openProfileEditor;$("#logoutButton").onclick=()=>logout(true);
  $("#privacyButton").onclick=()=>{loadPrivacy();openModal("privacyModal")};$("#savePrivacyButton").onclick=savePrivacy;
  $("#rulesButton").onclick=()=>openModal("rulesModal");$("#safetyButton").onclick=()=>openModal("safetyModal");$("#openRulesFromAuth").onclick=()=>openModal("rulesModal");
  $$(".game-card").forEach(b=>b.onclick=()=>openGame(b.dataset.game));
  $$("[data-close-modal]").forEach(b=>b.onclick=()=>closeModal(b.dataset.closeModal));
  $("#profileEditForm").onsubmit=saveProfile;
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAllModals()});
  window.addEventListener("storage",()=>{state.db=loadDB();state.user=currentUser();if(state.user&&state.currentPage==="home")loadFeed()});
  seed();
  setTimeout(()=>{$("#loadingScreen")?.classList.add("hidden");if(state.userId&&currentUser())enterApp();else leaveApp()},350);
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",setup):setup();