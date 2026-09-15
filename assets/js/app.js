/* ============================================================
   FitLab 前端主逻辑：数据加载 + Hash 路由 + 视图渲染
   纯原生 JS，无构建步骤。播放器见 player.js。
   ============================================================ */
'use strict';

/* ---------- 小工具 ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const Store = {
  get(k, d) { try { const v = localStorage.getItem('fitv:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fitv:' + k, JSON.stringify(v)); } catch { } }
};

function fmtTime(t) {
  if (!isFinite(t) || t < 0) t = 0;
  t = Math.floor(t);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

let toastTimer = null;
function toast(msg, ms = 2200) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* 视频文件地址：相对 R2 目录 → /media/<dir>/<file>（同域代理，无跨域问题） */
function mediaUrl(entry, file) {
  if (!file) return '';
  if (/^https?:\/\//i.test(file) || file.startsWith('/')) return file;
  const base = ((App.manifest && App.manifest.cdnBaseUrl) || '').replace(/\/+$/, '');
  return `${base}/media/${entry.dir}/${file}`;
}

/* ---------- 全局状态 ---------- */
const App = {
  manifest: null,
  player: null,          // 当前 FitPlayer 实例
  demo: new URLSearchParams(location.search).has('demo'),
  session: { sound: Store.get('soundOn', false) } // 用户是否已开启声音（本机记忆）
};

async function loadManifest() {
  const url = App.demo ? '.demo/demo-videos.json' : 'data/videos.json';
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`清单加载失败（HTTP ${res.status}）`);
  const m = await res.json();
  if (!m || !Array.isArray(m.categories)) throw new Error('清单格式不正确');
  return m;
}

function findVideo(id) {
  for (const cat of App.manifest.categories) {
    const v = (cat.videos || []).find(v => v.id === id);
    if (v) return { v, cat };
  }
  return { v: null, cat: null };
}

/* ---------- 图标（内联 SVG，无外部依赖） ---------- */
const I = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72c0 .8.87 1.3 1.55.87l10.5-6.86a1.03 1.03 0 000-1.74L9.55 4.27A1.03 1.03 0 008 5.14z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.4"/><rect x="14" y="5" width="4" height="14" rx="1.4"/></svg>',
  replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9.4 9.4 0 00-6.74 2.94L3 8"/><path d="M3 3v5h5"/></svg>',
  loop1: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 01-4 4H3"/><text x="9.2" y="15.4" font-size="8.4" font-weight="800" fill="currentColor" stroke="none">1</text></svg>',
  queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h11M4 12h11M4 18h7"/><path d="M17 12h5m0 0l-2.4-2.4M22 12l-2.4 2.4"/></svg>',
  speed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14l3.6-3.6"/><path d="M3.4 19a10 10 0 1117.2 0"/></svg>',
  vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.6 5.4a9 9 0 010 13.2"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.5 5.14v13.72c0 .8.87 1.3 1.55.87l9.2-6.02a1.03 1.03 0 000-1.74l-9.2-6.7A1.03 1.03 0 005.5 5.14z"/><rect x="17" y="5" width="2.6" height="14" rx="1.2"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 5.14v13.72c0 .8-.87 1.3-1.55.87l-9.2-6.02a1.03 1.03 0 010-1.74l9.2-6.7A1.03 1.03 0 0118.5 5.14z"/><rect x="4.4" y="5" width="2.6" height="14" rx="1.2"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="1.15" fill="currentColor" stroke="none"/></svg>',
  seek10l: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 9A8.5 8.5 0 1112 20.5"/><path d="M4.5 4v5h5"/></svg>',
  seek10r: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 9A8.5 8.5 0 1012 20.5"/><path d="M19.5 4v5h-5"/></svg>'
};

/* ============================================================
   视图：首页
   ============================================================ */
function renderHome() {
  const m = App.manifest;
  const groups = m.groups.map(g => {
    const cats = m.categories.filter(c => c.groupId === g.id);
    let inner = '';
    if (cats.length > 1) {
      inner = `<div class="cat-grid">` + cats.map((c, i) => `
        <a class="cat-card" href="#/c/${esc(c.id)}" style="--cat:${esc(c.accent || g.accent)};--i:${i}">
          <div class="cat-ico">${c.icon || '🎬'}</div>
          <div class="cat-name">${esc(c.name)}</div>
          <div class="cat-desc">${esc(c.description || '')}</div>
          <span class="cat-meta">${(c.videos || []).length} 个视频</span>
        </a>`).join('') + `</div>`;
    } else if (cats.length === 1) {
      inner = `<div class="v-grid">` + (cats[0].videos || []).map((v, i) => videoCard(v, cats[0], i)).join('') + `</div>`;
    }
    return `
      <section class="group" id="g-${esc(g.id)}" style="--cat:${esc(g.accent)}">
        <div class="group-head">
          <span class="group-badge">${g.icon || '🏋️'}</span>
          <div>
            <div class="group-name">${esc(g.name)}</div>
            <div class="group-sub">${esc(g.nameEn || '')}</div>
          </div>
        </div>
        ${inner}
      </section>`;
  }).join('');

  const chips = m.categories.map(c => `<a class="chip" href="#/c/${esc(c.id)}">${esc(c.name)}</a>`).join('');

  return `
    <header class="topbar">
      <div class="logo-mark">${I.logo}</div>
      <div style="flex:1">
        <div class="logo-name">FitLab 健身视频库</div>
        <div class="logo-sub">TRAIN · LEARN · REPEAT</div>
      </div>
    </header>
    <div class="hero">
      <h1>跟着视频，<em>练对每一个动作</em></h1>
      <p>手机优先 · 循环播放 · 滑动进度精学每个细节</p>
    </div>
    <nav class="chips">${chips}</nav>
    ${groups}
    <footer class="foot">FitLab · 本地视频库 · Cloudflare Pages + R2<br><b>向着更好的自己 💪</b></footer>`;
}

/* ============================================================
   视频卡片
   ============================================================ */
function thumbHTML(v, opts = {}) {
  const vertical = v.orientation !== 'horizontal';
  const pending = v.status !== 'ready';
  const poster = v.poster ? mediaUrl(v, v.poster) : '';
  const ratioCls = vertical ? 'is-v' : 'is-h';
  if (pending) {
    return `<div class="v-thumb pend ${opts.forceWide ? 'is-h' : ratioCls}"><span>🎬</span><i>视频整理中</i></div>`;
  }
  const dur = v.duration ? `<span class="v-dur">${fmtTime(v.duration)}</span>` : '';
  return `<div class="v-thumb ${opts.forceWide ? 'is-h' : ratioCls}">
      ${poster ? `<img loading="lazy" src="${esc(poster)}" alt="">` : ''}
      ${dur}
    </div>`;
}

function videoCard(v, cat, i) {
  const pending = v.status !== 'ready';
  const tags = (v.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const badge = pending
    ? `<span class="badge-pend">待上传</span>`
    : `<span class="badge-cat" style="--cat:${esc(cat.accent || '#ff5a3c')}">${esc(cat.name)}</span>`;
  return `
    <a class="v-card" style="--i:${i}" href="#/v/${esc(v.id)}">
      ${thumbHTML(v, { forceWide: false })}
      <div class="v-body">
        <div class="v-title">${esc(v.title)}</div>
        <div class="v-meta">${badge}${tags}</div>
      </div>
    </a>`;
}

/* ============================================================
   视图：科目页
   ============================================================ */
function renderCategory(catId) {
  const cat = App.manifest.categories.find(c => c.id === catId);
  if (!cat) return render404();
  const g = App.manifest.groups.find(g => g.id === cat.groupId) || {};
  const list = (cat.videos || []).map((v, i) => `
    <a class="v-card v-row" style="--i:${i}" href="#/v/${esc(v.id)}">
      ${thumbHTML(v, { forceWide: true })}
      <div class="v-body">
        <div class="v-title">${esc(v.title)}</div>
        <div class="v-meta">${v.status !== 'ready'
          ? '<span class="badge-pend">待上传</span>'
          : `<span class="badge-cat" style="--cat:${esc(cat.accent)}">${esc(cat.name)}</span>`}${(v.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      </div>
    </a>`).join('');

  return `
    <header class="cat-head">
      <a class="icon-btn" href="#/" aria-label="返回首页">${I.back}</a>
      <div style="flex:1;min-width:0">
        <div class="cat-head-title">${esc(cat.name)}</div>
        <div class="cat-head-sub">${esc(g.name || '')}${g.nameEn ? ' · ' + esc(g.nameEn) : ''}</div>
      </div>
    </header>
    <div class="cat-hero" style="--cat:${esc(cat.accent || '#ff5a3c')}">
      <h2><b>${cat.icon || '🎬'}</b>${esc(cat.name)}</h2>
      <p>${esc(cat.description || '')}</p>
    </div>
    <div class="section-label">视频列表 <span>${(cat.videos || []).length} 个</span></div>
    <div class="v-list" style="padding:0 20px">${list}</div>`;
}

function render404() {
  return `
    <header class="cat-head">
      <a class="icon-btn" href="#/" aria-label="返回首页">${I.back}</a>
      <div style="flex:1"><div class="cat-head-title">内容不存在</div></div>
    </header>
    <div class="hero"><h1>🤔 没找到</h1><p>这条内容可能已被移动或删除。</p></div>`;
}

/* ============================================================
   视图：播放页（交给 FitPlayer）
   ============================================================ */
function renderPlayer(videoId, root) {
  const { v, cat } = findVideo(videoId);
  if (!v) { root.innerHTML = render404(); return; }
  const siblings = (cat.videos || []);
  App.player = new FitPlayer(root, {
    entry: v,
    category: cat,
    siblings,
    settings: Store.get('player', { loop: true, autoNext: false, rate: 1 }),
    onNav(id) { location.hash = '#/v/' + id; },
    onExit() { location.hash = '#/c/' + (cat ? cat.id : ''); }
  });
}

/* ============================================================
   路由
   ============================================================ */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const seg = h.split('?')[0].split('/').filter(Boolean);
  if (seg[0] === 'c' && seg[1]) return { name: 'category', id: decodeURIComponent(seg[1]) };
  if (seg[0] === 'v' && seg[1]) return { name: 'player', id: decodeURIComponent(seg[1]) };
  return { name: 'home' };
}

let scrollMem = {};
let prevHash = location.hash;

function render() {
  const r = parseHash();
  const app = $('#app');

  if (App.player) { try { App.player.destroy(); } catch { } App.player = null; }

  const view = document.createElement('div');
  view.className = 'view' + (r.name === 'player' ? ' is-player' : '');

  if (r.name === 'home') {
    view.innerHTML = renderHome();
  } else if (r.name === 'category') {
    view.innerHTML = renderCategory(r.id);
  } else {
    renderPlayer(r.id, view); // 播放器自建 DOM
  }

  app.replaceChildren(view);
  requestAnimationFrame(() => window.scrollTo(0, scrollMem[location.hash] || 0));
}

function boot() {
  if (App.demo) {
    const b = document.createElement('div');
    b.className = 'demo-banner';
    b.textContent = 'DEMO 演示模式';
    document.body.appendChild(b);
  }
  loadManifest()
    .then(m => { App.manifest = m; render(); })
    .catch(err => {
      $('#app').innerHTML = `
        <div class="boot err">
          <div class="boot-logo">😵</div>
          <div class="boot-txt">${esc(err.message || '加载失败')}</div>
          <div class="boot-txt">请确认通过本地服务器访问（而不是直接双击文件）</div>
          <button onclick="location.reload()">重新加载</button>
        </div>`;
    });
}

addEventListener('hashchange', () => {
  scrollMem[prevHash] = window.scrollY;
  prevHash = location.hash;
  render();
});

boot();
