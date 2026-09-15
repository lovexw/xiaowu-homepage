# 📋 项目进度日志 & 断点记录

> 本文件是项目的「存档点」：记录已完成内容、当前断点、下一步计划。
> **给任何接手的人或 AI：先读完本文件再动手，改完代码请回写本文件。**

---

## 🗺️ 项目快照（断点标记）

| 项 | 状态 |
|---|---|
| 更新日期 | 2026-09-15 |
| 当前阶段 | **v0.2.0 增强版已上线**（继续观看/时间戳/PWA 壳；仍为占位数据，等待真实视频） |
| 线上地址 | https://fitlab-videos.pages.dev |
| 演示模式 | https://fitlab-videos.pages.dev/?demo=1 （内置测试视频，验证播放器用） |
| 部署方式 | Cloudflare Pages 直传（`npm run deploy`），R2 绑定 `VIDEO_BUCKET` 已生效 |
| GitHub | ❌ **尚未推送**（gh 未登录，见「断点与下一步」第 1 条） |
| 本地预览 | `python3 -m http.server 8080` 或 `npm run demo`（演示数据） |

---

## ✅ 已完成

### 站点框架（v0.1）
- [x] 纯静态 SPA：`index.html` + hash 路由（`#/` 首页、`#/c/:id` 科目页、`#/v/:id` 播放页），无构建步骤
- [x] 内容全部由 `data/videos.json` 驱动（groups → categories → videos，字段含 `_readme` 自说明）
- [x] 三大科目就位：有氧-走步机、有氧-游泳（各 2 条占位）、力量训练（蝴蝶机夹胸、坐姿哑铃肩推，含动作要领文案）
- [x] `status: pending` 占位体系：未上传视频显示优雅的「🎬 视频整理中」卡片/播放层
- [x] 明亮现代 UI：渐变主色（橙→粉）、圆角卡片、入场动画、毛玻璃顶栏、安全区适配、桌面端 520px 居中列

### 播放器（FitPlayer，assets/js/player.js）
- [x] 进入即**静音自动播放**（符合移动端策略），点击一键开声音（记忆偏好）
- [x] 默认**单集循环**；可切「连播」模式（播完自动下一个，与循环互斥），设置持久化 localStorage
- [x] **滑动进度条**：大热区、拖动实时 seek + 时间气泡、缓冲条、拖动时进度条增粗
- [x] 双击左/右 ±10s（带波纹提示）、双击中间播放/暂停、长按 2× 快进（松手恢复）
- [x] 倍速面板 0.5~2.0×、静音、下一个、全屏（iOS 用 `webkitEnterFullscreen`）
- [x] 断点续播（进度保存/恢复；首页「继续观看」卡片 + 播放页「从 xx 继续播放」浮层；接近片尾或重播时自动清除记录）
- [x] 要点时间戳：tips 支持 `{t: 秒, text}` 对象，渲染为时间芯片，点击即跳转对应进度（配合科目主色 `--cat`）
- [x] PWA 离线壳：`sw.js`（核心资源预缓存 + SWR；清单/导航网络优先；视频流完全不缓存），og 分享 meta
- [x] 竖版 9:16 / 横版 16:9 自适应布局；播放中 Wake Lock 屏幕常亮
- [x] hls.js 按需加载：本地 `assets/vendor/hls.min.js` 优先，失败回退 jsdelivr CDN；iOS/Safari 走原生 HLS
- [x] 桌面键盘快捷键：空格、←→、L 循环、M 静音、F 全屏、N 下一个

### 基础设施
- [x] `functions/media/[[path]].js`：`/media/*` 同域代理 R2（Range 分段请求、m3u8 短缓存/分片长缓存、CORS、防路径穿越）——**生产环境已验证生效**
- [x] `wrangler.toml`：Pages 项目 + R2 绑定（`VIDEO_BUCKET` → 桶 `fitlab-videos`）
- [x] `scripts/add-video.sh` 一条龙：ffmpeg 转码切片（6s HLS）→ 取 10% 处封面 → 上传 R2 → 打印清单 JSON 片段，支持 `--push`
- [x] `scripts/gen-demo.sh`：生成本地演示视频（竖版 MP4 / 横版 HLS / 占位条目）
- [x] R2 端到端链路验证：上传 → `https://fitlab-videos.pages.dev/media/<key>` 可读 → 删除 ✓

### 测试记录（2026-09-15，IAB WebKit 内核 390×844 视口）
- [x] 首页/科目页/播放页渲染正常，真实清单占位态美观
- [x] 演示视频（横版 HLS、竖版 MP4）自动静音播放、循环开启
- [x] 进度条拖动（合成事件验证：按下 20%→2s，拖至 80%→8s）、双击 ±10s、长按 2×、倍速 1.5× 持久化、连播自动跳下一集、占位层显示 —— 全部通过
- [x] v0.2 回归：时间戳芯片跳转（0.6→6.6s ✓）、进度自然保存/强制保存 ✓、继续观看卡片（进度条/剩余时间/刚刚）✓、卡片点击→续播 pill→精确 seek ✓、清空记录 ✓

---

## ⚠️ 已踩的坑（重要，勿重复踩）

1. **wrangler 4.x 在含 wrangler.toml 的目录里，`r2 object put` 默认写本地模拟桶**（`--remote` 才真正上传）。已在 `add-video.sh` 的 `r2put()` 里内置 `--remote` 优先，别改回去。
2. **CSS 类选择器会覆盖 HTML `hidden` 属性**（`.center-layer{display:grid}` 干掉 `[hidden]` 的 display:none），需要显式写 `.center-layer[hidden]{display:none}`。已修复，新增浮层时注意。
3. iOS 播放策略：自动播放必须 `muted + playsinline`；全屏用 `video.webkitEnterFullscreen()`（仅用户手势内可调）。
4. Cloudflare Pages **直传项目不能事后改成 Git 连接**。当前是直传；若以后想 GitHub 自动部署，需删除 Pages 项目重建（见下）。

---

## 📍 断点与下一步（按优先级）

1. **推送 GitHub**（用户动作，约 2 分钟）：
   ```bash
   gh auth login                       # 选 GitHub.com → HTTPS → 浏览器登录
   gh repo create fitlab-videos --private --source=. --push
   ```
   推上去之后若想要 push 自动部署：Cloudflare 控制台 → Workers & Pages → 删除现在的
   `fitlab-videos` 项目 → 重新 Create → 连接 Git 仓库（构建命令留空、输出目录 `/`），
   再在 Functions 设置里把 R2 绑定 `VIDEO_BUCKET` 指到桶 `fitlab-videos`
   （或保留 wrangler.toml，新部署会自动带绑定）。**不删项目也行**，继续用 `npm run deploy` 手动部署。

2. **上传真实视频**：完全按 `docs/WORKFLOW.md` 第 2~3 节操作（一条命令 + 粘 30 秒清单）。
   建议顺序：先传力量训练两条（蝴蝶机夹胸 `strength/pec-deck-fly`、坐姿哑铃肩推
   `strength/seated-db-press`），替换对应 pending 条目。

3. **待办（增强，非阻塞）**：
   - [ ] 多码率 HLS（现单码率 720p；手机流量够用，桌面想更高清再加 1080p rendition）
   - [ ] 科目页搜索/筛选（视频多了再做）
   - [ ] 动态 og:image（按视频生成分享卡；目前是站点级静态 og 标签）
   - [ ] 训练打卡/计数（可选玩法）

---

## 🤖 给下一个 AI 的接手说明

- **技术栈**：无框架原生 JS（`assets/js/app.js` 路由+渲染、`player.js` 播放器类 `FitPlayer`）、单文件 CSS。改 UI 先看 `style.css` 顶部 `:root` 变量。
- **内容协议**：一切内容改动 = 改 `data/videos.json`；`_readme` 字段里有完整字段说明。R2 目录约定 `<科目dir>/<视频id>/master.m3u8 + seg_*.ts + poster.jpg`。
- **本地验证流程**：`npm run demo` → 浏览器开 `http://localhost:8080/?demo=1`；改完用 IAB/Chrome 手机视口过一遍播放器手势。
- **发布**：`npm run deploy`（直传），或 Git 连接后 push 自动部署。
- **播放器核心手势逻辑**在 `bindStageGestures`（单击/双击/长按状态机）与 `bindScrub`（rAF 节流的拖动 seek），改动时保持「单击延迟 300ms 等双击」的时序约定。
- **不要**给 manifest 里的视频加跨域属性（同域代理无跨域）；若切到 R2 公开域名模式，记得配 `r2-cors.json` 并把 `cdnBaseUrl` 填上。

## 📝 变更日志

### 2026-09-15 · v0.2.0
- 新增：首页「继续观看」（localStorage 进度驱动，含进度条/剩余时间/刚刚，支持一键清空）
- 新增：要点时间戳 tips（`{t, text}` 渲染时间芯片，点击 seek + 回顶 + 提示）
- 新增：PWA Service Worker 离线壳（视频流不缓存）、og 分享 meta
- 修复：续播按钮调用未定义的 `this.play()`（现补 `play()` 方法）
- 修复：进度保存条件对短视频永远不成立（`t>5 && t<d-5` → `t>3 && t<d-2`），并新增「接近片尾/重播即清除」
- 优化：静态资源加 `?v=` 版本号防缓存串版本；sw 预缓存清单同步

### 2026-09-15 · v0.1.0
- 首个可上线版本：SPA + FitPlayer + R2 代理 + 一条龙脚本 + 双文档
- 修复：`[hidden]` 被 CSS 覆盖导致错误层常显；DEMO 角标遮挡全屏按钮；wrangler 本地/远程桶语义
- 验证：本地 IAB 手势全通过；生产 `/media/` R2 代理读写端到端通过
