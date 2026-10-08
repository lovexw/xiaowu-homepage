# 云音 · 私人在线音乐播放器

一个完全属于你自己的音乐播放器：**代码跑在 Cloudflare Workers，音乐存在 Cloudflare R2**，浏览器 / 手机浏览器打开即听。没有任何第三方音乐服务，曲库 100% 由你自己掌控。

![tech](https://img.shields.io/badge/Cloudflare-Workers%20%2B%20R2-f6821f) ![price](https://img.shields.io/badge/%E8%B4%B9%E7%94%A8-%E5%85%8D%E8%B4%B9%E9%A2%9D%E5%BA%A6%E5%86%85-green)

## 功能

- 🎧 流式播放（HTTP Range，支持拖动进度条、边下边播），支持 mp3 / flac / m4a / aac / ogg / opus / wav
- 🏷️ 自动读取歌曲标签：歌名 / 歌手 / 专辑 / 曲目号 / 时长 / 内嵌封面（FLAC、ID3v2、M4A、Ogg、WAV），认不出的按「文件夹 + 文件名」智能推断
- 🖼️ 内嵌封面自动提取并去重存储，没封面的按歌手生成专属渐变色占位图
- 🔍 搜索、按歌手 / 按专辑分组、播放全部
- 🔀 随机播放、列表循环、单曲循环、播放队列
- ⌨️ 快捷键：`空格` 播放暂停、`←/→` 快退快进 5 秒、`↑/↓` 音量、`/` 聚焦搜索
- 📱 手机浏览器可用，适配系统媒体面板（Media Session：锁屏/控制中心显示封面和歌名）
- ⬆️ 网页直接拖拽 / 选择文件上传，也可用脚本批量上传整个本地音乐库
- 🔐 密码登录（HMAC 签名 Cookie），只有你能访问
- 📝 播放器会记住音量、播放模式、上一次听的歌

## 目录结构

```
xw-music/
├── wrangler.jsonc        # Cloudflare 配置（Worker 名、R2 桶、静态资源）
├── src/
│   ├── index.ts          # Worker：登录鉴权 / 曲库 / 流媒体 / 上传 / 删除
│   ├── library.ts        # R2 曲库缓存（meta/library.json）
│   └── metadata.ts       # 音频标签解析器（纯手写，零依赖）
├── public/               # 前端界面（原生 HTML/CSS/JS，无框架）
└── scripts/upload.mjs    # 本地音乐库批量上传脚本（S3 API）
```

## 首次部署（约 5 分钟）

前置：一个 Cloudflare 账号（免费版就行）+ Node.js 18+。

```bash
npm install                 # 安装依赖
npx wrangler login          # 浏览器授权登录 Cloudflare
npx wrangler r2 bucket create xw-music   # 创建存音乐的桶
npm run deploy              # 部署 Worker
npx wrangler secret put USERNAME         # 设置登录用户名（回车后输入）
npx wrangler secret put PASSWORD         # 设置登录密码（回车后输入）
```

部署完终端会给出地址（形如 `https://xw-music.<你的子域>.workers.dev`），打开 → 输入用户名和密码 → 点「上传音乐」即可开始传歌。

绑定自己的域名：Cloudflare 控制台 → Workers → xw-music → Settings → Domains & Routes → Add Custom Domain（当前已绑定 `yinyue.xiaowuleyi.com`）。

> 以后更新代码，`git pull && npm run deploy` 就行。

## 上传音乐

**方式一：网页上传（少量、方便）**
打开播放器，把音频文件直接拖进页面，或点右上角「上传音乐」。单文件建议不超过 95MB（Workers 请求体限制）。

**方式二：脚本批量上传整个音乐库（推荐首次使用）**

1. 到 Cloudflare 控制台 → **R2 → Manage R2 API Tokens → Create API Token**（权限选 Object Read & Write），拿到 Access Key ID / Secret Access Key，账户 ID 在控制台首页右侧能看到；
2. 运行：

```bash
R2_ACCOUNT_ID=你的账户ID \
R2_ACCESS_KEY_ID=你的AccessKeyID \
R2_SECRET_ACCESS_KEY=你的SecretAccessKey \
npm run upload -- "/Users/xw/Documents/小吴-音乐库"
```

脚本会保留「歌手/专辑」目录结构（目录名会作为歌手/专辑的推断依据），4 路并发上传。传完后打开播放器，它会自动在后台逐首读取标签和封面（每刷新一次页面处理几首，歌多的话耐心等一会儿）。

> 装了 [rclone](https://rclone.org) 的话也可以用 rclone 挂 R2 传，效果一样。

## 本地开发

```bash
npm run dev      # http://localhost:8787
```

本地密码在 `.dev.vars` 里（`PASSWORD=...`），此文件已被 git 忽略，不会进仓库。

## 常用运维

| 操作 | 命令 |
|---|---|
| 改登录账号/密码 | `npx wrangler secret put USERNAME` / `npx wrangler secret put PASSWORD` |
| 看实时日志 | `npx wrangler tail` |
| 绑定自己的域名 | Cloudflare 控制台 → Workers → xw-music → Settings → Domains & Routes |
| 换 Worker / 桶名 | 改 `wrangler.jsonc` 里的 `name` / `bucket_name` |

## 成本

免费额度完全够个人用：

- **Workers Free**：10 万次请求/天（页面 + 播放请求都算）
- **R2 Free**：10 GB 存储 / 每月 100 万次读、1000 万次写，**流量免费**（这是选 R2 而不是 OSS/S3 的核心原因，听歌流量不计费）

超过免费额度的部分价格也极低（R2 存储 $0.015/GB·月）。无损 FLAC 一首 30–50MB，10GB 大约能放 250 首左右；歌多可以开 R2 付费版（5 美元/月 起，含 10GB 后按量计费）或者以后把存储迁到别处（只需换 `wrangler.jsonc` 里的绑定）。

## 说明与已知限制

- 首次扫描大曲库是渐进式的（受免费版 Workers 单请求 CPU 限制），页面保持打开会自动分批完成；
- Safari / iOS 支持 FLAC 播放（iOS 11+）；ogg/opus 在 Safari 上可能无法播放（浏览器解码器限制）；
- 封面大于 2MB 的极端文件会跳过内嵌封面（极少见）；
- 密码修改后，所有已登录会话立即失效（密钥即密码的 HMAC）；
- 本地开发时登录账号密码在 `.dev.vars`（已被 git 忽略）。
