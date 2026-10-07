"use strict";

/* ================= 工具 ================= */

const $ = (s, el = document) => el.querySelector(s);
const audio = $("#audio");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtTime = (s) => {
  if (s == null || !isFinite(s) || s < 0) return "–:––";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const hashHue = (s) => {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
};

const zh = (a, b) => String(a || "").localeCompare(String(b || ""), "zh-Hans-CN");

function toast(msg, ms = 2600) {
  const wrap = $("#toast-wrap");
  while (wrap.children.length >= 4) wrap.firstChild.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/* ================= 状态 ================= */

const state = {
  tracks: [],
  songs: [], // 搜索过滤 + 排序后的歌曲
  artists: [], // [{ name, items }]
  albums: [], // [{ name, artist, items }]
  items: [], // 当前页面展示的歌曲行
  tab: "songs", // songs | artists | albums
  detail: null, // { type: 'artist' | 'album', name }
  query: "",
  queue: [],
  qi: -1,
  shuffle: false,
  repeat: "off",
  playing: false,
  currentKey: null,
  pending: 0,
  errors: 0,
};

const byKey = new Map();

/* ================= 曲库加载 ================= */

let pollTimer = null;

function schedulePoll(delay = 1500) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(pollLibrary, delay);
}

async function pollLibrary() {
  try {
    const r = await fetch("/api/library");
    if (r.status === 401) { showLogin(); return; }
    if (r.ok) {
      const data = await r.json();
      state.pending = data.pending || 0;
      state.tracks = data.tracks || [];
      indexTracks();
      recompute();
      render();
    }
  } catch { /* 网络抖动，下轮再试 */ }
  if (state.pending > 0) {
    $("#build-notice").textContent = `正在为新歌曲读取标签与封面…（剩余 ${state.pending} 首）`;
    $("#build-notice").classList.remove("hidden");
    schedulePoll();
  } else {
    $("#build-notice").classList.add("hidden");
  }
}

async function loadLibrary() {
  $("#list").innerHTML = `<div class="skeleton">正在加载音乐库…</div>`;
  try {
    const r = await fetch("/api/library");
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) { toast("加载音乐库失败，稍后自动重试"); schedulePoll(3000); return; }
    const data = await r.json();
    state.pending = data.pending || 0;
    state.tracks = data.tracks || [];
    indexTracks();
    recompute();
    render();
    restoreLastTrack();
    if (state.pending > 0) { $("#build-notice").classList.remove("hidden"); schedulePoll(800); }
  } catch {
    $("#list").innerHTML = `<div class="skeleton">加载失败，请刷新重试</div>`;
  }
}

function indexTracks() {
  byKey.clear();
  for (const t of state.tracks) byKey.set(t.key, t);
}

/* ================= 数据整理 ================= */

function recompute() {
  const q = state.query.trim().toLowerCase();
  const match = (t) => !q || [t.title, t.artist, t.album].some((v) => v && v.toLowerCase().includes(q));

  state.songs = state.tracks.filter(match).sort((a, b) => zh(a.title, b.title));

  const artistMap = new Map();
  const albumMap = new Map();
  for (const t of state.tracks) {
    if (!match(t)) continue;
    const an = t.artist || "未知歌手";
    const bn = t.album || "未知专辑";
    if (!artistMap.has(an)) artistMap.set(an, { name: an, items: [] });
    artistMap.get(an).items.push(t);
    if (!albumMap.has(bn)) albumMap.set(bn, { name: bn, artist: an, items: [] });
    albumMap.get(bn).items.push(t);
  }
  const byAlbum = (a, b) => zh(a.album, b.album) || ((a.trackNo ?? 1e9) - (b.trackNo ?? 1e9)) || zh(a.title, b.title);
  const byTrack = (a, b) => ((a.trackNo ?? 1e9) - (b.trackNo ?? 1e9)) || zh(a.title, b.title);
  for (const a of artistMap.values()) a.items.sort(byAlbum);
  for (const al of albumMap.values()) al.items.sort(byTrack);
  state.artists = [...artistMap.values()].sort((a, b) => zh(a.name, b.name));
  state.albums = [...albumMap.values()].sort((a, b) => zh(a.name, b.name));

  if (state.detail) {
    const pool = state.detail.type === "artist" ? state.artists : state.albums;
    const entry = pool.find((x) => x.name === state.detail.name);
    state.items = entry ? entry.items : [];
    if (entry) state.detail.entry = entry; // 后台刷新后保持 hero 数据同步
  } else if (state.tab === "songs") {
    state.items = state.songs;
  } else {
    state.items = [];
  }
}

/* ================= 渲染 ================= */

function coverHtml(t, cls) {
  if (t.cover) return `<img class="${cls}" loading="lazy" src="/api/cover/${esc(t.cover)}" alt="">`;
  const hue = hashHue(t.artist || t.album || t.title);
  const ch = esc((t.title || "♪").trim().charAt(0).toUpperCase());
  return `<div class="${cls} ph" style="background:linear-gradient(135deg,hsl(${hue} 55% 62%),hsl(${(hue + 48) % 360} 60% 50%))">${ch}</div>`;
}

function rowHtml(t, i) {
  const playing = t.key === state.currentKey;
  const idx = playing
    ? `<span class="eq"><i></i><i></i><i></i></span>`
    : `<span class="num">${i + 1}</span>`;
  const sub = [t.artist, t.album].filter(Boolean).join(" · ");
  const dur = t.duration != null ? fmtTime(t.duration) : `${(t.format || "").toUpperCase() || "?"}`;
  return `<div class="row ${playing ? "playing" : ""} ${playing && !state.playing ? "paused" : ""}" data-i="${i}">
    <div class="row-idx">${idx}</div>
    ${coverHtml(t, "row-cover")}
    <div class="row-main"><div class="row-title">${esc(t.title)}</div><div class="row-sub">${esc(sub) || "&nbsp;"}</div></div>
    <span class="row-dur">${dur}</span>
    <button class="row-del" data-key="${esc(t.key)}" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
  </div>`;
}

function cardHtml(entry, type, i) {
  const sub = type === "album" ? `${entry.items.length} 首 · ${esc(entry.artist || "未知歌手")}` : `${entry.items.length} 首`;
  return `<div class="card" style="animation-delay:${Math.min(i * 26, 320)}ms" data-type="${type}" data-name="${esc(entry.name)}">
    <div class="card-cover">${mosaicInner(entry)}</div>
    <div class="card-name">${esc(entry.name)}</div>
    <div class="card-sub">${sub}</div>
  </div>`;
}

// 卡片封面内容（不带外层尺寸容器）
function mosaicInner(entry) {
  const covers = [...new Set(entry.items.map((t) => t.cover).filter(Boolean))].slice(0, 4);
  if (covers.length >= 4) {
    return `<div class="mosaic">${covers.map((c) => `<img loading="lazy" src="/api/cover/${esc(c)}">`).join("")}</div>`;
  }
  if (covers.length > 0) return `<img loading="lazy" src="/api/cover/${esc(covers[0])}" alt="">`;
  const hue = hashHue(entry.name);
  const ch = esc(entry.name.trim().charAt(0).toUpperCase());
  return `<div class="ph-big" style="background:linear-gradient(135deg,hsl(${hue} 60% 58%),hsl(${(hue + 48) % 360} 62% 46%))">${ch}</div>`;
}

function render() {
  const listEl = $("#list");

  if (!state.tracks.length) {
    listEl.innerHTML = `<div class="empty-state">
      <div class="big">🎵</div>
      <h3>音乐库还是空的</h3>
      <p>把音频文件拖进页面，或点击右上角「上传音乐」</p>
      <button class="primary" id="empty-upload">上传音乐</button>
    </div>`;
    $("#empty-upload").addEventListener("click", () => $("#file-input").click());
    return;
  }

  let html = "";
  let anim = true;

  if (state.detail) {
    // 详情页：hero + 歌曲列表
    const isArtist = state.detail.type === "artist";
    const backLabel = isArtist ? "全部歌手" : "全部专辑";
    const albumCount = isArtist ? new Set(state.items.map((t) => t.album || "未知专辑")).size : 0;
    html += `<div class="detail-hero">
      <button class="ghost icon-only hero-back" id="btn-back" title="${backLabel}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <div class="hero-cover">${mosaicInner(state.detail.entry || { name: state.detail.name, items: state.items })}</div>
      <div>
        <div class="hero-kicker">${isArtist ? "歌手" : "专辑"}</div>
        <h2>${esc(state.detail.name)}</h2>
        <div class="hero-sub">${state.items.length} 首歌曲${isArtist ? ` · ${albumCount} 张专辑` : ""}</div>
      </div>
      <button class="ghost play-all" id="btn-play-all" style="margin-left:auto">▶ 播放全部</button>
    </div>`;
    html += state.items.map((t, i) => rowHtml(t, i)).join("");
  } else if (state.tab === "songs") {
    if (!state.songs.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="big">🔍</div><h3>没有找到「${esc(state.query)}」</h3><p>换个关键词试试</p></div>`;
      return;
    }
    const artistCount = new Set(state.tracks.map((t) => t.artist || "未知歌手")).size;
    html += `<div class="list-head"><span>共 ${state.tracks.length} 首 · ${artistCount} 位歌手</span>
      <button class="ghost play-all" id="btn-play-all">▶ 播放全部</button></div>`;
    html += state.songs.map((t, i) => rowHtml(t, i)).join("");
  } else {
    const entries = state.tab === "artists" ? state.artists : state.albums;
    const type = state.tab === "artists" ? "artist" : "album";
    if (!entries.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="big">🔍</div><h3>没有找到「${esc(state.query)}」</h3><p>换个关键词试试</p></div>`;
      return;
    }
    const label = state.tab === "artists" ? `共 ${entries.length} 位歌手` : `共 ${entries.length} 张专辑`;
    html += `<div class="list-head"><span>${label}</span></div><div class="cards">`;
    html += entries.map((e, i) => cardHtml(e, type, i)).join("");
    html += `</div>`;
  }

  listEl.innerHTML = html;
  if (anim) {
    listEl.classList.remove("view-anim");
    void listEl.offsetWidth; // 重新触发动画
    listEl.classList.add("view-anim");
  }
  const back = $("#btn-back");
  if (back) back.addEventListener("click", closeDetail);
  const playAll = $("#btn-play-all");
  if (playAll) playAll.addEventListener("click", () => playIndex(0));
  listEl.scrollTop = 0;
}

function openDetail(type, name) {
  const pool = type === "artist" ? state.artists : state.albums;
  const entry = pool.find((x) => x.name === name);
  state.detail = { type, name, entry };
  recompute();
  render();
}

function closeDetail() {
  state.detail = null;
  recompute();
  render();
}

$("#list").addEventListener("click", (e) => {
  const del = e.target.closest(".row-del");
  if (del) {
    e.stopPropagation();
    deleteTrack(del.dataset.key);
    return;
  }
  const card = e.target.closest(".card");
  if (card) {
    openDetail(card.dataset.type, card.dataset.name);
    return;
  }
  const row = e.target.closest(".row");
  if (row) playIndex(+row.dataset.i);
});

/* ================= 播放核心 ================= */

function playIndex(i) {
  if (!state.items[i]) return;
  state.queue = state.items.slice();
  state.qi = i;
  startCurrent();
}

function startCurrent() {
  const t = state.queue[state.qi];
  if (!t) return;
  state.currentKey = t.key;
  state.errors = 0;
  audio.src = "/api/stream/" + t.key.split("/").map(encodeURIComponent).join("/");
  audio.play().catch(() => toast("播放被浏览器拦截，请再点一次"));
  updateNowPlaying(t);
  localStorage.setItem("mp_last", t.key);
  renderQueue();
}

function currentTrack() {
  return state.queue[state.qi] || byKey.get(state.currentKey) || null;
}

function updateNowPlaying(t) {
  const cover = $("#np-cover");
  cover.classList.add("active");
  if (t.cover) {
    cover.style.backgroundImage = `url(/api/cover/${encodeURIComponent(t.cover)})`;
    cover.textContent = "";
  } else {
    const hue = hashHue(t.artist || t.title);
    cover.style.backgroundImage = `linear-gradient(135deg,hsl(${hue} 60% 62%),hsl(${(hue + 48) % 360} 62% 50%))`;
    cover.textContent = (t.title || "♪").trim().charAt(0).toUpperCase();
  }
  $("#np-title").textContent = t.title || "未知歌曲";
  $("#np-artist").textContent = [t.artist, t.album].filter(Boolean).join(" · ") || "未知歌手";
  document.title = `${t.title || "云音"}${t.artist ? " · " + t.artist : ""}`;
  render();
  renderQueue();

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title || "",
        artist: t.artist || "",
        album: t.album || "",
        artwork: t.cover ? [{ src: `/api/cover/${t.cover}`, sizes: "512x512" }] : [],
      });
    } catch { /* 忽略 */ }
  }
}

function togglePlay() {
  if (!audio.src) {
    if (state.items.length) playIndex(0);
    return;
  }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

function nextTrack(manual = false) {
  if (!state.queue.length) return;
  let ni;
  if (state.shuffle && state.queue.length > 1) {
    do { ni = Math.floor(Math.random() * state.queue.length); } while (ni === state.qi);
  } else {
    ni = state.qi + 1;
    if (ni >= state.queue.length) {
      if (manual || state.repeat === "all") ni = 0;
      else {
        state.playing = false;
        syncPlayUI();
        return;
      }
    }
  }
  state.qi = ni;
  startCurrent();
}

function prevTrack() {
  if (!state.queue.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  state.qi = (state.qi - 1 + state.queue.length) % state.queue.length;
  startCurrent();
}

audio.addEventListener("play", () => { state.playing = true; syncPlayUI(); });
audio.addEventListener("pause", () => { state.playing = false; syncPlayUI(); });

audio.addEventListener("ended", () => {
  if (state.repeat === "one") { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  nextTrack(false);
});

audio.addEventListener("error", () => {
  if (!state.currentKey || !audio.error) return;
  const t = currentTrack();
  state.errors++;
  toast(`无法播放：${t ? t.title : "未知"}（${state.errors >= 3 ? "已停止" : "自动跳下一首"}）`);
  if (state.errors < 3 && state.queue.length > 1) nextTrack(true);
});

audio.addEventListener("loadedmetadata", () => {
  $("#time-total").textContent = fmtTime(audio.duration);
  maybePatchDuration();
});

audio.addEventListener("timeupdate", () => {
  if (seeking) return;
  const d = audio.duration;
  if (isFinite(d) && d > 0) {
    $("#seek").value = Math.round((audio.currentTime / d) * 1000);
    $("#seek").style.setProperty("--fill", (audio.currentTime / d) * 100 + "%");
    $("#time-cur").textContent = fmtTime(audio.currentTime);
  }
});

function maybePatchDuration() {
  const t = currentTrack();
  const d = audio.duration;
  if (!t || !isFinite(d) || d <= 0) return;
  if (t.duration == null || Math.abs(t.duration - d) > 0.4) {
    t.duration = Math.round(d * 10) / 10;
    fetch("/api/duration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: t.key, duration: d }),
    }).catch(() => {});
  }
}

function syncPlayUI() {
  $("#btn-play").innerHTML = state.playing
    ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.87l11-6.86a1 1 0 0 0 0-1.74l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>`;
  const playingRow = document.querySelector(".row.playing");
  if (playingRow) playingRow.classList.toggle("paused", !state.playing);
  const qRow = document.querySelector(".q-row.playing");
  if (qRow) qRow.querySelector(".eq")?.style.setProperty("animation-play-state", state.playing ? "running" : "paused");
}

/* ================= 进度 / 音量 ================= */

let seeking = false;

$("#seek").addEventListener("input", () => {
  seeking = true;
  const d = audio.duration;
  if (isFinite(d)) {
    const t = ($("#seek").value / 1000) * d;
    $("#time-cur").textContent = fmtTime(t);
    $("#seek").style.setProperty("--fill", $("#seek").value / 10 + "%");
  }
});
$("#seek").addEventListener("change", () => {
  const d = audio.duration;
  if (isFinite(d)) audio.currentTime = ($("#seek").value / 1000) * d;
  seeking = false;
});

const ICON_VOL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.3 5.8a9 9 0 0 1 0 12.4"/></svg>`;
const ICON_MUTED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none"/><path d="m16 9 6 6M22 9l-6 6"/></svg>`;

function setVolume(v, save = true) {
  v = Math.min(1, Math.max(0, v));
  audio.volume = v;
  audio.muted = false;
  $("#vol").value = Math.round(v * 100);
  $("#vol").style.setProperty("--fill", v * 100 + "%");
  $("#btn-mute").innerHTML = v === 0 ? ICON_MUTED : ICON_VOL;
  if (save) localStorage.setItem("mp_vol", String(v));
}

$("#vol").addEventListener("input", () => setVolume($("#vol").value / 100));

$("#btn-mute").addEventListener("click", () => {
  if (audio.volume > 0) { state._prevVol = audio.volume; setVolume(0); }
  else setVolume(state._prevVol ?? 1);
});

/* ================= 播放模式 ================= */

$("#btn-shuffle").addEventListener("click", () => {
  state.shuffle = !state.shuffle;
  $("#btn-shuffle").classList.toggle("active", state.shuffle);
  localStorage.setItem("mp_shuffle", state.shuffle ? "1" : "");
  toast(state.shuffle ? "随机播放：开" : "随机播放：关", 1400);
});

const REPEAT_ICON = {
  off: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`,
  all: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent)"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`,
  one: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent)"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><text x="12" y="15.5" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor" stroke="none">1</text></svg>`,
};

$("#btn-repeat").addEventListener("click", () => {
  state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
  $("#btn-repeat").innerHTML = REPEAT_ICON[state.repeat];
  localStorage.setItem("mp_repeat", state.repeat);
  const label = { off: "顺序播放", all: "列表循环", one: "单曲循环" }[state.repeat];
  toast(label, 1400);
});

$("#btn-prev").addEventListener("click", () => prevTrack());
$("#btn-next").addEventListener("click", () => nextTrack(true));
$("#btn-play").addEventListener("click", togglePlay);

/* ================= 播放队列 ================= */

function renderQueue() {
  const wrap = $("#queue-list");
  if (!state.queue.length) {
    wrap.innerHTML = `<div class="q-empty">队列是空的<br>点击任意歌曲开始播放</div>`;
    return;
  }
  wrap.innerHTML = state.queue
    .map((t, i) => {
      const playing = i === state.qi;
      return `<div class="q-row ${playing ? "playing" : ""}" data-i="${i}">
        <span class="row-idx">${playing ? `<span class="eq"><i></i><i></i><i></i></span>` : i + 1}</span>
        <span class="q-title">${esc(t.title)}</span>
        <span class="q-artist">${esc(t.artist || "")}</span>
      </div>`;
    })
    .join("");
}

$("#queue-list").addEventListener("click", (e) => {
  const row = e.target.closest(".q-row");
  if (!row) return;
  state.qi = +row.dataset.i;
  startCurrent();
});

function toggleQueue(open) {
  const q = $("#queue");
  const willOpen = open ?? !q.classList.contains("open");
  q.classList.toggle("open", willOpen);
}

$("#btn-queue").addEventListener("click", () => toggleQueue());
$("#btn-close-queue").addEventListener("click", () => toggleQueue(false));

/* ================= 视图切换 / 搜索 ================= */

$("#seg").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-view]");
  if (!btn) return;
  state.tab = btn.dataset.view;
  state.detail = null;
  syncSeg();
  localStorage.setItem("mp_tab", state.tab);
  recompute();
  render();
});

function syncSeg() {
  for (const b of $("#seg").querySelectorAll("button")) {
    b.classList.toggle("active", b.dataset.view === state.tab && !state.detail);
  }
}

let searchTimer = null;
$("#search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = $("#search").value;
    recompute();
    render();
  }, 140);
});

/* ================= 上传 / 删除 ================= */

const AUDIO_RE = /\.(mp3|flac|m4a|aac|ogg|oga|opus|wav|webm)$/i;

async function handleFiles(files) {
  const list = [...files].filter((f) => AUDIO_RE.test(f.name));
  if (!list.length) { toast("没有可上传的音频文件"); return; }
  let ok = 0;
  for (let i = 0; i < list.length; i++) {
    toast(`正在上传 ${i + 1}/${list.length}：${list[i].name}`, 10000);
    try {
      const fd = new FormData();
      fd.append("file", list[i]);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.track) {
        mergeTrack(data.track);
        ok++;
      } else {
        toast(data.error || `上传失败：${list[i].name}`);
      }
    } catch {
      toast(`上传失败：${list[i].name}`);
    }
  }
  if (ok) toast(`已上传 ${ok} 首歌曲 ✓`);
}

function mergeTrack(track) {
  const idx = state.tracks.findIndex((t) => t.key === track.key);
  if (idx >= 0) state.tracks[idx] = track;
  else state.tracks.push(track);
  indexTracks();
  recompute();
  render();
}

$("#btn-upload").addEventListener("click", () => $("#file-input").click());
$("#file-input").addEventListener("change", () => {
  handleFiles($("#file-input").files);
  $("#file-input").value = "";
});

let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  if (![...(e.dataTransfer?.types || [])].includes("Files")) return;
  dragDepth++;
  $("#drop").classList.remove("hidden");
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) { dragDepth = 0; $("#drop").classList.add("hidden"); }
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  $("#drop").classList.add("hidden");
  if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
});

async function deleteTrack(key) {
  if (!confirm("确定要从音乐库中永久删除这首歌吗？")) return;
  try {
    const r = await fetch("/api/track?key=" + encodeURIComponent(key), { method: "DELETE" });
    if (r.ok) {
      state.tracks = state.tracks.filter((t) => t.key !== key);
      indexTracks();
      if (state.currentKey === key) {
        audio.pause();
        audio.removeAttribute("src");
        state.currentKey = null;
        $("#np-title").textContent = "未在播放";
        $("#np-artist").textContent = "选一首歌开始吧";
        $("#np-cover").classList.remove("active");
        $("#np-cover").style.backgroundImage = "";
        $("#np-cover").textContent = "♫";
        document.title = "云音 · 我的私人音乐库";
      }
      recompute();
      render();
      toast("已删除");
    } else toast("删除失败");
  } catch {
    toast("删除失败，请检查网络");
  }
}

/* ================= 登录 / 登出 ================= */

function showLogin() {
  $("#app").classList.add("hidden");
  $("#login").classList.remove("hidden");
  $("#login-username").value = localStorage.getItem("mp_user") || "";
  setTimeout(() => ($("#login-username").value ? $("#login-password").focus() : $("#login-username").focus()), 60);
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("#login-error");
  errEl.classList.add("hidden");
  try {
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: $("#login-username").value.trim(),
        password: $("#login-password").value,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      localStorage.setItem("mp_user", $("#login-username").value.trim());
      $("#login").classList.add("hidden");
      $("#app").classList.remove("hidden");
      $("#login-password").value = "";
      loadLibrary();
    } else {
      errEl.textContent = data.error || "登录失败";
      errEl.classList.remove("hidden");
    }
  } catch {
    errEl.textContent = "网络错误，请重试";
    errEl.classList.remove("hidden");
  }
});

$("#btn-logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  location.reload();
});

const _origFetch = window.fetch;
window.fetch = async (...args) => {
  const r = await _origFetch(...args);
  if (r.status === 401 && !String(args[0]).includes("/api/login")) showLogin();
  return r;
};

/* ================= 快捷键 ================= */

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  if (!$("#login").classList.contains("hidden")) return;
  switch (e.key) {
    case " ":
      e.preventDefault();
      togglePlay();
      break;
    case "ArrowLeft":
      if (isFinite(audio.duration)) audio.currentTime = Math.max(0, audio.currentTime - 5);
      break;
    case "ArrowRight":
      if (isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
      break;
    case "ArrowUp":
      e.preventDefault();
      setVolume(audio.volume + 0.05);
      break;
    case "ArrowDown":
      e.preventDefault();
      setVolume(audio.volume - 0.05);
      break;
    case "/":
      e.preventDefault();
      $("#search").focus();
      break;
  }
});

/* ================= MediaSession ================= */

if ("mediaSession" in navigator) {
  const safe = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch { /* 不支持 */ } };
  safe("play", () => audio.play().catch(() => {}));
  safe("pause", () => audio.pause());
  safe("previoustrack", () => prevTrack());
  safe("nexttrack", () => nextTrack(true));
  safe("seekto", (d) => { if (d.seekTime != null && isFinite(audio.duration)) audio.currentTime = d.seekTime; });
}

/* ================= 偏好恢复 & 启动 ================= */

function restoreLastTrack() {
  const lastKey = localStorage.getItem("mp_last");
  if (!lastKey || !byKey.has(lastKey)) return;
  const t = byKey.get(lastKey);
  state.queue = state.items.length ? state.items.slice() : [t];
  state.qi = Math.max(0, state.items.findIndex((x) => x.key === lastKey));
  state.currentKey = lastKey;
  audio.src = "/api/stream/" + lastKey.split("/").map(encodeURIComponent).join("/");
  updateNowPlaying(t);
}

function restorePrefs() {
  const vol = parseFloat(localStorage.getItem("mp_vol") ?? "1");
  setVolume(isNaN(vol) ? 1 : vol, false);
  state.shuffle = localStorage.getItem("mp_shuffle") === "1";
  $("#btn-shuffle").classList.toggle("active", state.shuffle);
  const rep = localStorage.getItem("mp_repeat");
  if (rep && REPEAT_ICON[rep]) { state.repeat = rep; $("#btn-repeat").innerHTML = REPEAT_ICON[rep]; }
  const tab = localStorage.getItem("mp_tab");
  if (tab && ["songs", "artists", "albums"].includes(tab)) { state.tab = tab; }
  syncSeg();
}

function boot() {
  restorePrefs();
  $("#app").classList.remove("hidden");
  loadLibrary();
}

boot();
