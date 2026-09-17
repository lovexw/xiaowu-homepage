import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { profile, socials, projects, categoryLabel } from '../src/data.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const external = 'target="_blank" rel="noopener noreferrer"';
const arrow = '<span class="arrow" aria-hidden="true">↗</span>';
const socialCards = socials.map((item) => {
  const tag = item.url ? 'a' : 'button';
  const attrs = item.url ? `href="${escape(item.url)}" ${external}` : 'type="button" data-dialog="wechat-dialog"';
  return `<${tag} class="social-card" ${attrs}><span class="social-icon"><img src="${escape(item.icon)}" width="23" height="23" alt="" loading="lazy"></span><span class="social-text"><strong>${escape(item.name)}</strong><small>${escape(item.description)}</small></span>${item.url ? arrow : '<span class="arrow" aria-hidden="true">＋</span>'}</${tag}>`;
}).join('\n');
const projectCards = projects.map((item, index) => `<a class="project-card" href="${escape(item.url)}" ${external} data-category="${item.category}"><div class="project-art" aria-hidden="true"><span class="project-mark">${escape(item.mark)}</span><span class="art-label">${String(index + 1).padStart(2, '0')} / ${item.id.toUpperCase()}</span>${arrow}</div><div class="project-info"><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p><div class="project-tags">${item.tags.map((tag) => `<span>${escape(tag)}</span>`).join('')}</div></div></a>`).join('\n');
const head = await readFile(join(root, 'src/head.html'), 'utf8');
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}})();`;
const html = `<!doctype html>
<html lang="zh-CN"><head>${head}
<link rel="icon" type="image/svg+xml" href="/public/favicon.svg">
<link rel="apple-touch-icon" href="/public/apple-touch-icon.png">
<script>${themeInit}</script>
<link rel="stylesheet" href="/css/main.css">
<script type="module" src="/js/main.js"></script>
</head><body>
<a class="skip-link" href="#main">跳至主要内容</a>
<header class="site-header wrap"><a class="brand" href="#" aria-label="小吴乐意，回到顶部"><span class="brand-mark" aria-hidden="true">吴</span>小吴乐意<span aria-hidden="true" style="color:var(--accent)">.</span></a><div class="header-right"><nav class="site-nav" aria-label="主导航"><a href="#connect">找到我</a><a href="#projects">项目</a><a href="#about">关于</a></nav><button class="theme-toggle" type="button" aria-label="切换深浅主题" hidden>◐</button></div></header>
<main id="main" class="wrap">
<section class="hero" aria-labelledby="hero-title"><div><div class="hello"><span class="status-dot" aria-hidden="true"></span>保持好奇，持续创造</div><h1 id="hero-title">你好，我是<span>小吴。</span></h1><p class="hero-title">${escape(profile.title)}</p><p class="hero-copy">在这里，记录思考，分享作品。<br>关注健康、人工智能与比特币，做一个长期主义者。</p><p class="creed" title="仓位声明">₿ <strong>${escape(profile.bitcoinCreed)}</strong></p><div class="interests"><span class="interest"><b>H</b>Health</span><span class="interest"><b>A</b>AI</span><span class="interest"><b>B</b>Bitcoin</span></div><div class="hero-actions"><a class="button primary" href="#projects">探索我的项目 <span aria-hidden="true">↓</span></a><a class="button" href="https://blog.xiaowuleyi.com/" ${external}>读我的博客 ${arrow}</a></div></div><div class="hero-portrait"><div class="portrait-frame"><img src="/public/img/avatar.webp" width="320" height="320" alt="小吴乐意的头像" fetchpriority="high" decoding="async"><div class="portrait-caption"><span>XIAOWU LEYI</span><span>HEALTH · AI · BITCOIN</span></div></div><span class="portrait-label">✳ 一个长期主义者</span></div></section>
<div class="quote-strip"><blockquote><span aria-hidden="true">“</span>${escape(profile.quote.replace(/^"|"$/g, ''))}</blockquote><span class="eyebrow">THINK LONG TERM. KEEP BUILDING.</span></div>
<section id="connect" class="section" aria-labelledby="connect-title"><div class="section-heading"><div><p class="eyebrow">01 / ELSEWHERE</p><h2 id="connect-title">在这些地方，找到我</h2></div><p class="section-note">不同的平台，同一个小吴。外链将在新标签页打开。</p></div><div class="social-grid">${socialCards}</div></section>
<section id="projects" class="section" aria-labelledby="projects-title"><div class="section-heading projects-heading"><div><p class="eyebrow">02 / THINGS I BUILD</p><h2 id="projects-title">把想法，变成作品</h2></div><div class="filters" role="group" aria-label="筛选项目" hidden><button type="button" class="filter" data-filter="all" aria-pressed="true">全部 ${projects.length}</button>${Object.entries(categoryLabel).map(([key, label]) => `<button type="button" class="filter" data-filter="${key}" aria-pressed="false">${label}</button>`).join('')}</div></div><div class="project-grid">${projectCards}</div><p class="project-count" role="status" aria-live="polite">展示全部 ${projects.length} 个项目</p></section>
<section id="about" class="section" aria-labelledby="about-title"><div class="section-heading"><div><p class="eyebrow">03 / A LITTLE MORE</p><h2 id="about-title">慢一点，也走远一点</h2></div></div><div class="about-grid"><a class="book-card" href="${escape(profile.bookUrl)}" ${external}><div class="book" aria-hidden="true"><small>XIAOWU LEYI</small><strong>慢者<br>生存</strong><small>THINK IN DECADES.</small></div><div class="book-copy"><p class="eyebrow">MY E-BOOK</p><h3>《慢者生存》</h3><p>我的电子书，关于比特币与长期思考。</p><span class="text-link">打开电子书 ${arrow}</span></div></a><article class="mystery-card"><span class="mystery-glyph" aria-hidden="true">？</span><p class="eyebrow">COMING SOON</p><h3>神秘企划 · 即将开放</h3><p>这里正在酝酿一件小事，先卖个关子。<br>保持好奇，敬请期待。</p><span class="mystery-badge">✳ 即将开放</span></article></div></section>
</main><footer class="wrap"><div class="footer-top"><div><strong>${escape(profile.motto)}</strong></div><button class="btc-trigger" type="button" data-dialog="btc-dialog"><b aria-hidden="true">₿</b><span class="btc-full">${escape(profile.bitcoinAddress)}</span><span aria-hidden="true">＋</span><span class="sr-only">查看比特币地址和二维码</span></button><noscript><code class="address">${escape(profile.bitcoinAddress)}</code></noscript></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} 小吴乐意 · 用热爱，连接这个世界。</span><a href="https://github.com/lovexw/xiaowu-homepage" ${external}>本站开源于 GitHub ↗</a></div></footer>
<dialog id="wechat-dialog" aria-labelledby="wechat-title"><button class="dialog-close" type="button" data-close aria-label="关闭公众号说明">×</button><p class="eyebrow">WECHAT</p><h2 id="wechat-title">公众号：小吴乐意</h2><p>在微信「搜一搜」中搜索下方名称，选择「公众号」即可找到我。</p><code class="address">小吴乐意</code><button class="button primary" type="button" data-copy="小吴乐意">复制公众号名称</button></dialog>
<dialog id="btc-dialog" aria-labelledby="btc-title"><button class="dialog-close" type="button" data-close aria-label="关闭比特币地址">×</button><p class="eyebrow">BITCOIN</p><h2 id="btc-title">我的比特币地址</h2><p>请核对完整地址与网络。这里不会发起任何交易。</p><div class="qr" id="btc-qr" data-address="${escape(profile.bitcoinAddress)}" aria-label="比特币地址二维码"></div><code class="address">${escape(profile.bitcoinAddress)}</code><button class="button primary" type="button" data-copy="${escape(profile.bitcoinAddress)}">复制 BTC 地址</button></dialog><div class="toast" role="status" aria-live="polite" hidden></div>
</body></html>`;
await writeFile(join(root, 'index.html'), html);
const css = await Promise.all(['tokens', 'base', 'components'].map((name) => readFile(join(root, `css/${name}.css`), 'utf8')));
await writeFile(join(root, 'css/main.css'), css.join('\n'));
console.log(`Built static homepage: ${socials.length} social links, ${projects.length} projects. No runtime framework, no external requests.`);
