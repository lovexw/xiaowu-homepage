# 小吴乐意 · 个人品牌视觉规范 · Xiaowu Brand Kit

一套「温润纸感，手作印刷」的个人品牌视觉语言：纸白底、墨色字、陶土橘点缀、等宽编号、1px 细描边。给人看，也给 AI 用——任何 AI 读完 `DESIGN.md` 就能按统一风格产出小吴乐意的网页、分享卡与海报。纯静态、零依赖、零外链。

**基准实现**：[xiaowu-homepage](https://github.com/lovexw/xiaowu-homepage)（个人主页即本规范的第一示范）。

## 这是什么

- **给 AI**：把 [`DESIGN.md`](DESIGN.md) 全文投喂给任何 AI（做网页、PPT、分享卡），它就知道色彩、字体、组件、文案声音与十条硬规则，产出即统一。
- **给开发**：[`assets/brand.css`](assets/brand.css) 引入即用——`--xw-` 前缀 tokens（浅/深双主题）+ 眉题/按钮/卡片/标签/编号艺术区块/立场框/宋体引言/拍立得相框。
- **给人**：`index.html` 是可视化规范手册，色卡与组件点击即复制色值和 CSS。

## 站点内容

- **色彩**：浅色 10 色卡 + 深色 8 色卡，点击复制色值，附 WCAG 对比度（墨/纸白 14.6:1 AAA）
- **字体**：系统 sans / 等宽 mono / 宋体 serif 三字库守界演示与字号阶梯
- **组件**：按钮、卡片与标签、编号艺术区块（四色轮换）、立场框与引言，一键复制 CSS
- **版式**：1120px 容器、节律、三档断点（1000/700/440）、贯穿全站的编号系统
- **标志**：「吴」字墨章与变体、状态点、favicon
- **规则**：十条硬规则 + 文案声音（AI 写文案也照此执行）
- **资源**：brand.css 下载与引入代码

## 本地运行

无需构建，纯静态：

```bash
cd 项目目录
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000
```

## 目录结构

```
├── index.html        # 规范手册（单页，锚点导航，深浅主题）
├── DESIGN.md         # AI 设计规范（投喂给 AI 的唯一权威版本）
├── assets/
│   ├── brand.css     # 可直接引入的品牌 CSS（--xw- 前缀 tokens + 组件）
│   ├── style.css     # 规范站自身版式（组件样式来自 brand.css）
│   ├── main.js       # 主题切换 / 点击复制 / toast（零依赖）
│   └── favicon.svg   # 「吴」墨章
└── LICENSE           # MIT
```

## 用法

```html
<!-- 1. 引入品牌 CSS -->
<link rel="stylesheet" href="brand.css">

<!-- 2. 按 class 组合使用 -->
<p class="xw-eyebrow">01 / THINGS I BUILD</p>
<a class="xw-btn xw-btn--primary" href="#">主要按钮</a>
<article class="xw-card">…</article>
```

给 AI 的最短指令：**「读取 xiaowu-brand-kit/DESIGN.md，按规范执行。」**

## 常见修改

| 想改什么 | 改哪里 |
|---|---|
| 调整品牌色 / 字体栈 | `assets/brand.css` 顶部 `:root` 与 `html[data-theme='dark']`，同步 `DESIGN.md` 第 1 节与 `assets/main.js` 的复制片段 |
| 增补组件 | `assets/brand.css` 加 class，`DESIGN.md` 第 4 节补 CSS 与规则，`assets/main.js` 补复制片段 |
| 改规则 / 文案声音 | `DESIGN.md` 第 5、6 节，同步 `index.html` 对应区块 |
| 换 favicon | `assets/favicon.svg` |

## 版权

代码与规范文档 MIT License。文字内容（金句、立场声明）归小吴乐意所有，引用请注明出处。
