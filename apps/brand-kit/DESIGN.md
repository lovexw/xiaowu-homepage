# 小吴乐意 · AI 设计规范 v1.0

> **用途**：把本文件全文投喂给任何 AI（做网页、分享卡、海报、PPT），AI 就能按统一的视觉语言产出「小吴乐意」风格的页面。这是唯一的权威版本；配套演示站与本文件同仓库（`xiaowu-brand-kit`），可直接引入的组件 CSS 见 `assets/brand.css`。
> **适用人**：小吴乐意（H.A.B｜哈勃未来创始人，比特币爱好者，Health · AI · Bitcoin）。

---

## 0 · 一句话定位

**温润纸感，手作印刷。** 每个页面都像一本慢慢做的手工杂志：纸白底、墨色字、陶土橘点缀、等宽字体编号、1px 细描边、克制的上浮动效。

气质关键词：`纸感 PAPER` · `印刷 PRINT` · `编号 INDEX` · `长期 DECADES`

**反面清单（看到就删）**：渐变大 hero、玻璃拟态、霓虹渐变字、大面积投影、圆角全 0 的「科技风」、外部字体 CDN、emoji 当图标体系、蓝紫默认配色。

---

## 1 · 设计变量（tokens）

浅色为默认主题；深色通过 `html[data-theme='dark']` 整组切换，**两套必须同时定义**。

| 语义 | 浅色值 | 深色值 | 用途 |
|---|---|---|---|
| `--xw-bg` | `#faf9f6` 纸白 | `#181b18` 墨夜 | 页面底色 |
| `--xw-surface` | `#ffffff` 纯白 | `#212521` 炭面 | 卡片、按钮表面 |
| `--xw-fg` | `#252623` 墨色 | `#eeeee7` 晨雾 | 正文、主按钮底 |
| `--xw-muted` | `#6d7069` 灰苔 | `#b1b7ac` 雾苔 | 次要文字（4.8:1 AA） |
| `--xw-line` | `#e5e5df` 亚麻 | `#383e36` 炭线 | 所有描边、分隔线 |
| `--xw-soft` | `#f1f1eb` 米灰 | `#2c322a` 暖炭 | 软底色块、标签底 |
| `--xw-accent` | `#b9542b` 陶土橘 | `#f5a37d` 陶土浅 | 品牌强调（4.6:1 AA） |
| `--xw-accent-soft` | `#f9e8de` | `#463026` | 强调软底 |
| `--xw-green` | `#356347` 苔绿 | `#a7d4ae` 月光苔 | 辅助、状态、成功 |
| `--xw-btc` | `#F7931A` 比特币橙 | 同 | **仅比特币专属场景**（₿、地址、比特币类项目） |

```css
:root {
  color-scheme: light;
  --xw-bg: #faf9f6; --xw-surface: #ffffff; --xw-fg: #252623; --xw-muted: #6d7069;
  --xw-line: #e5e5df; --xw-soft: #f1f1eb; --xw-accent: #b9542b; --xw-accent-soft: #f9e8de;
  --xw-green: #356347; --xw-btc: #F7931A;
  --xw-radius: 20px; --xw-radius-md: 13px; --xw-radius-sm: 9px;
  --xw-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --xw-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --xw-serif: 'Songti SC', 'STSong', Georgia, serif;
}
html[data-theme='dark'] {
  color-scheme: dark;
  --xw-bg: #181b18; --xw-surface: #212521; --xw-fg: #eeeee7; --xw-muted: #b1b7ac;
  --xw-line: #383e36; --xw-soft: #2c322a; --xw-accent: #f5a37d; --xw-accent-soft: #463026;
  --xw-green: #a7d4ae;
}
```

**色彩使用铁律**

- 陶土橘只做**点缀**：悬停描边、关键词、编号高亮、左边框。不做大面积色块、不做按钮底色。
- 主按钮 = 墨底纸字（14.6:1 AAA），不是橘底。
- 比特币橙只出现在比特币语义的场景，与其他橘严格区分。
- 全站零外部请求：不用外部字体、不用 CDN 图标库，图标用字符（`↗` `＋` `◐` `₿` `✳` `？`）。

---

## 2 · 字体排印

三种字库，各司其职，**不可混用**：

| 字库 | 栈 | 只用于 |
|---|---|---|
| 界面 sans | 系统栈（见 tokens） | 正文、标题、按钮 |
| 等宽 mono | `ui-monospace, SFMono-Regular, Menlo, Consolas` | 编号眉题、标签、地址、元数据、艺术字块 |
| 宋体 serif | `'Songti SC', 'STSong', Georgia, serif` | **仅**引言、书名等书卷气场景 |

| 层级 | 规格 |
|---|---|
| H1（首屏） | `clamp(42px, 5vw, 62px)` / 行高 1.2 / 字重 750 / 字距 -0.05em；句中关键词用 `--xw-accent` |
| H2（节标题） | 25px / 字重 650 / 字距 -0.02em |
| H3（卡标题） | 14px / 字重 650 / 行高 1.65 |
| 正文 | 15px / 行高 1.7；长段落行高 1.8–1.9、颜色 `--xw-muted` |
| 辅助文字 | 12–13px，`--xw-muted` |
| 眉题 eyebrow | `11px/1.5 mono` / 字距 .16em / 全大写 / `--xw-muted` |
| 微标 art-label | `9px mono` / 字距 .12em |

标题一律 `margin: 0` 重置后按节距控制；中文标点悬挂不做强求，但标题避免以逗号结尾。

---

## 3 · 间距与版式

- **容器**：`width: min(1120px, calc(100% - 64px)); margin-inline: auto;`，≤600px 改 `calc(100% - 40px)`。
- **节节奏**：每节 `padding-top: 56px`（移动 40px）；节头 = eyebrow + H2 + 右侧说明小字，`margin-bottom: 24px`。
- **页面骨架**（个人主页型）：`头部导航 → 首屏 hero（左文右图 1.4:1）→ 宋体引言条（上下 1px 线）→ 若干编号节 → 页脚（上 1px 线）`。
- **网格**：项目卡 4 列 → ≤1000px 2 列；社交卡 3 列 → 2 列 → ≤440px 1 列。间距 12–16px，≤440px 收到 11px。
- **断点**：`1000px` / `700px` / `440px` 三档。
- **编号系统（排版签名，必须用）**：每个内容节给序号——眉题 `01 / ELSEWHERE`、`02 / THINGS I BUILD`；卡片艺术区左下角 `01 / LITEPIC` 式微标。数字两位补零，斜杠前后空格。
- **对角线手作感**：允许少量元素旋转制造「手作印刷」感：照片框 +4°、贴纸 -5°、书本 -7°。每屏 1–2 处，不可滥用。

---

## 4 · 组件库（复制即用，完整版见 `assets/brand.css`）

### 4.1 眉题 eyebrow
```css
.xw-eyebrow { font: 11px/1.5 var(--xw-mono); letter-spacing: .16em; color: var(--xw-muted); text-transform: uppercase; }
.xw-eyebrow b { color: var(--xw-accent); font-weight: 400; }
/* 用法：<p class="xw-eyebrow">01 / THINGS I BUILD</p> */
```

### 4.2 按钮
```css
.xw-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 12px;
  min-height: 46px; padding: 10px 20px;
  border: 1px solid var(--xw-line); border-radius: var(--xw-radius-sm);
  background: var(--xw-surface); color: var(--xw-fg);
  font: 600 13px/1.5 var(--xw-font); text-decoration: none; cursor: pointer;
  transition: transform .18s ease, border-color .18s ease;
}
.xw-btn:hover { transform: translateY(-2px); }
.xw-btn--primary { background: var(--xw-fg); color: var(--xw-bg); border-color: var(--xw-fg); }
```
规则：一屏一个主按钮；悬停上浮 2px；无投影无渐变。

### 4.3 卡片
```css
.xw-card {
  background: var(--xw-surface); border: 1px solid var(--xw-line);
  border-radius: var(--xw-radius-md); padding: 20px;
  transition: transform .18s ease, border-color .18s ease;
}
.xw-card:hover { border-color: var(--xw-accent); transform: translateY(-3px); }
.xw-card--lg { border-radius: var(--xw-radius); padding: 28px 30px; }
```
规则：一卡一事；卡不嵌卡；1px 细描边不堆投影；圆角由外向内递减（20 > 13–15 > 9 > 4–7）。

### 4.4 标签与徽章
```css
.xw-tag { display: inline-block; padding: 2px 6px; border-radius: 4px; background: var(--xw-soft); color: var(--xw-muted); font-size: 10px; }
.xw-chip { display: inline-block; padding: 6px 10px; border: 1px solid var(--xw-line); border-radius: 7px; color: var(--xw-muted); font: 11px/1.5 var(--xw-mono); }
.xw-chip b { color: var(--xw-accent); font-weight: 400; margin-right: 5px; }
/* chip 用法：<span class="xw-chip"><b>H</b>Health</span> */
```

### 4.5 编号艺术区块（卡头 / 封面）
```css
.xw-art {
  position: relative; display: flex; align-items: center; justify-content: center;
  min-height: 136px; overflow: hidden;
  border: 1px solid var(--xw-line); border-radius: 15px;
  color: #45604e; background: #eaf0e7;           /* v1 苔绿（默认） */
}
.xw-art::before { content: ''; position: absolute; width: 100px; height: 100px; border: 1px solid currentColor; opacity: .09; border-radius: 50%; transform: scale(1.7); }
.xw-art .xw-mark-lg { font: 700 34px/1 var(--xw-mono); letter-spacing: -.05em; position: relative; }
.xw-art .xw-art-label { position: absolute; left: 14px; bottom: 12px; font: 9px/1 var(--xw-mono); letter-spacing: .12em; opacity: .65; }
.xw-art--v2 { color: #5a587c; background: #e9e9f2; }  /* 藤紫 */
.xw-art--v3 { color: #976641; background: #f3e9dc; }  /* 沙棕 */
.xw-art--v4 { color: #4a687c; background: #e6edf2; }  /* 雾蓝 */
```
规则：中央等宽大字符（项目缩写或汉字），左下角 `01 / ID` 微标，右上角 `↗`；四色按顺序轮换；深色模式**保留浅色底**（像贴纸）。

### 4.6 立场框 creed
```css
.xw-creed {
  display: flex; align-items: baseline; gap: 10px; padding: 11px 14px;
  border: 1px solid var(--xw-line); border-left: 3px solid var(--xw-accent);
  border-radius: 0 9px 9px 0; background: var(--xw-surface); font-size: 13px;
}
```
用途：一句话立场/仓位声明/重要引述，一页最多一个。

### 4.7 宋体引言 quote
```css
.xw-quote { margin: 0; font: 20px/1.6 var(--xw-serif); }
.xw-quote span { color: var(--xw-accent); margin-right: 12px; font-size: 30px; vertical-align: middle; }
/* 用法：<blockquote class="xw-quote"><span>“</span>未来的种子，深埋在过去。</blockquote> */
```

### 4.8 拍立得相框 frame（唯一允许的投影）
```css
.xw-frame {
  display: inline-block; padding: 13px 13px 18px;
  background: var(--xw-surface); border: 1px solid var(--xw-line);
  border-radius: 6px; transform: rotate(4deg); box-shadow: 0 14px 35px #2526230c;
}
.xw-frame img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 3px; }
.xw-frame figcaption { display: flex; justify-content: space-between; padding: 15px 4px 0; font: 10px/1.5 var(--xw-mono); color: var(--xw-muted); letter-spacing: .1em; }
```

### 4.9 品牌标与状态点
```css
.xw-brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; background: var(--xw-fg); color: var(--xw-bg); font-size: 17px; font-weight: 700; }
.xw-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #719168; box-shadow: 0 0 0 4px var(--xw-soft); }
```
品牌标内容为「吴」，最小 28px，不换色不拉伸。比特币场景可用 `₿`（`--xw-btc` 色）替代。

---

## 5 · 文案声音（AI 写文案也照此执行）

- 第一人称、短句、句号结尾。克制，不堆感叹号，不喊口号。
- 中文为主，关键词点缀英文：`Health · AI · Bitcoin`、`THINK IN DECADES.`。
- 眉题、按钮用短动词短语：「探索我的项目」「读我的博客」。
- 金句库（可直接引用）：「未来的种子，深埋在过去。」「保持好奇，持续创造。」「慢一点，也走远一点。」「永远年轻，永远热泪盈眶。」「100% 全仓，且唯一只持有比特币。」
- 自称「小吴」，亲切但不油腻；不用「亲」「哦」等淘宝腔。

---

## 6 · 硬性规则（十条）

1. **双主题**：浅色为默认，深色 `data-theme='dark'` 整组切换，两套 tokens 必须同时给出。
2. **陶土橘只点缀**：不做大面积色块、不做主按钮底。
3. **1px 细描边世界观**：分隔靠线不靠投影；唯一例外是拍立得相框的柔和投影。
4. **编号贯穿**：节有眉题编号，卡有 art-label 编号，两位补零。
5. **圆角递减**：容器 20 > 卡 13–15 > 按钮 9 > 标签 4–7；同层同级圆角一致。
6. **动效只有 transform**：`.18s ease`，位移 ≤3px；必须写 `prefers-reduced-motion` 全关。
7. **零外部依赖**：无外部字体、无 CDN、无运行时框架；图标用字符（`↗ ＋ ◐ ₿ ✳ ？`）。
8. **等宽字体守界**：只做编号/标签/地址/元数据；正文永远系统 sans。
9. **宋体守界**：只做引言与书名。
10. **比特币橙守界**：只出现在比特币语义场景。

---

## 7 · 无障碍

- 正文对比 ≥ AA：墨/纸白 14.6:1（AAA）、灰苔/纸白 4.8:1（AA）、陶土橘/纸白 4.6:1（AA，用于 ≥14px 强调）、暗色强调 8.6:1（AAA）。
- `:focus-visible { outline: 3px solid var(--xw-accent); outline-offset: 5px; }`，焦点态永不移除。
- 交互目标最小 44px 高；外链统一 `rel="noopener noreferrer"`。
- 图片声明 `width/height` 防 CLS；状态用 `aria-pressed`/`role="status"`；提供跳转正文的 skip-link。

---

## 8 · 新页面快速配方

1. 引入 tokens（拷贝第 1 节 CSS 或 `assets/brand.css`），底 `--xw-bg`，字 `15px/1.7`。
2. 搭骨架：头部（品牌标「吴」+ 导航 + ◐ 主题钮）→ hero → 引言条 → 编号节 → 页脚。
3. 每节写眉题 `0N / NAME` + H2；内容装 `.xw-card`，卡头可用 `.xw-art` 四色轮换。
4. 首屏放一个主按钮 + 一个次按钮；立场句用 `.xw-creed`。
5. 加一处手作感（拍立得或旋转贴纸），其余保持横平竖直。
6. 补深色主题、`prefers-reduced-motion`、焦点态、外链 `noopener`。
7. 对照第 9 节验收清单逐项过。

---

## 9 · 验收清单

- [ ] 浅深两套主题都完整，切换无闪烁（`<head>` 内联初始化脚本）。
- [ ] 页面上除了拍立得投影没有任何 box-shadow；渐变 0 个。
- [ ] 陶土橘没有出现在按钮底色 / 大面积色块上。
- [ ] 等宽字体只出现在编号、标签、地址、元数据、艺术字块。
- [ ] 每个内容节有编号眉题；每张可点击卡有 `↗`。
- [ ] 悬停效果只有描边变化 + ≤3px 位移。
- [ ] 无外部请求（字体/图标/脚本）。
- [ ] 键盘焦点可见；对比度达标；`prefers-reduced-motion` 生效。

---

*v1.0 · 2026-09 · 基准实现：[xiaowu-homepage](https://github.com/lovexw/xiaowu-homepage) · MIT License*
