# FitLab · 健身视频库

手机优先的个人健身视频学习站：**有氧（走步机 / 游泳）+ 力量训练**。
视频经 HLS 分片后存储在 Cloudflare R2，网站部署在 Cloudflare Pages，纯静态零服务器。

![tech](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20CF%20Pages%20%2B%20R2-ff5a3c)

## ✨ 特性

- 📱 **移动优先**：竖版 9:16 / 横版 16:9 视频自适应，iPhone 安全区适配，可「添加到主屏幕」当 App 用
- 🔁 **跟学友好**：进入即静音循环播放、双击 ±10s、长按 2 倍速、0.5~2.0 变速、连播模式
- 🕐 **继续观看**：首页自动记录上次看到的位置，一键续播（看完自动清掉）
- 🎯 **要点时间戳**：tips 支持 `{t: 秒, text}`，渲染成时间芯片，点击直达对应片段
- 📴 **PWA 离线壳**：Service Worker 预缓存界面框架，弱网也能打开浏览
- 🎚️ **丝滑进度条**：大热区拖动 + 时间气泡预览，学习时反复精看某一段
- 🌗 **屏幕常亮**：跟练时自动申请 Wake Lock，不怕锁屏
- 🧩 **纯静态**：无框架无构建，`data/videos.json` 一个文件管全部内容
- ⚡ **R2 同域代理**：`/media/*` 由 Pages Function 代理 R2（支持 Range），无跨域烦恼

## 🚀 快速开始

```bash
npm run demo      # 生成本地演示视频并启动 → http://localhost:8080/?demo=1
npm run dev       # 不带演示数据，看真实清单（占位状态）
```

## 📂 目录结构

```
fitlab-videos/
├── index.html                  # 入口（SPA，hash 路由）
├── sw.js                       # PWA 离线壳（视频流不缓存）
├── assets/
│   ├── css/style.css           # 全部样式（明亮现代风）
│   ├── js/app.js               # 路由 + 首页/科目页渲染
│   ├── js/player.js            # FitPlayer 自定义播放器
│   └── vendor/hls.min.js       # hls.js 本地副本（无外网也能播）
├── data/videos.json            # ★ 全站内容清单：科目 ↔ R2 目录映射
├── functions/media/[[path]].js # /media/* → R2 同域代理（Range/缓存）
├── scripts/
│   ├── add-video.sh            # ★ 一条龙：切片→封面→上传R2→输出清单片段
│   └── gen-demo.sh             # 生成本地演示资源
├── docs/
│   ├── WORKFLOW.md             # ★ 视频上传全流程指南
│   └── PROGRESS.md             # ★ 项目进度日志 / 断点记录
├── wrangler.toml               # Pages + R2 绑定配置
└── r2-cors.json                # （可选）R2 直连域名时的跨域配置
```

## 🎬 添加一个视频（3 步）

```bash
# 1. 切片并上传到 R2（自动压缩、生成封面、输出清单片段）
./scripts/add-video.sh ~/Movies/pec.mp4 strength pec-deck-fly "蝴蝶机夹胸" horizontal

# 2. 把输出的 JSON 片段粘进 data/videos.json 对应科目的 videos 里

# 3. push 上线（或 npm run deploy）
git add -A && git commit -m "video: 蝴蝶机夹胸" && git push
```

详细说明 → **[docs/WORKFLOW.md](docs/WORKFLOW.md)**

## ☁️ 部署架构

```
iPhone/Android 浏览器
        │  https://<你的域名>/
        ▼
Cloudflare Pages（静态站点 + Functions）
        │  /media/* 代理（支持 Range 断点拖动）
        ▼
Cloudflare R2 桶 fitlab-videos
        └── cardio/treadmill/... · cardio/swimming/... · strength/...
```

- **部署方式 A（推荐）**：GitHub 仓库 → Cloudflare Pages「连接 Git」→ 每次 push 自动部署
- **部署方式 B**：本地 `npm run deploy` 直接上传
- R2 绑定名必须是 `VIDEO_BUCKET`（见 `wrangler.toml`）

## 📝 日常维护 & 继续开发

- 加科目/改文案：编辑 `data/videos.json`
- 改样式/配色：`assets/css/style.css`（顶部 `:root` 变量）
- 改播放器行为：`assets/js/player.js`
- **进度与断点记录（给下一个你/AI）**：`docs/PROGRESS.md`
