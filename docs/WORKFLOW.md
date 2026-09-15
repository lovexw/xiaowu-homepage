# 🎬 视频上传全流程指南（本地 → R2 → 上线）

> 一句话流程：**一条命令切片上传 → 手动加 30 秒清单 → push 自动上线**。
> 进阶玩法全部可选，先跑通基础流程再说。

---

## 0. 一次性准备（只需做一次）

```bash
# 1) 安装 ffmpeg（视频切片工具）
brew install ffmpeg

# 2) 登录 Cloudflare（上传 R2 用）
npx wrangler login

# 3) 创建 R2 存储桶（名字与 wrangler.toml 中的 bucket_name 一致）
npx wrangler r2 bucket create fitlab-videos
```

检查登录状态：`npx wrangler whoami`。

---

## 1. 视频拍法建议（先看这里）

| 项目 | 建议 |
|---|---|
| 方向 | 手机**竖拍 = 竖版 9:16**，横拍 = 横版 16:9，网站两种都完美支持 |
| 时长 | 单个动作 30 秒～3 分钟最佳；长有氧课可以整条传 |
| 文件 | 相机原片直接给脚本即可，脚本会自动压缩到最长边 720/1280 |
| 命名 | 源文件随意，**视频 ID**（如 `pec-deck-fly`）用小写英文+中划线 |

> 压缩参数（CRF 23 + 6 秒分片）兼顾清晰度和流量，手机端秒开。

---

## 2. 一条龙上传（日常 90% 只用这条命令）

```bash
./scripts/add-video.sh <本地视频> <R2目录> <视频ID> "<标题>" [vertical|horizontal|auto] [--push]
```

真实例子——上传「蝴蝶机夹胸」：

```bash
./scripts/add-video.sh ~/Movies/pec-deck.mp4 strength pec-deck-fly "蝴蝶机夹胸" horizontal
```

上传「走步机」竖版视频：

```bash
./scripts/add-video.sh ~/Movies/walk01.mov cardio/treadmill walk-basics-20 "20分钟基础快走" vertical --push
```

脚本会自动完成 4 件事：

1. **转码 + 分片**：H.264/AAC、6 秒 HLS 分片（`master.m3u8 + seg_xxx.ts`）
2. **生成封面**：取视频 10% 处一帧存为 `poster.jpg`
3. **上传 R2**：全部文件传到桶 `fitlab-videos/<R2目录>/<视频ID>/` 下
4. **打印清单片段**：终端输出一段现成的 JSON，还会存到 `build/<视频ID>/manifest-snippet.json`

> 加 `--push` 会在最后自动 `git commit + push`。

### 上传后的目录结构（R2 桶内）

```
fitlab-videos/
├── cardio/treadmill/walk-basics-20/
│   ├── master.m3u8
│   ├── seg_000.ts, seg_001.ts ...
│   └── poster.jpg
├── cardio/swimming/freestyle-kick/...
└── strength/pec-deck-fly/
    ├── master.m3u8
    ├── seg_000.ts ...
    └── poster.jpg
```

---

## 3. 更新清单（代码同步修改，约 30 秒）

打开 **`data/videos.json`**，在对应科目的 `videos` 数组里，把脚本输出的片段粘进去
（并删掉同 ID 的 `"status": "pending"` 占位条目）：

```json
{
  "id": "pec-deck-fly",
  "title": "蝴蝶机夹胸",
  "dir": "strength/pec-deck-fly",     ← R2 目录（脚本已写好）
  "hls": "master.m3u8",               ← m3u8 文件名
  "mp4": "",
  "poster": "poster.jpg",
  "orientation": "horizontal",        ← 竖版改 vertical
  "duration": 95,                     ← 秒数（脚本已算好）
  "tags": ["胸", "中束"],
  "tips": ["动作要领第一条", "第二条"],
  "status": "ready"
}
```

字段速查：

| 字段 | 说明 |
|---|---|
| `dir` | R2 里的目录，前端按 `<cdnBaseUrl>/media/<dir>/<文件>` 取文件 |
| `hls` / `mp4` | 至少填一个；都有时 m3u8 优先（省流量、可拖动快） |
| `orientation` | `vertical`(9:16) / `horizontal`(16:9)，决定封面与播放器比例 |
| `duration` | 秒，卡片角标显示；填 0 则不显示 |
| `tips` | 字符串或字符串数组，显示在播放页「动作要领」卡片 |
| `status` | `ready` 可播放 / `pending` 显示优雅占位卡片 |
| `tags` | 小标签，随意 |

---

## 4. 上线（二选一）

**方式 A：已连 GitHub（推荐）** —— `git push` 后 Cloudflare Pages 自动部署：

```bash
git add -A && git commit -m "video: 上传《蝴蝶机夹胸》" && git push
```

**方式 B：手动部署**（未连 GitHub 时）：

```bash
npm run deploy        # = wrangler pages deploy . --project-name fitlab-videos
```

> 清单 `videos.json` 是跟着代码一起部署的；R2 里的视频文件则独立存在，
> 所以**先传视频、再改清单、最后 push** 即可，顺序反了最多是页面先出现「加载失败」，传完刷新就好。

---

## 5. 本地预览

```bash
npm run demo          # 生成演示视频 + 起本地服务 → http://localhost:8080/?demo=1
npm run dev           # 只起本地服务（看真实清单的占位状态）
```

> 必须走 http 服务，直接双击 index.html 无法 fetch 清单。

**本地联调 R2（进阶）**：让 `/media/` 真正读到本地模拟桶：

```bash
npx wrangler pages dev .                     # 终端 A：带 Functions + 本地 R2 模拟
npx wrangler r2 object put fitlab-videos/strength/pec-deck-fly/master.m3u8 \
  --file build/pec-deck-fly/master.m3u8 --local --persist-to .wrangler/state   # 终端 B
```

（把整个 `build/<id>/` 目录逐个 put 进去即可；嫌麻烦就直接 `npm run deploy` 上线预览。）

---

## 6. 可选：R2 绑自定义域名（绕过代理直连 CDN）

不想走 `/media/` 代理时：Cloudflare 控制台 → R2 → 桶 `fitlab-videos` → Settings →
Public Development URL 或绑定自定义域名（如 `cdn.yourdomain.com`），然后：

1. 给桶配置跨域（仓库里已备好 `r2-cors.json`）：
   `npx wrangler r2 bucket cors set fitlab-videos --file r2-cors.json`
2. `data/videos.json` 里把 `cdnBaseUrl` 填成 `https://cdn.yourdomain.com`
3. 完成。清单里的相对路径会自动拼成 `https://cdn.yourdomain.com/<dir>/<file>`

> 没有自定义域名时**保持 `cdnBaseUrl` 为空**即可（走同域代理，无跨域问题）。

---

## 7. 常见问题

| 现象 | 原因 / 解决 |
|---|---|
| 播放器显示「视频加载失败」 | 检查 `data/videos.json` 的 `dir` 与 R2 实际目录是否一致；浏览器 F12 看 `/media/...` 是否 404 |
| `/media/` 返回 500「R2 绑定未配置」 | Pages 项目设置 → Functions → R2 桶绑定，绑定名必须是 `VIDEO_BUCKET` |
| 手机上进度条拖不动 | 用的是网页缓存旧版 → 强制刷新；仍异常请开 issue 反馈 |
| 视频能放但没声音 | 跟学默认静音自动播放（浏览器策略），点播放器上的 🔊 开声音 |
| 上传报 wrangler 未登录 | `npx wrangler login` |
| 切片很慢 | 把 `-preset medium` 改成 `-preset fast`（体积略增） |
| 想删视频 | 先在 R2 控制台删 `dir` 目录，再删清单里的条目并 push |
