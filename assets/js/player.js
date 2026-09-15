/* ============================================================
   FitPlayer —— 移动优先的自定义视频播放器
   设计目标：跟学场景下的丝滑体验
   - 进入即静音自动循环播放（遵守移动端自动播放策略）
   - 滑动进度条精确学习、双击 ±10s、长按 2 倍速
   - 循环 / 连播 / 倍速 0.5~2.0、画中画全屏
   - HLS(m3u8) 优先：iOS 原生播放，安卓/桌面用 hls.js
   ============================================================ */
'use strict';

/* ---------- hls.js 按需加载：本地 vendor 优先，失败再走 CDN ---------- */
function ensureHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (ensureHls._p) return ensureHls._p;
  ensureHls._p = new Promise((resolve, reject) => {
    const tryLoad = (src, fallback) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => window.Hls ? resolve(window.Hls) : (fallback ? tryLoad(fallback, null) : reject(new Error('hls.js 加载失败')));
      s.onerror = () => fallback ? tryLoad(fallback, null) : reject(new Error('hls.js 加载失败'));
      document.head.appendChild(s);
    };
    tryLoad('assets/vendor/hls.min.js', 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js');
  });
  return ensureHls._p;
}

const fmtT = (t) => {
  if (!isFinite(t) || t < 0) t = 0;
  t = Math.floor(t);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
};
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* 要点：字符串直接渲染；{t, text} 渲染成可点击的时间戳芯片 */
function tipItem(t) {
  if (t && typeof t === 'object' && isFinite(t.t)) {
    return `<li><button class="tip-jump" data-t="${Number(t.t)}">⏱ ${fmtT(Number(t.t))}</button><span>${esc(t.text || '')}</span></li>`;
  }
  return `<li>${esc(t)}</li>`;
}

class FitPlayer {
  /**
   * @param {HTMLElement} root  挂载容器（.view）
   * @param {Object} opts { entry, category, siblings, settings, onNav, onExit }
   */
  constructor(root, opts) {
    this.root = root;
    this.opts = opts;
    this.entry = opts.entry;
    this.settings = Object.assign({ loop: true, autoNext: false, rate: 1 }, opts.settings || {});
    this.uiShow = true;
    this.scrubbing = false;
    this.ended = false;
    this.hls = null;
    this.ac = new AbortController();          // 统一注销所有监听
    this.hideTimer = null;
    this.saveTick = 0;
    this._lastTap = { t: 0, z: '' };
    this._longTimer = null;
    this._longFired = false;
    this._origRate = this.settings.rate;

    this.build();
    this.bindVideo();
    this.bindStageGestures();
    this.bindScrub();
    this.bindKeys();
    this.attachSource();
    this.autostart();
    this.applySettings();
  }

  /* ================= DOM ================= */
  build() {
    const v = this.entry;
    const vertical = v.orientation !== 'horizontal';
    const pending = v.status !== 'ready' || (!v.hls && !v.mp4);
    this.pending = pending;
    const poster = v.poster ? mediaUrl(v, v.poster) : '';
    const cat = this.opts.category || {};
    const tips = Array.isArray(v.tips) ? v.tips : (v.tips ? [v.tips] : []);

    this.root.innerHTML = `
      <div class="player-shell">
        <div class="stage-wrap ${vertical ? 'is-vertical' : ''}">
          <div class="stage ui-show" data-ref="stage">
            <div class="backdrop ${poster ? 'show' : ''}" style="${poster ? `background-image:url('${poster.replace(/'/g, '%27')}')` : ''}"></div>
            <video data-ref="video" playsinline webkit-playsinline x5-playsinline preload="metadata" ${poster ? `poster="${poster}"` : ''}></video>
            <div class="stage-mask"></div>
            <div class="seek-hint left" data-ref="hintL">${I.seek10l}<span>后退10s</span></div>
            <div class="seek-hint right" data-ref="hintR">${I.seek10r}<span>前进10s</span></div>
            <div class="rate-badge" data-ref="rateBadge">2× 快进</div>

            <div class="ctrl-top">
              <button class="ct-btn" data-act="back" aria-label="返回">${I.back}</button>
              <div class="ct-title">${esc(v.title || '')}</div>
              <button class="ct-btn" data-act="fs" aria-label="全屏">${I.full}</button>
            </div>

            <button class="big-btn" data-act="big" data-ref="bigBtn" aria-label="播放/暂停">${I.pause}</button>

            <div class="ctrl-bottom">
              <div class="scrub" data-ref="scrub">
                <div class="scrub-rail">
                  <div class="scrub-buf" data-ref="buf"></div>
                  <div class="scrub-fill" data-ref="fill"><div class="scrub-thumb"></div></div>
                </div>
                <div class="scrub-bubble" data-ref="bubble">0:00</div>
              </div>
              <div class="ctrl-row">
                <span class="time" data-ref="tCur">0:00</span><span class="time-sep">/</span><span class="time dur" data-ref="tDur">0:00</span>
                <div class="ctrl-sp"></div>
                <button class="row-btn" data-act="mute" aria-label="声音" data-ref="muteBtn">${I.mute}</button>
                <button class="row-btn txt" data-act="rate" data-ref="rateBtn">1.0×</button>
                <button class="row-btn" data-act="next" aria-label="下一个">${I.next}</button>
              </div>
            </div>

            <button class="pill sound-pill" data-act="unmute">🔇 已静音播放 · 点击开启声音</button>
            <button class="pill resume-pill" data-act="resume" data-ref="resumePill">▶ 从上次继续播放</button>

            ${pending ? `
            <div class="center-layer">
              <div class="cl-ico">🎬</div>
              <div class="cl-t">视频整理中</div>
              <div class="cl-s">这一节的切片还在上传/处理，传好后刷新本页就能直接播放。</div>
            </div>` : ''}
            <div class="center-layer" data-ref="errLayer" hidden>
              <div class="cl-ico">📡</div>
              <div class="cl-t">视频加载失败</div>
              <div class="cl-s" data-ref="errMsg">请检查网络后重试</div>
              <button class="cl-btn" data-act="retry">重新加载</button>
            </div>
          </div>
        </div>

        <div class="p-info">
          <div class="p-title-row">
            <h1>${esc(v.title || '')}</h1>
            <span class="p-orient">${vertical ? '竖屏 9:16' : '横屏 16:9'}</span>
          </div>
          ${cat.name ? `<div class="p-desc">${esc(cat.icon || '')} ${esc(cat.name)}${cat.description ? ' · ' + esc(cat.description) : ''}</div>` : ''}
          <div class="p-chips">
            <button class="p-chip" data-act="loop" data-ref="chipLoop">${I.loop1}<span>循环</span></button>
            <button class="p-chip" data-act="autonext" data-ref="chipNext">${I.queue}<span>连播</span></button>
            <button class="p-chip" data-act="rate" data-ref="chipRate">${I.speed}<span>1.0×</span></button>
            <button class="p-chip" data-act="mute" data-ref="chipMute">${I.mute}<span>声音</span></button>
          </div>
          ${tips.length ? `
          <div class="tips-card">
            <div class="tips-h">${I.info} 动作要领</div>
            <ul>${tips.map(tipItem).join('')}</ul>
          </div>` : ''}
        </div>

        <div class="p-more">
          <div class="p-more-h">本科目其他视频 <span>${(this.opts.siblings || []).length} 个</span></div>
          <div class="more-scroll">
            ${(this.opts.siblings || []).map(s => {
      const now = s.id === v.id;
      const p = s.poster ? mediaUrl(s, s.poster) : '';
      return `<a class="more-card ${now ? 'now' : ''}" href="#/v/${esc(s.id)}">
                <div class="more-thumb ${s.status !== 'ready' ? 'pend' : ''}">${s.status !== 'ready' ? '🎬' : (p ? `<img loading="lazy" src="${esc(p)}" alt="">` : '')}</div>
                <div class="more-t">${esc(s.title)}</div>
              </a>`;
    }).join('') || '<div class="p-desc">暂无其他视频</div>'}
          </div>
        </div>
      </div>`;

    // 科目主色（时间戳芯片等使用）
    const shell = this.root.querySelector('.player-shell');
    if (shell) shell.style.setProperty('--cat', cat.accent || '#ff5a3c');

    // 收集 DOM 引用
    this.ui = {};
    this.root.querySelectorAll('[data-ref]').forEach(el => {
      const k = el.getAttribute('data-ref');
      this.ui[k] = el;
    });
    this.video = this.ui.video;
    this.video.defaultMuted = true;

    // 点击行为代理（芯片/按钮/要点时间戳）
    this.root.addEventListener('click', e => {
      const jump = e.target.closest('.tip-jump');
      if (jump) {
        const t = parseFloat(jump.getAttribute('data-t')) || 0;
        this.seekTo(t);
        if (this.video.paused || this.video.ended) this.play();
        try { this.ui.stage.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { window.scrollTo(0, 0); }
        this.stageUI(true);
        toast('⏱ 已跳到 ' + fmtT(t));
        return;
      }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      ({
        back: () => this.opts.onExit && this.opts.onExit(),
        big: () => this.togglePlay(),
        mute: () => this.toggleMute(),
        unmute: () => this.toggleMute(),
        rate: () => this.openRateSheet(),
        next: () => this.goNext(),
        loop: () => this.setLoop(!this.settings.loop),
        autonext: () => this.setAutoNext(!this.settings.autoNext),
        resume: () => { const p = Store.get('prog:' + this.entry.id, null); if (p) { this.seekTo(p.t); this.play(); } this.ui.resumePill.classList.remove('show'); },
        retry: () => { this.ui.errLayer.hidden = true; this.attachSource(); this.autostart(); },
        fs: () => this.toggleFullscreen()
      }[act] || (() => { }))();
    });
  }

  /* ================= 数据源 ================= */
  srcOf(file) { return mediaUrl(this.entry, file); }

  attachSource() {
    if (this.pending || this.disposed) return;
    const video = this.video;
    const hlsSrc = this.entry.hls ? this.srcOf(this.entry.hls) : '';
    const mp4Src = this.entry.mp4 ? this.srcOf(this.entry.mp4) : '';
    const canNative = video.canPlayType('application/vnd.apple.mpegurl');

    if (this.hls) { try { this.hls.destroy(); } catch { } this.hls = null; }

    if (hlsSrc && canNative) {
      video.src = hlsSrc;                       // iOS / Safari：原生 HLS
    } else if (hlsSrc && window.Hls && window.Hls.isSupported()) {
      this.attachHls(hlsSrc);                   // Chrome / Android
    } else if (hlsSrc) {
      ensureHls()
        .then(Hls => { if (!this.disposed && Hls.isSupported()) this.attachHls(hlsSrc); else if (mp4Src) video.src = mp4Src; else this.showError('当前浏览器不支持播放'); })
        .catch(() => { if (mp4Src) this.video.src = mp4Src; else this.showError('播放组件加载失败'); });
    } else if (mp4Src) {
      video.src = mp4Src;
    } else {
      this.showError('未找到可播放的视频文件');
    }
  }

  attachHls(src) {
    const Hls = window.Hls;
    const hls = new Hls({ maxBufferLength: 30, capLevelToPlayerSize: true, enableWorker: true });
    this.hls = hls;
    hls.loadSource(src);
    hls.attachMedia(this.video);
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else this.showError('视频流出现错误（' + (data.details || '') + '）');
      }
    });
  }

  showError(msg) {
    if (this.disposed) return;
    this.ui.errMsg.textContent = msg || '未知错误';
    this.ui.errLayer.hidden = false;
  }

  autostart() {
    if (this.pending) return;
    const video = this.video;
    const soundOn = App.session.sound === true;
    video.muted = !soundOn;
    video.playbackRate = this.settings.rate || 1;
    const p = video.play();
    if (p && p.catch) {
      p.catch(() => { if (!video.muted) { video.muted = true; video.play().catch(() => { }); } this.syncUI(); });
    }
    if (!soundOn) this.showPill(this.pillSound, 5000);
  }

  /* ================= 播放核心事件 ================= */
  bindVideo() {
    const v = this.video, sig = { signal: this.ac.signal };
    v.addEventListener('loadedmetadata', () => {
      this.ui.tDur.textContent = fmtT(v.duration);
      this.ui.rateBtn.textContent = v.playbackRate.toFixed(v.playbackRate % 1 ? 2 : 1) + '×';
      this.ui.chipRate.querySelector('span').textContent = v.playbackRate.toFixed(v.playbackRate % 1 ? 2 : 1) + '×';
      this.maybeResume();
      this.updateProgressUI();
    }, sig);
    v.addEventListener('timeupdate', () => { this.updateProgressUI(); this.saveProgress(false); }, sig);
    v.addEventListener('progress', () => this.updateBuffer(), sig);
    v.addEventListener('play', () => { this.ended = false; this.syncUI(); this.reqWakeLock(); }, sig);
    v.addEventListener('playing', () => this.syncUI(), sig);
    v.addEventListener('pause', () => { this.syncUI(); this.saveProgress(true); this.relWakeLock(); }, sig);
    v.addEventListener('ended', () => this.onEnded(), sig);
    v.addEventListener('error', () => {
      if (this.hls || this.pending) return;   // hls.js 的错误单独处理
      const code = v.error && v.error.code;
      this.showError(['', '播放被中断', '网络加载失败', '视频解码失败', '视频格式不支持'][code] || '视频加载失败');
    }, sig);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.relWakeLock(); this.saveProgress(true); }
      else if (this.video && !this.video.paused) this.reqWakeLock();
    }, sig);
    addEventListener('pagehide', () => this.saveProgress(true), sig);
  }

  onEnded() {
    this.ended = true;
    if (!this.settings.loop && this.settings.autoNext) { this.goNext(); return; }
    if (!this.settings.loop) { this.syncUI(); }   // 显示重播按钮
  }

  goNext() {
    const sibs = this.opts.siblings || [];
    const i = sibs.findIndex(s => s.id === this.entry.id);
    const next = sibs[(i + 1) % sibs.length];
    if (next && next.id !== this.entry.id) {
      toast('下一个：' + (next.title || ''));
      this.opts.onNav(next.id);
    } else {
      toast('已经是最后一个啦');
    }
  }

  goPrev() {
    const sibs = this.opts.siblings || [];
    const i = sibs.findIndex(s => s.id === this.entry.id);
    const prev = sibs[(i - 1 + sibs.length) % sibs.length];
    if (prev && prev.id !== this.entry.id) this.opts.onNav(prev.id);
  }

  /* ================= 设置：循环 / 连播 / 倍速 / 声音 ================= */
  persistSettings() { Store.set('player', this.settings); }

  applySettings() {
    this.video.loop = !!this.settings.loop;
    this.video.playbackRate = this.settings.rate || 1;
    this.syncChips();
  }

  setLoop(on) {
    this.settings.loop = on;
    if (on) this.settings.autoNext = false;
    this.persistSettings(); this.applySettings();
    toast(on ? '🔁 单集循环：开' : '循环已关闭' + (this.settings.autoNext ? ' · 自动连播' : ''));
  }

  setAutoNext(on) {
    this.settings.autoNext = on;
    if (on) this.settings.loop = false;
    this.persistSettings(); this.applySettings();
    toast(on ? '⏭ 自动连播：开（播完自动下一个）' : '自动连播已关闭');
  }

  setRate(r) {
    this.settings.rate = r;
    this.video.playbackRate = r;
    this.persistSettings();
    const label = r.toFixed(r % 1 ? 2 : 1) + '×';
    this.ui.rateBtn.textContent = label;
    this.ui.chipRate.querySelector('span').textContent = label;
    this.syncChips();
  }

  toggleMute() {
    const v = this.video;
    v.muted = !v.muted;
    App.session.sound = !v.muted;
    Store.set('soundOn', !v.muted);
    this.syncChips();
    if (!v.muted) this.hidePill(this.pillSound);
    toast(v.muted ? '🔇 已静音' : '🔊 声音已开启');
  }

  syncChips() {
    const { chipLoop, chipNext, chipMute, muteBtn } = this.ui;
    chipLoop.classList.toggle('on', !!this.settings.loop);
    chipNext.classList.toggle('on', !!this.settings.autoNext);
    chipMute.querySelector('span').textContent = this.video.muted ? '静音' : '声音';
    chipMute.classList.toggle('on', !this.video.muted);
    muteBtn.innerHTML = this.video.muted ? I.mute : I.vol;
    muteBtn.classList.toggle('on', !this.video.muted);
    chipLoop.querySelector('span').textContent = this.settings.loop ? '循环 开' : '循环 关';
    chipNext.querySelector('span').textContent = this.settings.autoNext ? '连播 开' : '连播 关';
  }

  openRateSheet() {
    if (this.sheet) return;
    const mask = document.createElement('div');
    mask.className = 'sheet-mask';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.innerHTML = `
      <div class="sheet-grip"></div>
      <div class="sheet-h">播放倍速</div>
      <div class="rate-grid">
        ${RATES.map(r => `<button class="rate-opt ${r === this.settings.rate ? 'on' : ''}" data-r="${r}">${r}×</button>`).join('')}
      </div>`;
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => { mask.classList.add('show'); sheet.classList.add('show'); });
    const close = () => {
      if (!this.sheet) return;
      this.sheet = null;
      mask.classList.remove('show'); sheet.classList.remove('show');
      setTimeout(() => { mask.remove(); sheet.remove(); }, 320);
      this.root.removeEventListener('click', onRoot, true);
    };
    const onRoot = (e) => { if (!sheet.contains(e.target)) close(); };
    this.root.addEventListener('click', onRoot, true);
    mask.addEventListener('click', close);
    sheet.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      this.setRate(parseFloat(b.getAttribute('data-r')));
      close();
    });
    this.sheet = { mask, sheet, close };
  }

  /* ================= 手势：单击/双击/长按 ================= */
  bindStageGestures() {
    const stage = this.ui.stage, sig = { signal: this.ac.signal };
    const isCtrl = t => t.closest && t.closest('.ctrl-top,.ctrl-bottom,.big-btn,.pill,.center-layer');

    stage.addEventListener('pointerdown', e => {
      if (isCtrl(e.target)) return;
      this._longFired = false;
      clearTimeout(this._longTimer);
      this._longTimer = setTimeout(() => {
        if (this.video.paused || this.scrubbing) return;
        this._longFired = true;
        this._origRate = this.video.playbackRate;
        this.video.playbackRate = 2;
        this.ui.rateBadge.classList.add('show');
        if (navigator.vibrate) navigator.vibrate(10);
      }, 500);
    }, sig);

    stage.addEventListener('pointerup', e => {
      clearTimeout(this._longTimer);
      if (isCtrl(e.target)) return;
      if (this._longFired) {
        this._longFired = false;
        this.video.playbackRate = this._origRate;
        this.ui.rateBadge.classList.remove('show');
        return;
      }
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const zone = x < rect.width * 0.33 ? 'l' : x > rect.width * 0.67 ? 'r' : 'c';
      const now = performance.now();
      if (now - this._lastTap.t < 320 && this._lastTap.z === zone) {
        clearTimeout(this._tapTimer);
        this._lastTap.t = 0;
        this.doDoubleTap(zone);
      } else {
        this._lastTap = { t: now, z: zone };
        clearTimeout(this._tapTimer);
        this._tapTimer = setTimeout(() => this.toggleUI(), 300);
      }
    }, sig);

    stage.addEventListener('pointercancel', () => {
      clearTimeout(this._longTimer);
      if (this._longFired) { this._longFired = false; this.video.playbackRate = this._origRate; this.ui.rateBadge.classList.remove('show'); }
    }, sig);
  }

  doDoubleTap(zone) {
    if (this.pending) return;
    if (zone === 'c') { this.togglePlay(); return; }
    const delta = zone === 'l' ? -10 : 10;
    this.seekBy(delta);
    const hint = zone === 'l' ? this.ui.hintL : this.ui.hintR;
    hint.classList.remove('pop'); void hint.offsetWidth; hint.classList.add('pop');
    if (navigator.vibrate) navigator.vibrate(8);
  }

  /* ================= 进度条拖动 ================= */
  bindScrub() {
    const scrub = this.ui.scrub, sig = { signal: this.ac.signal };
    let raf = 0, pendingX = 0;

    const apply = () => {
      raf = 0;
      const d = this.video.duration;
      if (!isFinite(d) || d <= 0) return;
      const pct = clamp(pendingX / scrub.getBoundingClientRect().width, 0, 1);
      const t = pct * d;
      this.video.currentTime = t;
      this.setBar(pct);
      this.ui.bubble.textContent = fmtT(t);
      this.ui.tCur.textContent = fmtT(t);
    };

    const fromEvent = e => {
      const rect = scrub.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    scrub.addEventListener('pointerdown', e => {
      if (this.pending || !isFinite(this.video.duration)) return;
      this.scrubbing = true;
      scrub.classList.add('scrubbing');
      this.stageUI(true);
      try { scrub.setPointerCapture(e.pointerId); } catch { }
      fromEvent(e);
      e.stopPropagation();
    }, sig);
    scrub.addEventListener('pointermove', e => { if (this.scrubbing) fromEvent(e); }, sig);
    const up = () => {
      if (!this.scrubbing) return;
      this.scrubbing = false;
      scrub.classList.remove('scrubbing');
    };
    scrub.addEventListener('pointerup', up, sig);
    scrub.addEventListener('pointercancel', up, sig);
  }

  setBar(pct) {
    pct = clamp(pct, 0, 1);
    this.ui.fill.style.width = (pct * 100) + '%';
  }

  updateProgressUI() {
    if (this.scrubbing) return;
    const d = this.video.duration;
    if (isFinite(d) && d > 0) this.setBar(this.video.currentTime / d);
    this.ui.tCur.textContent = fmtT(this.video.currentTime);
    if (!this.ui.tDur.textContent || this.ui.tDur.textContent === '0:00') this.ui.tDur.textContent = fmtT(d);
  }

  updateBuffer() {
    const v = this.video, d = v.duration;
    if (!isFinite(d) || !v.buffered.length) return;
    const end = v.buffered.end(v.buffered.length - 1);
    this.ui.buf.style.width = clamp(end / d, 0, 1) * 100 + '%';
  }

  /* ================= UI 显隐 ================= */
  toggleUI() { this.stageUI(!this.uiShow); }

  stageUI(show) {
    this.uiShow = show;
    this.ui.stage.classList.toggle('ui-show', show);
    this.syncUI();
    clearTimeout(this.hideTimer);
    if (show && !this.video.paused && !this.scrubbing) {
      this.hideTimer = setTimeout(() => this.stageUI(false), 3200);
    }
  }

  syncUI() {
    const playing = !this.video.paused && !this.video.ended;
    const big = this.ui.bigBtn;
    big.innerHTML = this.ended && !this.settings.loop ? I.replay : (playing ? I.pause : I.play);
    big.classList.toggle('playing', playing);
    big.classList.toggle('hide', playing && !this.uiShow);
    if (playing && this.uiShow) {
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => this.stageUI(false), 3200);
    }
  }

  play() { const p = this.video.play(); return p && p.catch ? p.catch(() => { }) : p; }
  togglePlay() {
    if (this.pending) { toast('视频还没上传哦'); return; }
    if (this.video.paused || this.video.ended) {
      if (this.video.ended) this.video.currentTime = 0;
      this.play();
    } else {
      this.video.pause();
      this.stageUI(true);
    }
  }

  seekBy(d) { const t = clamp((this.video.currentTime || 0) + d, 0, this.video.duration || 0); this.video.currentTime = t; this.updateProgressUI(); }
  seekTo(t) { if (isFinite(this.video.duration)) this.video.currentTime = clamp(t, 0, this.video.duration); this.updateProgressUI(); }

  toggleFullscreen() {
    const v = this.video;
    if (v.webkitEnterFullscreen) { v.webkitEnterFullscreen(); return; }   // iPhone Safari
    const stage = this.ui.stage;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (stage.requestFullscreen) stage.requestFullscreen().catch(() => toast('当前环境不支持全屏'));
    else toast('当前环境不支持全屏');
  }

  /* ================= 续播记忆 ================= */
  maybeResume() {
    const p = Store.get('prog:' + this.entry.id, null);
    if (!p || !isFinite(this.video.duration)) return;
    const min = Math.min(30, this.video.duration * 0.15);
    if (p.t > min && p.t < this.video.duration - 3) {
      this.ui.resumePill.textContent = '▶ 从 ' + fmtT(p.t) + ' 继续播放';
      this.showPill(this.ui.resumePill, 6000);
    }
  }

  saveProgress(force) {
    const now = Date.now();
    if (!force && now - this.saveTick < 3000) return;
    this.saveTick = now;
    const v = this.video, d = v.duration, t = v.currentTime;
    if (!isFinite(d) || !d) return;
    const key = 'fitv:prog:' + this.entry.id;
    if (t > 3 && t < d - 2) {
      Store.set('prog:' + this.entry.id, { t, d, at: now });
    } else if (t >= d - 2 || t <= 3) {
      // 刚开播或接近看完：清掉记录，避免「继续观看」里留无效条目
      try { localStorage.removeItem(key); } catch { }
    }
  }

  /* ================= 屏幕常亮（跟练不锁屏） ================= */
  async reqWakeLock() {
    try {
      if ('wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
      }
    } catch { /* 不支持或被拒绝则忽略 */ }
  }
  relWakeLock() {
    try { if (this.wakeLock) { this.wakeLock.release(); this.wakeLock = null; } } catch { }
  }

  /* ================= pill 工具 ================= */
  showPill(el, ms = 5000) {
    if (!el) return;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), ms);
  }
  hidePill(el) { if (el) { clearTimeout(el._t); el.classList.remove('show'); } }

  /* ================= 键盘（桌面辅助） ================= */
  bindKeys() {
    document.addEventListener('keydown', e => {
      if (this.disposed || e.target.matches('input,textarea')) return;
      const k = e.key;
      if (k === ' ') { e.preventDefault(); this.togglePlay(); }
      else if (k === 'ArrowLeft') this.seekBy(-5);
      else if (k === 'ArrowRight') this.seekBy(5);
      else if (k === 'ArrowUp') { this.video.volume = clamp(this.video.volume + 0.1, 0, 1); }
      else if (k === 'ArrowDown') { this.video.volume = clamp(this.video.volume - 0.1, 0, 1); }
      else if (k.toLowerCase() === 'l') this.setLoop(!this.settings.loop);
      else if (k.toLowerCase() === 'm') this.toggleMute();
      else if (k.toLowerCase() === 'f') this.toggleFullscreen();
      else if (k.toLowerCase() === 'n') this.goNext();
    }, { signal: this.ac.signal });
  }

  /* ================= 生命周期 ================= */
  destroy() {
    this.disposed = true;
    try { this.saveProgress(true); } catch { }
    try { this.video.pause(); } catch { }
    if (this.hls) { try { this.hls.destroy(); } catch { } this.hls = null; }
    this.relWakeLock();
    clearTimeout(this.hideTimer);
    clearTimeout(this._longTimer);
    clearTimeout(this._tapTimer);
    if (this.sheet) { try { this.sheet.close(); } catch { } }
    try { this.ac.abort(); } catch { }
    this.root.innerHTML = '';
  }
}

/* sound-pill 引用修正：build() 里用 data-ref 标记 */
Object.defineProperty(FitPlayer.prototype, 'pillSound', {
  get() { return this.root.querySelector('.sound-pill'); }
});
