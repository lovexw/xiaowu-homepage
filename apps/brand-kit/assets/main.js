/* 小吴乐意品牌规范站 · 交互：主题切换 + 点击复制 + toast（零依赖） */
(function () {
  'use strict';

  var root = document.documentElement;
  var toggle = document.querySelector('.theme-toggle');
  var toast = document.querySelector('.toast');
  var toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 1800);
  }

  function copyText(text, message) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showToast(message); }, function () { fallbackCopy(text, message); });
    } else {
      fallbackCopy(text, message);
    }
  }

  function fallbackCopy(text, message) {
    var area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); showToast(message); } catch (error) { showToast('复制失败，请手动复制'); }
    document.body.removeChild(area);
  }

  // 可复制的组件 CSS（与 assets/brand.css 保持同步）
  var cssSnippets = {
    button: '.xw-btn {\n  display: inline-flex; align-items: center; justify-content: center; gap: 12px;\n  min-height: 46px; padding: 10px 20px;\n  border: 1px solid var(--xw-line); border-radius: var(--xw-radius-sm);\n  background: var(--xw-surface); color: var(--xw-fg);\n  font: 600 13px/1.5 var(--xw-font); text-decoration: none; cursor: pointer;\n  transition: transform .18s ease, border-color .18s ease;\n}\n.xw-btn:hover { transform: translateY(-2px); }\n.xw-btn--primary { background: var(--xw-fg); color: var(--xw-bg); border-color: var(--xw-fg); }',
    card: '.xw-card {\n  background: var(--xw-surface); border: 1px solid var(--xw-line);\n  border-radius: var(--xw-radius-md); padding: 20px;\n  transition: transform .18s ease, border-color .18s ease;\n}\n.xw-card:hover { border-color: var(--xw-accent); transform: translateY(-3px); }\n.xw-tag { display: inline-block; padding: 2px 6px; border-radius: 4px; background: var(--xw-soft); color: var(--xw-muted); font-size: 10px; }\n.xw-chip { display: inline-block; padding: 6px 10px; border: 1px solid var(--xw-line); border-radius: 7px; color: var(--xw-muted); font: 11px/1.5 var(--xw-mono); }\n.xw-chip b { color: var(--xw-accent); font-weight: 400; margin-right: 5px; }',
    art: '.xw-art {\n  position: relative; display: flex; align-items: center; justify-content: center;\n  min-height: 136px; overflow: hidden;\n  border: 1px solid var(--xw-line); border-radius: 15px;\n  color: #45604e; background: #eaf0e7;\n}\n.xw-art::before { content: \'\'; position: absolute; width: 100px; height: 100px; border: 1px solid currentColor; opacity: .09; border-radius: 50%; transform: scale(1.7); }\n.xw-art .xw-mark-lg { font: 700 34px/1 var(--xw-mono); letter-spacing: -.05em; position: relative; }\n.xw-art .xw-art-label { position: absolute; left: 14px; bottom: 12px; font: 9px/1 var(--xw-mono); letter-spacing: .12em; opacity: .65; }\n.xw-art--v2 { color: #5a587c; background: #e9e9f2; }\n.xw-art--v3 { color: #976641; background: #f3e9dc; }\n.xw-art--v4 { color: #4a687c; background: #e6edf2; }',
    quote: '.xw-creed {\n  display: flex; align-items: baseline; gap: 10px; padding: 11px 14px;\n  border: 1px solid var(--xw-line); border-left: 3px solid var(--xw-accent);\n  border-radius: 0 9px 9px 0; background: var(--xw-surface); font-size: 13px;\n}\n.xw-quote { margin: 0; font: 20px/1.6 var(--xw-serif); }\n.xw-quote span { color: var(--xw-accent); margin-right: 12px; font-size: 30px; vertical-align: middle; }'
  };

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('xw-theme', next); } catch (error) { /* 隐私模式忽略 */ }
    });
  }

  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-copy], [data-copy-css]');
    if (!target) return;
    var cssKey = target.getAttribute('data-copy-css');
    var text = cssKey ? cssSnippets[cssKey] : target.getAttribute('data-copy');
    if (!text) return;
    copyText(text, cssKey ? 'CSS 已复制，先引入 brand.css 的 tokens 再使用' : '已复制 ' + text + ' ' + (text.indexOf('#') === 0 ? '· 粘贴即可' : ''));
  });
})();
