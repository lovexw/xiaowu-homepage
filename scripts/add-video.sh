#!/usr/bin/env bash
# ============================================================
# FitLab 视频一条龙：转码切片 → 生成封面 → 上传 R2 → 输出清单片段
#
# 用法:
#   ./scripts/add-video.sh <本地视频> <R2目录> <视频ID> <标题> [orientation] [--push]
#
# 示例:
#   ./scripts/add-video.sh ~/Movies/pec.mp4 strength pec-deck-fly "蝴蝶机夹胸" vertical
#   ./scripts/add-video.sh ~/walk.mov cardio/treadmill walk-basics-20 "20分钟基础快走" --push
#
# orientation: vertical(竖版9:16，默认，站内一律默认竖屏) | horizontal(横版16:9) | auto(自动检测)
# --push:      上传成功后自动 git commit + push（触发 Cloudflare 自动部署）
#
# 依赖: ffmpeg / wrangler（没有则自动用 npx 拉起）/ git(可选)
# ============================================================
set -euo pipefail

# ---------- 参数解析 ----------
ARGS=("$@")
PUSH=0
POS=()
for a in "${ARGS[@]:-}"; do
  case "$a" in
    --push) PUSH=1 ;;
    *) POS+=("$a") ;;
  esac
done

IN="${POS[0]:-}"; DIR="${POS[1]:-}"; VID="${POS[2]:-}"; TITLE="${POS[3]:-}"; ORIENT="${POS[4]:-vertical}"

if [[ -z "$IN" || -z "$DIR" || -z "$VID" || -z "$TITLE" ]]; then
  grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -20
  echo ""
  echo "❌ 缺少参数。用法: $0 <本地视频> <R2目录> <视频ID> <标题> [vertical|horizontal|auto] [--push]"
  exit 1
fi
[[ -f "$IN" ]] || { echo "❌ 找不到输入视频: $IN"; exit 1; }
[[ "$VID" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "❌ 视频ID只能用小写字母/数字/中划线，如 pec-deck-fly"; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUCKET="${R2_BUCKET:-fitlab-videos}"
OUT="$ROOT/build/$VID"
VDIR="$DIR/$VID"                       # R2 里的完整目录
mkdir -p "$OUT"

# ---------- 依赖 ----------
command -v ffmpeg >/dev/null 2>&1 || { echo "❌ 需要 ffmpeg：brew install ffmpeg"; exit 1; }
if command -v wrangler >/dev/null 2>&1; then WR="wrangler"; else WR="npx -y wrangler"; fi

say()  { printf "\033[1;36m▶ %s\033[0m\n" "$1"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$1"; }
die()  { printf "\033[1;31m✗ %s\033[0m\n" "$1"; exit 1; }

# ---------- 探测时长与方向 ----------
say "读取视频信息…"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
DUR_INT=$(printf "%.0f" "$DUR")
DIM=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$IN" | head -1)
W=${DIM%,*}; H=${DIM#*,}
if [[ "$ORIENT" == "auto" || -z "$ORIENT" ]]; then
  if (( W >= H )); then ORIENT="horizontal"; else ORIENT="vertical"; fi
fi
ok "时长 ${DUR_INT}s · ${W}x${H} · 按 $ORIENT 处理"

# ---------- 1) 转码 + HLS 切片 ----------
say "1/4 转码并切片（H.264 + AAC，6 秒分片，最长边 720/1280）…"
ffmpeg -hide_banner -loglevel error -y -i "$IN" \
  -vf "scale=w='if(gt(iw,ih),1280,720)':h=-2" \
  -c:v libx264 -profile:v main -level 4.1 -pix_fmt yuv420p \
  -crf 23 -preset medium \
  -force_key_frames "expr:gte(t,n_forced*2)" \
  -c:a aac -b:a 128k -ar 44100 -ac 2 \
  -hls_time 6 -hls_playlist_type vod -hls_flags independent_segments \
  -hls_segment_filename "$OUT/seg_%03d.ts" \
  "$OUT/master.m3u8"
ok "切片完成 → $OUT"

# ---------- 2) 封面图（取 10% 处一帧） ----------
say "2/4 生成封面…"
POSTER_AT=$(printf "%.1f" "$(echo "$DUR * 0.1" | bc -l 2>/dev/null || echo 1)")
ffmpeg -hide_banner -loglevel error -y -ss "$POSTER_AT" -i "$IN" -vframes 1 \
  -vf "scale=w='if(gt(iw,ih),960,540)':h=-2" "$OUT/poster.jpg"
ok "封面 → poster.jpg"

# ---------- 3) 上传 R2 ----------
say "3/4 上传到 R2 桶 [$BUCKET] 的 $VDIR/ …"
r2put() { # $1=远端key $2=本地文件 $3=Content-Type
  # 注意：项目目录里有 wrangler.toml 时，wrangler 4.x 默认写"本地模拟桶"，
  # 必须显式 --remote 才真正上传到 R2，因此 --remote 优先。
  if $WR r2 object put "$BUCKET/$1" --file "$2" --content-type "$3" --remote >/dev/null 2>&1; then return 0; fi
  if $WR r2 object put "$BUCKET/$1" --file "$2" >/dev/null 2>&1; then return 0; fi
  return 1
}
N=0
while IFS= read -r f; do
  base="$(basename "$f")"
  ct="application/octet-stream"
  case "$base" in
    *.m3u8) ct="application/vnd.apple.mpegurl" ;;
    *.ts)   ct="video/mp2t" ;;
    *.jpg|*.jpeg) ct="image/jpeg" ;;
    *.png)  ct="image/png" ;;
    *.mp4)  ct="video/mp4" ;;
  esac
  N=$((N+1))
  printf "  [%d] %s\n" "$N" "$base"
  r2put "$VDIR/$base" "$f" "$ct" || die "上传失败: $base（检查 wrangler 登录: npx wrangler login）"
done < <(find "$OUT" -maxdepth 1 -type f | sort)
ok "共上传 $N 个文件"

# ---------- 4) 输出清单片段 ----------
say "4/4 生成 data/videos.json 清单片段…"
SNIPPET=$(cat <<JSON
{
  "id": "$VID",
  "title": "$TITLE",
  "dir": "$VDIR",
  "hls": "master.m3u8",
  "mp4": "",
  "poster": "poster.jpg",
  "orientation": "$ORIENT",
  "duration": $DUR_INT,
  "tags": [],
  "tips": "动作要领（自己补充）",
  "status": "ready"
}
JSON
)
echo "$SNIPPET" > "$OUT/manifest-snippet.json"
echo ""
echo "================= 下一步（手动 30 秒） ================="
echo "1. 打开 data/videos.json，找到科目 [$DIR] 的 videos 数组"
echo "2. 删掉同 ID 的占位条目（如果有），把下面这段加进去："
echo ""
echo "$SNIPPET"
echo ""
echo "3. 提交并推送（或用 npm run deploy 手动部署）:"
# 注意：$TITLE 后紧贴中文全角字符时，旧版 bash(3.2)+C locale 会把多字节字符并入变量名
# 导致 "TITLE: unbound variable"，因此用 printf 以 %s 注入标题。
printf '   git add -A && git commit -m "video: 上传《%s》" && git push\n' "$TITLE"

if [[ "$PUSH" == "1" ]]; then
  say "自动提交并推送…"
  cd "$ROOT"
  git add -A
  COMMIT_MSG=$(printf 'video: 上传《%s》(%s)' "$TITLE" "$VID")
  git commit -m "$COMMIT_MSG" || ok "没有可提交的变更"
  git push && ok "已推送，Cloudflare 正在自动部署"
fi

echo ""
ok "完成！本地文件保留在 $OUT（可删除，已传 R2）"
