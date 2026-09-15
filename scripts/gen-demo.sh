#!/usr/bin/env bash
# 生成本地演示资源到 .demo/（不进 git）：合成竖版/横版测试视频 + 一份演示清单
# 用法: bash scripts/gen-demo.sh   （需要 ffmpeg）
# 然后访问: http://localhost:8080/?demo=1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.demo"
mkdir -p "$OUT"

command -v ffmpeg >/dev/null 2>&1 || { echo "❌ 需要 ffmpeg：brew install ffmpeg"; exit 1; }

V="$OUT/vertical.mp4"
H="$OUT/horizontal.mp4"

if [[ ! -f "$V" ]]; then
  echo "▶ 生成竖版测试视频 (9:16, 8s)…"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "testsrc2=size=720x1280:rate=30" \
    -f lavfi -i "sine=frequency=440:sample_rate=44100" \
    -t 8 -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 30 \
    -c:a aac -shortest "$V"
fi

if [[ ! -f "$H" ]]; then
  echo "▶ 生成横版测试视频 (16:9, 10s)…"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "smptebars=size=1280x720:rate=30" \
    -f lavfi -i "sine=frequency=330:sample_rate=44100" \
    -t 10 -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 30 \
    -c:a aac -shortest "$H"
fi

if [[ ! -f "$OUT/hls/master.m3u8" ]]; then
  echo "▶ 生成横版 HLS 分片（测试 hls.js 播放路径）…"
  mkdir -p "$OUT/hls"
  ffmpeg -hide_banner -loglevel error -y -i "$H" \
    -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 30 \
    -force_key_frames "expr:gte(t,n_forced*2)" \
    -c:a aac -hls_time 4 -hls_playlist_type vod \
    -hls_segment_filename "$OUT/hls/seg_%03d.ts" "$OUT/hls/master.m3u8"
fi

cat > "$OUT/demo-videos.json" <<'JSON'
{
  "version": 1,
  "cdnBaseUrl": "",
  "groups": [
    { "id": "cardio", "name": "有氧", "nameEn": "CARDIO", "icon": "🔥", "accent": "#ff7a45" },
    { "id": "strength", "name": "力量训练", "nameEn": "STRENGTH", "icon": "💪", "accent": "#7c5cff" }
  ],
  "categories": [
    {
      "id": "treadmill", "groupId": "cardio", "name": "走步机", "icon": "🚶",
      "accent": "#ff9f43", "dir": "cardio/treadmill",
      "description": "演示：竖版 MP4 直连播放",
      "videos": [
        { "id": "demo-vertical", "title": "竖屏演示（MP4 直连）", "dir": "demo",
          "mp4": "/.demo/vertical.mp4", "poster": "", "orientation": "vertical",
          "duration": 8, "tags": ["演示"], "tips": "这是本地生成的测试画面，用来验证播放器：双击左右可快退/快进 10 秒，长按可 2 倍速。", "status": "ready" },
        { "id": "demo-pending", "title": "占位示例（未上传）", "dir": "demo/pending",
          "hls": "", "poster": "", "orientation": "vertical", "duration": 0,
          "tags": ["占位"], "tips": "status=pending 时前端会显示优雅的「整理中」占位。", "status": "pending" }
      ]
    },
    {
      "id": "swimming", "groupId": "cardio", "name": "游泳", "icon": "🏊",
      "accent": "#2f9bff", "dir": "cardio/swimming",
      "description": "演示科目",
      "videos": [
        { "id": "demo-pending-swim", "title": "占位示例（未上传）", "dir": "demo/pending",
          "hls": "", "poster": "", "orientation": "vertical", "duration": 0,
          "tags": ["占位"], "tips": "", "status": "pending" }
      ]
    },
    {
      "id": "strength", "groupId": "strength", "name": "力量训练", "icon": "🏋️",
      "accent": "#ff4d6d", "dir": "strength",
      "description": "演示：横版 HLS 分片播放",
      "videos": [
        { "id": "demo-hls", "title": "横屏演示（HLS 分片）", "dir": "demo",
          "hls": "/.demo/hls/master.m3u8", "poster": "", "orientation": "horizontal",
          "duration": 10, "tags": ["演示", "HLS"], "tips": ["这条走的是 hls.js 分片加载路径，进度条可以随意拖动。", "手机竖拍视频是 9:16 竖版，相机横拍是 16:9 横版，播放器都会自动适配。"], "status": "ready" }
      ]
    }
  ]
}
JSON

echo "✓ 演示资源就绪 → 启动: npm run demo  然后打开 http://localhost:8080/?demo=1"
