# 📋 项目进度日志 & 断点记录

> 本文件是项目的「存档点」：记录已完成内容、当前断点、下一步计划。
> **给任何接手的人或 AI：先读完本文件再动手，改完代码请回写本文件。**

---

## 🗺️ 项目快照（断点标记）

| 项 | 状态 |
|---|---|
| 更新日期 | 2026-09-16 |
| 当前阶段 | **v0.2.3 已上线**（播放页常驻返回/首页导航；第四条真实视频《平板支撑》可播，新增「核心训练」分类） |
| 线上地址 | https://fitlab-videos.pages.dev |
| 演示模式 | https://fitlab-videos.pages.dev/?demo=1 （内置测试视频，验证播放器用） |
| 部署方式 | Cloudflare Pages 直传（`npm run deploy`）+ **GitHub Actions 工作流已就绪**（等 API Token 密钥后即全自动；密钥仍未配置，Actions 目前跳过部署，改清单后需本地 `npm run deploy`） |
| GitHub | ✅ 已推送 https://github.com/lovexw/fitlab-videos （main 分支） |
| R2 | ✅ 桶 `fitlab-videos`：`strength/pec-deck-fly/`、`strength/seated-db-press/`、`strength/lat-pulldown/`、`core/plank/`（各 m3u8 + 分片 + 封面）均在线可播 |
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

### 真实视频上线 + v0.2.1/v0.2.2（2026-09-16）
- [x] 《蝴蝶机夹胸》端到端上架：原片 1080×1920 竖屏 103s → `add-video.sh` 切片（18 分片）+ 封面 → 上传 R2 → 清单 `status: ready`，附 10 条**可点击时间戳要点**（调座椅→全握→抱树发力→慢还原→上胸/下胸变式）
- [x] 生产链路验证：`/media/strength/pec-deck-fly/` 的 m3u8 / 分片 / 封面全部 200
- [x] **全站默认竖屏 9:16**：清单内全部条目 `orientation: vertical`；`add-video.sh` 与 WORKFLOW.md 明确「无特殊说明一律竖屏」
- [x] **简洁化改版**：删除方向徽章、图标 inset 描边圈、桌面 1px 边框、卡片装饰圆斑、按钮粉紫光晕；`.more-card.now` 改淡色描边
- [x] **修复播放器模糊遮挡**：`.backdrop`（封面虚化层）在无 z-index 时按绘制顺序压在 video 上层，真实视频有封面后首次暴露；`video { position:relative; z-index:1 }` 提层修复（v0.2.2）
- [x] GitHub 仓库已推送；新增 `.github/workflows/deploy.yml`（push main → wrangler pages deploy，密钥未配置时自动跳过保持绿色）
- [x] 修复 `add-video.sh` 在 macOS 自带 bash 3.2 + C locale 下 `$TITLE` 紧贴全角字符报 unbound variable 的问题（改用 printf 注入）

### 播放页导航修复 + 《坐姿哑铃肩推》上架（v0.2.3，2026-09-16）
- [x] **播放页常驻导航栏**：视频下方新增「← 返回」「🏠 首页」两个胶囊按钮（`.p-nav`），不依赖视频控件显隐——修复「打开视频后找不到回主页的路」
- [x] **智能历史回退**：app.js 记录站内 hash 跳转深度（`navDepth`），「返回」按钮走 `history.back()` 从哪来回哪去（首页进的回首页、科目页进的回科目页）；直进/刷新进来的播放页兜底回科目页；「首页」按钮固定回 `#/`
- [x] 《坐姿哑铃肩推》端到端上架：原片 1080×1920 竖屏 73s → `add-video.sh`（13 分片）+ 封面 → 上传 R2 → 清单 `status: ready`，附 **6 条可点击时间戳要点**（按原片字幕对齐：调凳子→靠背稳定→手腕握法→手肘垂直→哑铃平行耳朵→肩部持续受力）
- [x] 生产链路验证：`/media/strength/seated-db-press/` m3u8/分片/封面全部 200；生产播放页 HLS 加载正常（readyState 3、无报错层）
- [x] `add-video.sh` 末行 `$OUT（` 又踩 bash 3.2 全角字符坑（报 unbound variable，上传本身已完成）→ 改 `${OUT} ` 修复
- [x] 导航路径本地 + 生产实测通过：首页→视频→返回 ✓、播放页→首页 ✓、科目页→视频→返回→科目页 ✓、直进播放页→返回兜底 ✓

### 测试记录（2026-09-16，IAB 1280×720 视口，生产环境）
- [x] 播放页 9:16 竖屏渲染正常、画面清晰无遮挡（截图验证）、时间戳要点芯片正常显示
- [x] GitHub Actions 两次推送运行成功（未配置密钥 → 按设计跳过部署）

### 《平板支撑》上架 + 新增「核心训练」分类（2026-09-16）
- [x] 新增分类：`core`（核心训练，🧘，accent `#14b8a6`，groupId 归入 💪 力量训练组）——自重核心动作与器械动作分家，纯清单驱动、零代码改动
- [x] 《平板支撑》端到端上架：原片 1078×1920 竖屏 60s（3D 动画教学片，带字幕要点）→ `add-video.sh`（10 分片 + 封面，共 13 文件）→ 上传 R2 `core/plank/` → 清单 `status: ready`，附 **11 条可点击时间戳要点**（按原片字幕段落对齐：整体姿态→别含胸挤肩胛→肩胛自然展开→勿塌腰坠腹→收腹夹臀纠正→手肘勿内夹→肘与肩同宽→勿双脚并拢防大腿代偿→头颈放松→宁做标准 30 秒）
- [x] 生产链路验证：`/media/core/plank/` 的 m3u8 / 分片 / 封面全部 200

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
4. Cloudflare Pages **直传项目不能事后改成 Git 连接**（官方文档只支持创建时连接）。所以自动部署走 **GitHub Actions → `wrangler pages deploy`**（仓库里 `.github/workflows/deploy.yml` 已就绪），不要尝试删项目重建来换原生 Git 集成（`fitlab-videos.pages.dev` 子域名有被回收的风险）。
5. **`.stage` 内部的层叠顺序**：`position:absolute` 的装饰层（如封面虚化 `.backdrop`）会绘制在未定位的 `video` 之上——给视频加 `position:relative; z-index:1` 才不会被遮挡。新增 stage 内浮层时注意 z-index 层级表（video 1 / 控件 5-6 / 浮层 7 / 居中层 8）。
6. **macOS 自带 bash 3.2 + C locale**：`"$VAR"` 后紧贴中文全角字符（如 `$TITLE》`、`$OUT（`）会把多字节字符并入变量名，报 `VAR: unbound variable`。脚本里凡变量后接中文，一律用 `printf '%s'` 注入或写成 `${VAR} `（大括号闭合 + 空格隔开）。

---

## 📍 断点与下一步（按优先级）

1. **打通 GitHub 自动部署**（用户动作，唯一剩余步骤）：
   `.github/workflows/deploy.yml` 已就位，只差两个仓库密钥：
   - Cloudflare 控制台 → My Profile → API Tokens → Create Token → 模板「Edit Cloudflare Workers」（含 Pages: Edit）→ 创建并复制
   - 配置密钥（或把 Token 交给 AI 处理）：
     ```bash
     gh secret set CLOUDFLARE_API_TOKEN -R lovexw/fitlab-videos   # 粘贴 Token
     gh secret set CLOUDFLARE_ACCOUNT_ID -R lovexw/fitlab-videos  # edbcf0ec7c3ee185334d13d9077ef6e9
     ```
   配好后任意 `git push` 即自动部署；也可在 Actions 页面手动 Run workflow 验证。

2. **继续上传视频**：按 `docs/WORKFLOW.md` 操作（一条命令 + 粘 30 秒清单）。
   待传：走步机两条 `cardio/treadmill/*`、游泳两条 `cardio/swimming/*`（均为竖屏 9:16）。
   （《坐姿哑铃肩推》已于 2026-09-16 上架 ✓；《高位下拉》已于 2026-09-16 上架 ✓；《平板支撑》已于 2026-09-16 上架 ✓）

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

### 2026-09-16 · 《平板支撑》上架
- 新增分类「核心训练」（`core`，🧘 `#14b8a6`，挂在力量训练组下）——第一个自重核心动作入库
- 上架：《平板支撑》（`core/plank`，60s 竖屏 HLS + 封面 + **11 条时间戳要点**，`status: ready`）
  - 原片为 3D 动画教学片（带中文字幕），抽帧逐段对齐要点：含胸挤肩胛→肩胛自然展开→塌腰坠腹→收腹夹臀→手肘内夹→肘与肩同宽→双脚并拢/大腿代偿→头颈放松→宁做标准 30 秒
  - `add-video.sh` 共上传 13 个文件 → 生产 `/media/core/plank/` m3u8/分片/封面全部 200

### 2026-09-16 · 《高位下拉》上架
- 上架：《高位下拉》（`strength/lat-pulldown`，124s 竖屏 HLS + 封面 + **11 条时间戳要点**，`status: ready`）
  - 原片 1078×1920 竖屏 → `add-video.sh`（21 分片，23 个文件）→ 上传 R2 → 生产 `/media/strength/lat-pulldown/` m3u8/分片/封面全部 200
  - 要点时间戳按原片内容对齐：握法虚握→握距 1.5 倍肩宽→「掰弯横杆」→勿手臂硬拽→背阔肌发力主体→慢速还原→握距/握把变式（宽握倒三角、对握 V 把）→颈后下拉伤肩警告
- ⚠️ **GitHub Actions 密钥仍未配置**：本次 push 后 Actions 显示 success 但实为「跳过部署」（`Missing Cloudflare credentials`）——线上清单靠本地 `wrangler pages deploy` 直传生效。以后改 `videos.json` 后记得 `npm run deploy`，或尽快配好密钥（见断点 1）
- 命令行注意：本机 npm 不在 PATH（zsh 只能找到 `/usr/local/bin/wrangler`），可绕过 npm 直接执行 `wrangler pages deploy . --project-name fitlab-videos`

### 2026-09-16 · v0.2.3
- 新增：播放页常驻导航栏 `.p-nav`（「← 返回」+「🏠 首页」）——修复播放页找不到回主页入口的问题
- 新增：智能历史回退 `goBack()`（`navDepth` 跟踪站内跳转；有来路 `history.back()`，无来路兜底科目页）；新增 `home` 图标与 `onHome` 回调
- 上架：《坐姿哑铃肩推》（`strength/seated-db-press`，73s 竖屏 HLS + 封面 + 6 条时间戳要点，`status: ready`）
- 修复：`add-video.sh` 末行 `$OUT（` 全角字符 unbound variable（改 `${OUT} `）
- 版本号 bump：`index.html` / `sw.js` → `?v=0.2.3`

### 2026-09-16 · v0.2.2
- 修复：播放器封面虚化背景层（`.backdrop`）绘制在视频上层，导致真实视频播放时有「一层模糊遮挡」——`video` 提升 `position:relative; z-index:1`（背景层此前从未被触发：占位视频无封面，首条真实视频上线才暴露）
- 版本号 bump：`index.html` / `sw.js` → `?v=0.2.2`

### 2026-09-16 · v0.2.1
- 上架首条真实视频：《蝴蝶机夹胸》（`strength/pec-deck-fly`，103s 竖屏 HLS + 封面 + 10 条时间戳要点，`status: ready`）
- 全站规则：**无特殊说明一律竖屏 9:16**——清单两条力量视频 `horizontal → vertical`；`add-video.sh` 与 `WORKFLOW.md` 默认值/示例/说明同步
- 简洁化改版：移除播放页方向徽章、`.group-badge`/`.cat-ico`/`.tip-jump` 的 inset 描边、`.cat-card::after` 装饰圆斑、桌面 `.app` 1px 边框、各渐变按钮光晕阴影
- 修复：`add-video.sh` 在 bash 3.2 + C locale 下 `$TITLE` 后接全角字符报 unbound variable（改 printf 注入）
- 新增：`.github/workflows/deploy.yml`（push main 自动 `wrangler pages deploy`；密钥未配置时跳过）
- GitHub 仓库建立并推送：https://github.com/lovexw/fitlab-videos

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
